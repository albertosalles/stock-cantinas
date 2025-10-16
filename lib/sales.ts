import { supabase } from '@/lib/supabaseClient';

/**
 * Genera un UUID v4 compatible con todos los navegadores
 * Fallback para navegadores que no soportan crypto.randomUUID()
 */
function generateUUID(): string {
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

export async function createSale(
    eventId: string,
    cantinaId: string,
    userId: string,
    lines: {productId: string, qty: number}[]
) {
  const { data, error } = await supabase.rpc('create_sale', {
    p_event_id: eventId,
    p_cantina_id: cantinaId,
    p_user_id: userId,
    p_lines: lines,
    p_client_request_id: generateUUID()
  });
  if (error) throw error;
  return data;
}
