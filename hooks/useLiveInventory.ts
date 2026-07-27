import { useRealtimeSignal } from '@/hooks/useEventRealtime';

/**
 * Señal de "el stock de esta cantina ha cambiado en el servidor".
 *
 * Devuelve un CONTADOR monótono, no la lista de payloads: los consumidores sólo
 * lo usan como disparador de refetch, y acumular los payloads hacía crecer un
 * array sin límite durante toda la sesión —en un turno de 4 h son miles de
 * objetos— re-renderizando además la página completa en cada mensaje
 * (INF-1, defecto 3).
 *
 * El filtrado por cantina lo hace ahora el SERVIDOR, no este hook. Antes se
 * suscribía a todo el evento y descartaba en JavaScript el ~95 % de lo que
 * recibía: con 20 barras, un TPV procesaba 27 mensajes por segundo en el pico
 * del descanso para quedarse con uno (INF-1, apartado 3.4).
 *
 * Empieza en 0, que es falsy a propósito: así el consumidor distingue "todavía no
 * ha pasado nada" de "ha habido al menos un cambio" y no invalida en el montaje.
 */
export function useLiveInventory(eventId: string, cantinaId: string) {
  return useRealtimeSignal(eventId, cantinaId, ['stock_movements']);
}
