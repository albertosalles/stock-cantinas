import React from 'react';
import Link from 'next/link';
import { EventRow } from '../hooks/useAdminEvents';

interface EventsListProps {
  events: EventRow[];
  loading: boolean;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}

export default function EventsList({ events, loading, onUpdateStatus }: EventsListProps) {
  if (loading) {
    return (
      <div className="py-12 text-center text-elche-text-light flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-elche-primary border-t-transparent rounded-full animate-spin"/>
        Cargando eventos...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-elche-text-light italic bg-white/50 rounded-3xl border border-dashed border-elche-border">
        No hay eventos registrados
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {events.map(evt => (
        <div key={evt.id} className="bg-white rounded-3xl p-5 shadow-sm border border-elche-gray/50 hover:border-elche-primary/30 transition-all hover:shadow-[0_8px_30px_rgba(0,150,79,0.08)] group flex flex-col md:flex-row md:items-center gap-4">
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <Link href={`/admin/${evt.id}`} className="text-lg md:text-xl font-bold text-elche-text hover:text-elche-primary transition-colors">
                {evt.name}
              </Link>
              {evt.status === 'live' && (
                <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-green-200 animate-pulse">
                  En Vivo
                </span>
              )}
            </div>
            <div className="text-elche-text-light text-sm font-medium flex items-center gap-2">
              <span>🗓️ {evt.date ? new Date(evt.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Selector de estado */}
            <div className="relative w-full md:w-auto">
              <select
                value={evt.status || 'draft'}
                onChange={async (e) => {
                  if (confirm(`¿Cambiar estado a ${e.target.value.toUpperCase()}?`)) {
                    await onUpdateStatus(evt.id, e.target.value);
                  }
                }}
                className={`w-full md:w-auto appearance-none pl-4 pr-8 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide border-2 cursor-pointer focus:outline-none transition-colors ${
                  evt.status === 'live' 
                    ? 'border-elche-success bg-elche-success/10 text-elche-success' 
                    : evt.status === 'closed' 
                      ? 'border-gray-200 bg-gray-50 text-gray-500' 
                      : 'border-elche-warning bg-elche-warning/10 text-elche-warning-dark'
                }`}
              >
                <option value="draft">📝 Borrador</option>
                <option value="live">🟢 En Vivo</option>
                <option value="closed">🔒 Cerrado</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">▼</div>
            </div>
            
            <Link href={`/admin/${evt.id}`} className="w-full md:w-auto">
              <button className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-elche-text text-white font-semibold text-sm hover:bg-elche-primary transition-colors shadow-sm active:scale-95">
                Configurar →
              </button>
            </Link>
          </div>

        </div>
      ))}
    </div>
  );
}


