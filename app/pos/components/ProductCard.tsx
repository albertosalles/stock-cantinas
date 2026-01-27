import React from 'react';
import { Product, InventoryRow } from '../hooks/usePosData';

interface ProductCardProps {
  product: Product;
  inventory?: InventoryRow;
  onAdd: () => void;
}

export default function ProductCard({ product, inventory, onAdd }: ProductCardProps) {
  const qty = inventory?.current_qty ?? 0;
  const low = inventory?.low_stock_threshold ?? 0;
  const status: 'ok' | 'bajo' | 'agotado' = qty <= 0 ? 'agotado' : qty <= low ? 'bajo' : 'ok';

  const dotColor = status === 'ok' ? 'bg-elche-success' : status === 'bajo' ? 'bg-elche-warning' : 'bg-elche-danger';
  const borderColor = status === 'ok' ? 'hover:border-elche-success' : status === 'bajo' ? 'hover:border-elche-warning' : 'hover:border-elche-danger';

  return (
    <button
      onClick={() => qty > 0 && onAdd()}
      disabled={qty <= 0}
      className={`
        bg-elche-surface p-3 md:p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent transition-all duration-200 ease-out text-left relative overflow-hidden flex flex-col justify-between min-h-[120px] w-full group
        ${qty <= 0
          ? 'opacity-60 cursor-not-allowed grayscale-[0.5]'
          : `${borderColor} hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-[0.98]`
        }
      `}>
      <div>
        <div className="text-base md:text-lg font-bold text-elche-text mb-1 leading-tight group-hover:text-elche-primary transition-colors">{product.name}</div>
        <div className="text-lg md:text-xl font-bold text-elche-primary mb-2">
          {(product.price_cents / 100).toFixed(2)} €
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs md:text-sm mt-auto">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0 shadow-sm`} />
        <span className="text-elche-muted font-medium">Stock: {qty}</span>
      </div>
    </button>
  );
}
