'use client';

import { useState } from 'react';
import { createSale } from '@/lib/sales';
import { usePosSession } from './hooks/usePosSession';
import { usePosData } from './hooks/usePosData';
import { useCart } from './hooks/useCart';
import PosHeader from './components/PosHeader';
import PosSalesTab from './components/PosSalesTab';
import PosInventoryTab from './components/PosInventoryTab';
import PosHistoryTab from './components/PosHistoryTab';

export default function PosPage() {
  const { eventId, cantinaId, userId, eventName, cantinaName, sessionChecked, logout } = usePosSession();
  const { products, inventory, invMap, totals, refreshInventory, refreshTotals } = usePosData(eventId, cantinaId, sessionChecked);
  const { cart, addOne, decOne, clearCart, totalEur } = useCart(products);
  
  const [tab, setTab] = useState<'venta'|'inventario'|'ventas'>('venta');

  // Si no se ha verificado la sesión, mostrar loading
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elche-bg">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <div className="text-lg text-elche-text font-medium">Cargando sistema...</div>
        </div>
      </div>
    );
  }

  const handleSell = async () => {
    if (!cart.length) return;
    try {
      await createSale(eventId, cantinaId, userId, cart);
      clearCart();
      await Promise.all([refreshInventory(), refreshTotals()]);
      alert('Venta registrada ✅');
    } catch (e: any) {
      alert(e?.message ?? 'Error al vender');
    }
  };

  return (
    <div className="min-h-screen bg-elche-bg pb-24 md:pb-0">
      
      <PosHeader 
        eventName={eventName} 
        cantinaName={cantinaName} 
        tab={tab} 
        setTab={setTab} 
        onLogout={logout} 
      />

      {/* Navegación Móvil (Pills) */}
      <div className="md:hidden px-4 py-3 overflow-x-auto flex gap-2 snap-x no-scrollbar sticky top-14 bg-elche-bg z-20 pb-2">
         {(['venta', 'inventario', 'ventas'] as const).map(t => (
            <button key={t}
              onClick={() => setTab(t)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors snap-start ${
                tab === t 
                  ? 'bg-elche-primary text-white shadow-md' 
                  : 'bg-white text-elche-muted border border-gray-200'
              }`}>
              {t === 'venta' ? '💰 Venta' : t === 'inventario' ? '📦 Inventario' : '📊 Historial'}
            </button>
          ))}
      </div>

      <div className="max-w-[1600px] mx-auto p-3 md:p-8">

      {tab === 'venta' && (
          <PosSalesTab 
            products={products}
            invMap={invMap}
            cart={cart}
            totalEur={totalEur}
            onAddOne={addOne}
            onDecOne={decOne}
            onClear={clearCart}
            onSell={handleSell}
          />
        )}

      {tab === 'inventario' && (
          <PosInventoryTab 
            eventId={eventId}
            cantinaId={cantinaId}
            userId={userId}
            products={products}
            inventory={inventory}
            onRefresh={refreshInventory}
          />
        )}

      {tab === 'ventas' && (
        <section className="grid gap-6">
             {/* Totales Widget */}
          <div className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,150,79,0.08)] border border-elche-gray/50">
            <div className="font-bold text-lg mb-4 text-elche-text border-b border-elche-gray pb-2">
                📊 Totales del evento
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-elche-green to-elche-green-light text-white shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  <div className="opacity-90 mb-2 text-sm font-bold uppercase tracking-wide">Tickets</div>
                  <div className="text-4xl font-extrabold">{totals.num_sales}</div>
                </div>
                <div className="absolute -bottom-4 -right-4 opacity-20 text-6xl">🎫</div>
              </div>
              <div className="p-5 rounded-2xl bg-gradient-to-br from-elche-green-light to-elche-green text-white shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  <div className="opacity-90 mb-2 text-sm font-bold uppercase tracking-wide">Artículos</div>
                  <div className="text-4xl font-extrabold">{totals.total_items}</div>
                </div>
                <div className="absolute -bottom-4 -right-4 opacity-20 text-6xl">📦</div>
              </div>
              <div className="p-5 rounded-2xl bg-gradient-to-br from-elche-green-dark to-elche-green text-white shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  <div className="opacity-90 mb-2 text-sm font-bold uppercase tracking-wide">Ingresos</div>
                  <div className="text-4xl font-extrabold">{(totals.total_cents/100).toFixed(2)} €</div>
                </div>
                <div className="absolute -bottom-4 -right-4 opacity-20 text-6xl">💰</div>
              </div>
            </div>
            <button 
                onClick={refreshTotals} 
              className="mt-5 px-6 py-3 rounded-xl bg-elche-gray/20 text-elche-text font-semibold hover:bg-elche-gray/40 transition-colors w-full border border-elche-gray/50">
              🔄 Refrescar datos
            </button>
          </div>

            <PosHistoryTab 
              eventId={eventId}
              cantinaId={cantinaId}
              products={products}
              sessionChecked={sessionChecked}
            />
        </section>
      )}

      </div>
    </div>
  );
}
