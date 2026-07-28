import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeInvalidate } from '@/hooks/useEventRealtime';

/** Fases de un partido, en el orden en que ocurren. */
export type FasePartido = 'Previa' | '1ª parte' | 'Descanso' | '2ª parte' | 'Final';

export interface SlotVentas {
  /** Hora de comienzo del tramo, ya formateada en Europe/Madrid ("19:45"). */
  etiqueta: string;
  /** Minutos respecto al pitido inicial. Negativo antes de empezar. */
  minuto: number;
  fase: FasePartido;
  totalCents: number;
  numSales: number;
}

/** Granularidades ofrecidas. 15 min es el equilibrio por defecto. */
export const TRAMOS_DISPONIBLES = [10, 15, 30] as const;
export type Tramo = (typeof TRAMOS_DISPONIBLES)[number];

/**
 * Reparte las ventas del evento en tramos relativos al pitido inicial.
 *
 * Sustituye al reparto por hora natural, que para un partido decía poco: lo
 * relevante no es "las 20 h" sino "veinte minutos antes de empezar" o "el
 * descanso". La ventana va de la apertura de puertas al final más un margen, y
 * las ventas fuera de ella no se cuentan.
 *
 * Devuelve `sinKickoff: true` cuando el evento no tiene hora de inicio definida,
 * que es lo que permite a la interfaz pedirla en lugar de mostrar un hueco.
 */
export function useSalesBySlot(eventId: string | undefined, tramo: Tramo = 15) {
  const key = ['sales_by_slot', eventId, tramo];

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: key,
    enabled: !!eventId,
    refetchInterval: 60000,
    queryFn: async (): Promise<SlotVentas[]> => {
      const { data, error } = await supabase.rpc('get_sales_by_slot', {
        p_event_id: eventId,
        p_slot_minutes: tramo,
      });
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        etiqueta: row.etiqueta,
        minuto: row.minuto_relativo,
        fase: row.fase as FasePartido,
        totalCents: row.total_cents ?? 0,
        numSales: row.num_sales ?? 0,
      }));
    },
  });

  useRealtimeInvalidate(eventId, undefined, ['stock_movements'], key);

  return {
    slots: data,
    // El RPC devuelve la rejilla completa aunque esté vacía de ventas; que no
    // devuelva NADA sólo ocurre si falta `kickoff_at`.
    sinKickoff: !isLoading && data.length === 0,
    loading: isLoading,
    refresh: refetch,
  };
}
