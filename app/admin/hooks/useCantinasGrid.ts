import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { adminOp } from '@/lib/adminData';
import { setCantinaPin } from '@/lib/adminPins';
import { useRealtimeInvalidate } from '@/hooks/useEventRealtime';

export interface FeaturedStock { name: string; qty: number; }

export interface CantinaGridRow {
  cantina_id: string;
  cantina_name: string;
  qr_token: string;
  assigned: boolean;
  total_cents: number;
  num_sales: number;
  active_waiters: number;
  pending_incidents: number;
  low_stock_count: number;
  featured: FeaturedStock[];
}

export function useCantinasGrid(eventId: string | undefined) {
  const key = ['cantinas_grid', eventId];

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: key,
    enabled: !!eventId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_event_cantinas_grid', { p_event_id: eventId });
      if (error) throw error;
      return (data ?? []) as CantinaGridRow[];
    },
  });

  useRealtimeInvalidate(eventId, undefined, ['stock_movements', 'incidents'], key);

  async function toggleAssign(cantinaId: string, assign: boolean) {
    if (assign) {
      await adminOp('cantina.asignar', { eventId, cantinaId, asignar: true });
    } else {
      await adminOp('cantina.asignar', { eventId, cantinaId, asignar: false });
    }
    await refetch();
  }

  async function createCantina(name: string, pin: string) {
    if (!name.trim()) throw new Error('Nombre requerido');
    if (!pin.trim()) throw new Error('PIN requerido');
    const data = await adminOp<{ id: string }>('cantina.crear', { name });
    await setCantinaPin(data.id, pin);
    await adminOp('cantina.asignar', { eventId, cantinaId: data.id, asignar: true });
    await refetch();
  }

  return { cantinas: data, loading: isLoading, refresh: refetch, toggleAssign, createCantina };
}
