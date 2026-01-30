'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
// 1. Eliminamos 'xlsx' e importamos tu utilidad de exportación y notificaciones
import { exportInventoryToExcel } from '@/lib/exportUtils';
import { toast, Toaster } from 'react-hot-toast';
import { EventProductRow } from '../hooks/useAdminCatalog';

interface EventGlobalTabProps {
  eventId: string;
  eventName: string;
  products: EventProductRow[];
  cantinas: { id: string; name: string; assigned: boolean }[];
}

export default function EventGlobalTab({ eventId, eventName, products, cantinas }: EventGlobalTabProps) {
  const [globalMatrix, setGlobalMatrix] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  // 2. Nuevo estado para controlar el botón de exportar
  const [isExporting, setIsExporting] = useState(false);

  // Carga inicial de datos para la TABLA VISUAL
  useEffect(() => {
    fetchGlobalInventory();
  }, [eventId]);

  async function fetchGlobalInventory() {
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
  }

  // 3. Nueva función de Exportación usando la plantilla
  async function handleExportExcel() {
    if (isExporting) return;

    setIsExporting(true);
    const toastId = toast.loading('Generando Excel con plantilla...');

    try {
      // Llamamos a tu lógica centralizada en exportUtils.ts
      // Esta función hace su propio fetch a Supabase, por lo que siempre tiene datos frescos
      await exportInventoryToExcel(eventId, eventName);

      toast.success('¡Plantilla descargada!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Error al generar Excel. Revisa la consola.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }

  const assignedCantinas = cantinas.filter(c => c.assigned);

  return (
    <div className="space-y-6">
      {/* Añadimos Toaster para que se vean las notificaciones */}
      <Toaster position="top-right" />

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Inventario Actual</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchGlobalInventory()}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Recargar datos"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>

          {/* 4. Botón Actualizado */}
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white shadow-md transition-all
              ${isExporting
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 active:transform active:scale-95'
              }
            `}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generando...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M1.125 12c0 .621.504 1.125 1.125 1.125" />
                </svg>
                <span>Descargar Plantilla</span>
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 animate-pulse">Cargando matriz de inventario...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl shadow-sm border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
              <tr>
                <th className="p-4 text-left sticky left-0 bg-slate-50 z-10 w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Producto</th>
                {assignedCantinas.map(c => (
                  <th key={c.id} className="p-4 text-center min-w-[80px] whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(p => (
                <tr key={p.product_id} className="hover:bg-elche-gray/5 transition-colors group">
                  <td className="p-4 font-bold text-elche-text sticky left-0 bg-white group-hover:bg-elche-gray/5 transition-colors z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    {p.name}
                  </td>
                  {assignedCantinas.map(c => {
                    const qty = globalMatrix[p.product_id]?.[c.id] ?? 0;
                    const isLow = qty <= p.low_stock_threshold;
                    const isOut = qty <= 0;

                    return (
                      <td key={c.id} className="p-4 text-center">
                        <div className={`
                          inline-flex items-center justify-center px-3 py-1.5 rounded-xl font-bold text-sm min-w-[50px] shadow-sm border
                          ${isOut
                            ? 'bg-elche-danger/10 text-elche-danger border-elche-danger/20'
                            : isLow
                              ? 'bg-elche-warning/10 text-elche-warning border-elche-warning/20'
                              : 'bg-elche-success/10 text-elche-success border-elche-success/20'
                          }
                        `}>
                          {qty}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}