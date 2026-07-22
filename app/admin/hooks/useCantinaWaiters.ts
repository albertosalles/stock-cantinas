import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { openShift, closeShift } from '@/lib/waiters';

export interface WaiterAssignment {
  id: string;
  name: string;
  /** true si tiene un turno abierto en ESTA cantina */
  here: boolean;
  /** nombre de la cantina donde está en turno, si es en otra */
  elsewhere: string | null;
}

/**
 * Gestiona qué camareros están en turno en una cantina.
 * "Asignar" abre un turno aquí (moviéndolo si estaba en otra cantina);
 * "quitar" cierra su turno. Reutiliza el modelo de turnos de la Fase 0.
 */
export function useCantinaWaiters(eventId: string, cantinaId: string) {
  const [waiters, setWaiters] = useState<WaiterAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [wRes, sRes, cRes] = await Promise.all([
      supabase.from('waiters').select('id, name, surname').eq('active', true).order('name'),
      supabase.from('shifts').select('waiter_id, cantina_id').eq('event_id', eventId).is('ended_at', null),
      supabase.from('cantinas').select('id, name'),
    ]);
    const openByWaiter = new Map<string, string>(); // waiter_id -> cantina_id
    (sRes.data ?? []).forEach((s: any) => openByWaiter.set(s.waiter_id, s.cantina_id));
    const cantMap = new Map((cRes.data ?? []).map((c: any) => [c.id, c.name]));

    setWaiters(((wRes.data ?? []) as any[]).map(w => {
      const at = openByWaiter.get(w.id);
      return {
        id: w.id,
        name: `${w.name} ${w.surname ?? ''}`.trim(),
        here: at === cantinaId,
        elsewhere: at && at !== cantinaId ? (cantMap.get(at) ?? 'otra cantina') : null,
      };
    }));
    setLoading(false);
  }, [eventId, cantinaId]);

  useEffect(() => { load(); }, [load]);

  const assign = async (waiterId: string) => {
    setBusyId(waiterId);
    try { await openShift(waiterId, eventId, cantinaId); await load(); }
    finally { setBusyId(null); }
  };

  const unassign = async (waiterId: string) => {
    setBusyId(waiterId);
    try {
      const { data } = await supabase.from('shifts')
        .select('id').eq('waiter_id', waiterId).eq('event_id', eventId).eq('cantina_id', cantinaId).is('ended_at', null);
      for (const s of data ?? []) await closeShift((s as any).id);
      await load();
    } finally { setBusyId(null); }
  };

  return { waiters, loading, busyId, assign, unassign, refresh: load };
}
