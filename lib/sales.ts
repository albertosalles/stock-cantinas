import { supabase } from '@/lib/supabaseClient';

/**
 * Genera un UUID v4 compatible con todos los navegadores.
 * Fallback para navegadores que no soportan crypto.randomUUID().
 */
export function generateUUID(): string {
  // Intenta usar crypto.randomUUID() si está disponible
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Falla silenciosamente y usa el fallback
    }
  }

  // Fallback: genera UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface CreateSaleOptions {
  /**
   * Clave de idempotencia. DEBE generarse una sola vez por venta y reutilizarse
   * en cada reintento (p. ej. al sincronizar la cola offline). Si no se pasa,
   * se genera una nueva (solo válido para intentos online de un único disparo).
   */
  clientRequestId?: string;
  /**
   * true para ventas offline ya consumadas físicamente: se registran aunque
   * dejen el stock en negativo (el negativo es la señal de descuadre a conciliar).
   * false (por defecto) para ventas online: se rechazan si no hay stock.
   */
  allowOversell?: boolean;
}

export async function createSale(
    eventId: string,
    cantinaId: string,
    userId: string,
    lines: {productId: string, qty: number}[],
    options: CreateSaleOptions = {}
) {
  const { data, error } = await supabase.rpc('create_sale', {
    p_event_id: eventId,
    p_cantina_id: cantinaId,
    p_user_id: userId,
    p_lines: lines,
    p_client_request_id: options.clientRequestId ?? generateUUID(),
    p_allow_oversell: options.allowOversell ?? false,
  });
  if (error) throw error;
  return data;
}

/**
 * Distingue un fallo de red (hay que encolar la venta y reintentar más tarde)
 * de un error de negocio devuelto por el servidor (stock insuficiente, producto
 * inactivo…), que NO debe encolarse porque el servidor la rechazó a propósito.
 */
export function isNetworkError(error: any): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!error) return false;
  // Errores de negocio de PostgREST/PostgreSQL traen un `code` (p. ej. P0001).
  if (error.code && String(error.code).trim() !== '') return false;
  const msg = String(error.message ?? error).toLowerCase();
  return (
    error.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch')
  );
}
