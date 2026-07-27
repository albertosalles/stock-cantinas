import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeInvalidate } from '@/hooks/useEventRealtime';

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
    // La agregación la hace Postgres: devuelve una fila por hora en lugar de una
    // por venta. Antes se descargaban todas las ventas del evento para agrupar
    // aquí, cada 60 s y por cada admin conectado.
    queryFn: async (): Promise<HourBucket[]> => {
      const { data, error } = await supabase.rpc('get_sales_by_hour', { p_event_id: eventId });
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        hora: `${row.hora}h`,
        totalCents: row.total_cents ?? 0,
        numSales: row.num_sales ?? 0,
      }));
    },
  });

  // Tiempo real activado, ya con las dos piezas que lo hacen barato: la
  // agregación vive en Postgres (devuelve una fila por franja, no por venta) y
  // los avisos se agrupan en el bus compartido.
  //
  // Se escucha `stock_movements` y no `sales`: toda venta genera movimientos, esa
  // tabla sí está en la publicación de Realtime, y así no hay que replicar una
  // tabla más. La suscripción original apuntaba a `sales` y por eso nunca
  // disparaba (INF-1, defecto 1).
  useRealtimeInvalidate(eventId, undefined, ['stock_movements'], ['sales_by_hour', eventId]);

  return { buckets: data, loading: isLoading, refresh: refetch };
}
