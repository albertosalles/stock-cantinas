import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useAdminEvent(eventId: string) {
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchEvent() {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('name, date, status')
      .eq('id', eventId)
      .single();
      
    if (!error && data) {
      setEventName(data.name);
      setEventDate(data.date);
      setEventStatus(data.status);
    }
    setLoading(false);
  }

  async function saveEvent() {
    const { error } = await supabase
      .from('events')
      .update({ name: eventName, date: eventDate })
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
    eventStatus,
    loading,
    saveEvent
  };
}

