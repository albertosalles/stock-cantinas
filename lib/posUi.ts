// Helpers visuales del POS (design.md §5 + §7).
//
// La semántica de stock se comparte con el panel de administración:
// `stockLevel` vive en lib/adminUi.ts. Regla vigente:
//   agotado (0) → rojo siempre · <= umbral definido → ámbar · resto → verde.
// Aquí sólo se traduce ese nivel a los estilos concretos del terminal de barra.

import { stockLevel } from './adminUi';

export { stockLevel, hasThreshold } from './adminUi';
export type { StockLevel } from './adminUi';

/** Estado visual de un producto en el POS. */
export type PosStockState = 'agotado' | 'warn' | 'ok';

export function posStockState(qty: number, threshold: number): PosStockState {
  const level = stockLevel(qty, threshold);
  return level === 'out' ? 'agotado' : level === 'warn' ? 'warn' : 'ok';
}

/** Etiqueta de la pill de estado (vista Stock · Actual). */
export const POS_STATE_LABEL: Record<PosStockState, string> = {
  agotado: 'Agotado',
  warn: 'Reponer',
  ok: 'OK',
};

/**
 * Color del punto de stock de la tarjeta de producto y de la barra de progreso.
 * Variantes brillantes de los semánticos, declaradas en globals.css.
 */
export const POS_DOT_VAR: Record<PosStockState, string> = {
  agotado: 'var(--pos-dot-crit)',
  warn: 'var(--pos-dot-warn)',
  ok: 'var(--pos-dot-ok)',
};

/** Clases de la pill de estado, con los semánticos fg/bg de design.md §6. */
export const POS_PILL_CLASS: Record<PosStockState, string> = {
  agotado: 'text-[var(--c-crit)] bg-[var(--c-crit-bg)]',
  warn: 'text-[var(--c-warn)] bg-[var(--c-warn-bg)]',
  ok: 'text-[var(--c-ok)] bg-[var(--c-ok-bg)]',
};

/** Icono Material Symbols por estado (design.md §1, tabla de semánticos). */
export const POS_STATE_ICON: Record<PosStockState, string> = {
  agotado: 'error',
  warn: 'warning',
  ok: 'check_circle',
};

/**
 * Importe en euros con formato es-ES ("3,50 €").
 * El POS trabaja en euros; el backend persiste céntimos.
 */
export function eurFromCents(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

export function eurFromNumber(value: number): string {
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

/** Icono Material Symbols por categoría, para los chips de la vista Venta. */
export const POS_CATEGORY_ICON: Record<string, string> = {
  Todos: 'apps',
  Bebida: 'local_bar',
  Comida: 'lunch_dining',
  Snacks: 'bakery_dining',
  Otros: 'inventory_2',
};

export function posCategoryIcon(category: string): string {
  return POS_CATEGORY_ICON[category] ?? 'inventory_2';
}
