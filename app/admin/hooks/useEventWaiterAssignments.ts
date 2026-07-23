import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { openShift, closeShift } from '@/lib/waiters';

export interface AssignableWaiter {
  id: string;
  name: string;
  /** Cantina donde tiene turno abierto en este evento (null si no está asignado). */
  cantinaId: string | null;
  cantinaName: string | null;
}

export interface EventCantinaOption {
  id: string;
  name: string;
}

/**
 * Asignación centralizada de camareros del evento: permite mover a cualquier
 * camarero a cualquier cantina del evento (o dejarlo sin asignar).
 * Se apoya en los turnos (open_shift mueve y cierra el anterior imputando horas).
 */
export function useEventWaiterAssignments(eventId: string) {
  const queryClient = useQueryClient();
  const [waiters, setWaiters] = useState<AssignableWaiter[]>([]);
  const [cantinas, setCantinas] = useState<EventCantinaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [wRes, sRes, cRes] = await Promise.all([
      supabase.from('waiters').select('id, name, surname').eq('active', true).order('name'),
      supabase.from('shifts').select('waiter_id, cantina_id').eq('event_id', eventId).is('ended_at', null),
      supabase.from('event_cantinas').select('cantina_id, cantinas(name)').eq('event_id', eventId),
    ]);

    const options: EventCantinaOption[] = ((cRes.data ?? []) as any[])
      .map(r => ({ id: r.cantina_id, name: r.cantinas?.name ?? 'Cantina' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setCantinas(options);

    const nameById = new Map(options.map(o => [o.id, o.name]));
    const openByWaiter = new Map<string, string>();
    (sRes.data ?? []).forEach((s: any) => openByWaiter.set(s.waiter_id, s.cantina_id));

    setWaiters(((wRes.data ?? []) as any[]).map(w => {
      const cid = openByWaiter.get(w.id) ?? null;
      return {
        id: w.id,
        name: `${w.name} ${w.surname ?? ''}`.trim(),
        cantinaId: cid,
        cantinaName: cid ? (nameById.get(cid) ?? 'Otra cantina') : null,
      };
    }));
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  /** Mueve al camarero a la cantina indicada, o cierra su turno si es null. */
  const assignTo = async (waiterId: string, cantinaId: string | null) => {
    setBusyId(waiterId);
    try {
      if (cantinaId) {
        await openShift(waiterId, eventId, cantinaId);
      } else {
        const { data } = await supabase.from('shifts')
          .select('id').eq('waiter_id', waiterId).eq('event_id', eventId).is('ended_at', null);
        for (const s of data ?? []) await closeShift((s as any).id);
      }
      await load();
      // El rendimiento y el grid dependen de los turnos: refrescarlos
      queryClient.invalidateQueries({ queryKey: ['waiter_performance'] });
      queryClient.invalidateQueries({ queryKey: ['cantinas_grid'] });
      queryClient.invalidateQueries({ queryKey: ['event_dashboard'] });
    } finally {
      setBusyId(null);
    }
  };

  return { waiters, cantinas, loading, busyId, assignTo, refresh: load };
}
