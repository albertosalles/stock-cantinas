import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface HourBucket {
  /** Etiqueta del eje ("20h"). */
  hora: string;
  /** Recaudación de esa hora, en céntimos. */
  totalCents: number;
  /** Tickets emitidos en esa hora. */
  numSales: number;
}

/**
 * Reparte las ventas del evento por hora natural para el gráfico del dashboard.
 * Sólo cuenta ventas en estado OK (las anuladas no computan).
 */
export function useSalesByHour(eventId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ['sales_by_hour', eventId];

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: key,
    enabled: !!eventId,
    refetchInterval: 60000,
    queryFn: async (): Promise<HourBucket[]> => {
      const { data, error } = await supabase
        .from('sales')
        .select('created_at, total_cents')
        .eq('event_id', eventId)
        .eq('status', 'OK')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const buckets = new Map<number, HourBucket>();
      (data ?? []).forEach((s: any) => {
        if (!s.created_at) return;
        const h = new Date(s.created_at).getHours();
        const b = buckets.get(h) ?? { hora: `${h}h`, totalCents: 0, numSales: 0 };
        b.totalCents += s.total_cents ?? 0;
        b.numSales += 1;
        buckets.set(h, b);
      });

      return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
    },
  });

  // Cada venta nueva mueve el gráfico
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`sales-hour-${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'sales', filter: `event_id=eq.${eventId}`,
      }, () => queryClient.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, queryClient]);

  return { buckets: data, loading: isLoading, refresh: refetch };
}
