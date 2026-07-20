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

// ─── RPCs ───

/** Resuelve el QR de una cantina → cantina + evento en vivo. null si no hay evento live. */
export async function resolveCantinaQr(qrToken: string): Promise<CantinaAccess | null> {
  const { data, error } = await supabase.rpc('resolve_cantina_qr', { p_qr_token: qrToken });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    cantinaId: row.cantina_id,
    cantinaName: row.cantina_name,
    eventId: row.event_id,
    eventName: row.event_name,
  };
}

/** Identifica a un camarero por su QR personal o su PIN. null si no existe o está inactivo. */
export async function identifyWaiter(opts: { qrToken?: string; pin?: string }): Promise<WaiterIdentity | null> {
  const { data, error } = await supabase.rpc('identify_waiter', {
    p_qr_token: opts.qrToken ?? null,
    p_pin: opts.pin ?? null,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { waiterId: row.waiter_id, waiterName: row.waiter_name };
}

/** Abre turno (cierra el anterior si estaba en otra cantina). Devuelve el id del turno. */
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
