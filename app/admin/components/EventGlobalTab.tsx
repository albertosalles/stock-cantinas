'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { exportInventoryToExcel } from '@/lib/exportUtils';
import { toast, Toaster } from 'react-hot-toast';
import { EventProductRow } from '../hooks/useAdminCatalog';
import { stockPillClass, stockLevel } from '@/lib/adminUi';

interface EventGlobalTabProps {
  eventId: string;
  eventName: string;
  products: EventProductRow[];
  cantinas: { id: string; name: string; assigned: boolean }[];
}

export default function EventGlobalTab({ eventId, eventName, products, cantinas }: EventGlobalTabProps) {
  const [globalMatrix, setGlobalMatrix] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchGlobalInventory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_cantina_inventory')
      .select('cantina_id, product_id, current_qty')
      .eq('event_id', eventId);

    if (error) {
      toast.error('Error cargando inventario global');
      setLoading(false);
      return;
    }

    const matrix: Record<string, Record<string, number>> = {};
    (data ?? []).forEach((row: any) => {
      if (!matrix[row.product_id]) matrix[row.product_id] = {};
      matrix[row.product_id][row.cantina_id] = row.current_qty;
    });

    setGlobalMatrix(matrix);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchGlobalInventory(); }, [fetchGlobalInventory]);

  async function handleExportExcel() {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading('Generando Excel con plantilla...');
    try {
      await exportInventoryToExcel(eventId, eventName);
      toast.success('¡Plantilla descargada!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Error al generar Excel. Revisa la consola.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }

  const assignedCantinas = useMemo(() => cantinas.filter(c => c.assigned), [cantinas]);

  // Recuento por estado. Agotado y "bajo mínimo" son cosas distintas:
  // agotado es un hecho (0 unidades); bajo mínimo requiere umbral definido.
  const { outCount, warnCount } = useMemo(() => {
    let out = 0, warn = 0;
    products.forEach(p => {
      assignedCantinas.forEach(c => {
        const qty = globalMatrix[p.product_id]?.[c.id] ?? 0;
        const level = stockLevel(qty, p.low_stock_threshold);
        if (level === 'out') out++;
        else if (level === 'warn') warn++;
      });
    });
    return { outCount: out, warnCount: warn };
  }, [products, assignedCantinas, globalMatrix]);

  // El chip se pinta según lo más grave que haya
  const summary = outCount > 0
    ? {
        tone: 'crit' as const,
        icon: 'error',
        text: `${outCount} ${outCount === 1 ? 'referencia agotada' : 'referencias agotadas'}` +
          (warnCount > 0 ? ` · ${warnCount} bajo mínimo` : ''),
      }
    : warnCount > 0
      ? {
          tone: 'warn' as const,
          icon: 'warning',
          text: `${warnCount} ${warnCount === 1 ? 'referencia' : 'referencias'} bajo mínimo`,
        }
      : { tone: 'ok' as const, icon: 'verified', text: 'Sin roturas de stock' };

  const SUMMARY_CLASS = {
    crit: 'bg-[var(--c-crit-bg)] text-[var(--c-crit)]',
    warn: 'bg-[var(--c-warn-bg)] text-[var(--c-warn)]',
    ok: 'bg-elche-primary/[0.09] text-elche-primary',
  } as const;

  const thClass = 'px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8aa397]';

  return (
    <div className="mx-auto max-w-[1440px] animate-fade-in">
      <Toaster position="top-right" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 ${SUMMARY_CLASS[summary.tone]}`}>
            <span className="ms text-base">{summary.icon}</span>
            <span className="text-xs font-bold tracking-wide">{summary.text}</span>
          </div>
          <span className="text-[12.5px] font-semibold text-[#8aa397]">Stock consolidado por cantina</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchGlobalInventory()}
            disabled={loading}
            title="Recargar datos"
            className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-elche-gray bg-white text-elche-text-light transition-colors hover:text-elche-primary"
          >
            <span className={`ms text-xl ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-[11px] bg-[#1a6b3a] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(26,107,58,.28)] transition-colors hover:bg-[#155530] disabled:opacity-60"
          >
            <span className={`ms text-lg ${isExporting ? 'animate-spin' : ''}`}>
              {isExporting ? 'progress_activity' : 'download'}
            </span>
            {isExporting ? 'Generando...' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-elche-gray bg-white">
        {loading && Object.keys(globalMatrix).length === 0 ? (
          <div className="py-16 text-center text-elche-text-light">Cargando matriz de inventario...</div>
        ) : assignedCantinas.length === 0 ? (
          <div className="py-12 text-center italic text-elche-text-light">
            Este evento no tiene cantinas asignadas todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="bg-[#f7fbf9]">
                  <th className={`sticky left-0 bg-[#f7fbf9] text-left ${thClass} pl-5`}>Producto</th>
                  {assignedCantinas.map(c => (
                    <th key={c.id} className={`whitespace-nowrap text-center ${thClass}`}>
                      {c.name}
                    </th>
                  ))}
                  <th className={`text-right ${thClass} pr-5 text-elche-text`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const total = assignedCantinas.reduce(
                    (sum, c) => sum + (globalMatrix[p.product_id]?.[c.id] ?? 0),
                    0
                  );
                  return (
                    <tr key={p.product_id} className="group border-t border-[#f0f6f2] transition-colors hover:bg-[#fafcfb]">
                      <td className="sticky left-0 whitespace-nowrap bg-white px-5 py-3 text-[13px] font-bold text-elche-text transition-colors group-hover:bg-[#fafcfb]">
                        {p.name}
                      </td>
                      {assignedCantinas.map(c => {
                        const qty = globalMatrix[p.product_id]?.[c.id] ?? 0;
                        return (
                          <td key={c.id} className="px-3 py-3 text-center">
                            <span className={stockPillClass(qty, p.low_stock_threshold)}>{qty}</span>
                          </td>
                        );
                      })}
                      <td className="py-3 pl-3 pr-5 text-right text-[13.5px] font-extrabold tabular-nums text-elche-text">
                        {total.toLocaleString('es-ES')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3.5 border-t border-[#f0f6f2] px-5 py-3 text-[11.5px] text-[#8aa397]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[#f5b5b5] bg-[#fdecec]" />
            Agotado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[#f3d78f] bg-[#fff7e6]" />
            Bajo mínimo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[#cbe6d8] bg-[#eef6f1]" />
            Correcto
          </span>
        </div>
      </div>
    </div>
  );
}
