import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type SaleLine = { product_id: string; qty: number; price_cents: number };
export type Sale = {
  id: string;
  created_at: string;
  total_cents: number;
  total_items: number;
  status: string;
  void_reason: string | null;
  sale_lines: SaleLine[];
};

const SALES_PER_PAGE = 10;

export function usePosHistory(eventId: string, cantinaId: string, sessionChecked: boolean) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(false);

  // Paginación por cursor (keyset) en lugar de OFFSET.
  //
  // El problema del OFFSET no era sólo de coste: con ventas entrando en tiempo
  // real, insertar un ticket desplaza todas las páginas y el cajero ve tickets
  // repetidos o se salta alguno al navegar. El cursor ancla cada página a un
  // instante concreto, así que la navegación es estable aunque entren ventas.
  //
  // `cursors[i]` es el `created_at` desde el que arranca la página i+1;
  // `cursors[0]` es null porque la primera página no tiene ancla.
  const cursors = useRef<(string | null)[]>([null]);

  const fetchSales = useCallback(async (page: number = 1) => {
    if (!sessionChecked || !eventId || !cantinaId) return;
    if (page < 1) return;

    setLoading(true);
    try {
      // El recuento total sólo se pide al cargar la primera página. Antes se
      // hacía un COUNT(*) exacto en CADA cambio de página.
      if (page === 1) {
        const { count } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('cantina_id', cantinaId);
        setTotalSales(count ?? 0);
        cursors.current = [null];
      }

      const cursor = cursors.current[page - 1] ?? null;

      let query = supabase
        .from('sales')
        .select(`
          id, created_at, status, void_reason,
          sale_line_items ( product_id, qty, unit_price_cents )
        `)
        .eq('event_id', eventId)
        .eq('cantina_id', cantinaId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(SALES_PER_PAGE);

      if (cursor) query = query.lt('created_at', cursor);

      const { data: salesData } = await query;

      // Ancla de la página siguiente: el último ticket devuelto.
      // (Dos ventas con el mismo `created_at` al microsegundo exacto y justo en
      // el corte de página podrían solaparse; es un caso mucho menos probable
      // que el desplazamiento que causaba el OFFSET en cada venta nueva.)
      const last = salesData?.[salesData.length - 1];
      if (last) cursors.current[page] = last.created_at;

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
          status: sale.status ?? 'OK',
          void_reason: sale.void_reason ?? null,
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

