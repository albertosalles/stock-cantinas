'use client';

import React from 'react';
import { Product, InventoryRow } from '../hooks/usePosData';
import { posStockState, POS_DOT_VAR, eurFromCents } from '@/lib/posUi';

interface ProductCardProps {
  product: Product;
  inventory?: InventoryRow;
  /** Unidades ya añadidas al ticket: pinta el badge flotante. */
  cartQty: number;
  /** true mientras dura el feedback táctil de "añadido" (300 ms). */
  pulsing: boolean;
  onAdd: () => void;
}

/**
 * Tarjeta de producto de la vista Venta (design.md §7, fila "Tarjeta producto (POS)").
 * Reposo → borde --c-border · pulsado → scale(.97) · agotado → opacity .55 sin tap.
 *
 * Nota: §7 pide `contain:content` por tarjeta para listas largas, pero la
 * contención de pintado recortaría el badge de cantidad (sobresale -7px).
 * Se usa `contain:layout style`, que mantiene el aislamiento sin recortar.
 */
export default function ProductCard({ product, inventory, cartQty, pulsing, onAdd }: ProductCardProps) {
  const qty = inventory?.current_qty ?? 0;
  const threshold = inventory?.low_stock_threshold ?? 0;
  const state = posStockState(qty, threshold);
  const soldOut = state === 'agotado';

  const handlePress = () => {
    if (soldOut) return;
    // Feedback háptico inmediato: en barra el camarero no mira la pantalla
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(35);
    onAdd();
  };

  return (
    <button
      onClick={handlePress}
      disabled={soldOut}
      aria-label={`${product.name}, ${eurFromCents(product.price_cents)}, stock ${qty}`}
      className={`relative flex min-h-[118px] flex-col justify-between rounded-[15px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 pb-[11px] pt-3 text-left transition-shadow duration-150 [contain:layout_style] ${
        soldOut
          ? 'cursor-not-allowed opacity-55'
          : 'cursor-pointer active:scale-[0.97] active:shadow-[0_2px_6px_rgba(16,40,26,.12)] active:duration-100'
      } ${pulsing ? 'animate-cardtap' : ''}`}
    >
      {cartQty > 0 && (
        <span className="animate-pop absolute -right-[7px] -top-[7px] flex h-6 min-w-[24px] items-center justify-center rounded-[13px] border-2 border-white bg-[var(--c-primary)] px-1.5 text-[12.5px] font-extrabold text-white shadow-[0_3px_8px_rgba(0,150,79,.4)]">
          {cartQty}
        </span>
      )}

      <div className="text-[15px] font-extrabold leading-[1.25] tracking-[-0.01em] text-[var(--c-text)] [text-wrap:pretty]">
        {product.name}
      </div>

      <div>
        <div className="mt-2 text-[17px] font-extrabold tracking-[-0.01em] text-[var(--c-primary)]">
          {eurFromCents(product.price_cents)}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className="h-2 w-2 flex-none rounded-full"
            style={{ background: POS_DOT_VAR[state] }}
          />
          <span className="text-[11.5px] font-semibold text-[var(--c-text-muted)]">
            {soldOut ? 'Agotado' : `Stock: ${qty}`}
          </span>
        </div>
      </div>
    </button>
  );
}
