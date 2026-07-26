'use client';

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { usePosHistory, Sale } from '../hooks/usePosHistory';
import { Product } from '../hooks/usePosData';
import { voidSale } from '@/lib/sales';
import { eurFromCents } from '@/lib/posUi';

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

const MOTIVOS = ['Error de cobro', 'Producto equivocado', 'Cliente se arrepiente', 'Cantidad incorrecta'];

export default function PosHistoryTab({
  eventId, cantinaId, waiterId, products, sessionChecked, active, onModify, onAfterVoid,
}: PosHistoryTabProps) {
  const { sales, currentPage, totalSales, loading, fetchSales, SALES_PER_PAGE } =
    usePosHistory(eventId, cantinaId, sessionChecked);

  // Refresca al entrar en la pestaña (para ver ventas recién hechas)
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) fetchSales(currentPage);
    wasActive.current = active;
  }, [active, fetchSales, currentPage]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalSales / SALES_PER_PAGE));

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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabecera */}
      <div className="flex flex-none items-center justify-between px-4 pb-2 pt-3.5">
        <h2 className="m-0 text-base font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
          Historial de ventas
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--c-primary-tint)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--c-primary)]">
            {totalSales} {totalSales === 1 ? 'ticket' : 'tickets'}
          </span>
          <button
            onClick={() => fetchSales(currentPage)}
            title="Recargar"
            aria-label="Recargar historial"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-2)] transition-colors active:text-[var(--c-primary)]"
          >
            <span className={`ms text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="noscroll animate-fade-in flex-1 overflow-y-auto px-4 pb-6 pt-1">
        {loading && sales.length === 0 ? (
          <div className="py-16 text-center">
            <span className="ms animate-spin text-[32px] text-[var(--c-primary)]">progress_activity</span>
            <div className="mt-2 text-[13px] font-semibold text-[var(--c-text-muted)]">Cargando ventas…</div>
          </div>
        ) : sales.length === 0 ? (
          <div className="py-16 text-center">
            <span className="ms text-[40px] text-[#bfe3cf]">receipt_long</span>
            <div className="mt-2 text-[12.5px] font-bold text-[var(--c-text-2)]">Sin ventas todavía</div>
            <div className="mt-0.5 text-[11px] font-semibold text-[var(--c-text-muted)]">
              Los tickets aparecerán aquí a medida que cobres
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sales.map(sale => {
              const time = new Date(sale.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
              const voided = sale.status === 'CANCELED';
              const open = expandedId === sale.id;
              return (
                <div
                  key={sale.id}
                  className={`overflow-hidden rounded-[14px] border bg-[var(--c-surface)] ${
                    voided ? 'border-[var(--c-crit-bd)]' : open ? 'border-[var(--c-primary)]' : 'border-[var(--c-border)]'
                  }`}
                >
                  {/* Fila principal */}
                  <button
                    onClick={() => setExpandedId(open ? null : sale.id)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-[#fafcfb]"
                  >
                    <span
                      className={`flex h-10 w-10 flex-none items-center justify-center rounded-[11px] ${
                        voided ? 'bg-[var(--c-crit-bg)] text-[var(--c-crit)]' : 'bg-[var(--c-primary-tint)] text-[var(--c-primary)]'
                      }`}
                    >
                      <span className="ms text-[21px]">{voided ? 'block' : 'shopping_bag'}</span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-extrabold ${voided ? 'text-[var(--c-text-faint)] line-through' : 'text-[var(--c-text)]'}`}>
                        {eurFromCents(sale.total_cents)}
                      </div>
                      <div className="mt-px flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--c-text-muted)]">
                        {sale.total_items} {sale.total_items === 1 ? 'artículo' : 'artículos'}
                        {voided && <span className="font-bold text-[var(--c-crit)]">· ANULADA</span>}
                      </div>
                    </div>

                    <div className="flex flex-none items-center gap-1.5">
                      <span className="text-xs font-bold text-[var(--c-text-faint)]">{time}</span>
                      <span className="ms text-lg text-[var(--c-text-muted)]">{open ? 'expand_less' : 'expand_more'}</span>
                    </div>
                  </button>

                  {/* Detalle */}
                  {open && (
                    <div className="animate-fade-in border-t border-[var(--c-divider)] bg-[#fbfdfc] px-3.5 pb-3.5 pt-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
                        Productos
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {sale.sale_lines.map((line, idx) => {
                          const p = products.find(x => x.id === line.product_id);
                          return (
                            <div key={idx} className="flex items-center justify-between gap-3 text-[12.5px]">
                              <span className="flex min-w-0 items-center gap-2 text-[var(--c-text)]">
                                <span className="shrink-0 rounded-md border border-[var(--c-border-input)] bg-white px-1.5 py-0.5 text-[11px] font-bold text-[var(--c-text-muted)]">
                                  {line.qty}×
                                </span>
                                <span className="truncate font-medium">{p?.name ?? 'Producto desconocido'}</span>
                              </span>
                              <span className="shrink-0 font-bold text-[var(--c-text-2)]">
                                {eurFromCents(line.price_cents * line.qty)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {voided && sale.void_reason && (
                        <div className="mt-2.5 text-[11.5px] font-semibold text-[var(--c-crit)]">
                          Motivo: {sale.void_reason}
                        </div>
                      )}

                      {!voided && (
                        <div className="mt-3.5 flex gap-2">
                          <button
                            onClick={() => handleModify(sale)}
                            disabled={busy}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] border border-[var(--c-border-input)] bg-[var(--c-surface)] py-2.5 text-[12.5px] font-bold text-[var(--c-text-2)] transition-colors active:border-[var(--c-primary)] active:text-[var(--c-primary)] disabled:opacity-50"
                          >
                            <span className="ms text-[17px]">edit</span>
                            Modificar
                          </button>
                          <button
                            onClick={() => { setVoidTarget(sale); setReason(''); }}
                            disabled={busy}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] border border-[var(--c-crit-bd)] bg-[var(--c-crit-bg)] py-2.5 text-[12.5px] font-bold text-[var(--c-crit)] transition-colors active:bg-[var(--c-crit)] active:text-white disabled:opacity-50"
                          >
                            <span className="ms text-[17px]">block</span>
                            Anular
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
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => fetchSales(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-2)] transition-colors active:text-[var(--c-primary)] disabled:opacity-40"
            >
              <span className="ms text-lg">chevron_left</span>
            </button>
            <span className="rounded-full bg-[var(--c-surface-alt)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--c-text)]">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => fetchSales(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-2)] transition-colors active:text-[var(--c-primary)] disabled:opacity-40"
            >
              <span className="ms text-lg">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal de anulación con motivo obligatorio */}
      {voidTarget && (
        <div
          className="animate-overlay absolute inset-0 z-50 flex items-end justify-center bg-[rgba(10,30,20,.45)] p-4"
          onClick={() => !busy && setVoidTarget(null)}
        >
          <div
            className="animate-sheetup w-full max-w-sm rounded-[22px] bg-[var(--c-surface)] p-5 shadow-[0_-12px_40px_rgba(10,30,20,.25)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-lg font-extrabold tracking-[-0.01em] text-[var(--c-text)]">Anular venta</div>
            <div className="mb-4 mt-1 text-xs font-semibold text-[var(--c-text-muted)]">
              Se restaurará el stock de {voidTarget.total_items} artículo(s). Indica el motivo:
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {MOTIVOS.map(m => (
                <button
                  key={m}
                  onClick={() => setReason(m)}
                  className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                    reason === m
                      ? 'border border-[var(--c-primary)] bg-[var(--c-primary)] text-white'
                      : 'border border-[var(--c-border-input)] bg-[var(--c-surface)] text-[var(--c-text-2)]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Motivo de la anulación *"
              autoFocus
              className="mb-4 w-full rounded-[11px] border border-[var(--c-border-input)] bg-[var(--c-surface-sub)] px-3 py-3 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-crit)]"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setVoidTarget(null)}
                disabled={busy}
                className="flex-1 rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] py-3 text-sm font-bold text-[var(--c-text)] transition-colors active:bg-[var(--c-bg)] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmVoid}
                disabled={busy || !reason.trim()}
                className="flex-1 rounded-[12px] bg-[var(--c-crit)] py-3 text-sm font-bold text-white transition-colors active:brightness-95 disabled:opacity-50"
              >
                {busy ? 'Anulando…' : 'Anular venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
