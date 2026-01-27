import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface CantinaRow {
  id: string;
  name: string;
  assigned: boolean;
}

export function useAdminCantinas(eventId: string) {
  const [cantinas, setCantinas] = useState<CantinaRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCantinas() {
    setLoading(true);
    // Obtiene todas las cantinas
    const { data: all } = await supabase
      .from('cantinas')
      .select('id, name')
      .order('name');

    // Obtiene las cantinas ya asignadas
    const { data: assigned } = await supabase
      .from('event_cantinas')
      .select('cantina_id')
      .eq('event_id', eventId);

    const assignedSet = new Set((assigned ?? []).map((row: any) => row.cantina_id));

    if (all) {
      const mapped = all.map((c: any) => ({
        id: c.id,
        name: c.name,
        assigned: assignedSet.has(c.id)
      }));
      setCantinas(mapped);
    }
    setLoading(false);
  }

  async function toggleCantina(cantinaId: string, assign: boolean) {
    if (assign) {
      await supabase.from('event_cantinas').insert({ event_id: eventId, cantina_id: cantinaId });
    } else {
      await supabase.from('event_cantinas').delete().match({ event_id: eventId, cantina_id: cantinaId });
    }
    await fetchCantinas();
  }

  async function createCantina(name: string, pin: string) {
    if (!name.trim()) throw new Error('Nombre requerido');
    if (!pin.trim()) throw new Error('PIN requerido');

    const { data, error } = await supabase
      .from('cantinas')
      .insert({ name: name.trim() })
      .select('id')
      .single();

    if (error) throw error;

    // Set PIN
    const { error: pinError } = await supabase.rpc('set_cantina_pin', {
      p_cantina_id: data.id,
      p_pin_code: pin.trim(),
      p_is_active: true
    });

    if (pinError) console.error('Error setting PIN:', pinError);

    // Auto-assign to current event
    await supabase
      .from('event_cantinas')
      .insert({ event_id: eventId, cantina_id: data.id });

    await fetchCantinas();
  }

  useEffect(() => {
    if (eventId) fetchCantinas();
  }, [eventId]);

  return {
    cantinas,
    loading,
    fetchCantinas,
    toggleCantina,
    createCantina
  };
}

