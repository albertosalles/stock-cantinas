import { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useLiveInventory } from '@/hooks/useLiveInventory';

// Definición de tipos
export type Product = { id: string; name: string; price_cents: number; sku: string };
export type InventoryRow = { product_id: string; current_qty: number; low_stock_threshold: number };
export type Totals = { num_sales: number; total_cents: number; total_items: number };

export function usePosData(eventId: string, cantinaId: string, sessionChecked: boolean) {
  const queryClient = useQueryClient();
  const changes = useLiveInventory(eventId, cantinaId);

  // 1. QUERY: Productos (Catálogo)
  // queryKey: Identificador único para la caché.
  // staleTime: Infinity en productos porque el catálogo cambia poco (ahorra peticiones).
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products', eventId],
    enabled: sessionChecked && !!eventId,
    staleTime: 1000 * 60 * 30, // 30 minutos sin comprobar servidor
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_products')
        .select('product_id, price_cents, products(name, sku)')
        .eq('event_id', eventId)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const mapped = data.map((row: any) => ({
        id: row.product_id,
        name: row.products?.name ?? '—',
        price_cents: row.price_cents,
        sku: row.products?.sku ?? '',
      }));

      // Ordenar por SKU (alfanumérico)
      return mapped.sort((a: any, b: any) => {
        const skuA = String(a.sku || '');
        const skuB = String(b.sku || '');
        return skuA.localeCompare(skuB, undefined, { numeric: true });
      });
    }
  });

  // 2. QUERY: Inventario
  // staleTime: 0 porque el stock cambia mucho.
  const { data: inventory = [], isLoading: loadingInv, refetch: refetchInventory } = useQuery({
    queryKey: ['inventory', eventId, cantinaId],
    enabled: sessionChecked && !!eventId && !!cantinaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_cantina_inventory')
        .select('product_id, current_qty, low_stock_threshold')
        .match({ event_id: eventId, cantina_id: cantinaId });

      if (error) throw error;
      return data as InventoryRow[];
    }
  });

  // 3. QUERY: Totales
  const { data: totals = { num_sales: 0, total_cents: 0, total_items: 0 }, refetch: refetchTotals } = useQuery({
    queryKey: ['totals', eventId, cantinaId],
    enabled: sessionChecked && !!eventId && !!cantinaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_sales_by_cantina')
        .select('*')
        .match({ event_id: eventId, cantina_id: cantinaId })
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // Ignorar error si no hay filas

      return {
        num_sales: data?.num_sales ?? 0,
        total_cents: data?.total_cents ?? 0,
        total_items: data?.total_items ?? 0
      } as Totals;
    }
  });

  // 4. Map para búsqueda rápida (Derivado - O(1))
  const invMap = useMemo(() => {
    const m = new Map<string, InventoryRow>();
    inventory.forEach(r => m.set(r.product_id, r));
    return m;
  }, [inventory]);

  // 5. Sincronización Real-Time
  // Si useLiveInventory detecta un cambio (por websocket),
  // invalidamos la caché para que React Query vuelva a pedir datos frescos.
  useEffect(() => {
    if (changes) {
      // Invalidate queries forza un refetch suave
      queryClient.invalidateQueries({ queryKey: ['inventory', eventId, cantinaId] });
      queryClient.invalidateQueries({ queryKey: ['totals', eventId, cantinaId] });
    }
  }, [changes, queryClient, eventId, cantinaId]);

  return {
    products,
    inventory,
    invMap,
    totals,
    loading: loadingProducts || loadingInv,
    refreshInventory: refetchInventory, // Mantenemos la API original
    refreshTotals: refetchTotals
  };
}