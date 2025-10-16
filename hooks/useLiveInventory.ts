import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useLiveInventory(eventId: string, cantinaId: string) {
  const [changes, setChanges] = useState<any[]>([]);
  useEffect(() => {
    const channel = supabase
      .channel(`evt-${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'stock_movements',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
        if ((payload.new as any)?.cantina_id === cantinaId) {
          setChanges((prev) => [payload, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, cantinaId]);
  return changes;
}
