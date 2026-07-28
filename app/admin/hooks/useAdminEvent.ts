import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useAdminEvent(eventId: string) {
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState<string | null>(null);
  /** Hora del pitido inicial. La apertura de puertas se deriva restando 90 min. */
  const [kickoffAt, setKickoffAt] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchEvent() {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('name, date, status, kickoff_at')
      .eq('id', eventId)
      .single();
      
    if (!error && data) {
      setEventName(data.name);
      setEventDate(data.date);
      setKickoffAt(data.kickoff_at ?? null);
      setEventStatus(data.status);
    }
    setLoading(false);
  }

  async function saveEvent() {
    const { error } = await supabase
      .from('events')
      .update({ name: eventName, date: eventDate, kickoff_at: kickoffAt })
      .eq('id', eventId);
      
    if (error) throw error;
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
    eventStatus,
    loading,
    saveEvent
  };
}

