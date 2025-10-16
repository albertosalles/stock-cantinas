'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

type Event = {
  id: string;
  name: string;
  date: string;
  cantinas_count: number;
};

type Cantina = {
  event_id: string;
  event_name: string;
  cantina_id: string;
  cantina_name: string;
  cantina_location: string;
  access_enabled: boolean;
  has_credentials: boolean;
};

export default function CantinaLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'event' | 'cantina' | 'pin'>('event');
  const [events, setEvents] = useState<Event[]>([]);
  const [cantinas, setCantinas] = useState<Cantina[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedCantina, setSelectedCantina] = useState<Cantina | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cargar eventos activos
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

  // Cargar cantinas del evento seleccionado
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

  function handleEventSelect(event: Event) {
    setSelectedEvent(event);
    setError('');
    loadCantinas(event.id);
    setStep('cantina');
  }

  function handleCantinaSelect(cantina: Cantina) {
    setSelectedCantina(cantina);
    setError('');
    setStep('pin');
  }

  async function handleLogin() {
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
        // Guardar en localStorage
        localStorage.setItem('cantina_session', JSON.stringify({
          eventId: selectedEvent.id,
          eventName: result.event_name,
          cantinaId: selectedCantina.cantina_id,
          cantinaName: result.cantina_name,
          loginTime: new Date().toISOString()
        }));

        // Redirigir al POS
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

  function handleBack() {
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--elche-bg)' }}>
      {/* Barra superior */}
      <header style={{
        background: 'linear-gradient(135deg, var(--elche-green) 0%, var(--elche-green-dark) 100%)',
        color: 'white',
        padding: '20px 32px',
        boxShadow: '0 2px 8px rgba(0, 150, 79, 0.2)'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>
            🏪 Acceso Cantina
          </h1>
          <p style={{ opacity: 0.9, fontSize: '14px' }}>
            Sistema de gestión — Elche CF
          </p>
        </div>
      </header>

      {/* Contenido */}
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 32px' }}>
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 4px 24px rgba(0, 150, 79, 0.08)'
        }}>
          {/* Breadcrumb */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 32,
            fontSize: 14,
            color: 'var(--elche-text-light)'
          }}>
            <span style={{ color: step === 'event' ? 'var(--elche-green)' : undefined, fontWeight: step === 'event' ? 600 : 400 }}>
              1. Evento
            </span>
            <span>→</span>
            <span style={{ color: step === 'cantina' ? 'var(--elche-green)' : undefined, fontWeight: step === 'cantina' ? 600 : 400 }}>
              2. Cantina
            </span>
            <span>→</span>
            <span style={{ color: step === 'pin' ? 'var(--elche-green)' : undefined, fontWeight: step === 'pin' ? 600 : 400 }}>
              3. PIN
            </span>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              background: '#fee',
              border: '2px solid #fcc',
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              color: '#c00',
              fontSize: 14
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Paso 1: Seleccionar evento */}
          {step === 'event' && (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: 'var(--elche-text)' }}>
                Selecciona el evento
              </h2>
              {events.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px', 
                  color: 'var(--elche-text-light)' 
                }}>
                  No hay eventos activos en este momento
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {events.map(event => (
                    <button
                      key={event.id}
                      onClick={() => handleEventSelect(event)}
                      style={{
                        padding: 20,
                        borderRadius: 12,
                        border: '2px solid var(--elche-gray)',
                        background: 'white',
                        textAlign: 'left',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--elche-green)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--elche-gray)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--elche-text)', marginBottom: 6 }}>
                        {event.name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--elche-text-light)' }}>
                        📅 {new Date(event.date).toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--elche-text-light)', marginTop: 4 }}>
                        🏪 {event.cantinas_count} cantina{event.cantinas_count !== 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Paso 2: Seleccionar cantina */}
          {step === 'cantina' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--elche-text)' }}>
                  Selecciona tu cantina
                </h2>
                <button
                  onClick={handleBack}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: 'var(--elche-gray)',
                    color: 'var(--elche-text)',
                    fontWeight: 600,
                    fontSize: 14
                  }}>
                  ← Volver
                </button>
              </div>
              <div style={{ 
                padding: 12, 
                background: 'var(--elche-gray)', 
                borderRadius: 12, 
                marginBottom: 24,
                fontSize: 14,
                color: 'var(--elche-text-light)'
              }}>
                Evento: <strong>{selectedEvent?.name}</strong>
              </div>
              {cantinas.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px', 
                  color: 'var(--elche-text-light)' 
                }}>
                  No hay cantinas disponibles para este evento
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {cantinas.map(cantina => (
                    <button
                      key={cantina.cantina_id}
                      onClick={() => handleCantinaSelect(cantina)}
                      disabled={!cantina.has_credentials || !cantina.access_enabled}
                      style={{
                        padding: 20,
                        borderRadius: 12,
                        border: '2px solid var(--elche-gray)',
                        background: (!cantina.has_credentials || !cantina.access_enabled) ? 'var(--elche-gray)' : 'white',
                        textAlign: 'left',
                        opacity: (!cantina.has_credentials || !cantina.access_enabled) ? 0.5 : 1,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (cantina.has_credentials && cantina.access_enabled) {
                          e.currentTarget.style.borderColor = 'var(--elche-green)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--elche-gray)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--elche-text)', marginBottom: 6 }}>
                        {cantina.cantina_name}
                      </div>
                      {cantina.cantina_location && (
                        <div style={{ fontSize: 13, color: 'var(--elche-text-light)' }}>
                          📍 {cantina.cantina_location}
                        </div>
                      )}
                      {!cantina.has_credentials && (
                        <div style={{ fontSize: 12, color: '#c00', marginTop: 6 }}>
                          ⚠️ Sin credenciales configuradas
                        </div>
                      )}
                      {cantina.has_credentials && !cantina.access_enabled && (
                        <div style={{ fontSize: 12, color: '#c00', marginTop: 6 }}>
                          ⚠️ Acceso deshabilitado
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Paso 3: Ingresar PIN */}
          {step === 'pin' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--elche-text)' }}>
                  Código de acceso
                </h2>
                <button
                  onClick={handleBack}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: 'var(--elche-gray)',
                    color: 'var(--elche-text)',
                    fontWeight: 600,
                    fontSize: 14
                  }}>
                  ← Volver
                </button>
              </div>
              <div style={{ 
                padding: 12, 
                background: 'var(--elche-gray)', 
                borderRadius: 12, 
                marginBottom: 24,
                fontSize: 14,
                color: 'var(--elche-text-light)'
              }}>
                <div>Evento: <strong>{selectedEvent?.name}</strong></div>
                <div>Cantina: <strong>{selectedCantina?.cantina_name}</strong></div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: 14, 
                  fontWeight: 600, 
                  marginBottom: 8,
                  color: 'var(--elche-text)'
                }}>
                  Introduce el código PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pin) {
                      handleLogin();
                    }
                  }}
                  placeholder="****"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: 24,
                    textAlign: 'center',
                    letterSpacing: 8,
                    borderRadius: 12,
                    border: '2px solid var(--elche-gray)',
                    fontWeight: 700
                  }}
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={!pin || loading}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 12,
                  background: loading ? 'var(--elche-gray)' : 'linear-gradient(135deg, var(--elche-green) 0%, var(--elche-green-light) 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 16,
                  boxShadow: '0 4px 16px rgba(0, 150, 79, 0.3)'
                }}>
                {loading ? '⏳ Validando...' : '🔓 Iniciar sesión'}
              </button>
            </>
          )}
        </div>

        {/* Info */}
        <div style={{
          marginTop: 24,
          padding: 16,
          background: 'white',
          borderRadius: 12,
          fontSize: 13,
          color: 'var(--elche-text-light)',
          textAlign: 'center'
        }}>
          💡 Si no tienes acceso, contacta con el administrador del evento
        </div>
      </main>
    </div>
  );
}
