import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLiveInventory } from '@/hooks/useLiveInventory';

export interface CantinaMetrics {
  stock_total: number;
  low_stock: number;
  num_sales: number;
  total_items: number;
  total_cents: number;
}

export interface PanelRow {
  product_id: string;
  name: string;
  sku: string;
  current_qty: number;
  initial_qty: number | null;
  low_stock_threshold: number
}

export function useAdminMetrics(eventId: string, assignedCantinas: { id: string }[]) {
  const [metrics, setMetrics] = useState<{ [id: string]: CantinaMetrics }>({});
  const [loading, setLoading] = useState(false);

  // Selected Cantina Panel Data
  const [panelCantinaId, setPanelCantinaId] = useState<string | null>(null);
  const [panelRows, setPanelRows] = useState<PanelRow[]>([]);
  const [panelTotals, setPanelTotals] = useState({ num_sales: 0, total_cents: 0, total_items: 0 });

  // Sales History
  const [salesHistory, setSalesHistory] = useState<any[]>([]);

  const changes = useLiveInventory(eventId, panelCantinaId ?? '');

  async function fetchMetrics() {
    setLoading(true);
    const metricsMap: { [id: string]: CantinaMetrics } = {};

    assignedCantinas.forEach(c => {
      metricsMap[c.id] = { stock_total: 0, low_stock: 0, num_sales: 0, total_items: 0, total_cents: 0 };
    });

    // Inventory Data
    const { data: invRows } = await supabase
      .from('v_cantina_inventory')
      .select('cantina_id, current_qty, low_stock_threshold')
      .eq('event_id', eventId);

    invRows?.forEach((row: any) => {
      const id = row.cantina_id;
      if (!metricsMap[id]) return;
      metricsMap[id].stock_total += row.current_qty ?? 0;
      if ((row.current_qty ?? 0) <= (row.low_stock_threshold ?? 0)) metricsMap[id].low_stock += 1;
    });

    // Sales Data
    const { data: salesRows } = await supabase
      .from('v_sales_by_cantina')
      .select('cantina_id, num_sales, total_items, total_cents')
      .eq('event_id', eventId);

    salesRows?.forEach((row: any) => {
      const id = row.cantina_id;
      if (!metricsMap[id]) return;
      metricsMap[id].num_sales = row.num_sales ?? 0;
      metricsMap[id].total_items = row.total_items ?? 0;
      metricsMap[id].total_cents = row.total_cents ?? 0;
    });

    setMetrics(metricsMap);
    setLoading(false);
  }

  async function fetchPanelData(cantinaId: string) {
    // Fetch stock, products and initial inventory in parallel
    const [invRes, prodsRes, initRes] = await Promise.all([
      supabase
        .from('v_cantina_inventory')
        .select('product_id, current_qty, low_stock_threshold')
        .match({ event_id: eventId, cantina_id: cantinaId }),
      supabase
        .from('event_products')
        .select('product_id, low_stock_threshold, products(name, sku)')
        .eq('event_id', eventId)
        .eq('active', true),
      supabase
        .from('inventory_snapshots')
        .select('product_id, qty')
        .match({ event_id: eventId, cantina_id: cantinaId, kind: 'INITIAL' })
    ]);

    const invMap = new Map(invRes.data?.map((r: any) => [r.product_id, r]) ?? []);
    const initMap = new Map(initRes.data?.map((r: any) => [r.product_id, r.qty as number]) ?? []);

    const rows = (prodsRes.data ?? []).map((ep: any) => {
      const r = invMap.get(ep.product_id);
      const initialQty = initMap.get(ep.product_id);
      return {
        product_id: ep.product_id,
        name: ep.products?.name ?? '—',
        sku: ep.products?.sku ?? '',
        current_qty: r?.current_qty ?? 0,
        initial_qty: initialQty ?? null,
        low_stock_threshold: (r?.low_stock_threshold ?? ep.low_stock_threshold ?? 0)
      };
    });

    // Sort by SKU (alphanumeric) — same pattern as usePosData
    rows.sort((a: PanelRow, b: PanelRow) => {
      const skuA = String(a.sku || '');
      const skuB = String(b.sku || '');
      return skuA.localeCompare(skuB, undefined, { numeric: true });
    });
    setPanelRows(rows);

    // Totals
    const { data: totals } = await supabase
      .from('v_sales_by_cantina')
      .select('num_sales,total_cents,total_items')
      .match({ event_id: eventId, cantina_id: cantinaId })
      .maybeSingle();

    setPanelTotals({
      num_sales: totals?.num_sales ?? 0,
      total_cents: totals?.total_cents ?? 0,
      total_items: totals?.total_items ?? 0
    });

    // Sales History (Last 30)
    const { data: sales } = await supabase
      .from('sales')
      .select(`
        id, 
        created_at, 
        total_items, 
        total_cents, 
        status,
        sale_line_items (
          id,
          qty,
          unit_price_cents,
          product:products (
            name
          )
        )
      `)
      .match({ event_id: eventId, cantina_id: cantinaId })
      .order('created_at', { ascending: false })
      .limit(15);

    setSalesHistory(sales ?? []);
  }

  useEffect(() => {
    fetchMetrics();
  }, [assignedCantinas.length]);

  useEffect(() => {
    if (panelCantinaId) fetchPanelData(panelCantinaId);
  }, [panelCantinaId, changes]);

  return {
    metrics,
    loading,
    panelCantinaId,
    setPanelCantinaId,
    panelRows,
    panelTotals,
    salesHistory,
    fetchMetrics,
    fetchPanelData
  };
}

