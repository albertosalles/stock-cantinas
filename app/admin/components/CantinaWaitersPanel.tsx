'use client';

import React from 'react';
import { useCantinaWaiters } from '../hooks/useCantinaWaiters';

export default function CantinaWaitersPanel({ eventId, cantinaId }: { eventId: string; cantinaId: string }) {
  const { waiters, loading, busyId, assign, unassign, refresh } = useCantinaWaiters(eventId, cantinaId);
  const here = waiters.filter(w => w.here);

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="flex items-center justify-between mb-4">
        <div className="font-bold text-xl text-elche-text flex items-center gap-2">
          <span className="bg-elche-primary/10 text-elche-primary p-2 rounded-xl">👥</span>
          Camareros en esta cantina
          {here.length > 0 && <span className="bg-elche-success/10 text-elche-success text-xs px-2 py-0.5 rounded-full">{here.length} en turno</span>}
        </div>
        <button onClick={() => refresh()} className="px-3 py-1.5 rounded-lg bg-white border border-elche-gray text-elche-text font-bold text-xs hover:bg-elche-gray/30 transition-colors">🔄</button>
      </div>

      {loading && waiters.length === 0 ? (
        <div className="py-6 text-center text-elche-text-light">Cargando…</div>
      ) : waiters.length === 0 ? (
        <div className="py-6 text-center text-elche-text-light italic">No hay camareros activos. Da de alta camareros desde el panel principal.</div>
      ) : (
        <div className="grid gap-2">
          {waiters.map(w => (
            <div key={w.id} className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${w.here ? 'bg-elche-success/5 border-elche-success/30' : 'bg-white border-elche-gray/50'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${w.here ? 'bg-elche-success animate-pulse' : 'bg-gray-300'}`} />
                <span className="font-bold text-elche-text truncate">{w.name}</span>
                {w.elsewhere && (
                  <span className="text-[11px] text-elche-text-light bg-elche-gray/30 px-2 py-0.5 rounded-full shrink-0">en {w.elsewhere}</span>
                )}
              </div>
              {w.here ? (
                <button onClick={() => unassign(w.id)} disabled={busyId === w.id}
                  className="px-4 py-1.5 rounded-lg bg-white border border-elche-gray text-elche-text-light font-bold text-xs hover:text-elche-danger hover:border-elche-danger/40 transition-colors disabled:opacity-50 shrink-0">
                  {busyId === w.id ? '⏳' : 'Quitar'}
                </button>
              ) : (
                <button onClick={() => assign(w.id)} disabled={busyId === w.id}
                  className="px-4 py-1.5 rounded-lg bg-elche-primary text-white font-bold text-xs hover:bg-elche-secondary transition-colors disabled:opacity-50 shrink-0">
                  {busyId === w.id ? '⏳' : (w.elsewhere ? 'Mover aquí' : 'Asignar')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
