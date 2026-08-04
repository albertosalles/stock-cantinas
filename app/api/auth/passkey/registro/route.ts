import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { esAdmin } from '@/lib/serverAuth';
import { verifyAccessToken } from '@/lib/authToken';
import { rpID, origen, NOMBRE_APP, COOKIE_RETO, firmarReto, leerReto } from '@/lib/webauthn';

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRAR UNA PASSKEY
//
// Sólo se puede registrar desde una sesión YA AUTENTICADA. Es la regla que
// sostiene todo lo demás: la passkey no crea identidad, hereda la que ya se
// demostró con el PIN, el QR o la contraseña. Si se pudiera registrar sin
// sesión, cualquiera se daría de alta como camarero.
// ─────────────────────────────────────────────────────────────────────────────

/** Quién está pidiendo registrar, deducido de la sesión en curso. */
async function sujeto(request: Request): Promise<
  { tipo: 'admin'; id: string; nombre: string } |
  { tipo: 'waiter'; id: string; nombre: string } |
  null
> {
  if (await esAdmin()) return { tipo: 'admin', id: 'admin', nombre: 'Administración' };

  const cabecera = request.headers.get('authorization') ?? '';
  const claims = verifyAccessToken(cabecera.replace(/^Bearer /, ''));
  if (claims?.app_role === 'pos' && claims.waiter_id) {
    const { data } = await supabaseAdmin()
      .from('waiters').select('name, surname').eq('id', claims.waiter_id).maybeSingle();
    const nombre = data ? `${data.name} ${data.surname ?? ''}`.trim() : 'Camarero';
    return { tipo: 'waiter', id: claims.waiter_id, nombre };
  }
  return null;
}

export async function POST(request: Request) {
  const quien = await sujeto(request);
  if (!quien) {
    return NextResponse.json(
      { error: 'Hay que haber iniciado sesión para registrar el acceso biométrico' },
      { status: 401 },
    );
  }

  const db = supabaseAdmin();
  const tarro = await cookies();

  let cuerpo: { paso?: string; respuesta?: unknown; etiqueta?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición mal formada' }, { status: 400 });
  }

  // ─── Paso 1: opciones ───
  if (cuerpo.paso === 'opciones') {
    // Las ya registradas se excluyen para que el sistema operativo no ofrezca
    // crear una segunda passkey del mismo dispositivo.
    const { data: existentes } = await db
      .from('webauthn_credentials')
      .select('credential_id, transports')
      .eq('subject_type', quien.tipo)
      .eq(quien.tipo === 'waiter' ? 'waiter_id' : 'subject_type',
          quien.tipo === 'waiter' ? quien.id : 'admin');

    const opciones = await generateRegistrationOptions({
      rpName: NOMBRE_APP,
      rpID: rpID(request),
      userName: quien.nombre,
      userID: new TextEncoder().encode(`${quien.tipo}:${quien.id}`),
      userDisplayName: quien.nombre,
      attestationType: 'none',
      excludeCredentials: (existentes ?? []).map((c: any) => ({
        id: c.credential_id,
        transports: c.transports ?? undefined,
      })),
      authenticatorSelection: {
        // Autenticador del propio dispositivo (FaceID, huella), no una llave
        // externa: la idea es que el camarero entre con su móvil, no que
        // tenga que llevar un llavero encima.
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
    });

    tarro.set(COOKIE_RETO, firmarReto({
      reto: opciones.challenge,
      proposito: 'registro',
      sujeto: `${quien.tipo}:${quien.id}`,
    }), {
      httpOnly: true, sameSite: 'lax', path: '/',
      secure: process.env.NODE_ENV === 'production', maxAge: 300,
    });

    return NextResponse.json({ opciones });
  }

  // ─── Paso 2: verificar ───
  if (cuerpo.paso === 'verificar') {
    const reto = leerReto(tarro.get(COOKIE_RETO)?.value);
    if (!reto || reto.proposito !== 'registro' || reto.sujeto !== `${quien.tipo}:${quien.id}`) {
      return NextResponse.json({ error: 'El registro ha caducado. Inténtalo otra vez.' }, { status: 400 });
    }

    try {
      const resultado = await verifyRegistrationResponse({
        response: cuerpo.respuesta as any,
        expectedChallenge: reto.reto,
        expectedOrigin: origen(request),
        expectedRPID: rpID(request),
        requireUserVerification: true,
      });

      if (!resultado.verified || !resultado.registrationInfo) {
        return NextResponse.json({ error: 'No se pudo verificar el registro' }, { status: 400 });
      }

      const { credential } = resultado.registrationInfo;

      const { error } = await db.from('webauthn_credentials').insert({
        subject_type: quien.tipo,
        waiter_id: quien.tipo === 'waiter' ? quien.id : null,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports ?? null,
        label: cuerpo.etiqueta ?? null,
      });
      if (error) throw error;

      tarro.delete(COOKIE_RETO);
      return NextResponse.json({ success: true });
    } catch (e) {
      console.error('passkey/registro:', e);
      const mensaje = e instanceof Error ? e.message : 'No se pudo registrar';
      return NextResponse.json({ error: mensaje }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'Paso desconocido' }, { status: 400 });
}
