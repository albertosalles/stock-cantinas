import { createClient } from '@supabase/supabase-js';
import { getAccessToken, onAccessTokenChange } from '@/lib/session';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
