import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  joinRealtime, watchRealtimeStatus, countInvalidation,
  type RealtimeTable, type RealtimeStatus,
} from '@/lib/realtimeBus';

export type { RealtimeTable, RealtimeStatus };

/** Ventana de agrupación por defecto, en milisegundos. */
const DEFAULT_THROTTLE_MS = 2500;

/**
 * Invalida una consulta cuando cambian las tablas indicadas, AGRUPANDO los avisos.
 *
 * Antes cada mensaje disparaba un refetch inmediato. En el pico del descanso
 * entran ~27 movimientos por segundo, así que un hook con sondeo de 30 s acababa
 * lanzando 27 refetches por segundo (INF-1, apartado 3.4).
 *
 * La agrupación es de "flanco de subida": el primer mensaje refresca al instante
 * —para que la caja perciba el cambio como inmediato— y los siguientes se
 * acumulan en una ventana, de modo que el mismo pico se resuelve con menos de un
 * refetch por segundo sin pérdida perceptible de tiempo real.
 */
export function useRealtimeInvalidate(
  eventId: string | undefined,
  cantinaId: string | undefined,
  tables: RealtimeTable[],
  queryKey: QueryKey,
  throttleMs: number = DEFAULT_THROTTLE_MS,
) {
  const queryClient = useQueryClient();

  // Se leen por referencia para no reenganchar el canal en cada render.
  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;
  const tablesRef = useRef(tables);
  tablesRef.current = tables;

  const tablesId = tables.join(',');
  const keyId = JSON.stringify(queryKey);

  useEffect(() => {
    if (!eventId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;

    const flush = () => {
      countInvalidation();
      queryClient.invalidateQueries({ queryKey: keyRef.current });
    };

    const tick = () => {
      timer = null;
      if (!pending) return;
      pending = false;
      flush();
      timer = setTimeout(tick, throttleMs);
    };

    const onChange = () => {
      if (timer) { pending = true; return; }
      flush();
      timer = setTimeout(tick, throttleMs);
    };

    const leave = joinRealtime(eventId, cantinaId, { tables: tablesRef.current, onChange });

    return () => {
      leave();
      if (timer) clearTimeout(timer);
    };
  }, [eventId, cantinaId, tablesId, keyId, throttleMs, queryClient]);
}

/**
 * Señal de cambio para consumidores que no usan React Query.
 * Devuelve un contador monótono, ya agrupado.
 */
export function useRealtimeSignal(
  eventId: string | undefined,
  cantinaId: string | undefined,
  tables: RealtimeTable[],
  throttleMs: number = DEFAULT_THROTTLE_MS,
): number {
  const [count, setCount] = useState(0);
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const tablesId = tables.join(',');

  useEffect(() => {
    if (!eventId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;

    const bump = () => setCount(n => n + 1);

    const tick = () => {
      timer = null;
      if (!pending) return;
      pending = false;
      bump();
      timer = setTimeout(tick, throttleMs);
    };

    const onChange = () => {
      if (timer) { pending = true; return; }
      bump();
      timer = setTimeout(tick, throttleMs);
    };

    const leave = joinRealtime(eventId, cantinaId, { tables: tablesRef.current, onChange });

    return () => {
      leave();
      if (timer) clearTimeout(timer);
    };
  }, [eventId, cantinaId, tablesId, throttleMs]);

  return count;
}

/**
 * Estado de la conexión en tiempo real del ámbito.
 *
 * Existe porque la caída del WebSocket era silenciosa: la aplicación seguía
 * mostrando datos viejos sin avisar, y en el TPV eso significa vender contra un
 * stock que ya no es el real.
 */
export function useRealtimeStatus(
  eventId: string | undefined,
  cantinaId?: string,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    if (!eventId) return;
    return watchRealtimeStatus(eventId, cantinaId, setStatus);
  }, [eventId, cantinaId]);

  return status;
}
