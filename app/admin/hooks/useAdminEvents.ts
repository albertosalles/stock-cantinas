import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { adminOp } from '@/lib/adminData';

export interface EventRow {
  id: string;
  name: string;
  date?: string | null;
  status?: string | null;
  season_id?: string | null;
  /** Recaudación acumulada del evento (céntimos). */
  total_cents: number;
  /** Tickets (ventas) del evento. */
  num_sales: number;
  /** Cantinas asignadas al evento. */
  num_cantinas: number;
}

export function useAdminEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  async function fetchEvents() {
    setLoading(true);

    // Eventos + agregados de venta y nº de cantinas, en paralelo.
    const [evRes, salesRes, cantRes] = await Promise.all([
      supabase.from('events').select('id, name, date, status, season_id').order('date', { ascending: false }),
      supabase.from('v_sales_by_cantina').select('event_id, total_cents, num_sales'),
      supabase.from('event_cantinas').select('event_id'),
    ]);

    const salesByEvent = new Map<string, { total_cents: number; num_sales: number }>();
    (salesRes.data ?? []).forEach((r: any) => {
      const cur = salesByEvent.get(r.event_id) ?? { total_cents: 0, num_sales: 0 };
      cur.total_cents += r.total_cents ?? 0;
      cur.num_sales += r.num_sales ?? 0;
      salesByEvent.set(r.event_id, cur);
    });

    const cantinasByEvent = new Map<string, number>();
    (cantRes.data ?? []).forEach((r: any) => {
      cantinasByEvent.set(r.event_id, (cantinasByEvent.get(r.event_id) ?? 0) + 1);
    });

    if (!evRes.error) {
      setEvents((evRes.data ?? []).map((e: any) => {
        const agg = salesByEvent.get(e.id) ?? { total_cents: 0, num_sales: 0 };
        return {
          ...e,
          total_cents: agg.total_cents,
          num_sales: agg.num_sales,
          num_cantinas: cantinasByEvent.get(e.id) ?? 0,
        } as EventRow;
      }));
    }
    setLoading(false);
  }

  async function createEvent(
    name: string,
    date: string,
    seasonId?: string | null,
    datos?: { kickoffAt?: string | null; opponentId?: string | null; matchType?: string | null },
  ) {
    if (!name.trim()) throw new Error('Debe introducir un nombre');

    // Hora de inicio, rival y competición se guardan ya en el alta: son los
    // únicos datos del partido que no se pueden reconstruir después de jugarlo.
    const data = await adminOp<any>('evento.crear', {
      name, date, seasonId,
      kickoffAt: datos?.kickoffAt ?? null,
      opponentId: datos?.opponentId ?? null,
      matchType: datos?.matchType ?? null,
    });

    setEvents([{ ...(data as any), total_cents: 0, num_sales: 0, num_cantinas: 0 }, ...events]);
    return data;
  }

  async function updateEventStatus(eventId: string, newStatus: string) {
    await adminOp('evento.estado', { id: eventId, status: newStatus });

    setEvents(events.map(e => e.id === eventId ? { ...e, status: newStatus } : e));
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  return {
    events,
    loading,
    fetchEvents,
    createEvent,
    updateEventStatus
  };
}
