import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as XLSX from 'xlsx';
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

  async function fetchGlobalInventory() {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_cantina_inventory')
      .select('cantina_id, product_id, current_qty')
      .eq('event_id', eventId);

    if (error) {
      alert('Error cargando inventario global');
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

  function exportGlobalInventory() {
    const assignedCantinas = cantinas.filter(c => c.assigned);
    const headers = ['Producto', ...assignedCantinas.map(c => c.name)];
    
    const dataRows = products.map(p => {
      const row: any[] = [p.name];
      assignedCantinas.forEach(c => {
        const qty = globalMatrix[p.product_id]?.[c.id] ?? 0;
        row.push(qty);
      });
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario Global');
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Inventario_Global_${eventName}_${dateStr}.xlsx`);
  }

  useEffect(() => {
    fetchGlobalInventory();
  }, []);

  const assignedCantinas = cantinas.filter(c => c.assigned);

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-elche-gray/50 pb-4 gap-4">
        <div className="font-bold text-xl text-elche-text flex items-center gap-2">
          <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">🌍</span>
          Estado global de inventario
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={fetchGlobalInventory} 
            className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-white border border-elche-gray text-elche-text font-bold hover:bg-elche-gray/50 shadow-sm transition-colors"
          >
            🔄 Refrescar
          </button>
          <button 
            onClick={exportGlobalInventory} 
            className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-elche-primary text-white font-bold hover:bg-elche-secondary shadow-lg shadow-elche-primary/20 transition-colors"
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-elche-text-light flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-elche-primary border-t-transparent rounded-full animate-spin"/>
          Cargando datos globales...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-elche-gray/50 shadow-sm custom-scrollbar pb-2">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-elche-gray/20 text-elche-text-light text-xs font-bold uppercase tracking-wider">
                <th className="p-4 text-left border-b border-elche-gray/30 sticky left-0 bg-elche-bg/50 backdrop-blur-sm z-10">Producto</th>
                {assignedCantinas.map(c => (
                  <th key={c.id} className="p-4 text-center min-w-[120px] border-b border-elche-gray/30">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-elche-gray/30">
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
    </section>
  );
}

