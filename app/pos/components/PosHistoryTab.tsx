import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { usePosHistory, Sale } from '../hooks/usePosHistory';
import { Product } from '../hooks/usePosData';
import { voidSale } from '@/lib/sales';

interface PosHistoryTabProps {
  eventId: string;
  cantinaId: string;
  waiterId: string;
  products: Product[];
  sessionChecked: boolean;
  /** true cuando la pestaña de historial está visible (para refrescar al entrar). */
  active: boolean;
  /** Modificar = anular + rehacer: carga las líneas en el carrito y va a Venta. */
  onModify: (lines: { productId: string; qty: number }[]) => void;
  /** Refresca inventario/totales del padre tras una anulación. */
  onAfterVoid?: () => void;
}

export default function PosHistoryTab({ eventId, cantinaId, waiterId, products, sessionChecked, active, onModify, onAfterVoid }: PosHistoryTabProps) {
  const { sales, currentPage, totalSales, loading, fetchSales, SALES_PER_PAGE } = usePosHistory(eventId, cantinaId, sessionChecked);

  // Refresca el historial cada vez que se entra en la pestaña (para ver ventas recién hechas)
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) fetchSales(currentPage);
    wasActive.current = active;
  }, [active, fetchSales, currentPage]);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // Modal de anulación (motivo obligatorio)
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const MOTIVOS = ['Error de cobro', 'Producto equivocado', 'Cliente se arrepiente', 'Cantidad incorrecta'];

  const confirmVoid = async () => {
    if (!voidTarget || !reason.trim() || busy) return;
    setBusy(true);
    try {
      await voidSale(voidTarget.id, waiterId, reason.trim());
      toast.success('Venta anulada', { duration: 2000 });
      setVoidTarget(null);
      setReason('');
      await fetchSales(currentPage);
      onAfterVoid?.();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo anular la venta', { duration: 3000 });
    } finally {
      setBusy(false);
    }
  };

  const handleModify = async (sale: Sale) => {
    if (busy) return;
    if (!confirm('Modificar anulará esta venta y cargará sus productos en el carrito para rehacerla. ¿Continuar?')) return;
    setBusy(true);
    try {
      await voidSale(sale.id, waiterId, 'Modificación de venta');
      onModify(sale.sale_lines.map(l => ({ productId: l.product_id, qty: l.qty })));
      toast('Venta cargada en el carrito para modificar', { icon: '✏️', duration: 2500 });
      await fetchSales(currentPage);
      onAfterVoid?.();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo modificar la venta', { duration: 3000 });
    } finally {
      setBusy(false);
    }
  };

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
            const isVoided = sale.status === 'CANCELED';

            return (
              <div key={sale.id} className={`p-4 rounded-2xl border transition-all duration-200 ${
                isVoided
                  ? 'bg-elche-danger/5 border-elche-danger/30'
                  : isExpanded ? 'border-elche-primary shadow-md bg-white' : 'bg-elche-gray/20 border-elche-gray/50 hover:border-elche-green/30 hover:bg-white'}`}>
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center mb-0 cursor-pointer" onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}>
                  <div>
                    <div className="text-xs text-elche-text-light mb-1 font-bold uppercase tracking-wide flex gap-2 items-center flex-wrap">
                      <span>{dateStr}</span>
                      <span className="opacity-50">|</span>
                      <span>{timeStr}</span>
                      {isVoided && (
                        <span className="bg-elche-danger/10 text-elche-danger border border-elche-danger/20 px-2 py-0.5 rounded-full text-[10px]">
                          🚫 ANULADA
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-elche-text-light font-mono bg-white px-2 py-0.5 rounded border border-elche-gray/30 w-fit">
                      ID: {sale.id.substring(0, 8)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-elche-text-light mb-0.5 font-medium">
                      {sale.total_items} art.
                    </div>
                    <div className={`text-xl font-bold ${isVoided ? 'text-elche-text-light line-through' : 'text-elche-green'}`}>
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

                {/* Motivo si está anulada */}
                {isVoided && sale.void_reason && (
                  <div className="mt-2 text-xs text-elche-danger font-medium">
                    Motivo: {sale.void_reason}
                  </div>
                )}

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

                    {/* Acciones: solo en ventas no anuladas */}
                    {!isVoided && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleModify(sale)}
                          disabled={busy}
                          className="flex-1 py-2.5 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:border-elche-primary hover:text-elche-primary transition-colors disabled:opacity-50">
                          ✏️ Modificar
                        </button>
                        <button
                          onClick={() => { setVoidTarget(sale); setReason(''); }}
                          disabled={busy}
                          className="flex-1 py-2.5 rounded-xl bg-elche-danger/10 border border-elche-danger/30 text-elche-danger font-bold text-sm hover:bg-elche-danger hover:text-white transition-colors disabled:opacity-50">
                          🚫 Anular
                        </button>
                      </div>
                    )}
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

      {/* Modal de anulación con motivo obligatorio */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !busy && setVoidTarget(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-lg text-elche-text mb-1">Anular venta</div>
            <div className="text-xs text-elche-text-light mb-4">
              Se restaurará el stock de {voidTarget.total_items} artículo(s). Indica el motivo:
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {MOTIVOS.map(m => (
                <button
                  key={m}
                  onClick={() => setReason(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    reason === m ? 'bg-elche-primary text-white border-elche-primary' : 'bg-white border-elche-gray text-elche-text hover:border-elche-primary'}`}>
                  {m}
                </button>
              ))}
            </div>

            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Motivo de la anulación *"
              className="w-full p-3 rounded-xl border border-elche-gray focus:ring-2 focus:ring-elche-danger focus:outline-none mb-4"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={() => setVoidTarget(null)}
                disabled={busy}
                className="flex-1 py-3 rounded-xl bg-white border border-elche-gray text-elche-text font-bold hover:bg-elche-gray/20 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={confirmVoid}
                disabled={busy || !reason.trim()}
                className="flex-1 py-3 rounded-xl bg-elche-danger text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50">
                {busy ? '⏳ Anulando...' : 'Anular venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
