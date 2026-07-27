import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeInvalidate } from '@/hooks/useEventRealtime';

export interface WaiterPerformance {
  waiter_id: string;
  waiter_name: string;
  hours: number;
  num_sales: number;
  total_cents: number;
  total_items: number;
  is_active: boolean;
  cantinas: string;
}

/**
 * Rendimiento por camarero. Si se pasa cantinaId, se limita a esa cantina.
 */
export function useWaiterPerformance(eventId: string | undefined, cantinaId?: string) {
  const key = ['waiter_performance', eventId, cantinaId ?? 'all'];

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: key,
    enabled: !!eventId,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_event_waiter_performance', {
        p_event_id: eventId,
        p_cantina_id: cantinaId ?? null,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map(r => ({
        ...r,
        hours: Number(r.hours ?? 0),
      })) as WaiterPerformance[];
    },
  });

  // Las ventas nuevas mueven el rendimiento del camarero.
  useRealtimeInvalidate(eventId, undefined, ['stock_movements'], key);

  return { waiters: data, loading: isLoading, refresh: refetch };
}
