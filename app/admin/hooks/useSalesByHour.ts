import { useQuery } from '@tanstack/react-query';
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
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['sales_by_hour', eventId],
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

  // El gráfico se refresca SÓLO por el sondeo de 60 s de arriba, a propósito.
  //
  // Aquí había una suscripción Realtime a la tabla `sales` que nunca disparaba,
  // porque `sales` no está en la publicación `supabase_realtime` (INF-1, defecto 1).
  // Se ha retirado en lugar de activarla: hacerla funcionar hoy sería un retroceso,
  // porque esta queryFn se descarga TODAS las ventas del evento para agruparlas en
  // el cliente, y a 6-7 ventas/s eso son 6-7 descargas por segundo de miles de filas.
  // El sondeo de 60 s estaba enmascarando el problema.
  //
  // El tiempo real de este gráfico se activa cuando existan las dos piezas que lo
  // hacen barato: el RPC de agregación en servidor (épica «Agregación en servidor y
  // paginación eficiente») y la agrupación temporal de invalidaciones (épica
  // «Reducción del fan-out de Realtime»).

  return { buckets: data, loading: isLoading, refresh: refetch };
}
