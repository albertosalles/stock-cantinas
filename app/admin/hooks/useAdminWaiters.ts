import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface WaiterRow {
  id: string;
  name: string;
  surname: string | null;
  active: boolean;
  qr_token: string;
  pin_code: string | null;
  /** Horas imputadas en turnos cerrados */
  total_hours: number;
  /** true si tiene un turno abierto ahora mismo */
  on_shift: boolean;
}

export function useAdminWaiters() {
  const [waiters, setWaiters] = useState<WaiterRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchWaiters() {
    setLoading(true);
    const [wRes, sRes] = await Promise.all([
      supabase.from('waiters').select('id, name, surname, active, qr_token, pin_code').order('name'),
      supabase.from('shifts').select('waiter_id, hours, ended_at'),
    ]);

    const hoursByWaiter = new Map<string, number>();
    const openByWaiter = new Set<string>();
    (sRes.data ?? []).forEach((s: any) => {
      if (s.ended_at === null) openByWaiter.add(s.waiter_id);
      else hoursByWaiter.set(s.waiter_id, (hoursByWaiter.get(s.waiter_id) ?? 0) + Number(s.hours ?? 0));
    });

    setWaiters(((wRes.data ?? []) as any[]).map(w => ({
      ...w,
      total_hours: Math.round((hoursByWaiter.get(w.id) ?? 0) * 100) / 100,
      on_shift: openByWaiter.has(w.id),
    })));
    setLoading(false);
  }

  async function createWaiter(name: string, surname: string, pin: string) {
    if (!name.trim()) throw new Error('El nombre es obligatorio');
    const { error } = await supabase.from('waiters').insert({
      name: name.trim(),
      surname: surname.trim() || null,
      pin_code: pin.trim() || null,
    });
    if (error) {
      if (error.code === '23505') throw new Error('Ese PIN ya está en uso por otro camarero');
      throw error;
    }
    await fetchWaiters();
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from('waiters').update({ active }).eq('id', id);
    if (error) throw error;
    setWaiters(ws => ws.map(w => w.id === id ? { ...w, active } : w));
  }

  useEffect(() => { fetchWaiters(); }, []);

  return { waiters, loading, fetchWaiters, createWaiter, toggleActive };
}
