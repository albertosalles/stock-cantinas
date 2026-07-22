import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface CantinaOverview {
  cantina_id: string;
  cantina_name: string;
  total_cents: number;
  num_sales: number;
  active_waiters: number;
  pending_incidents: number;
  low_stock_count: number;
}

export function useCantinasOverview(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['cantinas_overview', eventId],
    enabled: !!eventId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_event_cantinas_overview', { p_event_id: eventId });
      if (error) throw error;
      return (data ?? []) as CantinaOverview[];
    },
  });

  // Realtime: ventas/ajustes e incidencias refrescan el grid
  useEffect(() => {
    if (!eventId) return;
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cantinas_overview', eventId] });
    const channel = supabase
      .channel(`cantinas-overview-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: `event_id=eq.${eventId}` }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, queryClient]);

  return { cantinas: data, loading: isLoading, refresh: refetch };
}
