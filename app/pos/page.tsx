'use client';

import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast'; // Feedback visual
import { createSale } from '@/lib/sales';
import { usePosSession } from './hooks/usePosSession';
import { usePosData } from './hooks/usePosData';
import { useCart } from './hooks/useCart';
import { useOfflineSales } from './hooks/useOfflineSales'; // Tu nuevo hook
import PosHeader from './components/PosHeader';
import PosSalesTab from './components/PosSalesTab';
import PosInventoryTab from './components/PosInventoryTab';
import PosHistoryTab from './components/PosHistoryTab';

export default function PosPage() {
  // 1. Hooks de Datos y Sesión
  const session = usePosSession();
  const { products, inventory, invMap, totals, refreshInventory, refreshTotals, loading } = usePosData(
    session.eventId,
    session.cantinaId,
    session.sessionChecked
  );

  // 2. Hook del Carrito
  const { cart, addOne, decOne, clearCart, totalEur } = useCart(products);

  // 3. Hook Offline (La magia nueva)
  const { queueSale, pendingCount, syncQueue } = useOfflineSales();

  // Estado local para UI
  const [tab, setTab] = useState<'venta' | 'inventario' | 'ventas'>('venta');
  const [processing, setProcessing] = useState(false);

  // Pantalla de carga inicial
  if (!session.sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <div className="text-lg text-slate-600 font-medium">Cargando sistema...</div>
        </div>
      </div>
    );
  }

  // 4. Lógica de Venta Robusta (Online + Offline)
  const handleSell = async () => {
    if (cart.length === 0 || processing) return;
    setProcessing(true);

    const salePayload = {
      eventId: session.eventId,
      cantinaId: session.cantinaId,
      userId: session.userId,
      lines: cart
    };

    try {
      // A. Optimistic UI: Vaciamos el carrito visualmente YA
      clearCart();

      // B. Intentamos enviar si el navegador dice que hay línea
      if (navigator.onLine) {
        await createSale(
          salePayload.eventId,
          salePayload.cantinaId,
          salePayload.userId,
          salePayload.lines
        );

        toast.success('Venta registrada', { duration: 2000 });

        // Actualizamos contadores de dinero
        refreshTotals();
        refreshInventory();
      } else {
        // Forzamos el error para ir al bloque catch si no hay línea
        throw new Error('Offline detected');
      }

    } catch (error) {
      // C. MODO OFFLINE (Fallback)
      console.log("⚠️ Modo offline activado para esta venta");

      // Guardamos en la cola segura (IndexedDB)
      await queueSale(salePayload);

      // Avisamos al usuario con un icono diferente
      toast('Guardado en el dispositivo', {
        icon: '☁️',
        duration: 3000,
        style: { border: '1px solid #f59e0b', color: '#b45309' }
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <Toaster position="top-center" />

      {/* HEADER: Ahora recibe pendingUploads y onManualSync */}
      <PosHeader
        eventName={session.eventName}
        cantinaName={session.cantinaName}
        onLogout={session.logout}
        pendingUploads={pendingCount}
        onManualSync={syncQueue}
      />

      {/* PESTAÑAS DE NAVEGACIÓN (Solo visible en móvil normalmente, o integrado en header) */}
      <div className="max-w-7xl mx-auto p-2 flex gap-2 justify-center md:justify-start">
        <button
          onClick={() => setTab('venta')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${tab === 'venta' ? 'bg-elche-primary text-white shadow-md' : 'bg-elche-gray text-elche-primary hover:bg-elche-primary/10'}`}
        >
          💰 Venta
        </button>
        <button
          onClick={() => setTab('inventario')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${tab === 'inventario' ? 'bg-elche-primary text-white shadow-md' : 'bg-elche-gray text-elche-primary hover:bg-elche-primary/10'}`}
        >
          📦 Stock
        </button>
        <button
          onClick={() => setTab('ventas')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${tab === 'ventas' ? 'bg-elche-primary text-white shadow-md' : 'bg-elche-gray text-elche-primary hover:bg-elche-primary/10'}`}
        >
          📝 Historial
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {loading && tab === 'venta' ? (
          <div className="text-center py-20 text-slate-500">Cargando catálogo...</div>
        ) : (
          <>
            {/* PESTAÑA: VENTA (TPV) */}
            <div className={tab === 'venta' ? 'block' : 'hidden'}>
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
            </div>

            {/* PESTAÑA: INVENTARIO */}
            <div className={tab === 'inventario' ? 'block' : 'hidden'}>
              <PosInventoryTab
                // Añadimos las 3 IDs que faltaban (vienen de tu objeto 'session')
                eventId={session.eventId}
                cantinaId={session.cantinaId}
                userId={session.userId}
                // Datos existentes
                inventory={inventory}
                products={products}
                // Corregimos el nombre: de 'refresh' a 'onRefresh'
                onRefresh={refreshInventory}
              />
            </div>

            {/* PESTAÑA: HISTORIAL */}
            <div className={tab === 'ventas' ? 'block' : 'hidden'}>
              <PosHistoryTab
                eventId={session.eventId}
                cantinaId={session.cantinaId}
                products={products}
                sessionChecked={session.sessionChecked}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}