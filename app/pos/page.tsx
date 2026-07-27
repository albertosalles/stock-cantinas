'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { createSale, generateUUID, isNetworkError } from '@/lib/sales';
import { usePosSession } from './hooks/usePosSession';
import { usePosData } from './hooks/usePosData';
import { useCart } from './hooks/useCart';
import { useOfflineSales } from './hooks/useOfflineSales';
import { useRealtimeStatus } from '@/hooks/useEventRealtime';
import { useStripeTerminal } from './hooks/useStripeTerminal';
import PosShell, { PosTab } from './components/PosShell';
import PosSalesTab from './components/PosSalesTab';
import PosStockTab from './components/PosStockTab';
import PosHistoryTab from './components/PosHistoryTab';
import TicketSheet, { PayMethod, TicketLine } from './components/TicketSheet';
import IncidentModal from './components/IncidentModal';
import { reportIncident } from '@/lib/incidents';

export default function PosPage() {
  // 1. Sesión y datos
  const session = usePosSession();
  const { products, inventory, invMap, refreshInventory, refreshTotals, loading } = usePosData(
    session.eventId,
    session.cantinaId,
    session.sessionChecked
  );

  // 2. Carrito
  const { cart, addOne, decOne, clearCart, setCartLines, totalCents } = useCart(products);

  // 3. Cola offline
  const { queueSale, pendingCount, syncQueue } = useOfflineSales();

  // Estado del canal de la barra: alimenta el aviso de cabecera cuando cae.
  const realtimeStatus = useRealtimeStatus(session.eventId, session.cantinaId);

  // 4. Stripe Terminal
  const terminal = useStripeTerminal();

  // Estado de UI
  const [tab, setTab] = useState<PosTab>('venta');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pay, setPay] = useState<PayMethod>('efectivo');
  const [processing, setProcessing] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  // Feedback táctil de "añadido" (300 ms sobre la tarjeta pulsada)
  const [pulseId, setPulseId] = useState<string | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pulseTimer.current) clearTimeout(pulseTimer.current); }, []);

  const handleAddOne = (id: string) => {
    addOne(id);
    setPulseId(id);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulseId(null), 300);
  };

  // Líneas del ticket, ya resueltas contra el catálogo
  const ticketLines: TicketLine[] = useMemo(() =>
    cart.flatMap(l => {
      const p = products.find(x => x.id === l.productId);
      if (!p) return [];
      return [{ productId: l.productId, name: p.name, unitCents: p.price_cents, qty: l.qty }];
    })
  , [cart, products]);

  if (!session.sessionChecked) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--c-bg)]">
        <div className="text-center">
          <span className="ms animate-spin text-[40px] text-[var(--c-primary)]">progress_activity</span>
          <div className="mt-3 text-[15px] font-semibold text-[var(--c-text-2)]">Cargando sistema…</div>
        </div>
      </div>
    );
  }

  const toastQueued = () =>
    toast('Guardado en el dispositivo', {
      icon: '☁️',
      duration: 3000,
      style: { border: '1px solid #f59e0b', color: '#b45309' },
    });

  // ---- Cobro en efectivo (online con respaldo offline) ----
  const sellCash = async () => {
    if (cart.length === 0 || processing) return;
    setProcessing(true);

    const salePayload = {
      eventId: session.eventId,
      cantinaId: session.cantinaId,
      userId: session.userId,
      waiterId: session.waiterId,
      lines: cart,
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
          setSheetOpen(false);
          toast.success('Venta registrada', { duration: 2000 });
          refreshTotals();
          refreshInventory();
        } catch (error) {
          if (isNetworkError(error)) {
            // Fallo de red: encolamos y seguimos vendiendo
            await queueSale(salePayload, clientRequestId);
            clearCart();
            setSheetOpen(false);
            toastQueued();
          } else {
            // Error de negocio (p. ej. stock insuficiente): el servidor la rechazó.
            // NO encolamos y conservamos el carrito para que el cajero decida.
            console.error('❌ Venta rechazada por el servidor:', error);
            toast.error((error as any)?.message || 'No se pudo registrar la venta', { duration: 4000 });
          }
        }
      } else {
        await queueSale(salePayload, clientRequestId);
        clearCart();
        setSheetOpen(false);
        toastQueued();
      }
    } finally {
      setProcessing(false);
    }
  };

  // ---- Cobro con tarjeta (Stripe Terminal) ----
  const sellCard = async () => {
    if (cart.length === 0 || processing) return;
    setProcessing(true);

    try {
      if (!terminal.readerConnected) {
        const initialized = await terminal.initialize();
        if (!initialized) {
          toast.error('No se pudo conectar al terminal', { duration: 3000 });
          setProcessing(false);
          return;
        }
      }

      const result = await terminal.collectCardPayment(totalCents, {
        event_id: session.eventId,
        cantina_id: session.cantinaId,
        source: 'stock-cantinas-pos',
      });

      if (result.success) {
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

  const handleConfirm = () => (pay === 'tarjeta' ? sellCard() : sellCash());

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

  const refreshAll = () => {
    refreshInventory();
    refreshTotals();
    if (pendingCount > 0) syncQueue();
  };

  return (
    <PosShell
      cantinaName={session.cantinaName}
      eventName={session.eventName}
      waiterName={session.waiterName}
      tab={tab}
      onTabChange={setTab}
      onReportIncident={() => setShowIncidentModal(true)}
      pendingUploads={pendingCount}
      realtimeStatus={realtimeStatus}
      onSync={syncQueue}
      onRefresh={refreshAll}
      onLogout={session.logout}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
    >
      <Toaster position="top-center" />

      {tab === 'venta' && (
        <PosSalesTab
          products={products}
          invMap={invMap}
          cart={cart}
          totalCents={totalCents}
          pulseId={pulseId}
          onAddOne={handleAddOne}
          onClear={clearCart}
          onOpenTicket={() => setSheetOpen(true)}
          loading={loading}
        />
      )}

      {tab === 'stock' && (
        <PosStockTab
          eventId={session.eventId}
          cantinaId={session.cantinaId}
          userId={session.userId}
          inventory={inventory}
          products={products}
          onRefresh={refreshInventory}
        />
      )}

      {tab === 'historial' && (
        <PosHistoryTab
          eventId={session.eventId}
          cantinaId={session.cantinaId}
          waiterId={session.waiterId}
          products={products}
          sessionChecked={session.sessionChecked}
          active={tab === 'historial'}
          onModify={(lines) => { setCartLines(lines); setTab('venta'); }}
          onAfterVoid={() => { refreshInventory(); refreshTotals(); }}
        />
      )}

      {/* Ticket + cobro */}
      <TicketSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        lines={ticketLines}
        totalCents={totalCents}
        pay={pay}
        onPayChange={setPay}
        onInc={addOne}
        onDec={decOne}
        onConfirm={handleConfirm}
        processing={processing}
        terminalStatus={terminal.status}
        terminalError={terminal.error}
        readerConnected={terminal.readerConnected}
      />

      <IncidentModal
        visible={showIncidentModal}
        products={products}
        onClose={() => setShowIncidentModal(false)}
        onSubmit={handleReportIncident}
      />
    </PosShell>
  );
}
