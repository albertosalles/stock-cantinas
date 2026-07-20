import React, { useMemo, useState } from 'react';
import { Product, InventoryRow } from '../hooks/usePosData';
import ProductCard from './ProductCard';
import CartSidebar from './CartSidebar';
import MobileCartDrawer from './MobileCartDrawer';
import { PRODUCT_CATEGORIES, UNCATEGORIZED_LABEL, categoryIcon } from '@/lib/categories';

interface PosSalesTabProps {
  products: Product[];
  invMap: Map<string, InventoryRow>;
  cart: { productId: string; qty: number }[];
  totalEur: number;
  onAddOne: (id: string) => void;
  onDecOne: (id: string) => void;
  onClear: () => void;
  onOpenPayment: () => void;
}

// Valor especial para la pestaña "Todos"
const ALL = '__all__';

export default function PosSalesTab({ products, invMap, cart, totalEur, onAddOne, onDecOne, onClear, onOpenPayment }: PosSalesTabProps) {
  const [selected, setSelected] = useState<string>(ALL);

  // Solo mostramos pestañas de categorías que realmente tienen productos activos.
  const availableCategories = useMemo(() => {
    const present = new Set(products.map(p => p.category ?? UNCATEGORIZED_LABEL));
    const ordered = [
      ...PRODUCT_CATEGORIES.filter(c => present.has(c)),
      ...(present.has(UNCATEGORIZED_LABEL) ? [UNCATEGORIZED_LABEL] : []),
    ];
    return ordered;
  }, [products]);

  const filtered = useMemo(() => {
    if (selected === ALL) return products;
    return products.filter(p => (p.category ?? UNCATEGORIZED_LABEL) === selected);
  }, [products, selected]);

  return (
    <section className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-5 pb-32 md:pb-0">
      <div className="content-start">
        {/* Pestañas de categoría (solo si hay más de una categoría) */}
        {availableCategories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-1 -mx-1 px-1 no-scrollbar">
            <CategoryTab label="Todos" icon="🗂️" active={selected === ALL} onClick={() => setSelected(ALL)} />
            {availableCategories.map(c => (
              <CategoryTab key={c} label={c} icon={categoryIcon(c)} active={selected === c} onClick={() => setSelected(c)} />
            ))}
          </div>
        )}

        {/* Productos Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 content-start">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              inventory={invMap.get(p.id)}
              onAdd={() => onAddOne(p.id)}
            />
          ))}
        </div>
      </div>

      {/* Carrito Desktop */}
      <CartSidebar
        cart={cart}
        products={products}
        totalEur={totalEur}
        onAddOne={onAddOne}
        onDecOne={onDecOne}
        onClear={onClear}
        onPay={onOpenPayment}
      />

      {/* Carrito Mobile */}
      <MobileCartDrawer
        cart={cart}
        products={products}
        totalEur={totalEur}
        onAddOne={onAddOne}
        onDecOne={onDecOne}
        onClear={onClear}
        onPay={onOpenPayment}
      />
    </section>
  );
}

function CategoryTab({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-1.5 ${active
        ? 'bg-elche-primary text-white shadow-md'
        : 'bg-elche-gray text-elche-primary hover:bg-elche-primary/10'}`}
    >
      <span>{icon}</span> {label}
    </button>
  );
}
