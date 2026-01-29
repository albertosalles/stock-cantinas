import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export type StockAlert = {
    cantinaId: string;
    cantinaName: string;
    productId: string;
    productName: string;
    currentQty: number;
    threshold: number;
};

export function useStockNotifications(eventId: string | undefined) {
    const queryClient = useQueryClient();

    const { data: alerts = [], isLoading, refetch } = useQuery({
        queryKey: ['stock_notifications', eventId],
        enabled: !!eventId,
        queryFn: async () => {
            // 1. Fetch items with low stock (raw IDs)
            const { data: inventoryData, error: invError } = await supabase
                .from('v_cantina_inventory')
                .select('cantina_id, product_id, current_qty, low_stock_threshold')
                .eq('event_id', eventId)
                .not('low_stock_threshold', 'is', null);

            if (invError) throw invError;

            const rawItems = (inventoryData ?? []).filter((item: any) => {
                const qty = item.current_qty ?? 0;
                const threshold = item.low_stock_threshold;
                return threshold !== null && qty <= threshold;
            });

            if (rawItems.length === 0) return [];

            // 2. Extract IDs to fetch names
            // We use Sets to avoid duplicates
            const productIds = Array.from(new Set(rawItems.map((i: any) => i.product_id)));
            const cantinaIds = Array.from(new Set(rawItems.map((i: any) => i.cantina_id)));

            // 3. Fetch Names in parallel
            const [prodRes, cantRes] = await Promise.all([
                supabase.from('products').select('id, name').in('id', productIds),
                supabase.from('cantinas').select('id, name').in('id', cantinaIds)
            ]);

            if (prodRes.error) throw prodRes.error;
            if (cantRes.error) throw cantRes.error;

            const productMap = new Map(prodRes.data?.map(p => [p.id, p.name]));
            const cantinaMap = new Map(cantRes.data?.map(c => [c.id, c.name]));

            // 4. Merge
            return rawItems.map((item: any) => ({
                cantinaId: item.cantina_id,
                cantinaName: cantinaMap.get(item.cantina_id) ?? 'Cantina ???',
                productId: item.product_id,
                productName: productMap.get(item.product_id) ?? 'Producto ???',
                currentQty: item.current_qty,
                threshold: item.low_stock_threshold
            }));
        },
        // Refresh every minute even if no activity, just in case
        refetchInterval: 60000
    });

    // Real-time subscription
    useEffect(() => {
        if (!eventId) return;

        const channel = supabase
            .channel(`notifications-${eventId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'stock_movements',
                filter: `event_id=eq.${eventId}`
            }, () => {
                // When stock moves, refresh alerts
                queryClient.invalidateQueries({ queryKey: ['stock_notifications', eventId] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [eventId, queryClient]);

    return {
        alerts,
        loading: isLoading,
        refresh: refetch
    };
}
