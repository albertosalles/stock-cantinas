import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE DE SERVICIO · SÓLO DE SERVIDOR (S2)
//
// `service_role` se salta RLS y todos los privilegios, así que su uso está
// acotado a propósito. El ADR lo dice: no es una puerta trasera generalizada
// para escrituras, sino la llave de dos cosas concretas:
//
//   1. Validar credenciales y firmar el token, en las rutas de login. El
//      cliente no puede hacerlo porque las funciones de credenciales están
//      revocadas a `anon` y `authenticated`.
//   2. Operaciones de administración que tocan esas mismas credenciales
//      (fijar el PIN de una cantina o de un camarero).
//
// Todo lo demás —lecturas y escrituras de datos— pasa por el token del usuario
// y por RLS, que es donde tienen que estar los límites.
//
// Si este módulo acaba importado desde un componente de cliente, el build de
// Next fallará al no encontrar la variable, que no lleva prefijo NEXT_PUBLIC_.
// Es deliberado: mejor romper el build que filtrar la llave maestra.
// ─────────────────────────────────────────────────────────────────────────────

let cliente: SupabaseClient | null = null;

export function supabaseAdmin() {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL');
  if (!clave) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY. Sin ella las rutas de login no pueden ' +
      'validar credenciales, porque esas funciones están revocadas a anon.',
    );
  }

  cliente = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}
