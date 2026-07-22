import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface EventDashboard {
  total_cents: number;
  num_sales: number;
  total_items: number;
  star_product: string | null;
  star_units: number;
  active_waiters: number;
  num_cantinas: number;
  active_cantinas: number;
}

export interface CantinaRanking {
  cantinaId: string;
  name: string;
  totalCents: number;
  numSales: number;
}

const EMPTY: EventDashboard = {
  total_cents: 0, num_sales: 0, total_items: 0, star_product: null,
  star_units: 0, active_waiters: 0, num_cantinas: 0, active_cantinas: 0,
};

export function useEventDashboard(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['event_dashboard', eventId],
    enabled: !!eventId,
    refetchInterval: 30000, // "live": refresco periódico además del Realtime
    queryFn: async () => {
      // KPIs de cabecera (RPC agregado) + ranking de cantinas por facturación
      const [kpiRes, rankRes] = await Promise.all([
        supabase.rpc('get_event_dashboard', { p_event_id: eventId }),
        supabase.from('v_sales_by_cantina')
          .select('cantina_id, total_cents, num_sales')
          .eq('event_id', eventId),
      ]);

      if (kpiRes.error) throw kpiRes.error;
      const kpis: EventDashboard = kpiRes.data?.[0] ?? EMPTY;

      // Enriquecer ranking con nombres de cantina
      const rows = rankRes.data ?? [];
      let ranking: CantinaRanking[] = [];
      if (rows.length) {
        const ids = rows.map((r: any) => r.cantina_id);
        const { data: cants } = await supabase.from('cantinas').select('id, name').in('id', ids);
        const nameMap = new Map((cants ?? []).map((c: any) => [c.id, c.name]));
        ranking = rows
          .map((r: any) => ({
            cantinaId: r.cantina_id,
            name: nameMap.get(r.cantina_id) ?? 'Cantina',
            totalCents: r.total_cents ?? 0,
            numSales: r.num_sales ?? 0,
          }))
          .sort((a, b) => b.totalCents - a.totalCents);
      }

      return { kpis, ranking };
    },
  });

  // Realtime: cada movimiento de stock (incluye ventas) refresca el dashboard
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`dashboard-${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'stock_movements',
        filter: `event_id=eq.${eventId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['event_dashboard', eventId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, queryClient]);

  return {
    kpis: data?.kpis ?? EMPTY,
    ranking: data?.ranking ?? [],
    loading: isLoading,
    refresh: refetch,
  };
}
