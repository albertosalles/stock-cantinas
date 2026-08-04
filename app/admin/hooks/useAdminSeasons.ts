import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { adminOp } from '@/lib/adminData';

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
    await adminOp('temporada.crear', { name, startsOn, endsOn });
    await fetchSeasons();
  }

  /** Activa una temporada (desactivando la anterior; la BD garantiza una sola activa). */
  async function activateSeason(id: string) {
    await adminOp('temporada.activar', { id });
    await fetchSeasons();
  }

  /** Cierra una temporada (deja de estar activa y pasa a estado closed). */
  async function closeSeason(id: string) {
    await adminOp('temporada.cerrar', { id });
    await fetchSeasons();
  }

  useEffect(() => { fetchSeasons(); }, []);

  return { seasons, loading, fetchSeasons, createSeason, activateSeason, closeSeason };
}
