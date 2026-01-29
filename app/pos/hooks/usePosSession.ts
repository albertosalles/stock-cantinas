import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export type PosSession = {
  eventId: string;
  cantinaId: string;
  userId: string;
  eventName: string;
  cantinaName: string;
  sessionChecked: boolean;
};

// Usuario de respaldo (MVP sin Supabase Auth)
const FALLBACK_USER_ID = process.env.NEXT_PUBLIC_APP_USER_ID!;

export function usePosSession() {
  const router = useRouter();

  const [session, setSession] = useState<PosSession>({
    eventId: '',
    cantinaId: '',
    userId: '',
    eventName: 'Evento',
    cantinaName: 'Cantina',
    sessionChecked: false,
  });

  useEffect(() => {
    const checkSession = async () => {
      const sessionData = localStorage.getItem('cantina_session');

      if (!sessionData) {
        router.push('/login');
        return;
      }

      try {
        const parsedSession = JSON.parse(sessionData);

        // PASO 1 (CRÍTICO PARA OFFLINE): 
        // Establecemos la sesión inmediatamente con los datos locales.
        // Esto permite que la app cargue aunque no haya internet.
        setSession({
          eventId: parsedSession.eventId,
          cantinaId: parsedSession.cantinaId,
          userId: FALLBACK_USER_ID,
          eventName: parsedSession.eventName,
          cantinaName: parsedSession.cantinaName,
          sessionChecked: true, // Permitimos renderizar el TPV
        });

        // PASO 2: Verificación en segundo plano (Background Check)
        // Intentamos contactar con Supabase. Si falla por red, NO hacemos nada.
        // Solo cerramos sesión si Supabase nos responde explícitamente que el evento acabó.
        const { data, error } = await supabase
          .from('events')
          .select('status, name')
          .eq('id', parsedSession.eventId)
          .single();

        // CASO A: Error de red o servidor -> Asumimos Offline y mantenemos sesión abierta.
        if (error) {
          console.warn('Modo Offline: No se pudo verificar el estado del evento. Manteniendo sesión local.');
          return;
        }

        // CASO B: Conectamos bien, pero el evento ya no está activo
        if (data && data.status !== 'live') {
          alert('El evento ha finalizado o está pausado.');
          localStorage.removeItem('cantina_session');
          router.push('/login');
          return;
        }

        // CASO C: Todo bien, actualizamos el nombre si cambió
        if (data && data.name !== parsedSession.eventName) {
          setSession(prev => ({ ...prev, eventName: data.name }));
        }

      } catch (e) {
        console.error('Error parsing session:', e);
        // Si el JSON local está corrupto, ahí sí debemos limpiar
        localStorage.removeItem('cantina_session');
        router.push('/login');
      }
    };

    checkSession();
  }, [router]);

  const logout = () => {
    if (confirm('¿Seguro que quieres cerrar sesión?')) {
      localStorage.removeItem('cantina_session');
      router.push('/login');
    }
  };

  return { ...session, logout };
}