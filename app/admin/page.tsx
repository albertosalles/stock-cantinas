"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

/**
 * Página principal del panel de administración.
 *
 * Muestra un listado de eventos disponibles y permite crear un nuevo evento.
 * Cada tarjeta de evento enlaza a la página de detalle donde se configuran
 * cantinas, catálogo e inventario por cantina. El diseño sigue la guía
 * definida en `DESIGN.md` utilizando la paleta de colores del Elche CF.
 */
export default function AdminHome() {
  interface EventRow {
    id: string;
    name: string;
    date?: string | null;
    status?: string | null;
  }

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');

  /**
   * Carga todos los eventos desde la base de datos.
   */
  async function fetchEvents() {
    setLoading(true);
    const { data, error } = await supabase.from('events').select('id, name, date, status').order('date', { ascending: false });
    if (!error) setEvents(data ?? []);
    setLoading(false);
  }

  /**
   * Crea un nuevo evento en la base de datos. Se requiere al menos un nombre.
   */
  async function createEvent() {
    if (!newName.trim()) {
      alert('Debe introducir un nombre para el evento');
      return;
    }
    const { data, error } = await supabase.from('events').insert({ name: newName.trim(), date: newDate || null }).select().single();
    if (error) {
      alert(error.message);
      return;
    }
    // Añade el evento recién creado a la lista y limpia el formulario
    setEvents([data as EventRow, ...events]);
    setNewName('');
    setNewDate('');
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--elche-bg)' }}>
      {/* Barra superior */}
      <header style={{
        background: 'linear-gradient(135deg, var(--elche-green) 0%, var(--elche-green-dark) 100%)',
        color: 'white',
        padding: '16px 32px',
        boxShadow: '0 2px 8px rgba(0, 150, 79, 0.2)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>Panel de Administración</div>
            <div style={{ opacity: 0.9, fontSize: '14px' }}>Configuración de eventos y catálogo</div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px', display: 'grid', gap: 32 }}>
        {/* Formulario para crear un nuevo evento */}
        <section style={{ background: 'white', padding: 24, borderRadius: 16, boxShadow: '0 4px 16px rgba(0, 150, 79, 0.08)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
            ➕ Crear nuevo evento
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Nombre del evento"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8 }}
            />
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8 }}
            />
            <button onClick={createEvent} style={{ padding: '12px 20px', borderRadius: 10, background: 'var(--elche-green)', color: 'white', fontWeight: 600 }}>
              Crear
            </button>
          </div>
        </section>

        {/* Listado de eventos */}
        <section>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
            📅 Eventos
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--elche-text-light)' }}>Cargando eventos…</div>
          ) : events.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--elche-text-light)' }}>No hay eventos registrados</div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {events.map(evt => (
                <div key={evt.id} style={{
                  background: 'white',
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: '0 4px 16px rgba(0, 150, 79, 0.05)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 16,
                  alignItems: 'center'
                }}>
                  <Link href={`/admin/${evt.id}`} style={{ textDecoration: 'none' }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--elche-text)' }}>{evt.name}</div>
                      <div style={{ color: 'var(--elche-text-light)', fontSize: 14 }}>{evt.date ? new Date(evt.date).toLocaleDateString() : 'Sin fecha'}</div>
                    </div>
                  </Link>
                  
                  {/* Selector de estado */}
                  <select
                    value={evt.status || 'draft'}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      const confirmed = confirm(`¿Cambiar el estado del evento "${evt.name}" a "${newStatus.toUpperCase()}"?`);
                      if (!confirmed) return;
                      
                      const { error } = await supabase
                        .from('events')
                        .update({ status: newStatus })
                        .eq('id', evt.id);
                      
                      if (error) {
                        alert('Error al cambiar el estado: ' + error.message);
                        return;
                      }
                      
                      // Actualizar la lista
                      setEvents(events.map(e => e.id === evt.id ? { ...e, status: newStatus } : e));
                      alert(`✅ Estado cambiado a "${newStatus.toUpperCase()}"`);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '2px solid',
                      borderColor: evt.status === 'live' ? 'var(--elche-green)' : evt.status === 'closed' ? '#666' : '#ddd',
                      background: evt.status === 'live' ? 'var(--elche-green-light)' : evt.status === 'closed' ? '#f0f0f0' : 'white',
                      color: evt.status === 'live' ? 'white' : 'var(--elche-text)',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      minWidth: 120
                    }}
                  >
                    <option value="draft">📝 BORRADOR</option>
                    <option value="live">🟢 EN VIVO</option>
                    <option value="closed">🔒 CERRADO</option>
                  </select>
                  
                  <Link href={`/admin/${evt.id}`}>
                    <button style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: 'var(--elche-green)',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      border: 'none'
                    }}>
                      Configurar →
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}