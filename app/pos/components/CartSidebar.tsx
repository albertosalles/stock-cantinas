import React from 'react';
import { Product } from '../hooks/usePosData';

interface CartSidebarProps {
  cart: { productId: string; qty: number }[];
  products: Product[];
  totalEur: number;
  onAddOne: (id: string) => void;
  onDecOne: (id: string) => void;
  onClear: () => void;
  onSell: () => void;
}

export default function CartSidebar({ cart, products, totalEur, onAddOne, onDecOne, onClear, onSell }: CartSidebarProps) {
  return (
    <aside className="hidden md:flex bg-white p-5 rounded-3xl shadow-sm sticky top-24 self-start gap-4 max-h-[calc(100vh-120px)] overflow-hidden flex-col border border-elche-gray/50 w-full max-w-[380px]">
      <div className="font-bold text-lg text-elche-text pb-3 border-b-2 border-elche-gray/50 flex justify-between items-center">
        <span>🛒 Carrito</span>
        {cart.length > 0 && <span className="text-xs bg-elche-primary text-white px-2 py-1 rounded-full">{cart.reduce((a,b)=>a+b.qty,0)}</span>}
      </div>

      <div className="grid gap-3 overflow-y-auto pr-1 flex-1 custom-scrollbar">
        {cart.length === 0 && (
          <div className="opacity-60 text-center py-10 text-elche-text-light italic">
            Carrito vacío
          </div>
        )}
        {cart.map((l) => {
          const p = products.find(x => x.id === l.productId);
          if (!p) return null;
          return (
            <div key={l.productId} className="flex justify-between items-center gap-3 p-3 bg-elche-gray/30 rounded-2xl border border-elche-gray/50 group hover:border-elche-primary/30 transition-colors">
              <div className="flex-1">
                <div className="font-semibold text-elche-text mb-0.5 text-sm">{p.name}</div>
                <div className="text-elche-primary text-xs font-bold">
                  {(p.price_cents/100).toFixed(2)} €
                </div>
              </div>
              <div className="flex gap-2 items-center bg-white rounded-xl p-1 border border-elche-gray/20 shadow-sm">
                <button 
                  onClick={() => onDecOne(l.productId)} 
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-elche-gray/20 font-bold text-elche-text hover:bg-elche-gray/40 active:scale-90 transition-all">
                  −
                </button>
                <div className="font-bold text-sm min-w-[20px] text-center">
                  {l.qty}
                </div>
                <button 
                  onClick={() => onAddOne(l.productId)} 
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-elche-gray/20 font-bold text-elche-text hover:bg-elche-gray/40 active:scale-90 transition-all">
                  ＋
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-2 pt-4 border-t-2 border-elche-gray/50 text-xl font-bold">
        <span className="text-elche-text">Total</span>
        <span className="text-elche-primary">{totalEur.toFixed(2)} €</span>
      </div>

      <div className="grid gap-2.5">
        <button 
          onClick={onSell} 
          disabled={!cart.length}
          className="p-4 rounded-2xl bg-gradient-to-r from-elche-primary to-elche-secondary text-white font-bold text-base shadow-[0_4px_16px_rgba(0,150,79,0.3)] hover:scale-[1.02] active:scale-100 transition-transform disabled:opacity-50 disabled:shadow-none disabled:scale-100 flex justify-center items-center gap-2">
          <span>💳 Cobrar</span>
        </button>
        <button 
          onClick={onClear} 
          disabled={!cart.length} 
          className="p-3 rounded-2xl bg-red-50 text-red-600 border border-red-100 font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 text-sm flex justify-center items-center gap-2">
          <span>🗑️ Vaciar carrito</span>
        </button>
      </div>
    </aside>
  );
}
