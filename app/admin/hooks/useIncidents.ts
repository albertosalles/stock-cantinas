import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { resolveIncident } from '@/lib/incidents';

export interface EnrichedIncident {
  id: string;
  type: string;
  cantinaId: string;
  cantinaName: string;
  waiterName: string;
  productNames: string[];
  description: string | null;
  createdAt: string;
}

export function useIncidents(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: incidents = [], isLoading, refetch } = useQuery({
    queryKey: ['incidents', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('id, type, cantina_id, waiter_id, product_ids, description, created_at')
        .eq('event_id', eventId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      if (rows.length === 0) return [] as EnrichedIncident[];

      // Resolver nombres (cantinas, camareros, productos) en paralelo
      const cantinaIds = Array.from(new Set(rows.map((r: any) => r.cantina_id).filter(Boolean)));
      const waiterIds = Array.from(new Set(rows.map((r: any) => r.waiter_id).filter(Boolean)));
      const productIds = Array.from(new Set(rows.flatMap((r: any) => r.product_ids ?? [])));

      const [cantRes, waitRes, prodRes] = await Promise.all([
        cantinaIds.length ? supabase.from('cantinas').select('id, name').in('id', cantinaIds) : Promise.resolve({ data: [] as any[] }),
        waiterIds.length ? supabase.from('waiters').select('id, name, surname').in('id', waiterIds) : Promise.resolve({ data: [] as any[] }),
        productIds.length ? supabase.from('products').select('id, name').in('id', productIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const cantMap = new Map((cantRes.data ?? []).map((c: any) => [c.id, c.name]));
      const waitMap = new Map((waitRes.data ?? []).map((w: any) => [w.id, `${w.name} ${w.surname ?? ''}`.trim()]));
      const prodMap = new Map((prodRes.data ?? []).map((p: any) => [p.id, p.name]));

      return rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        cantinaId: r.cantina_id,
        cantinaName: cantMap.get(r.cantina_id) ?? 'Cantina',
        waiterName: r.waiter_id ? (waitMap.get(r.waiter_id) ?? 'Camarero') : '—',
        productNames: (r.product_ids ?? []).map((pid: string) => prodMap.get(pid) ?? '¿?'),
        description: r.description,
        createdAt: r.created_at,
      })) as EnrichedIncident[];
    },
  });

  // Realtime: cualquier cambio en incidencias del evento refresca la lista
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`incidents-${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'incidents',
        filter: `event_id=eq.${eventId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['incidents', eventId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, queryClient]);

  const resolve = async (id: string) => {
    await resolveIncident(id);
    queryClient.invalidateQueries({ queryKey: ['incidents', eventId] });
  };

  return { incidents, loading: isLoading, refresh: refetch, resolve };
}
