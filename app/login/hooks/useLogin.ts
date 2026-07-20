import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import {
  parseQr, resolveCantinaQr, identifyWaiter, openShift,
  CantinaAccess,
} from '@/lib/waiters';

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

// Flujo: 'scan' (QR cantina, camino principal) → 'waiter' (identificación personal)
// Fallback manual: 'event' → 'cantina' → 'pin' → 'waiter'
export type LoginStep = 'scan' | 'event' | 'cantina' | 'pin' | 'waiter';

export function useLogin() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('scan');
  const [events, setEvents] = useState<Event[]>([]);
  const [cantinas, setCantinas] = useState<Cantina[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedCantina, setSelectedCantina] = useState<Cantina | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Acceso a cantina resuelto (por QR o por flujo manual), pendiente de identificar camarero
  const [pendingAccess, setPendingAccess] = useState<CantinaAccess | null>(null);

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

  // ─── Paso 'scan': QR de cantina ───
  async function handleCantinaQr(text: string) {
    if (loading) return;
    const { kind, token } = parseQr(text);
    if (kind === 'waiter') {
      setError('Este QR es de una acreditación de camarero. Escanea el QR de la cantina.');
      return;
    }
    if (!token) {
      setError('Código QR no reconocido');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const access = await resolveCantinaQr(token);
      if (!access) {
        setError('QR no válido o la cantina no tiene ningún evento en vivo');
        return;
      }
      setPendingAccess(access);
      setStep('waiter');
    } catch (e: any) {
      console.error('QR cantina error:', e);
      setError(e.message || 'Error al validar el QR');
    } finally {
      setLoading(false);
    }
  }

  // ─── Paso 'waiter': identificación personal (QR de acreditación o PIN personal) ───
  async function handleWaiterIdentify(opts: { qrText?: string; pin?: string }) {
    if (!pendingAccess || loading) return;
    setLoading(true);
    setError('');
    try {
      let identity = null;
      if (opts.qrText !== undefined) {
        const { kind, token } = parseQr(opts.qrText);
        if (kind === 'cantina') {
          setError('Este QR es de una cantina. Escanea el QR de tu acreditación.');
          return;
        }
        if (!token) {
          setError('Código QR no reconocido');
          return;
        }
        identity = await identifyWaiter({ qrToken: token });
      } else if (opts.pin) {
        identity = await identifyWaiter({ pin: opts.pin });
      }

      if (!identity) {
        setError('Camarero no encontrado o desactivado');
        return;
      }

      // Abrir turno e iniciar sesión
      const shiftId = await openShift(identity.waiterId, pendingAccess.eventId, pendingAccess.cantinaId);

      localStorage.setItem('cantina_session', JSON.stringify({
        eventId: pendingAccess.eventId,
        eventName: pendingAccess.eventName,
        cantinaId: pendingAccess.cantinaId,
        cantinaName: pendingAccess.cantinaName,
        waiterId: identity.waiterId,
        waiterName: identity.waiterName,
        shiftId,
        loginTime: new Date().toISOString(),
      }));
      router.push('/pos');
    } catch (e: any) {
      console.error('Waiter identify error:', e);
      setError(e.message || 'Error al identificar al camarero');
    } finally {
      setLoading(false);
    }
  }

  // ─── Fallback manual (evento → cantina → PIN de cantina) ───
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

  function startManualFlow() {
    setError('');
    setStep('event');
  }

  function goBack() {
    setError('');
    if (step === 'waiter') {
      setPendingAccess(null);
      setStep('scan');
    } else if (step === 'pin') {
      setStep('cantina');
      setPin('');
    } else if (step === 'cantina') {
      setStep('event');
      setSelectedEvent(null);
      setCantinas([]);
    } else if (step === 'event') {
      setStep('scan');
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
        // El acceso a la cantina está validado: falta identificar al camarero
        setPendingAccess({
          eventId: selectedEvent.id,
          eventName: result.event_name,
          cantinaId: selectedCantina.cantina_id,
          cantinaName: result.cantina_name,
        });
        setStep('waiter');
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
    pendingAccess,
    pin,
    setPin,
    loading,
    error,
    setError,
    handleCantinaQr,
    handleWaiterIdentify,
    startManualFlow,
    selectEvent,
    selectCantina,
    goBack,
    login
  };
}
