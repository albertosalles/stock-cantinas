'use client';

import React, { useMemo, useState } from 'react';
import { Product, InventoryRow } from '../hooks/usePosData';
import ProductCard from './ProductCard';
import { PRODUCT_CATEGORIES, UNCATEGORIZED_LABEL } from '@/lib/categories';
import { posCategoryIcon, eurFromCents } from '@/lib/posUi';

interface PosSalesTabProps {
  products: Product[];
  invMap: Map<string, InventoryRow>;
  cart: { productId: string; qty: number }[];
  totalCents: number;
  /** id del producto con feedback táctil activo (300 ms tras añadir). */
  pulseId: string | null;
  onAddOne: (id: string) => void;
  onClear: () => void;
  onOpenTicket: () => void;
  loading: boolean;
}

const ALL = '__all__';

/**
 * Vista Venta (README "POS — Venta"): chips de categoría scrollables,
 * grid de productos 2/3 columnas y barra de cobro colapsable.
 */
export default function PosSalesTab({
  products,
  invMap,
  cart,
  totalCents,
  pulseId,
  onAddOne,
  onClear,
  onOpenTicket,
  loading,
}: PosSalesTabProps) {
  const [cat, setCat] = useState<string>(ALL);

  // Sólo se ofrecen categorías con productos activos en el evento
  const categories = useMemo(() => {
    const present = new Set(products.map(p => p.category ?? UNCATEGORIZED_LABEL));
    return [
      ...PRODUCT_CATEGORIES.filter(c => present.has(c)),
      ...(present.has(UNCATEGORIZED_LABEL) ? [UNCATEGORIZED_LABEL] : []),
    ];
  }, [products]);

  const filtered = useMemo(() => {
    if (cat === ALL) return products;
    return products.filter(p => (p.category ?? UNCATEGORIZED_LABEL) === cat);
  }, [products, cat]);

  const cartQtyById = useMemo(() => {
    const m = new Map<string, number>();
    cart.forEach(l => m.set(l.productId, l.qty));
    return m;
  }, [cart]);

  const count = cart.reduce((a, l) => a + l.qty, 0);
  const hasItems = count > 0;

  return (
    <>
      {/* Chips de categoría */}
      {categories.length > 1 && (
        <div className="flex-none px-3.5 pb-1 pt-3">
          <div className="noscroll flex gap-2 overflow-x-auto pb-1">
            <CategoryChip
              label="Todos"
              icon={posCategoryIcon('Todos')}
              active={cat === ALL}
              onClick={() => setCat(ALL)}
            />
            {categories.map(c => (
              <CategoryChip
                key={c}
                label={c}
                icon={posCategoryIcon(c)}
                active={cat === c}
                onClick={() => setCat(c)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Grid de productos */}
      <div className="noscroll animate-fade-in flex-1 overflow-y-auto px-3.5 pb-5 pt-2">
        {loading && products.length === 0 ? (
          <div className="py-16 text-center">
            <span className="ms animate-spin text-[32px] text-[var(--c-primary)]">progress_activity</span>
            <div className="mt-2 text-[13px] font-semibold text-[var(--c-text-muted)]">Cargando catálogo…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <span className="ms text-[40px] text-[#bfe3cf]">inventory_2</span>
            <div className="mt-2 text-[12.5px] font-bold text-[var(--c-text-2)]">Sin productos</div>
            <div className="mt-0.5 text-[11px] font-semibold text-[var(--c-text-muted)]">
              {products.length === 0
                ? 'Este evento no tiene catálogo activo'
                : `Nada en la categoría "${cat}"`}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 min-[360px]:grid-cols-3">
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                inventory={invMap.get(p.id)}
                cartQty={cartQtyById.get(p.id) ?? 0}
                pulsing={pulseId === p.id}
                onAdd={() => onAddOne(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Barra de cobro: sólo aparece con productos en el ticket */}
      {hasItems && (
        <div className="animate-fade-in relative z-10 flex flex-none items-center gap-2.5 border-t border-[#edf4f0] bg-[var(--c-surface)] px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_18px_-10px_rgba(16,40,26,.18)]">
          <button
            onClick={onClear}
            title="Vaciar"
            aria-label="Vaciar ticket"
            className="flex h-[46px] w-11 flex-none items-center justify-center rounded-xl border border-[#f7cccc] bg-[#fdeeee] text-[#e5484d] transition-transform active:scale-95"
          >
            <span className="ms text-[21px]">delete</span>
          </button>

          <button
            onClick={onOpenTicket}
            className="flex h-[46px] flex-1 items-center justify-between gap-3 rounded-[13px] border-none bg-[var(--c-primary)] px-4 text-white shadow-[0_5px_14px_rgba(0,150,79,.32)] transition-transform active:translate-y-px"
          >
            <span className="inline-flex items-center gap-2">
              <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-white/25 px-1.5 text-[12.5px] font-extrabold">
                {count}
              </span>
              <span className="text-sm font-extrabold tracking-[0.01em]">Ver carrito</span>
            </span>
            <span className="text-lg font-extrabold tracking-[-0.01em]">{eurFromCents(totalCents)}</span>
          </button>
        </div>
      )}
    </>
  );
}

function CategoryChip({ label, icon, active, onClick }: {
  label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[22px] px-4 py-2 text-[13px] font-bold transition-colors ${
        active
          ? 'border border-[var(--c-primary)] bg-[var(--c-primary)] text-white shadow-[0_3px_9px_rgba(0,150,79,.28)]'
          : 'border border-[var(--c-border-input)] bg-[var(--c-surface)] text-[var(--c-text-2)]'
      }`}
    >
      <span className="ms text-[17px]">{icon}</span>
      {label}
    </button>
  );
}
