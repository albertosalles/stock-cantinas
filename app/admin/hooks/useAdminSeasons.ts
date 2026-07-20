import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface SeasonRow {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  active: boolean;
  status: 'open' | 'closed';
}

export function useAdminSeasons() {
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchSeasons() {
    setLoading(true);
    const { data, error } = await supabase
      .from('seasons')
      .select('id, name, starts_on, ends_on, active, status')
      .order('starts_on', { ascending: false, nullsFirst: false });
    if (!error) setSeasons((data ?? []) as SeasonRow[]);
    setLoading(false);
  }

  async function createSeason(name: string, startsOn?: string, endsOn?: string) {
    if (!name.trim()) throw new Error('Debe introducir un nombre');
    const { error } = await supabase.from('seasons').insert({
      name: name.trim(),
      starts_on: startsOn || null,
      ends_on: endsOn || null,
    });
    if (error) throw error;
    await fetchSeasons();
  }

  /** Activa una temporada (desactivando la anterior; la BD garantiza una sola activa). */
  async function activateSeason(id: string) {
    const { error: e1 } = await supabase.from('seasons').update({ active: false }).eq('active', true);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('seasons').update({ active: true, status: 'open' }).eq('id', id);
    if (e2) throw e2;
    await fetchSeasons();
  }

  /** Cierra una temporada (deja de estar activa y pasa a estado closed). */
  async function closeSeason(id: string) {
    const { error } = await supabase.from('seasons').update({ active: false, status: 'closed' }).eq('id', id);
    if (error) throw error;
    await fetchSeasons();
  }

  useEffect(() => { fetchSeasons(); }, []);

  return { seasons, loading, fetchSeasons, createSeason, activateSeason, closeSeason };
}
