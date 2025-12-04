import React from 'react';
import { Product, InventoryRow } from '../hooks/usePosData';
import ProductCard from './ProductCard';
import CartSidebar from './CartSidebar';
import MobileCartDrawer from './MobileCartDrawer';

interface PosSalesTabProps {
  products: Product[];
  invMap: Map<string, InventoryRow>;
  cart: { productId: string; qty: number }[];
  totalEur: number;
  onAddOne: (id: string) => void;
  onDecOne: (id: string) => void;
  onClear: () => void;
  onSell: () => void;
}

export default function PosSalesTab({ products, invMap, cart, totalEur, onAddOne, onDecOne, onClear, onSell }: PosSalesTabProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-5 pb-32 md:pb-0">
      {/* Productos Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 md:gap-4 content-start">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            inventory={invMap.get(p.id)}
            onAdd={() => onAddOne(p.id)}
          />
        ))}
      </div>

      {/* Carrito Desktop */}
      <CartSidebar 
        cart={cart}
        products={products}
        totalEur={totalEur}
        onAddOne={onAddOne}
        onDecOne={onDecOne}
        onClear={onClear}
        onSell={onSell}
      />

      {/* Carrito Mobile */}
      <MobileCartDrawer
        cart={cart}
        products={products}
        totalEur={totalEur}
        onAddOne={onAddOne}
        onDecOne={onDecOne}
        onClear={onClear}
        onSell={onSell}
      />
    </section>
  );
}

