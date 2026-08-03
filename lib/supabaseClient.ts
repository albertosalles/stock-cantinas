import { createClient } from '@supabase/supabase-js';
import { getAccessToken, onAccessTokenChange } from '@/lib/session';

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * En desarrollo, la URL de Supabase apunta a 127.0.0.1, que se hornea en el
 * bundle. Si la app se abre desde otro dispositivo de la red —el móvil, por la
 * IP del ordenador—, ese 127.0.0.1 es el propio móvil y no hay nada ahí: la
 * pantalla de login dice «no se pudieron cargar los eventos activos».
 *
 * Se resuelve tomando el host por el que se ha llegado. Sólo en desarrollo y
 * sólo cuando la URL configurada es local: en producción no se toca nada, que
 * sería reescribir a dónde va la aplicación en función de la barra de
 * direcciones.
 */
function urlSupabase(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return base;

  const u = new global.URL(base);
  const esLocal = u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  if (!esLocal || window.location.hostname === u.hostname) return base;

  u.hostname = window.location.hostname;
  return u.toString().replace(/\/$/, '');
}

const URL = urlSupabase();

// ─────────────────────────────────────────────────────────────────────────────
// Desde S2 el cliente viaja con el token que emitió la ruta de login, no con la
// clave `anon` pelada. Ese token es lo que permitirá a las políticas RLS saber
// quién pregunta, y a Realtime entregar sólo lo de la cantina que toca.
//
// Sin sesión se sigue mandando `anon`, que es lo correcto: el catálogo del
// evento en curso es público y la pantalla de login tiene que poder cargarlo.
//
// DOS CAMINOS DISTINTOS, y hay que alimentar los dos:
//   · PostgREST lo toma de `accessToken`, que se consulta en CADA petición.
//     Verificado interceptando la cabecera saliente: va el token nuestro, con
//     su app_role y su cantina_id, no el anon.
//   · Realtime NO usa esa opción. Con ella el canal llega a SUBSCRIBED pero no
//     entrega nada, y una prueba de aislamiento pasaría en verde sin haber
//     medido nada — es el falso verde que costó una vuelta en S1. Hay que
//     llamar a `realtime.setAuth()` a mano, y repetirlo en cada cambio.
// ─────────────────────────────────────────────────────────────────────────────

export const supabase = createClient(URL, ANON, {
  accessToken: async () => getAccessToken() ?? ANON,
});

if (typeof window !== 'undefined') {
  supabase.realtime.setAuth(getAccessToken() ?? ANON);
  onAccessTokenChange((token) => supabase.realtime.setAuth(token ?? ANON));
}
