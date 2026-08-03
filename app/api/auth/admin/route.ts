import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signAccessToken, verifyAccessToken, TTL_ADMIN_SEGUNDOS } from '@/lib/authToken';

// ─────────────────────────────────────────────────────────────────────────────
// SESIÓN DE ADMINISTRADOR
//
// Hasta ahora era `sessionStorage.setItem('admin_authenticated','true')`, que
// cualquiera podía fijar desde la consola. Daba igual, en realidad: la barrera
// no era esa, era que la clave `anon` abría la base entera sin pasar por la
// interfaz. Con RLS por delante, la sesión sí pasa a significar algo.
//
// Dos piezas con papeles distintos:
//   · COOKIE httpOnly: prueba de que esta persona se autenticó. El JavaScript
//     de la página no la lee, así que no se puede fabricar desde la consola.
//     Sirve para volver a emitir el token tras una recarga.
//   · TOKEN en el cuerpo: lo necesita el navegador porque es supabase-js quien
//     lo manda en cada petición. No puede ser httpOnly; su defensa es que
//     caduca y que sólo abre lo que su rol permite.
//
// De regalo arregla una molestia de F1: la sesión se perdía al recrearse la
// pestaña, porque `sessionStorage` es por pestaña. La cookie sobrevive.
// ─────────────────────────────────────────────────────────────────────────────

const COOKIE = 'sc_admin';

function emitir() {
  return signAccessToken({ app_role: 'admin', sub: 'admin' }, TTL_ADMIN_SEGUNDOS);
}

export async function POST(request: Request) {
  let password: string | undefined;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Petición mal formada' }, { status: 400 });
  }

  const esperada = process.env.ADMIN_PASSWORD;
  if (!esperada) {
    return NextResponse.json(
      { error: 'Contraseña de administrador no configurada en el servidor' },
      { status: 500 },
    );
  }

  if (password !== esperada) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const { token, expiraEn } = emitir();

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_ADMIN_SEGUNDOS,
  });

  return NextResponse.json({ success: true, token, expiraEn });
}

/** Rehidrata la sesión tras una recarga: la cookie sigue ahí, el token no. */
export async function GET() {
  const cookie = (await cookies()).get(COOKIE)?.value;
  const claims = verifyAccessToken(cookie);

  if (!claims || claims.app_role !== 'admin') {
    return NextResponse.json({ autenticado: false }, { status: 401 });
  }

  // Se devuelve la cookie tal cual en vez de firmar uno nuevo: así la sesión
  // caduca cuando toca y no se renueva sola indefinidamente.
  return NextResponse.json({ autenticado: true, token: cookie, expiraEn: claims.exp });
}

export async function DELETE() {
  (await cookies()).delete(COOKIE);
  return NextResponse.json({ success: true });
}
