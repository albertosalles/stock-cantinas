import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface EventRow {
  id: string;
  name: string;
  date?: string | null;
  status?: string | null;
}

export function useAdminEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  async function fetchEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('id, name, date, status')
      .order('date', { ascending: false });
    
    if (!error) setEvents(data ?? []);
    setLoading(false);
  }

  async function createEvent(name: string, date: string) {
    if (!name.trim()) throw new Error('Debe introducir un nombre');
    
    const { data, error } = await supabase
      .from('events')
      .insert({ name: name.trim(), date: date || null })
      .select()
      .single();
      
    if (error) throw error;
    
    setEvents([data as EventRow, ...events]);
    return data;
  }

  async function updateEventStatus(eventId: string, newStatus: string) {
    const { error } = await supabase
      .from('events')
      .update({ status: newStatus })
      .eq('id', eventId);
      
    if (error) throw error;
    
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

