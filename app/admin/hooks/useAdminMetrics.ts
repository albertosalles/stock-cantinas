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
  current_qty: number; 
  low_stock_threshold: number 
}

export function useAdminMetrics(eventId: string, assignedCantinas: { id: string }[]) {
  const [metrics, setMetrics] = useState<{ [id: string]: CantinaMetrics }>({});
  const [loading, setLoading] = useState(false);
  
  // Selected Cantina Panel Data
  const [panelCantinaId, setPanelCantinaId] = useState<string | null>(null);
  const [panelRows, setPanelRows] = useState<PanelRow[]>([]);
  const [panelTotals, setPanelTotals] = useState({ num_sales: 0, total_cents: 0, total_items: 0 });

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
    // Stock Rows
    const { data: inv } = await supabase
      .from('v_cantina_inventory')
      .select('product_id, current_qty, low_stock_threshold')
      .match({ event_id: eventId, cantina_id: cantinaId });
      
    const invMap = new Map(inv?.map((r: any) => [r.product_id, r]) ?? []);

    const { data: prods } = await supabase
      .from('event_products')
      .select('product_id, low_stock_threshold, products(name)')
      .eq('event_id', eventId)
      .eq('active', true)
      .order('products(name)');

    const rows = (prods ?? []).map((ep: any) => {
      const r = invMap.get(ep.product_id);
      return {
        product_id: ep.product_id,
        name: ep.products?.name ?? '—',
        current_qty: r?.current_qty ?? 0,
        low_stock_threshold: (r?.low_stock_threshold ?? ep.low_stock_threshold ?? 0)
      };
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
    fetchMetrics,
    fetchPanelData
  };
}

