import React, { useState } from 'react';
import { usePosHistory } from '../hooks/usePosHistory';
import { Product } from '../hooks/usePosData';

interface PosHistoryTabProps {
  eventId: string;
  cantinaId: string;
  products: Product[];
  sessionChecked: boolean;
}

export default function PosHistoryTab({ eventId, cantinaId, products, sessionChecked }: PosHistoryTabProps) {
  const { sales, currentPage, totalSales, loading, fetchSales, SALES_PER_PAGE } = usePosHistory(eventId, cantinaId, sessionChecked);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  return (
    <div className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,150,79,0.08)] border border-elche-gray/50">
      <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-elche-gray/50">
        <div className="font-bold text-lg text-elche-text flex items-center gap-2">
          <span className="text-xl">🧾</span> Historial de ventas
        </div>
        <div className="text-elche-text-light text-sm font-medium bg-elche-gray/20 px-3 py-1 rounded-full">
          {sales.length} / {totalSales}
        </div>
      </div>

      <div className="flex justify-end mb-3">
         <button 
           onClick={() => fetchSales(currentPage)} 
           className="text-xs font-bold text-elche-primary hover:underline flex items-center gap-1 transition-colors">
           🔄 Recargar
         </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-elche-text-light flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-elche-primary border-t-transparent rounded-full animate-spin"></div>
          Cargando ventas...
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 text-elche-text-light italic bg-elche-gray/10 rounded-2xl border border-dashed border-elche-gray">
          No hay ventas registradas aún
        </div>
      ) : (
        <div className="grid gap-3">
          {sales.map((sale) => {
            const date = new Date(sale.created_at);
            const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            const isExpanded = expandedSaleId === sale.id;

            return (
              <div key={sale.id} className={`p-4 bg-elche-gray/20 rounded-2xl border transition-all duration-200 ${isExpanded ? 'border-elche-primary shadow-md bg-white' : 'border-elche-gray/50 hover:border-elche-green/30 hover:bg-white'}`}>
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center mb-0 cursor-pointer" onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}>
                  <div>
                    <div className="text-xs text-elche-text-light mb-1 font-bold uppercase tracking-wide flex gap-2">
                      <span>{dateStr}</span>
                      <span className="opacity-50">|</span>
                      <span>{timeStr}</span>
                    </div>
                    <div className="text-[10px] text-elche-text-light font-mono bg-white px-2 py-0.5 rounded border border-elche-gray/30 w-fit">
                      ID: {sale.id.substring(0, 8)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-elche-text-light mb-0.5 font-medium">
                      {sale.total_items} art.
                    </div>
                    <div className="text-xl font-bold text-elche-green">
                      {(sale.total_cents / 100).toFixed(2)} €
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedSaleId(isExpanded ? null : sale.id); }}
                    className={`px-4 py-2 rounded-xl border font-semibold text-xs shadow-sm transition-all ${
                      isExpanded 
                      ? 'bg-elche-primary text-white border-elche-primary active:scale-95' 
                      : 'bg-white border-elche-gray/50 text-elche-text hover:bg-elche-gray/20'
                    }`}>
                    {isExpanded ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                
                {/* Detalle */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-elche-gray/30 animate-in slide-in-from-top-2 duration-200">
                    <div className="text-xs font-bold text-elche-text mb-2 uppercase tracking-wide opacity-70">
                      Productos vendidos
                    </div>
                    <div className="grid gap-2">
                      {sale.sale_lines.map((line, idx) => {
                        const product = products.find(p => p.id === line.product_id);
                        return (
                          <div key={idx} className="flex justify-between p-3 bg-elche-gray/10 rounded-xl text-sm border border-elche-gray/20">
                            <div className="text-elche-text font-medium flex items-center">
                              <span className="bg-white border border-elche-gray/30 px-2 py-0.5 rounded-md text-elche-text-light mr-3 font-bold shadow-sm text-xs">{line.qty}x</span> 
                              {product?.name ?? 'Desconocido'}
                            </div>
                            <div className="text-elche-green font-bold">
                              {((line.price_cents * line.qty) / 100).toFixed(2)} €
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginación */}
      {totalSales > SALES_PER_PAGE && (
        <div className="flex justify-center items-center gap-3 mt-6 pt-6 border-t-2 border-elche-gray/50">
          <button
            onClick={() => fetchSales(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-xl font-semibold border transition-colors bg-white border-elche-gray text-elche-text hover:bg-elche-gray/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
            ← Anterior
          </button>
          <div className="text-elche-text font-bold text-sm bg-elche-gray/20 px-4 py-1.5 rounded-full">
             {currentPage} / {Math.ceil(totalSales / SALES_PER_PAGE)}
          </div>
          <button
            onClick={() => fetchSales(currentPage + 1)}
            disabled={currentPage >= Math.ceil(totalSales / SALES_PER_PAGE)}
            className="px-4 py-2 rounded-xl font-semibold border transition-colors bg-white border-elche-gray text-elche-text hover:bg-elche-gray/10 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
