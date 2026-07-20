import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { createSale, generateUUID } from '@/lib/sales';

const OFFLINE_QUEUE_KEY = 'offline_sales_queue';

// Guard a nivel de módulo: evita que dos disparos de sincronización
// (montaje + evento `online`, StrictMode, etc.) procesen la cola a la vez.
let isSyncing = false;

export type PendingSale = {
  /** También es la clave de idempotencia (client_request_id) enviada al servidor. */
  id: string;
  payload: {
    eventId: string;
    cantinaId: string;
    userId: string;
    waiterId?: string;
    lines: { productId: string; qty: number }[];
  };
  timestamp: number;
};

export function useOfflineSales() {
  const queryClient = useQueryClient();

  // 1. Leer cola
  const { data: queue = [], refetch } = useQuery({
    queryKey: ['offlineQueue'],
    queryFn: async () => (await get<PendingSale[]>(OFFLINE_QUEUE_KEY)) || [],
    staleTime: 0,
  });

  // 2. Añadir a cola.
  // `clientRequestId` permite reutilizar la misma clave de idempotencia que ya
  // se intentó online (si la venta pasó del camino online al offline), de modo
  // que una venta confirmada en servidor pero sin respuesta no se duplique.
  const queueSale = async (payload: PendingSale['payload'], clientRequestId?: string) => {
    const newSale: PendingSale = {
      id: clientRequestId ?? generateUUID(),
      payload,
      timestamp: Date.now(),
    };

    const currentQueue = (await get<PendingSale[]>(OFFLINE_QUEUE_KEY)) || [];
    // Evita encolar dos veces la misma venta (misma clave de idempotencia).
    if (currentQueue.some(s => s.id === newSale.id)) return;
    const updatedQueue = [...currentQueue, newSale];

    await set(OFFLINE_QUEUE_KEY, updatedQueue);
    refetch();
  };

  // 3. Sincronizar
  const syncQueue = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const currentQueue = (await get<PendingSale[]>(OFFLINE_QUEUE_KEY)) || [];
      if (currentQueue.length === 0) return;

      console.log(`🔄 Intentando sincronizar ${currentQueue.length} ventas...`);
      const failedQueue: PendingSale[] = [];
      let syncedCount = 0;

      for (const sale of currentQueue) {
        try {
          await createSale(
            sale.payload.eventId,
            sale.payload.cantinaId,
            sale.payload.userId,
            sale.payload.lines,
            // La venta offline ya ocurrió físicamente: se registra aunque el stock
            // quede negativo. La clave de idempotencia evita duplicados en reintentos.
            { clientRequestId: sale.id, allowOversell: true, waiterId: sale.payload.waiterId }
          );
          syncedCount++;
        } catch (error) {
          console.error("❌ Falló venta:", sale.id, error);
          failedQueue.push(sale);
        }
      }

      await set(OFFLINE_QUEUE_KEY, failedQueue);
      refetch();

      if (syncedCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['totals'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
    } finally {
      isSyncing = false;
    }
  };

  // 4. Listeners
  useEffect(() => {
    const handleOnline = () => syncQueue();
    window.addEventListener('online', handleOnline);

    if (navigator.onLine) {
      syncQueue();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return {
    queue,
    queueSale,
    syncQueue,
    pendingCount: queue.length
  };
}