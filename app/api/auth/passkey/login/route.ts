import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  signAccessToken, TTL_POS_SEGUNDOS, TTL_ADMIN_SEGUNDOS,
} from '@/lib/authToken';
import { rpID, origen, COOKIE_RETO, firmarReto, leerReto } from '@/lib/webauthn';

// ─────────────────────────────────────────────────────────────────────────────
// ENTRAR CON PASSKEY
//
// La credencial es descubrible (`residentKey: required`), así que no hace falta
// decir antes quién eres: el dispositivo ofrece las passkeys que tiene y el
// servidor deduce el sujeto de la que se use.
//
// EL CAMARERO ENTRA A SU TURNO ABIERTO, no a una barra cualquiera. Una passkey
// acredita quién eres, no dónde estás; el PIN o el QR de la cantina acreditan
// lo segundo, y son cosas distintas. Si la passkey sola abriera caja, bastaría
// el móvil del camarero para vender desde fuera del estadio.
//
// Con turno abierto, el evento y la cantina salen del propio turno: es el admin
// quien lo asignó, así que la barra no la elige el navegador. Sin turno abierto
// se devuelve 409 y el camarero pasa por el flujo completo, que es donde se
// comprueba la cantina.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const db = supabaseAdmin();
  const tarro = await cookies();

  let cuerpo: { paso?: string; respuesta?: any };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición mal formada' }, { status: 400 });
  }

  // ─── Paso 1: opciones ───
  if (cuerpo.paso === 'opciones') {
    const opciones = await generateAuthenticationOptions({
      rpID: rpID(request),
      userVerification: 'required',
      // Sin allowCredentials: el dispositivo enseña las suyas. Además de ser
      // más cómodo, evita que la respuesta revele qué credenciales existen.
    });

    tarro.set(COOKIE_RETO, firmarReto({ reto: opciones.challenge, proposito: 'login' }), {
      httpOnly: true, sameSite: 'lax', path: '/',
      secure: process.env.NODE_ENV === 'production', maxAge: 300,
    });

    return NextResponse.json({ opciones });
  }

  // ─── Paso 2: verificar ───
  if (cuerpo.paso !== 'verificar') {
    return NextResponse.json({ error: 'Paso desconocido' }, { status: 400 });
  }

  const reto = leerReto(tarro.get(COOKIE_RETO)?.value);
  if (!reto || reto.proposito !== 'login') {
    return NextResponse.json({ error: 'El acceso ha caducado. Inténtalo otra vez.' }, { status: 400 });
  }

  try {
    const idCredencial = cuerpo.respuesta?.id;
    const { data: cred } = await db
      .from('webauthn_credentials')
      .select('*')
      .eq('credential_id', idCredencial)
      .maybeSingle();

    if (!cred) {
      return NextResponse.json({ error: 'Este dispositivo no está registrado' }, { status: 401 });
    }

    const resultado = await verifyAuthenticationResponse({
      response: cuerpo.respuesta,
      expectedChallenge: reto.reto,
      expectedOrigin: origen(request),
      expectedRPID: rpID(request),
      requireUserVerification: true,
      credential: {
        id: cred.credential_id as string,
        publicKey: new Uint8Array(Buffer.from(cred.public_key as string, 'base64url')),
        counter: Number(cred.counter),
        transports: (cred.transports as any) ?? undefined,
      },
    });

    if (!resultado.verified) {
      return NextResponse.json({ error: 'No se pudo verificar el acceso' }, { status: 401 });
    }

    // Un contador que retrocede delata una credencial clonada. Muchos
    // autenticadores de plataforma lo dejan siempre a 0; sólo se comprueba
    // cuando de verdad lo mueven.
    const nuevo = resultado.authenticationInfo.newCounter;
    if (Number(cred.counter) > 0 && nuevo > 0 && nuevo <= Number(cred.counter)) {
      return NextResponse.json({ error: 'Credencial no válida' }, { status: 401 });
    }

    await db.from('webauthn_credentials')
      .update({ counter: nuevo, last_used_at: new Date().toISOString() })
      .eq('id', cred.id);

    tarro.delete(COOKIE_RETO);

    // ─── Administración ───
    if (cred.subject_type === 'admin') {
      const { token, expiraEn } = signAccessToken(
        { app_role: 'admin', sub: 'admin' }, TTL_ADMIN_SEGUNDOS);
      tarro.set('sc_admin', token, {
        httpOnly: true, sameSite: 'lax', path: '/',
        secure: process.env.NODE_ENV === 'production', maxAge: TTL_ADMIN_SEGUNDOS,
      });
      return NextResponse.json({ rol: 'admin', token, expiraEn });
    }

    // ─── Camarero: sólo con turno abierto ───
    const { data: turno } = await db
      .from('shifts')
      .select('id, event_id, cantina_id, events(name, status), cantinas(name)')
      .eq('waiter_id', cred.waiter_id)
      .is('ended_at', null)
      .maybeSingle();

    if (!turno || (turno.events as any)?.status !== 'live') {
      return NextResponse.json({
        error: 'No tienes ningún turno abierto. Entra con el QR o el PIN de la cantina.',
      }, { status: 409 });
    }

    const { data: camarero } = await db
      .from('waiters').select('name, surname').eq('id', cred.waiter_id).maybeSingle();
    const nombre = camarero ? `${camarero.name} ${camarero.surname ?? ''}`.trim() : 'Camarero';

    const { token, expiraEn } = signAccessToken({
      app_role: 'pos',
      sub: cred.waiter_id as string,
      event_id: turno.event_id as string,
      cantina_id: turno.cantina_id as string,
      waiter_id: cred.waiter_id as string,
    }, TTL_POS_SEGUNDOS);

    return NextResponse.json({
      rol: 'pos',
      token,
      expiraEn,
      sesion: {
        eventId: turno.event_id,
        eventName: (turno.events as any)?.name,
        cantinaId: turno.cantina_id,
        cantinaName: (turno.cantinas as any)?.name,
        waiterId: cred.waiter_id,
        waiterName: nombre,
        shiftId: turno.id,
        loginTime: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('passkey/login:', e);
    return NextResponse.json({ error: 'No se pudo completar el acceso' }, { status: 401 });
  }
}
