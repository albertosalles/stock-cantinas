import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { adminOp } from '@/lib/adminData';

export function useAdminEvent(eventId: string) {
  const queryClient = useQueryClient();
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState<string | null>(null);
  /** Hora del pitido inicial. La apertura de puertas se deriva restando 90 min. */
  const [kickoffAt, setKickoffAt] = useState<string | null>(null);
  /** Rival del catálogo y competición: alimentan la comparativa histórica. */
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchEvent() {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('name, date, status, kickoff_at, opponent_id, match_type')
      .eq('id', eventId)
      .single();
      
    if (!error && data) {
      setEventName(data.name);
      setEventDate(data.date);
      setKickoffAt(data.kickoff_at ?? null);
      setOpponentId(data.opponent_id ?? null);
      setMatchType(data.match_type ?? null);
      setEventStatus(data.status);
    }
    setLoading(false);
  }

  async function saveEvent() {
    await adminOp('evento.actualizar', {
      id: eventId, name: eventName, date: eventDate,
      kickoffAt, opponentId, matchType,
    });

    // Cambiar la hora de inicio redefine la ventana del partido, así que el mapa
    // de afluencia deja de ser válido. Sin esta invalidación el gráfico seguía
    // diciendo "falta la hora de inicio" después de haberla guardado, hasta que
    // la caché caducaba por su cuenta.
    queryClient.invalidateQueries({ queryKey: ['sales_by_slot', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event_dashboard', eventId] });
  }

  useEffect(() => {
    if (eventId) fetchEvent();
  }, [eventId]);

  return {
    eventName,
    setEventName,
    eventDate,
    setEventDate,
    kickoffAt,
    setKickoffAt,
    opponentId,
    setOpponentId,
    matchType,
    setMatchType,
    eventStatus,
    loading,
    saveEvent
  };
}

