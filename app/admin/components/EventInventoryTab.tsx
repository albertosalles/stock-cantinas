'use client';

import React, { useState } from 'react';
import { EventProductRow } from '../hooks/useAdminCatalog';
import { InventoryRow } from '../hooks/useAdminInventory';
import { useAutoSaveInventory, SaveStatus } from '@/hooks/useAutoSaveInventory';
import { categoryMsIcon, categoryTone, stockPillClass } from '@/lib/adminUi';

interface EventInventoryTabProps {
  eventId: string;
  cantinaId: string;
  loading: boolean;
  inventory: InventoryRow[];
  products: EventProductRow[];

  adjustForm: Record<string, number>;
  setAdjustForm: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  adjustType: string;
  setAdjustType: (val: any) => void;
  adjustReason: string;
  setAdjustReason: (val: string) => void;

  finalForm: Record<string, number>;
  setFinalForm: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  onApplyAdjust: () => Promise<void> | void;
  onSaveFinal: () => Promise<void> | void;
  onRefresh: () => void;
}

/**
 * Inventario de una cantina en una sola tabla: inicial (autoguardado),
 * ajustes pendientes, stock actual calculado e inventario final.
 */
export default function EventInventoryTab({
  eventId, cantinaId, loading, inventory, products,
  adjustForm, setAdjustForm, adjustType, setAdjustType, adjustReason, setAdjustReason,
  finalForm, setFinalForm, onApplyAdjust, onSaveFinal, onRefresh,
}: EventInventoryTabProps) {
  const [busy, setBusy] = useState<'adjust' | 'final' | null>(null);

  const invMap = new Map(inventory.map(r => [r.product_id, r]));

  // El inventario inicial se guarda solo, con indicador por fila
  const autoSave = useAutoSaveInventory({
    eventId,
    cantinaId,
    userId: process.env.NEXT_PUBLIC_APP_USER_ID ?? '',
    productIds: products.map(p => p.product_id),
    enabled: !!cantinaId && products.length > 0,
  });

  const pendingAdjust = Object.values(adjustForm).filter(v => v && v !== 0).length;

  const statusIcon = (s: SaveStatus | undefined) => {
    if (s === 'saving') return <span className="ms animate-pulse text-[14px] text-amber-500" title="Guardando…">sync</span>;
    if (s === 'saved') return <span className="ms text-[14px] text-elche-primary" title="Guardado">check_circle</span>;
    if (s === 'error') return <span className="ms text-[14px] text-red-500" title="Error al guardar">error</span>;
    return null;
  };

  const run = async (kind: 'adjust' | 'final', fn: () => Promise<void> | void) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e: any) {
      alert(e.message || 'No se pudo completar la operación');
    } finally {
      setBusy(null);
    }
  };

  const numInput =
    'w-[62px] rounded-lg border border-[#e0efe7] bg-[#f9fcfb] px-2 py-[7px] text-center text-[12.5px] font-bold text-elche-text outline-none focus:border-elche-primary focus:bg-white';
  const thClass = 'px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8aa397]';

  return (
    <div className="overflow-hidden rounded-2xl border border-elche-gray bg-white">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#f0f6f2] px-5 py-4">
        <span className="ms rounded-[10px] bg-elche-primary/10 p-[7px] text-xl text-elche-primary">inventory_2</span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[15px] font-extrabold tracking-tight text-elche-text">Inventario</h3>
          <div className="mt-0.5 text-[11.5px] font-semibold text-[#8aa397]">Inicial · Ajustes · Actual · Final</div>
        </div>
        <button
          onClick={onRefresh}
          title="Refrescar"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-elche-gray bg-elche-bg text-elche-text-light transition-colors hover:text-elche-primary"
        >
          <span className={`ms text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>

      {/* Tipo y motivo del ajuste */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#f0f6f2] bg-[#fbfdfc] px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">Ajuste</span>
        <select
          value={adjustType}
          onChange={e => setAdjustType(e.target.value)}
          className="cursor-pointer rounded-[9px] border border-[#e0efe7] bg-white px-2.5 py-2 text-[12.5px] font-semibold text-elche-text outline-none focus:border-elche-primary"
        >
          <option value="ADJUSTMENT">Manual</option>
          <option value="TRANSFER_IN">Entrada</option>
          <option value="TRANSFER_OUT">Salida</option>
          <option value="WASTE">Merma</option>
          <option value="RETURN">Devolución</option>
        </select>
        <input
          value={adjustReason}
          onChange={e => setAdjustReason(e.target.value)}
          placeholder="Motivo…"
          className="min-w-[160px] flex-1 rounded-[9px] border border-[#e0efe7] bg-white px-3 py-2 text-[12.5px] text-elche-text outline-none focus:border-elche-primary"
        />
        <button
          onClick={() => run('adjust', onApplyAdjust)}
          disabled={pendingAdjust === 0 || busy === 'adjust'}
          className="flex items-center gap-1.5 rounded-[9px] bg-amber-500 px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-40"
        >
          <span className="ms text-base">tune</span>
          {busy === 'adjust' ? 'Aplicando…' : `Aplicar ajustes${pendingAdjust ? ` (${pendingAdjust})` : ''}`}
        </button>
        <button
          onClick={() => run('final', onSaveFinal)}
          disabled={busy === 'final'}
          className="flex items-center gap-1.5 rounded-[9px] bg-elche-primary px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-elche-secondary disabled:opacity-40"
        >
          <span className="ms text-base">save</span>
          {busy === 'final' ? 'Guardando…' : 'Guardar final'}
        </button>
      </div>

      {loading && products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-elche-primary border-t-transparent" />
          <span className="font-medium text-elche-text-light">Cargando datos de inventario...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="py-12 text-center italic text-elche-text-light">
          Este evento no tiene productos en el catálogo todavía.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="bg-[#f7fbf9]">
                <th className={`text-left ${thClass} pl-5`}>Producto</th>
                <th className={`text-center ${thClass}`}>Inicial</th>
                <th className={`text-center ${thClass}`}>Ajustes</th>
                <th className={`text-center ${thClass} text-elche-primary`}>Stock actual</th>
                <th className={`text-center ${thClass} pr-5`}>Final</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const current = invMap.get(p.product_id)?.current_qty ?? 0;
                const delta = adjustForm[p.product_id] ?? 0;
                const projected = current + delta;
                const tone = categoryTone(p.category);
                return (
                  <tr key={p.product_id} className="border-t border-[#f0f6f2] transition-colors hover:bg-[#fafcfb]">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
                          style={{ background: tone.bg }}
                        >
                          <span className="ms text-lg" style={{ color: tone.fg }}>
                            {categoryMsIcon(p.category)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="whitespace-nowrap text-[13px] font-bold text-elche-text">{p.name}</span>
                            {statusIcon(autoSave.status[p.product_id])}
                          </div>
                          <div className="text-[10.5px] font-semibold text-[#8aa397]">
                            mín. {p.low_stock_threshold}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-2.5 py-2.5 text-center">
                      <input
                        type="number" min="0" placeholder="—"
                        value={autoSave.form[p.product_id] ?? ''}
                        onChange={e => autoSave.setValue(p.product_id, e.target.value)}
                        className={numInput}
                      />
                    </td>

                    <td className="px-2.5 py-2.5 text-center">
                      <input
                        type="number"
                        value={delta}
                        onChange={e =>
                          setAdjustForm(s => ({ ...s, [p.product_id]: parseInt(e.target.value || '0', 10) }))
                        }
                        className={`${numInput} w-[58px] ${delta !== 0 ? 'border-amber-400 text-amber-600' : 'text-elche-text-light'}`}
                      />
                    </td>

                    <td className="px-2.5 py-2.5 text-center">
                      <span className={stockPillClass(current, p.low_stock_threshold)}>{current}</span>
                      {delta !== 0 && (
                        <div className="mt-1 text-[10.5px] font-bold text-amber-600">→ {projected}</div>
                      )}
                    </td>

                    <td className="py-2.5 pl-2.5 pr-5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number" min="0" placeholder="—"
                          value={finalForm[p.product_id] ?? ''}
                          onChange={e =>
                            setFinalForm(s => ({ ...s, [p.product_id]: parseInt(e.target.value || '0', 10) }))
                          }
                          className={`${numInput} bg-white`}
                        />
                        <button
                          onClick={() => setFinalForm(s => ({ ...s, [p.product_id]: current }))}
                          title="Usar el stock calculado"
                          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#e0efe7] bg-white text-[#8aa397] transition-colors hover:border-[#bfe3cf] hover:text-elche-primary"
                        >
                          <span className="ms text-base">content_copy</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-1.5 border-t border-[#f0f6f2] px-5 py-3 text-[11.5px] text-[#8aa397]">
        <span className="ms text-[15px]">info</span>
        El inventario inicial se guarda automáticamente. Los ajustes y el inventario final requieren confirmación.
      </div>
    </div>
  );
}
