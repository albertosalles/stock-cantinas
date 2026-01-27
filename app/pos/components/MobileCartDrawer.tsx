import React, { useState } from 'react';
import { Product } from '../hooks/usePosData';

interface MobileCartDrawerProps {
  cart: { productId: string; qty: number }[];
  products: Product[];
  totalEur: number;
  onAddOne: (id: string) => void;
  onDecOne: (id: string) => void;
  onClear: () => void;
  onSell: () => void;
}

export default function MobileCartDrawer({ cart, products, totalEur, onAddOne, onDecOne, onClear, onSell }: MobileCartDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  if (cart.length === 0) return null;

  return (
    <>
      {/* Overlay if expanded */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/60 z-[50] backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={() => setExpanded(false)}
        />
      )}

      <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_30px_rgba(0,0,0,0.15)] z-[70] transition-all duration-300 rounded-t-3xl border-t border-gray-100 flex flex-col ${expanded ? 'h-[75vh]' : 'h-24'}`}>

        {/* Handle to drag/click */}
        <div
          className="w-full flex justify-center pt-2 pb-1 cursor-pointer active:opacity-70 shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {/* Content */}
        <div className="px-4 flex flex-col gap-4 overflow-hidden flex-1 h-full pb-4">

          {/* Items List - Visible only when expanded */}
          <div className={`overflow-y-auto flex-1 min-h-0 pr-1 space-y-3 transition-all duration-300 ${expanded ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
            {/* Header inside list for expanded view context */}
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
              <span className="font-bold text-lg text-elche-text">Detalle del pedido</span>
              <span className="bg-elche-primary text-white text-xs font-bold px-2 py-1 rounded-full">{cart.reduce((a, b) => a + b.qty, 0)} items</span>
            </div>

            {cart.map(l => {
              const p = products.find(x => x.id === l.productId);
              if (!p) return null;
              return (
                <div key={l.productId} className="flex justify-between items-center bg-elche-gray/30 p-3 rounded-2xl border border-elche-gray/50">
                  <span className="text-elche-text truncate pr-2 flex-1 font-bold text-sm">{l.qty}x {p.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onDecOne(l.productId)} className="w-9 h-9 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center font-bold text-elche-muted active:scale-90 transition-all text-lg">-</button>
                    <button onClick={() => onAddOne(l.productId)} className="w-9 h-9 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center font-bold text-elche-muted active:scale-90 transition-all text-lg">+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions - Always Visible */}
          <div className="flex gap-3 mt-auto pt-0 shrink-0">
            <button
              onClick={onClear}
              className="aspect-square h-[50px] flex items-center justify-center bg-red-50 text-red-500 rounded-2xl border border-red-100 active:bg-red-100 transition-colors"
            >
              🗑️
            </button>
            <button
              onClick={onSell}
              className="flex-1 bg-gradient-to-r from-elche-primary to-elche-secondary text-white font-bold h-[50px] rounded-2xl shadow-lg shadow-elche-primary/30 active:scale-[0.98] transition-transform flex justify-between items-center px-5 text-lg"
            >
              <div className="flex flex-col items-start leading-none gap-0.5">
                <span className="text-[10px] opacity-90 font-medium uppercase tracking-wider">Cobrar</span>
                <span className="text-xs">{cart.reduce((a, b) => a + b.qty, 0)} items</span>
              </div>
              <span className="text-xl font-extrabold">{totalEur.toFixed(2)} €</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
