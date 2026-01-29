import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { createSale } from '@/lib/sales';

const OFFLINE_QUEUE_KEY = 'offline_sales_queue';

export type PendingSale = {
  id: string;
  payload: {
    eventId: string;
    cantinaId: string;
    userId: string;
    lines: { productId: string; qty: number }[];
  };
  timestamp: number;
};

// --- FUNCIÓN SEGURA (Copiada de tu lib/sales.ts) ---
function generateSafeUUID(): string {
  // 1. Intenta usar la API moderna
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Si falla, ignoramos y pasamos al manual
    }
  }

  // 2. Fallback manual (funciona en todos los navegadores)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function useOfflineSales() {
  const queryClient = useQueryClient();

  // 1. Leer cola
  const { data: queue = [], refetch } = useQuery({
    queryKey: ['offlineQueue'],
    queryFn: async () => (await get<PendingSale[]>(OFFLINE_QUEUE_KEY)) || [],
    staleTime: 0,
  });

  // 2. Añadir a cola (Usando la función segura)
  const queueSale = async (payload: PendingSale['payload']) => {
    const newSale: PendingSale = {
      id: generateSafeUUID(), // <--- AQUI ESTABA EL ERROR, AHORA CORREGIDO
      payload,
      timestamp: Date.now(),
    };

    const currentQueue = (await get<PendingSale[]>(OFFLINE_QUEUE_KEY)) || [];
    const updatedQueue = [...currentQueue, newSale];

    await set(OFFLINE_QUEUE_KEY, updatedQueue);
    refetch();
  };

  // 3. Sincronizar
  const syncQueue = async () => {
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
          sale.payload.lines
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