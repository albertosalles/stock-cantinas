import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export type Event = {
  id: string;
  name: string;
  date: string;
  cantinas_count: number;
};

export type Cantina = {
  event_id: string;
  event_name: string;
  cantina_id: string;
  cantina_name: string;
  cantina_location: string;
  access_enabled: boolean;
  has_credentials: boolean;
};

export type LoginStep = 'event' | 'cantina' | 'pin';

export function useLogin() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('event');
  const [events, setEvents] = useState<Event[]>([]);
  const [cantinas, setCantinas] = useState<Cantina[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedCantina, setSelectedCantina] = useState<Cantina | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadActiveEvents();
  }, []);

  async function loadActiveEvents() {
    try {
      const { data, error } = await supabase.rpc('get_active_events');
      if (error) throw error;
      setEvents(data || []);
    } catch (e: any) {
      console.error('Error loading events:', e);
      setError('No se pudieron cargar los eventos activos');
    }
  }

  async function loadCantinas(eventId: string) {
    try {
      const { data, error } = await supabase
        .from('v_available_cantinas')
        .select('*')
        .eq('event_id', eventId);
      
      if (error) throw error;
      setCantinas(data || []);
    } catch (e: any) {
      console.error('Error loading cantinas:', e);
      setError('No se pudieron cargar las cantinas');
    }
  }

  function selectEvent(event: Event) {
    setSelectedEvent(event);
    setError('');
    loadCantinas(event.id);
    setStep('cantina');
  }

  function selectCantina(cantina: Cantina) {
    setSelectedCantina(cantina);
    setError('');
    setStep('pin');
  }

  function goBack() {
    setError('');
    if (step === 'pin') {
      setStep('cantina');
      setPin('');
    } else if (step === 'cantina') {
      setStep('event');
      setSelectedEvent(null);
      setCantinas([]);
    }
  }

  async function login() {
    if (!selectedEvent || !selectedCantina || !pin) return;

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.rpc('validate_cantina_access', {
        p_event_id: selectedEvent.id,
        p_cantina_id: selectedCantina.cantina_id,
        p_pin_code: pin
      });

      if (error) throw error;

      const result = data[0];
      
      if (result.success) {
        localStorage.setItem('cantina_session', JSON.stringify({
          eventId: selectedEvent.id,
          eventName: result.event_name,
          cantinaId: selectedCantina.cantina_id,
          cantinaName: result.cantina_name,
          loginTime: new Date().toISOString()
        }));
        router.push('/pos');
      } else {
        setError(result.message || 'Acceso denegado');
      }
    } catch (e: any) {
      console.error('Login error:', e);
      setError(e.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return {
    step,
    events,
    cantinas,
    selectedEvent,
    selectedCantina,
    pin,
    setPin,
    loading,
    error,
    selectEvent,
    selectCantina,
    goBack,
    login
  };
}

