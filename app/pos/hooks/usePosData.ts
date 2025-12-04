import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLiveInventory } from '@/hooks/useLiveInventory';

export type Product = { id: string; name: string; price_cents: number };
export type InventoryRow = { product_id: string; current_qty: number; low_stock_threshold: number };
export type Totals = { num_sales: number; total_cents: number; total_items: number };

export function usePosData(eventId: string, cantinaId: string, sessionChecked: boolean) {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ num_sales: 0, total_cents: 0, total_items: 0 });
  const [loading, setLoading] = useState(true);

  const changes = useLiveInventory(eventId, cantinaId);

  // Map for O(1) inventory lookup
  const invMap = useMemo(() => {
    const m = new Map<string, InventoryRow>();
    inventory.forEach(r => m.set(r.product_id, r));
    return m;
  }, [inventory]);

  // Cargar productos
  useEffect(() => {
    if (!sessionChecked || !eventId) return;

    (async () => {
      const { data, error } = await supabase
        .from('event_products')
        .select('product_id, price_cents, products(name)')
        .eq('event_id', eventId)
        .eq('active', true)
        .order('product_id');
        
      if (!error) {
        setProducts((data ?? []).map((row: any) => ({
          id: row.product_id,
          name: row.products?.name ?? '—',
          price_cents: row.price_cents,
        })));
      }
    })();
  }, [sessionChecked, eventId]);

  // Cargar inventario y totales
  useEffect(() => {
    if (!sessionChecked || !eventId || !cantinaId) return;

    const fetchData = async () => {
      setLoading(true);
      // Inventario
      const { data: invData } = await supabase
        .from('v_cantina_inventory')
        .select('product_id, current_qty, low_stock_threshold')
        .match({ event_id: eventId, cantina_id: cantinaId });
      setInventory(invData ?? []);

      // Totales
      const { data: totalsData } = await supabase
        .from('v_sales_by_cantina')
        .select('*')
        .match({ event_id: eventId, cantina_id: cantinaId })
        .maybeSingle();
        
      if (totalsData) {
        setTotals({
          num_sales: totalsData.num_sales ?? 0,
          total_cents: totalsData.total_cents ?? 0,
          total_items: totalsData.total_items ?? 0
        });
      }
      setLoading(false);
    };

    fetchData();
  }, [sessionChecked, eventId, cantinaId]);

  // Actualizar inventario en tiempo real
  useEffect(() => {
    if (!sessionChecked || !eventId || !cantinaId || !changes) return;

    (async () => {
      const { data } = await supabase
        .from('v_cantina_inventory')
        .select('product_id, current_qty, low_stock_threshold')
        .match({ event_id: eventId, cantina_id: cantinaId });
      setInventory(data ?? []);
    })();
  }, [changes, sessionChecked, eventId, cantinaId]);

  // Helpers para refrescar manualmente
  const refreshInventory = async () => {
    const { data } = await supabase
      .from('v_cantina_inventory')
      .select('product_id, current_qty, low_stock_threshold')
      .match({ event_id: eventId, cantina_id: cantinaId });
    setInventory(data ?? []);
  };

  const refreshTotals = async () => {
    const { data } = await supabase
      .from('v_sales_by_cantina')
      .select('num_sales,total_cents,total_items')
      .match({ event_id: eventId, cantina_id: cantinaId })
      .single();
    setTotals({
      num_sales: data?.num_sales ?? 0,
      total_cents: data?.total_cents ?? 0,
      total_items: data?.total_items ?? 0,
    });
  };

  return {
    products,
    inventory,
    invMap,
    totals,
    loading,
    refreshInventory,
    refreshTotals
  };
}

