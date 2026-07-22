'use client';

import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast'; // Feedback visual
import { createSale, generateUUID, isNetworkError } from '@/lib/sales';
import { usePosSession } from './hooks/usePosSession';
import { usePosData } from './hooks/usePosData';
import { useCart } from './hooks/useCart';
import { useOfflineSales } from './hooks/useOfflineSales'; // Tu nuevo hook
import { useStripeTerminal } from './hooks/useStripeTerminal';
import PosHeader from './components/PosHeader';
import PosSalesTab from './components/PosSalesTab';
import PosInventoryTab from './components/PosInventoryTab';
import PosHistoryTab from './components/PosHistoryTab';
import PaymentMethodModal from './components/PaymentMethodModal';
import IncidentModal from './components/IncidentModal';
import { reportIncident } from '@/lib/incidents';

export default function PosPage() {
  // 1. Hooks de Datos y Sesión
  const session = usePosSession();
  const { products, inventory, invMap, totals, refreshInventory, refreshTotals, loading } = usePosData(
    session.eventId,
    session.cantinaId,
    session.sessionChecked
  );

  // 2. Hook del Carrito
  const { cart, addOne, decOne, clearCart, setCartLines, totalEur } = useCart(products);

  // 3. Hook Offline (La magia nueva)
  const { queueSale, pendingCount, syncQueue } = useOfflineSales();

  // Stripe Terminal
  const terminal = useStripeTerminal();

  // Estado local para UI
  const [tab, setTab] = useState<'venta' | 'inventario' | 'ventas'>('venta');
  const [processing, setProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);

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

  // Aviso reutilizable de "guardado offline"
  const toastQueued = () =>
    toast('Guardado en el dispositivo', {
      icon: '☁️',
      duration: 3000,
      style: { border: '1px solid #f59e0b', color: '#b45309' }
    });

  // 4. Lógica de Venta Robusta (Online + Offline)
  const handleSell = async () => {
    if (cart.length === 0 || processing) return;
    setProcessing(true);

    const salePayload = {
      eventId: session.eventId,
      cantinaId: session.cantinaId,
      userId: session.userId,
      waiterId: session.waiterId,
      lines: cart
    };
    // Clave de idempotencia única: se reutiliza aunque la venta acabe en la cola
    // offline, para que una venta ya confirmada en servidor no se duplique al sincronizar.
    const clientRequestId = generateUUID();

    try {
      if (navigator.onLine) {
        try {
          await createSale(
            salePayload.eventId,
            salePayload.cantinaId,
            salePayload.userId,
            salePayload.lines,
            { clientRequestId, waiterId: session.waiterId }
          );

          clearCart();
          toast.success('Venta registrada', { duration: 2000 });
          refreshTotals();
          refreshInventory();
        } catch (error) {
          if (isNetworkError(error)) {
            // Fallo de red: encolamos y seguimos vendiendo
            console.log('⚠️ Modo offline activado para esta venta');
            await queueSale(salePayload, clientRequestId);
            clearCart();
            toastQueued();
          } else {
            // Error de negocio (p. ej. stock insuficiente): el servidor la rechazó.
            // NO encolamos y conservamos el carrito para que el cajero decida.
            console.error('❌ Venta rechazada por el servidor:', error);
            toast.error((error as any)?.message || 'No se pudo registrar la venta', { duration: 4000 });
          }
        }
      } else {
        // Sin conexión: directo a la cola
        await queueSale(salePayload, clientRequestId);
        clearCart();
        toastQueued();
      }
    } finally {
      setProcessing(false);
    }
  };

  // Abrir modal de selección de método de pago
  const handleOpenPayment = () => {
    if (cart.length === 0 || processing) return;
    setShowPaymentModal(true);
  };

  // Pago con tarjeta vía Stripe Terminal
  const handleCardPayment = async () => {
    if (cart.length === 0 || processing) return;
    setProcessing(true);

    try {
      // 1. Initialize terminal if not connected
      if (!terminal.readerConnected) {
        const initialized = await terminal.initialize();
        if (!initialized) {
          toast.error('No se pudo conectar al terminal', { duration: 3000 });
          setProcessing(false);
          return;
        }
      }

      // 2. Collect payment
      const amountCents = Math.round(totalEur * 100);
      const result = await terminal.collectCardPayment(amountCents, {
        event_id: session.eventId,
        cantina_id: session.cantinaId,
        source: 'stock-cantinas-pos',
      });

      if (result.success) {
        // 3. Register sale in Supabase (same as cash)
        const salePayload = {
          eventId: session.eventId,
          cantinaId: session.cantinaId,
          userId: session.userId,
          waiterId: session.waiterId,
          lines: cart,
        };
        const clientRequestId = generateUUID();

        clearCart();

        // El cobro con tarjeta YA se ha realizado: la venta debe registrarse sí o sí.
        // allowOversell evita que un descuadre de stock impida guardar una venta cobrada;
        // si falla la red, se encola con la misma clave de idempotencia.
        try {
          await createSale(
            salePayload.eventId,
            salePayload.cantinaId,
            salePayload.userId,
            salePayload.lines,
            { clientRequestId, allowOversell: true, waiterId: session.waiterId }
          );
          refreshTotals();
          refreshInventory();
        } catch (error) {
          console.warn('Venta con tarjeta no registrada online, se encola:', error);
          await queueSale(salePayload, clientRequestId);
        }

        toast.success('Pago con tarjeta registrado', { duration: 2000 });

        // Auto-close modal after success
        setTimeout(() => setShowPaymentModal(false), 1500);
      } else {
        toast.error(result.error || 'Error en el pago', { duration: 3000 });
      }
    } catch (error) {
      console.error('Card payment error:', error);
      toast.error('Error procesando pago con tarjeta', { duration: 3000 });
    } finally {
      setProcessing(false);
    }
  };

  // Pago en efectivo (cierra modal y ejecuta flujo original)
  const handleCashPayment = () => {
    setShowPaymentModal(false);
    handleSell();
  };

  // Reportar incidencia (online-only: es un aviso, no una transacción)
  const handleReportIncident = async (input: { type: any; productIds: string[]; description: string }) => {
    if (!navigator.onLine) {
      toast.error('Sin conexión: no se puede reportar la incidencia ahora', { duration: 3000 });
      return;
    }
    try {
      await reportIncident({
        eventId: session.eventId,
        cantinaId: session.cantinaId,
        waiterId: session.waiterId,
        type: input.type,
        productIds: input.productIds,
        description: input.description,
      });
      toast.success('Incidencia enviada al administrador', { duration: 2500 });
    } catch (e: any) {
      toast.error(e.message || 'No se pudo enviar la incidencia', { duration: 3000 });
      throw e;
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <Toaster position="top-center" />

      {/* Modal de selección de método de pago */}
      <PaymentMethodModal
        visible={showPaymentModal}
        totalEur={totalEur}
        terminalStatus={terminal.status}
        terminalError={terminal.error}
        readerConnected={terminal.readerConnected}
        onPayCash={handleCashPayment}
        onPayCard={handleCardPayment}
        onClose={() => setShowPaymentModal(false)}
      />

      {/* HEADER: Ahora recibe pendingUploads y onManualSync */}
      <PosHeader
        eventName={session.eventName}
        cantinaName={session.cantinaName}
        waiterName={session.waiterName}
        onLogout={session.logout}
        pendingUploads={pendingCount}
        onManualSync={syncQueue}
        onReportIncident={() => setShowIncidentModal(true)}
      />

      {/* Modal de reporte de incidencia */}
      <IncidentModal
        visible={showIncidentModal}
        products={products}
        onClose={() => setShowIncidentModal(false)}
        onSubmit={handleReportIncident}
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
                onOpenPayment={handleOpenPayment}
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
                waiterId={session.waiterId}
                products={products}
                sessionChecked={session.sessionChecked}
                active={tab === 'ventas'}
                onModify={(lines) => { setCartLines(lines); setTab('venta'); }}
                onAfterVoid={() => { refreshInventory(); refreshTotals(); }}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}