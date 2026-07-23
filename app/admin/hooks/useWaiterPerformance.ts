import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

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
  const queryClient = useQueryClient();
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

  // Las ventas nuevas mueven el rendimiento → refrescar en tiempo real
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`waiter-perf-${eventId}-${cantinaId ?? 'all'}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'stock_movements', filter: `event_id=eq.${eventId}`,
      }, () => queryClient.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, cantinaId, queryClient]);

  return { waiters: data, loading: isLoading, refresh: refetch };
}
