import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { adminOp } from '@/lib/adminData';
import { setCantinaPin } from '@/lib/adminPins';

export interface CantinaRow {
  id: string;
  name: string;
  assigned: boolean;
  qr_token: string;
}

export function useAdminCantinas(eventId: string) {
  const [cantinas, setCantinas] = useState<CantinaRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCantinas() {
    setLoading(true);
    // Obtiene todas las cantinas
    const { data: all } = await supabase
      .from('cantinas')
      .select('id, name, qr_token')
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
        qr_token: c.qr_token,
        assigned: assignedSet.has(c.id)
      }));
      setCantinas(mapped);
    }
    setLoading(false);
  }

  async function toggleCantina(cantinaId: string, assign: boolean) {
    if (assign) {
      await adminOp('cantina.asignar', { eventId, cantinaId, asignar: true });
    } else {
      await adminOp('cantina.asignar', { eventId, cantinaId, asignar: false });
    }
    await fetchCantinas();
  }

  async function createCantina(name: string, pin: string) {
    if (!name.trim()) throw new Error('Nombre requerido');
    if (!pin.trim()) throw new Error('PIN requerido');

    const data = await adminOp<{ id: string }>('cantina.crear', { name });

    // El PIN se fija por ruta de servidor: set_cantina_pin está revocada al
    // navegador desde S2. Si falla, la cantina quedaría sin credenciales, así
    // que el error se propaga en vez de tragarse como antes.
    await setCantinaPin(data.id, pin);

    // Auto-assign to current event
    await adminOp('cantina.asignar', { eventId, cantinaId: data.id, asignar: true });

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

