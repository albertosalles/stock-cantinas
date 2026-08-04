import { supabase } from '@/lib/supabaseClient';

// ─── Tipos ───
export type CantinaAccess = {
  cantinaId: string;
  cantinaName: string;
  eventId: string;
  eventName: string;
};

export type WaiterIdentity = {
  waiterId: string;
  waiterName: string;
};

// ─── Contenido de los QR ───
// Los QR generados por la app llevan prefijo para poder distinguirlos
// ("sc-cantina:<uuid>" en el cartel de la cantina, "sc-waiter:<uuid>" en la
// acreditación del camarero). Se acepta también un uuid pelado por robustez.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CANTINA_QR_PREFIX = 'sc-cantina:';
export const WAITER_QR_PREFIX = 'sc-waiter:';

export function parseQr(text: string): { kind: 'cantina' | 'waiter' | 'unknown'; token: string } {
  const t = text.trim();
  if (t.toLowerCase().startsWith(CANTINA_QR_PREFIX)) {
    const token = t.slice(CANTINA_QR_PREFIX.length);
    return { kind: UUID_RE.test(token) ? 'cantina' : 'unknown', token };
  }
  if (t.toLowerCase().startsWith(WAITER_QR_PREFIX)) {
    const token = t.slice(WAITER_QR_PREFIX.length);
    return { kind: UUID_RE.test(token) ? 'waiter' : 'unknown', token };
  }
  // uuid pelado: el contexto (paso del login) decide cómo interpretarlo
  if (UUID_RE.test(t)) return { kind: 'unknown', token: t };
  return { kind: 'unknown', token: '' };
}

// ─── Acceso ───
// Desde S2 el login NO habla con la base de datos: las funciones de
// credenciales están revocadas a `anon` y `authenticated`, y quien las ejecuta
// es `service_role` desde las rutas de servidor. El navegador ya no puede
// preguntarle a Postgres si un PIN es correcto, que era justo el problema.

/** Vale de diez minutos que acredita la cantina. Sólo sirve para el paso 2. */
export type CantinaGrant = { acceso: CantinaAccess; vale: string };

/** Sesión completa devuelta al identificarse el camarero. */
export type PosSession = {
  eventId: string; eventName: string;
  cantinaId: string; cantinaName: string;
  waiterId: string; waiterName: string;
  shiftId: string; loginTime: string;
};

async function postJson<T>(url: string, cuerpo: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error ?? 'Error de acceso');
  return datos as T;
}

/** Paso 1 por QR del cartel de la barra. null si el QR no vale o no hay evento en vivo. */
export async function resolveCantinaQr(qrToken: string): Promise<CantinaGrant | null> {
  try {
    return await postJson<CantinaGrant>('/api/auth/cantina', { qrToken });
  } catch (e) {
    if (e instanceof Error && e.message.includes('QR no válido')) return null;
    throw e;
  }
}

/** Paso 1 por evento + cantina + PIN. */
export async function validateCantinaPin(
  eventId: string, cantinaId: string, pin: string,
): Promise<CantinaGrant> {
  return postJson<CantinaGrant>('/api/auth/cantina', { eventId, cantinaId, pin });
}

/**
 * Paso 2: identifica a la persona y devuelve el token de acceso más la sesión.
 * La cantina y el evento salen del vale, NO de lo que mande el navegador.
 */
export async function startPosSession(opts: {
  vale: string; qrToken?: string; pin?: string; waiterId?: string;
}): Promise<{ token: string; sesion: PosSession }> {
  return postJson<{ token: string; sesion: PosSession }>('/api/auth/waiter', opts);
}

/**
 * Abre turno (cierra el anterior si estaba en otra cantina). Devuelve su id.
 *
 * El TPV ya NO llama aquí: su turno lo abre el servidor al emitir el token, en
 * la misma operación, para que no quede un token sin turno si algo falla por el
 * camino. Esto lo usa el admin al asignar camareros a una barra desde el panel.
 */
export async function openShift(waiterId: string, eventId: string, cantinaId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_shift', {
    p_waiter_id: waiterId,
    p_event_id: eventId,
    p_cantina_id: cantinaId,
  });
  if (error) throw error;
  return data as string;
}

/** Cierra turno imputando horas (idempotente, best-effort desde el cliente). */
export async function closeShift(shiftId: string): Promise<void> {
  const { error } = await supabase.rpc('close_shift', { p_shift_id: shiftId });
  if (error) throw error;
}
