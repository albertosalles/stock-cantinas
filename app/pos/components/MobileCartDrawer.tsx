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
          className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={() => setExpanded(false)}
        />
      )}
      
      <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_30px_rgba(0,0,0,0.15)] z-40 transition-all duration-300 rounded-t-3xl border-t border-gray-100 flex flex-col ${expanded ? 'h-[85vh]' : 'h-[180px]'}`}>
        
        {/* Handle to drag/click */}
        <div 
          className="w-full flex justify-center pt-3 pb-1 cursor-pointer active:opacity-70"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {/* Content */}
        <div className="px-5 pb-5 flex flex-col gap-4 overflow-hidden flex-1">
          
          {/* Header (Total) */}
          <div className="flex justify-between items-center" onClick={() => setExpanded(!expanded)}>
            <div className="font-bold text-elche-text flex items-center">
              <div className="bg-elche-primary text-white text-xs font-bold px-2.5 py-1 rounded-full mr-2 shadow-sm">{cart.reduce((a,b)=>a+b.qty,0)}</div>
              <span className="text-lg">Carrito</span>
            </div>
            <div className="text-2xl font-extrabold text-elche-primary tracking-tight">
              {totalEur.toFixed(2)} €
            </div>
          </div>

          {/* Items List (Scrollable) */}
          <div className={`overflow-y-auto flex-1 min-h-0 pr-1 space-y-3 ${expanded ? 'opacity-100' : 'opacity-100'} transition-opacity`}>
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

          {/* Actions */}
          <div className="flex gap-3 mt-auto pt-2 border-t border-gray-100 shrink-0">
            <button
              onClick={onSell}
              className="flex-1 bg-gradient-to-r from-elche-primary to-elche-secondary text-white font-bold py-4 rounded-2xl shadow-lg shadow-elche-primary/30 active:scale-[0.98] transition-transform flex justify-center items-center gap-2 text-lg"
            >
              <span>💳 Cobrar</span>
            </button>
            <button 
              onClick={onClear} 
              className="aspect-square h-full flex items-center justify-center bg-red-50 text-red-500 rounded-2xl border border-red-100 active:bg-red-100 transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
