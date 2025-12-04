import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type SaleLine = { product_id: string; qty: number; price_cents: number };
export type Sale = {
  id: string;
  created_at: string;
  total_cents: number;
  total_items: number;
  sale_lines: SaleLine[];
};

const SALES_PER_PAGE = 10;

export function usePosHistory(eventId: string, cantinaId: string, sessionChecked: boolean) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchSales = useCallback(async (page: number = 1) => {
    if (!sessionChecked || !eventId || !cantinaId) return;
    
    setLoading(true);
    try {
      const { count } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('cantina_id', cantinaId);
      setTotalSales(count ?? 0);

      const from = (page - 1) * SALES_PER_PAGE;
      const to = from + SALES_PER_PAGE - 1;

      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          id, created_at,
          sale_line_items ( product_id, qty, unit_price_cents )
        `)
        .eq('event_id', eventId)
        .eq('cantina_id', cantinaId)
        .order('created_at', { ascending: false })
        .range(from, to);

      const formatted: Sale[] = (salesData ?? []).map((sale: any) => {
        const lines = sale.sale_line_items?.map((line: any) => ({
            product_id: line.product_id,
            qty: line.qty,
            price_cents: line.unit_price_cents,
          })) ?? [];
        const total_cents = lines.reduce((sum: number, line: any) => sum + line.price_cents * line.qty, 0);
        const total_items = lines.reduce((sum: number, line: any) => sum + line.qty, 0);
        return {
          id: sale.id,
          created_at: sale.created_at,
          total_cents,
          total_items,
          sale_lines: lines,
        };
      });
      
      setSales(formatted);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId, cantinaId, sessionChecked]);

  // Initial load
  useEffect(() => {
    fetchSales(1);
  }, [fetchSales]);

  return {
    sales,
    currentPage,
    totalSales,
    loading,
    fetchSales,
    SALES_PER_PAGE
  };
}

