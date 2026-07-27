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
    // La agregación la hace Postgres: devuelve una fila por hora en lugar de una
    // por venta. Antes se descargaban todas las ventas del evento para agrupar
    // aquí, cada 60 s y por cada admin conectado.
    queryFn: async (): Promise<HourBucket[]> => {
      const { data, error } = await supabase.rpc('get_sales_by_hour', { p_event_id: eventId });
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        hora: `${new Date(row.hora).getHours()}h`,
        totalCents: row.total_cents ?? 0,
        numSales: row.num_sales ?? 0,
      }));
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
