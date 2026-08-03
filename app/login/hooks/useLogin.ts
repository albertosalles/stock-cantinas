import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import {
  parseQr, resolveCantinaQr, validateCantinaPin, startPosSession,
  CantinaAccess,
} from '@/lib/waiters';
import { setAccessToken } from '@/lib/session';
import { DEV_EASY_LOGIN } from '@/lib/devConfig';

export type ActiveWaiter = { id: string; name: string };

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
  // En modo dev arrancamos directamente en el flujo manual (sin escáner QR)
  const [step, setStep] = useState<LoginStep>(DEV_EASY_LOGIN ? 'event' : 'scan');
  const [events, setEvents] = useState<Event[]>([]);
  const [cantinas, setCantinas] = useState<Cantina[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedCantina, setSelectedCantina] = useState<Cantina | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Acceso a cantina resuelto (por QR o por flujo manual), pendiente de identificar camarero
  const [pendingAccess, setPendingAccess] = useState<CantinaAccess | null>(null);
  // Vale firmado por el servidor que acredita esa cantina. Sin él, el paso 2 no
  // emite token: es lo que impide pedir sesión para una barra cuyo PIN no se sabe.
  const [vale, setVale] = useState<string | null>(null);

  // [DEV] Listado de camareros activos para el login simplificado
  const [activeWaiters, setActiveWaiters] = useState<ActiveWaiter[]>([]);

  useEffect(() => {
    loadActiveEvents();
    if (DEV_EASY_LOGIN) loadActiveWaiters();
  }, []);

  async function loadActiveWaiters() {
    const { data, error } = await supabase
      .from('waiters')
      .select('id, name, surname')
      .eq('active', true)
      .order('name');
    if (error) { console.error('Error loading waiters:', error); return; }
    setActiveWaiters((data ?? []).map((w: any) => ({
      id: w.id,
      name: `${w.name} ${w.surname ?? ''}`.trim(),
    })));
  }

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
      const grant = await resolveCantinaQr(token);
      if (!grant) {
        setError('QR no válido o la cantina no tiene ningún evento en vivo');
        return;
      }
      setPendingAccess(grant.acceso);
      setVale(grant.vale);
      setStep('waiter');
    } catch (e: any) {
      console.error('QR cantina error:', e);
      setError(e.message || 'Error al validar el QR');
    } finally {
      setLoading(false);
    }
  }

  // Persiste la sesión y entra al POS. El turno lo abre el servidor al emitir
  // el token, en la misma operación: así no queda un token sin turno si falla
  // algo por el camino.
  function guardarSesion(token: string, sesion: Record<string, unknown>) {
    setAccessToken(token);
    localStorage.setItem('cantina_session', JSON.stringify(sesion));
    router.push('/pos');
  }

  // ─── Paso 'waiter': identificación personal (QR de acreditación o PIN personal) ───
  async function handleWaiterIdentify(opts: { qrText?: string; pin?: string }) {
    if (!pendingAccess || !vale || loading) return;
    setLoading(true);
    setError('');
    try {
      let qrToken: string | undefined;
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
        qrToken = token;
      }

      const { token, sesion } = await startPosSession({ vale, qrToken, pin: opts.pin });
      guardarSesion(token, sesion);
    } catch (e: any) {
      console.error('Waiter identify error:', e);
      setError(e.message || 'Error al identificar al camarero');
    } finally {
      setLoading(false);
    }
  }

  // [DEV] Login directo eligiendo camarero de la lista (sin QR ni PIN).
  // El servidor vuelve a comprobar el entorno antes de aceptarlo.
  async function loginAsWaiter(waiterId: string, _waiterName: string) {
    if (!pendingAccess || !vale || loading) return;
    setLoading(true);
    setError('');
    try {
      const { token, sesion } = await startPosSession({ vale, waiterId });
      guardarSesion(token, sesion);
    } catch (e: any) {
      console.error('Dev login error:', e);
      setError(e.message || 'Error al iniciar sesión');
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

  async function selectCantina(cantina: Cantina) {
    setSelectedCantina(cantina);
    setError('');
    if (!DEV_EASY_LOGIN) {
      setStep('pin');
      return;
    }
    // En dev se salta el PIN, pero el vale lo sigue firmando el servidor: es él
    // quien decide si el atajo está permitido en este entorno.
    setLoading(true);
    try {
      const grant = await validateCantinaPin(cantina.event_id, cantina.cantina_id, '');
      setPendingAccess(grant.acceso);
      setVale(grant.vale);
      setStep('waiter');
    } catch (e: any) {
      setError(e.message || 'No se pudo acceder a la cantina');
    } finally {
      setLoading(false);
    }
  }

  function startManualFlow() {
    setError('');
    setStep('event');
  }

  function goBack() {
    setError('');
    setVale(null);
    if (step === 'waiter') {
      setPendingAccess(null);
      // En dev volvemos a la selección de cantina; en producción, al escáner
      setStep(DEV_EASY_LOGIN ? 'cantina' : 'scan');
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
      const grant = await validateCantinaPin(selectedEvent.id, selectedCantina.cantina_id, pin);
      // El acceso a la cantina está validado: falta identificar al camarero
      setPendingAccess(grant.acceso);
      setVale(grant.vale);
      setStep('waiter');
    } catch (e: any) {
      console.error('Login error:', e);
      setError(e.message || 'Acceso denegado');
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
    activeWaiters,
    pin,
    setPin,
    loading,
    error,
    setError,
    handleCantinaQr,
    handleWaiterIdentify,
    loginAsWaiter,
    startManualFlow,
    selectEvent,
    selectCantina,
    goBack,
    login
  };
}
