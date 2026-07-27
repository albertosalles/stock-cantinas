import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeInvalidate } from '@/hooks/useEventRealtime';

export type StockAlert = {
    cantinaId: string;
    cantinaName: string;
    productId: string;
    productName: string;
    currentQty: number;
    threshold: number;
};

export function useStockNotifications(eventId: string | undefined) {
    const { data: alerts = [], isLoading, refetch } = useQuery({
        queryKey: ['stock_notifications', eventId],
        enabled: !!eventId,
        // Una sola llamada: el RPC filtra por umbral y resuelve los nombres de
        // producto y cantina en el servidor. Antes eran tres consultas — el
        // inventario del evento entero (productos × cantinas) y dos más para
        // resolver nombres — y el filtrado se repetía en el cliente.
        //
        // La regla de umbral vive ahora en el RPC: sólo se avisa de productos con
        // umbral definido (> 0). Un umbral 0 significa "no avisar", no "avisar al
        // agotarse".
        queryFn: async (): Promise<StockAlert[]> => {
            const { data, error } = await supabase.rpc('get_stock_alerts', { p_event_id: eventId });
            if (error) throw error;

            return (data ?? []).map((row: any) => ({
                cantinaId: row.cantina_id,
                cantinaName: row.cantina_name,
                productId: row.product_id,
                productName: row.product_name,
                currentQty: row.current_qty,
                threshold: row.threshold,
            }));
        },
        // Refresh every minute even if no activity, just in case
        refetchInterval: 60000
    });

    useRealtimeInvalidate(eventId, undefined, ['stock_movements'], ['stock_notifications', eventId]);

    return {
        alerts,
        loading: isLoading,
        refresh: refetch
    };
}
