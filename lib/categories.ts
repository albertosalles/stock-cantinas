// Categorías de producto (conjunto fijo). La categoría es intrínseca al producto
// global (products.category); NULL significa sin categorizar ("Otros").
// Añadir una categoría aquí + en el CHECK de products.category (migración) basta.

export const PRODUCT_CATEGORIES = ['Bebida', 'Comida', 'Snacks'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const UNCATEGORIZED_LABEL = 'Otros';

export const CATEGORY_ICON: Record<string, string> = {
  Bebida: '🥤',
  Comida: '🍔',
  Snacks: '🍿',
  [UNCATEGORIZED_LABEL]: '📦',
};

export function categoryIcon(category: string | null | undefined): string {
  return CATEGORY_ICON[category ?? UNCATEGORIZED_LABEL] ?? CATEGORY_ICON[UNCATEGORIZED_LABEL];
}
