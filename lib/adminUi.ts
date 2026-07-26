// Helpers visuales compartidos por el panel de administración.
// Centralizan la paleta derivada del diseño (avatares, iconos de cantina,
// semáforo de stock) para que las tarjetas y tablas hablen el mismo idioma.

import { PRODUCT_CATEGORIES, UNCATEGORIZED_LABEL } from './categories';

/** Degradados verdes para los avatares de camarero. */
const AVATAR_GRADIENTS = [
  'linear-gradient(145deg,#20b368,#007a3d)',
  'linear-gradient(145deg,#00964f,#005e2f)',
  'linear-gradient(145deg,#2bb673,#0a7a44)',
  'linear-gradient(145deg,#18a35c,#046b39)',
];

export function avatarBg(index: number): string {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}

/** Iconos y fondos que identifican visualmente cada cantina. */
const CANTINA_ICONS = ['sports_bar', 'local_bar', 'stadium', 'liquor', 'nightlife', 'diamond'];
const CANTINA_ICON_BGS = [
  'linear-gradient(145deg,#20b368,#007a3d)',
  'linear-gradient(145deg,#00964f,#005e2f)',
  'linear-gradient(145deg,#2bb673,#0a7a44)',
  'linear-gradient(145deg,#18a35c,#046b39)',
  'linear-gradient(145deg,#25a866,#037a41)',
  'linear-gradient(145deg,#c99a2e,#a06f0e)',
];

/** Índice estable a partir del id, para que una cantina no cambie de icono al reordenar. */
function hashIndex(id: string, len: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % len;
}

export function cantinaIcon(id: string): string {
  return CANTINA_ICONS[hashIndex(id, CANTINA_ICONS.length)];
}

export function cantinaIconBg(id: string): string {
  return CANTINA_ICON_BGS[hashIndex(id, CANTINA_ICON_BGS.length)];
}

/** Icono Material Symbols por categoría de producto. */
const CATEGORY_MS_ICON: Record<string, string> = {
  Bebida: 'local_drink',
  Comida: 'lunch_dining',
  Snacks: 'fastfood',
  [UNCATEGORIZED_LABEL]: 'inventory_2',
};

export function categoryMsIcon(category: string | null | undefined): string {
  return CATEGORY_MS_ICON[category ?? UNCATEGORIZED_LABEL] ?? CATEGORY_MS_ICON[UNCATEGORIZED_LABEL];
}

/** Color de acento por categoría (texto + fondo del icono). */
const CATEGORY_TONE: Record<string, { fg: string; bg: string }> = {
  Bebida: { fg: '#00964f', bg: 'rgba(0,150,79,.10)' },
  Comida: { fg: '#c98a1a', bg: 'rgba(245,158,11,.12)' },
  Snacks: { fg: '#7a5cc9', bg: 'rgba(122,92,201,.10)' },
  [UNCATEGORIZED_LABEL]: { fg: '#4a5f52', bg: 'rgba(74,95,82,.10)' },
};

export function categoryTone(category: string | null | undefined) {
  return CATEGORY_TONE[category ?? UNCATEGORIZED_LABEL] ?? CATEGORY_TONE[UNCATEGORIZED_LABEL];
}

export const CATEGORY_FILTERS = ['Todos', ...PRODUCT_CATEGORIES, UNCATEGORIZED_LABEL] as const;

export type StockLevel = 'out' | 'warn' | 'ok';

/**
 * Semáforo de stock. Dos conceptos distintos, deliberadamente separados:
 *
 *  - `out`  (ROJO)     agotado: no quedan unidades. Es un HECHO, no depende
 *                      de ninguna configuración → siempre se marca en rojo,
 *                      tenga umbral definido o no.
 *  - `warn` (ÁMBAR)    ha llegado al mínimo que el administrador fijó para
 *                      ese producto. Requiere umbral definido (> 0).
 *  - `ok`   (VERDE)    resto.
 *
 * `low_stock_threshold` vale 0 por defecto en la BD, y ese 0 significa
 * "sin umbral definido": sin umbral no hay aviso ámbar ni notificación,
 * pero el agotado se sigue viendo en rojo.
 *
 * OJO — esto diverge de design.md §1, que definía el rojo como
 * `actual <= umbral` y el ámbar como `actual <= umbral*2`. Se cambia por
 * decisión de producto: el rojo se reserva a "agotado" y el ámbar pasa a ser
 * "en el mínimo fijado". Conviene reflejarlo en design.md §1 para que el
 * contrato siga siendo la fuente de verdad.
 */
export function stockLevel(qty: number, threshold: number): StockLevel {
  if (qty <= 0) return 'out';
  if (threshold > 0 && qty <= threshold) return 'warn';
  return 'ok';
}

/**
 * true si el administrador ha definido un umbral para el producto.
 * Es la condición que habilita las notificaciones de bajo stock: sin umbral
 * explícito no se avisa al administrador (aunque el producto se vea en rojo
 * por estar agotado).
 */
export function hasThreshold(threshold: number | null | undefined): boolean {
  return (threshold ?? 0) > 0;
}

const STOCK_CLASSES: Record<StockLevel, string> = {
  out: 'bg-[#fdecec] text-[#d63838] border-[#f5b5b5]',
  warn: 'bg-[#fff7e6] text-[#b0790a] border-[#f3d78f]',
  ok: 'bg-[#eef6f1] text-[#2a6b45] border-[#dcefe4]',
};

/** Clases de la píldora numérica de stock (tablas de inventario y matriz global). */
export function stockPillClass(qty: number, threshold: number): string {
  return `inline-flex min-w-[42px] items-center justify-center rounded-lg border px-2.5 py-1 text-[13px] font-extrabold tabular-nums ${
    STOCK_CLASSES[stockLevel(qty, threshold)]
  }`;
}

/** Icono y color por tipo de incidencia (ver `lib/incidents.ts`). */
const INCIDENT_TONE: Record<string, { icon: string; fg: string; bg: string }> = {
  STOCK: { icon: 'inventory_2', fg: '#d63838', bg: '#fdecec' },
  TECH: { icon: 'build', fg: '#b0790a', bg: '#fff7e6' },
  OTHER: { icon: 'help', fg: '#6b7d72', bg: '#f0f4f2' },
};

export function incidentTone(type: string) {
  return INCIDENT_TONE[type] ?? INCIDENT_TONE.OTHER;
}

/** Formatea céntimos como euros (es-ES). */
export function eur(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

/** Versión compacta sin decimales, para tarjetas ("1.284 €", "—" si no hay ventas). */
export function eurShort(cents: number): string {
  if (!cents) return '—';
  return Math.round(cents / 100).toLocaleString('es-ES') + ' €';
}
