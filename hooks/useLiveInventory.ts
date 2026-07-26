import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Señal de "el stock de esta cantina ha cambiado en el servidor".
 *
 * Devuelve un CONTADOR monótono, no la lista de payloads: los tres consumidores
 * (TPV, métricas e inventario de admin) sólo lo usan como disparador de refetch,
 * y acumular los payloads hacía crecer un array sin límite durante toda la sesión
 * —en un turno de 4 h son miles de objetos— re-renderizando además la página
 * completa en cada mensaje (INF-1, defecto 3).
 *
 * Empieza en 0, que es falsy a propósito: así el consumidor distingue "todavía no
 * ha pasado nada" de "ha habido al menos un cambio" y no invalida en el montaje.
 */
export function useLiveInventory(eventId: string, cantinaId: string) {
  const [changeCount, setChangeCount] = useState(0);

  useEffect(() => {
    if (!eventId || !cantinaId) return;

    const channel = supabase
      .channel(`evt-${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'stock_movements',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
        // El filtro del servidor sólo acota por evento; la cantina se descarta aquí.
        // (El filtrado en origen se aborda en la épica de fan-out de Realtime.)
        const row = (payload.new ?? payload.old) as { cantina_id?: string } | null;
        if (row?.cantina_id === cantinaId) {
          setChangeCount((n) => n + 1);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, cantinaId]);

  return changeCount;
}
