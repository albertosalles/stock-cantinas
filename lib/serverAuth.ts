import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/authToken';

// ─────────────────────────────────────────────────────────────────────────────
// Guarda de administrador para rutas de servidor.
//
// Comprueba la cookie httpOnly, no lo que diga el cuerpo de la petición ni una
// cabecera que el cliente controle. Es la misma regla que gobierna toda F2: la
// identidad se deriva de algo firmado, no se recibe por parámetro.
// ─────────────────────────────────────────────────────────────────────────────

export async function esAdmin(): Promise<boolean> {
  const cookie = (await cookies()).get('sc_admin')?.value;
  const claims = verifyAccessToken(cookie);
  return claims?.app_role === 'admin';
}
