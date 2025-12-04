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
    const sessionData = localStorage.getItem('cantina_session');
    
    if (!sessionData) {
      // No hay sesión, redirigir al login
      router.push('/login');
      return;
    }

    try {
      const parsedSession = JSON.parse(sessionData);
      
      // Verificar que el evento siga activo
      supabase
        .from('events')
        .select('status, name')
        .eq('id', parsedSession.eventId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            alert('Error al verificar el evento');
            localStorage.removeItem('cantina_session');
            router.push('/login');
            return;
          }

          if (data.status !== 'live') {
            alert('El evento ya no está activo');
            localStorage.removeItem('cantina_session');
            router.push('/login');
            return;
          }

          // Sesión válida
          setSession({
            eventId: parsedSession.eventId,
            cantinaId: parsedSession.cantinaId,
            userId: FALLBACK_USER_ID,
            eventName: parsedSession.eventName,
            cantinaName: parsedSession.cantinaName,
            sessionChecked: true,
          });
        });
    } catch (e) {
      console.error('Error parsing session:', e);
      localStorage.removeItem('cantina_session');
      router.push('/login');
    }
  }, [router]);

  const logout = () => {
    if (confirm('¿Seguro que quieres cerrar sesión?')) {
      localStorage.removeItem('cantina_session');
      router.push('/login');
    }
  };

  return { ...session, logout };
}

