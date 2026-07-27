import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { createSalesBatch, generateUUID } from '@/lib/sales';

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
  //
  // La cola se vacía en UN solo viaje mediante `create_sales_batch`. Antes se
  // recorría con un await por venta: 200 ventas acumuladas tras un corte de red
  // eran 200 idas y vueltas consecutivas, justo cuando la conexión acaba de
  // recuperarse y es más frágil.
  //
  // El servidor procesa cada venta en su propia subtransacción, así que una que
  // falle no impide registrar las demás — mismo comportamiento que el bucle
  // anterior. Las fallidas se devuelven y se conservan en cola para reintentar.
  const syncQueue = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const currentQueue = (await get<PendingSale[]>(OFFLINE_QUEUE_KEY)) || [];
      if (currentQueue.length === 0) return;

      console.log(`🔄 Intentando sincronizar ${currentQueue.length} ventas...`);

      let failedQueue: PendingSale[] = [];
      let syncedCount = 0;

      try {
        const results = await createSalesBatch(
          currentQueue.map(sale => ({
            // La venta offline ya ocurrió físicamente: se registra aunque el stock
            // quede negativo. La clave de idempotencia evita duplicados en reintentos.
            clientRequestId: sale.id,
            allowOversell: true,
            ...sale.payload,
          }))
        );

        const failedIds = new Set(
          results.filter(r => !r.ok).map(r => r.client_request_id)
        );
        results.filter(r => !r.ok).forEach(r => console.error('❌ Falló venta:', r.client_request_id, r.error));

        failedQueue = currentQueue.filter(s => failedIds.has(s.id));
        syncedCount = currentQueue.length - failedQueue.length;
      } catch (error) {
        // Fallo de red del lote entero: se conserva la cola intacta y se
        // reintentará en la próxima reconexión.
        console.error('❌ No se pudo sincronizar el lote:', error);
        failedQueue = currentQueue;
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