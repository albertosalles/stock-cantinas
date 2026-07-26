'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { Product, InventoryRow } from '../hooks/usePosData';
import { useAutoSaveInventory, SaveStatus } from '@/hooks/useAutoSaveInventory';
import {
  posStockState,
  POS_STATE_LABEL,
  POS_PILL_CLASS,
  POS_DOT_VAR,
  posCategoryIcon,
} from '@/lib/posUi';

type StockMode = 'actual' | 'inicial' | 'ajustes' | 'final';

interface PosStockTabProps {
  eventId: string;
  cantinaId: string;
  userId: string;
  products: Product[];
  inventory: InventoryRow[];
  onRefresh: () => void;
}

const MODES: { id: StockMode; label: string; icon: string }[] = [
  { id: 'actual', label: 'Actual', icon: 'monitoring' },
  { id: 'inicial', label: 'Inicial', icon: 'flag' },
  { id: 'ajustes', label: 'Ajustes', icon: 'tune' },
  { id: 'final', label: 'Final', icon: 'inventory' },
];

// Tipos de ajuste (con dirección) — se corresponden con stock_movements.type
const ADJ_TYPES: { id: string; label: string; icon: string; dir: 1 | -1 }[] = [
  { id: 'ADJUSTMENT', label: 'Ajuste', icon: 'tune', dir: 1 },
  { id: 'TRANSFER_IN', label: 'Entrada', icon: 'call_received', dir: 1 },
  { id: 'TRANSFER_OUT', label: 'Salida', icon: 'call_made', dir: -1 },
  { id: 'WASTE', label: 'Merma', icon: 'delete_sweep', dir: -1 },
  { id: 'RETURN', label: 'Devolución', icon: 'undo', dir: 1 },
];

export default function PosStockTab({
  eventId,
  cantinaId,
  userId,
  products,
  inventory,
  onRefresh,
}: PosStockTabProps) {
  const [mode, setMode] = useState<StockMode>('actual');

  const invMap = useMemo(() => {
    const m = new Map<string, InventoryRow>();
    inventory.forEach(r => m.set(r.product_id, r));
    return m;
  }, [inventory]);

  return (
    <>
      {/* Control segmentado */}
      <div className="flex-none px-3.5 pb-1 pt-3">
        <div className="flex gap-1 rounded-xl bg-[#eef2f0] p-[3px]">
          {MODES.map(m => {
            const on = m.id === mode;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-bold transition-colors ${
                  on
                    ? 'bg-[var(--c-primary)] text-white shadow-[0_3px_9px_rgba(0,150,79,.28)]'
                    : 'bg-transparent text-[var(--c-text-2)]'
                }`}
              >
                <span className="ms text-[17px]">{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === 'actual' && (
        <StockActual eventId={eventId} cantinaId={cantinaId} products={products} invMap={invMap} />
      )}
      {mode === 'inicial' && (
        <StockInicial eventId={eventId} cantinaId={cantinaId} userId={userId} products={products} />
      )}
      {mode === 'ajustes' && (
        <StockAjustes
          eventId={eventId} cantinaId={cantinaId} userId={userId}
          products={products} invMap={invMap} onRefresh={onRefresh}
        />
      )}
      {mode === 'final' && (
        <StockFinal
          eventId={eventId} cantinaId={cantinaId} userId={userId}
          products={products} invMap={invMap} onRefresh={onRefresh}
        />
      )}
    </>
  );
}

/* =============================================================
   STOCK · ACTUAL — solo lectura: KPIs + barra + pill de estado
   ============================================================= */
function StockActual({ eventId, cantinaId, products, invMap }: {
  eventId: string; cantinaId: string; products: Product[]; invMap: Map<string, InventoryRow>;
}) {
  // Inventario inicial (denominador de la barra de progreso)
  const [initialMap, setInitialMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('inventory_snapshots')
      .select('product_id, qty')
      .match({ event_id: eventId, cantina_id: cantinaId, kind: 'INITIAL' })
      .then(({ data }) => {
        if (cancelled) return;
        setInitialMap(new Map((data ?? []).map((r: any) => [r.product_id, r.qty as number])));
      });
    return () => { cancelled = true; };
  }, [eventId, cantinaId]);

  const rows = useMemo(() => products.map(p => {
    const inv = invMap.get(p.id);
    const qty = inv?.current_qty ?? 0;
    const threshold = inv?.low_stock_threshold ?? 0;
    const state = posStockState(qty, threshold);
    const initial = initialMap.get(p.id) ?? 0;
    const pct = initial > 0
      ? Math.max(6, Math.min(100, Math.round((qty / initial) * 100)))
      : (qty > 0 ? 100 : 0);
    return { id: p.id, name: p.name, cat: p.category ?? 'Otros', qty, state, pct };
  }), [products, invMap, initialMap]);

  // "A reponer": todo lo que no está OK (agotado + crítico + reponer)
  const toRestock = rows.filter(r => r.state !== 'ok').length;

  return (
    <>
      <div className="flex-none px-4 pb-0.5 pt-2">
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--c-text-muted)]">Productos</div>
            <div className="mt-0.5 text-lg font-extrabold text-[var(--c-text)]">{products.length}</div>
          </div>
          <div className="flex-1 rounded-xl border border-[var(--c-warn-bd)] bg-[var(--c-surface)] px-3 py-2.5">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--c-warn)]">A reponer</div>
            <div className="mt-0.5 text-lg font-extrabold text-[var(--c-warn)]">{toRestock}</div>
          </div>
        </div>
      </div>

      <div className="noscroll animate-fade-in flex-1 overflow-y-auto px-4 pb-6 pt-2.5">
        {products.length === 0 ? (
          <EmptyState icon="inventory_2" title="Sin catálogo" desc="Este evento no tiene productos activos" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map(r => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold tracking-[-0.01em] text-[var(--c-text)]">{r.name}</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-[var(--c-text-muted)]">{r.cat}</div>
                  <div className="mt-2 h-[5px] overflow-hidden rounded-[4px] bg-[#eef2f0]">
                    <div
                      className="h-full rounded-[4px] transition-[width] duration-500"
                      style={{ width: `${r.pct}%`, background: POS_DOT_VAR[r.state] }}
                    />
                  </div>
                </div>
                <div className="flex-none text-right">
                  <div className="text-xl font-extrabold tracking-[-0.02em] tabular-nums text-[var(--c-text)]">{r.qty}</div>
                  <span className={`mt-[3px] inline-block rounded-[20px] px-2.5 py-0.5 text-[10.5px] font-extrabold ${POS_PILL_CLASS[r.state]}`}>
                    {POS_STATE_LABEL[r.state]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* =============================================================
   STOCK · INICIAL — fija unidades de partida (autosave por campo)
   ============================================================= */
function StockInicial({ eventId, cantinaId, userId, products }: {
  eventId: string; cantinaId: string; userId: string; products: Product[];
}) {
  const autoSave = useAutoSaveInventory({
    eventId,
    cantinaId,
    userId,
    productIds: products.map(p => p.id),
    enabled: !!eventId && !!cantinaId && products.length > 0,
  });

  return (
    <>
      <div className="flex-none px-4 pb-1 pt-2">
        <div className="flex items-start gap-2.5 rounded-[13px] border border-[#cdeede] bg-[#eef8f2] px-3.5 py-3">
          <span className="ms text-xl text-[var(--c-primary)]">flag</span>
          <span className="text-xs font-semibold leading-[1.4] text-[var(--c-ok)] [text-wrap:pretty]">
            Fija las unidades de partida de cada producto al abrir la cantina. Se guarda solo, a medida que editas.
          </span>
        </div>
      </div>

      <div className="noscroll animate-fade-in flex-1 overflow-y-auto px-4 pb-4 pt-2.5">
        {products.length === 0 ? (
          <EmptyState icon="inventory_2" title="Sin catálogo" desc="Este evento no tiene productos activos" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {products.map(p => {
              const raw = autoSave.form[p.id];
              const value = raw === undefined ? '' : String(raw);
              return (
                <StepperRow
                  key={p.id}
                  name={p.name}
                  subtitle={p.category ?? 'Otros'}
                  status={autoSave.status[p.id]}
                  value={value}
                  onChange={v => autoSave.setValue(p.id, v)}
                  onDec={() => autoSave.decrement(p.id)}
                  onInc={() => autoSave.increment(p.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* =============================================================
   STOCK · AJUSTES — entradas/salidas/mermas con vista previa
   ============================================================= */
function StockAjustes({ eventId, cantinaId, userId, products, invMap, onRefresh }: {
  eventId: string; cantinaId: string; userId: string;
  products: Product[]; invMap: Map<string, InventoryRow>; onRefresh: () => void;
}) {
  const [adjType, setAdjType] = useState(ADJ_TYPES[0].id);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const dir = (ADJ_TYPES.find(a => a.id === adjType) ?? ADJ_TYPES[0]).dir;

  const step = (pid: string, delta: number) =>
    setDraft(s => {
      const now = Number(s[pid] || 0) + delta;
      return { ...s, [pid]: String(Math.max(0, now)) };
    });

  const pending = Object.values(draft).filter(v => Number(v) > 0).length;

  const apply = useCallback(async () => {
    const lines = Object.entries(draft)
      .map(([productId, raw]) => ({ productId, qty: Number(raw || 0) }))
      .filter(l => l.qty > 0)
      .map(l => ({
        productId: l.productId,
        delta: dir * l.qty,
        movementType: adjType,
        reason: ADJ_TYPES.find(a => a.id === adjType)?.label ?? 'Ajuste',
      }));

    if (!lines.length) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('adjust_stock_bulk', {
        p_event_id: eventId, p_cantina_id: cantinaId, p_user_id: userId, p_lines: lines,
      });
      if (error) throw error;
      setDraft({});
      onRefresh();
      toast.success('Ajustes aplicados', { duration: 2000 });
    } catch (e: any) {
      toast.error(e.message || 'No se pudieron aplicar los ajustes', { duration: 3000 });
    } finally {
      setBusy(false);
    }
  }, [draft, dir, adjType, eventId, cantinaId, userId, onRefresh]);

  return (
    <>
      {/* Chips de tipo de ajuste */}
      <div className="flex-none px-4 pb-0.5 pt-2.5">
        <div className="noscroll flex gap-2 overflow-x-auto pb-1">
          {ADJ_TYPES.map(a => {
            const on = a.id === adjType;
            return (
              <button
                key={a.id}
                onClick={() => setAdjType(a.id)}
                className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[22px] px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                  on
                    ? 'border border-[var(--c-primary)] bg-[var(--c-primary)] text-white shadow-[0_3px_9px_rgba(0,150,79,.28)]'
                    : 'border border-[var(--c-border-input)] bg-[var(--c-surface)] text-[var(--c-text-2)]'
                }`}
              >
                <span className="ms text-[16px]">{a.icon}</span>
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="noscroll animate-fade-in flex-1 overflow-y-auto px-4 pb-4 pt-2">
        {products.length === 0 ? (
          <EmptyState icon="inventory_2" title="Sin catálogo" desc="Este evento no tiene productos activos" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {products.map(p => {
              const cur = invMap.get(p.id)?.current_qty ?? 0;
              const qty = Number(draft[p.id] || 0);
              const active = qty > 0;
              const next = Math.max(0, cur + dir * qty);
              return (
                <StepperRow
                  key={p.id}
                  name={p.name}
                  subtitle={`Stock: ${cur}`}
                  preview={active ? {
                    text: `${dir > 0 ? '+' : '−'}${qty} → ${next}`,
                    positive: dir > 0,
                  } : undefined}
                  value={draft[p.id] ?? ''}
                  placeholder="0"
                  onChange={v => setDraft(s => ({ ...s, [p.id]: v }))}
                  onDec={() => step(p.id, -1)}
                  onInc={() => step(p.id, 1)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Barra de acción */}
      <ActionBar>
        <PrimaryButton
          icon="published_with_changes"
          label={pending > 0 ? `Aplicar ajustes · ${pending}` : 'Sin ajustes pendientes'}
          disabled={pending === 0 || busy}
          busy={busy}
          onClick={apply}
        />
      </ActionBar>
    </>
  );
}

/* =============================================================
   STOCK · FINAL — recuento de cierre (sugerido = stock actual)
   ============================================================= */
function StockFinal({ eventId, cantinaId, userId, products, invMap, onRefresh }: {
  eventId: string; cantinaId: string; userId: string;
  products: Product[]; invMap: Map<string, InventoryRow>; onRefresh: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const suggested = useCallback((pid: string) => invMap.get(pid)?.current_qty ?? 0, [invMap]);

  const step = (pid: string, delta: number) =>
    setDraft(s => {
      const base = s[pid] !== undefined ? Number(s[pid]) : suggested(pid);
      return { ...s, [pid]: String(Math.max(0, base + delta)) };
    });

  const edited = products.filter(p => {
    const v = draft[p.id];
    return v !== undefined && Number(v) !== suggested(p.id);
  }).length;

  const close = useCallback(async () => {
    const lines = products.map(p => {
      const v = draft[p.id];
      const qty = v !== undefined && v !== '' ? Number(v) : suggested(p.id);
      return { productId: p.id, qty: Math.max(0, qty) };
    });
    setBusy(true);
    try {
      const { error } = await supabase.rpc('set_final_inventory_bulk', {
        p_event_id: eventId, p_cantina_id: cantinaId, p_user_id: userId, p_lines: lines,
      });
      if (error) throw error;
      onRefresh();
      toast.success('Inventario final guardado', { duration: 2200 });
    } catch (e: any) {
      toast.error(e.message || 'No se pudo cerrar el inventario', { duration: 3000 });
    } finally {
      setBusy(false);
    }
  }, [products, draft, suggested, eventId, cantinaId, userId, onRefresh]);

  return (
    <>
      <div className="flex-none px-4 pb-1 pt-2">
        <div className="flex items-start gap-2.5 rounded-[13px] border border-[var(--c-border)] bg-[var(--c-bg)] px-3.5 py-3">
          <span className="ms text-xl text-[var(--c-text-2)]">inventory</span>
          <span className="text-xs font-semibold leading-[1.4] text-[var(--c-text-2)] [text-wrap:pretty]">
            Recuento de cierre. El sugerido es el stock actual; edítalo solo si el conteo difiere.
          </span>
        </div>
      </div>

      <div className="noscroll animate-fade-in flex-1 overflow-y-auto px-4 pb-4 pt-2.5">
        {products.length === 0 ? (
          <EmptyState icon="inventory_2" title="Sin catálogo" desc="Este evento no tiene productos activos" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {products.map(p => {
              const sug = suggested(p.id);
              const v = draft[p.id] !== undefined ? draft[p.id] : String(sug);
              const diff = Number(v || 0) - sug;
              return (
                <StepperRow
                  key={p.id}
                  name={p.name}
                  subtitle={`Sugerido: ${sug}`}
                  diff={diff !== 0 ? diff : undefined}
                  value={v}
                  onChange={val => setDraft(s => ({ ...s, [p.id]: val }))}
                  onDec={() => step(p.id, -1)}
                  onInc={() => step(p.id, 1)}
                />
              );
            })}
          </div>
        )}
      </div>

      <ActionBar>
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--c-text-muted)]">Recuento final</span>
          <span className="text-xs font-bold text-[var(--c-primary)]">
            {edited > 0 ? `${edited} editados` : 'todo según sugerido'}
          </span>
        </div>
        <PrimaryButton icon="lock" label="Cerrar inventario" disabled={busy} busy={busy} onClick={close} />
      </ActionBar>
    </>
  );
}

/* =============================================================
   Piezas compartidas
   ============================================================= */
function StepperRow({
  name, subtitle, status, preview, diff, value, placeholder, onChange, onDec, onInc,
}: {
  name: string;
  subtitle: string;
  status?: SaveStatus;
  preview?: { text: string; positive: boolean };
  diff?: number;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-extrabold tracking-[-0.01em] text-[var(--c-text)]">{name}</span>
          <SaveIndicator status={status} />
        </div>
        <div className="mt-0.5 text-[11px] font-semibold text-[var(--c-text-muted)]">{subtitle}</div>

        {preview && (
          <div
            className="mt-[3px] text-[11.5px] font-extrabold"
            style={{ color: preview.positive ? 'var(--c-ok)' : 'var(--c-crit)' }}
          >
            {preview.text}
          </div>
        )}
        {diff !== undefined && (
          <span
            className={`mt-1 inline-flex items-center rounded-[20px] px-2 py-0.5 text-[10.5px] font-extrabold ${
              diff >= 0 ? 'bg-[var(--c-ok-bg)] text-[var(--c-ok)]' : 'bg-[var(--c-crit-bg)] text-[var(--c-crit)]'
            }`}
          >
            Δ {diff > 0 ? '+' : ''}{diff}
          </span>
        )}
      </div>

      <button
        onClick={onDec}
        aria-label={`Restar una unidad de ${name}`}
        className="flex h-[38px] w-[34px] flex-none items-center justify-center rounded-[10px] border border-[var(--c-border-input)] bg-[var(--c-surface-alt)] text-[var(--c-text-2)] transition-transform active:scale-90"
      >
        <span className="ms text-[19px]">remove</span>
      </button>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="h-[38px] w-16 flex-none rounded-[10px] border border-[var(--c-border-input)] bg-[var(--c-surface-sub)] text-center text-base font-extrabold text-[var(--c-text)] outline-none focus:border-[var(--c-primary)] focus:bg-white"
      />
      <button
        onClick={onInc}
        aria-label={`Sumar una unidad de ${name}`}
        className="flex h-[38px] w-[34px] flex-none items-center justify-center rounded-[10px] border border-[#cdeede] bg-[#eef8f2] text-[var(--c-primary)] transition-transform active:scale-90"
      >
        <span className="ms text-[19px]">add</span>
      </button>
    </div>
  );
}

function SaveIndicator({ status }: { status?: SaveStatus }) {
  if (status === 'saving') return <span className="ms animate-pulse text-[14px] text-[var(--c-warn)]" title="Guardando…">sync</span>;
  if (status === 'saved') return <span className="ms text-[14px] text-[var(--c-primary)]" title="Guardado">check_circle</span>;
  if (status === 'error') return <span className="ms text-[14px] text-[var(--c-crit)]" title="Error al guardar">error</span>;
  return null;
}

function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-none border-t border-[#edf4f0] bg-[var(--c-surface)] px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_18px_-10px_rgba(16,40,26,.18)]">
      {children}
    </div>
  );
}

function PrimaryButton({ icon, label, disabled, busy, onClick }: {
  icon: string; label: string; disabled?: boolean; busy?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-[14px] border-none px-4 py-3.5 text-[15px] font-extrabold text-white transition-transform ${
        disabled
          ? 'cursor-not-allowed bg-[#b9c9c0]'
          : 'bg-[var(--c-primary)] shadow-[0_6px_16px_rgba(0,150,79,.3)] active:translate-y-px'
      }`}
    >
      <span className={`ms text-[21px] ${busy ? 'animate-spin' : ''}`}>{busy ? 'progress_activity' : icon}</span>
      {label}
    </button>
  );
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="py-16 text-center">
      <span className="ms text-[40px] text-[#bfe3cf]">{icon}</span>
      <div className="mt-2 text-[12.5px] font-bold text-[var(--c-text-2)]">{title}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-[var(--c-text-muted)]">{desc}</div>
    </div>
  );
}
