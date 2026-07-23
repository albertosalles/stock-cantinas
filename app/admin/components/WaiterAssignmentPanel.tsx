'use client';

import React, { useMemo } from 'react';
import { useEventWaiterAssignments } from '../hooks/useEventWaiterAssignments';

interface Props {
  eventId: string;
}

/**
 * Asignación centralizada: el admin puede mover cualquier camarero a cualquier
 * cantina del evento (o dejarlo sin asignar) desde un único sitio.
 */
export default function WaiterAssignmentPanel({ eventId }: Props) {
  const { waiters, cantinas, loading, busyId, assignTo, refresh } = useEventWaiterAssignments(eventId);

  const asignados = waiters.filter(w => w.cantinaId).length;

  // Reparto actual por cantina (para ver de un vistazo dónde falta gente)
  const porCantina = useMemo(() => {
    const m = new Map<string, number>();
    waiters.forEach(w => { if (w.cantinaId) m.set(w.cantinaId, (m.get(w.cantinaId) ?? 0) + 1); });
    return cantinas
      .map(c => ({ ...c, count: m.get(c.id) ?? 0 }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [waiters, cantinas]);

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50 mb-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="font-bold text-xl text-elche-text flex items-center gap-2">
          <span className="bg-elche-primary/10 text-elche-primary p-2 rounded-xl">🔀</span>
          Asignación de camareros
          <span className="text-xs font-bold bg-elche-gray/30 text-elche-text-light px-2 py-0.5 rounded-full">
            {asignados}/{waiters.length} asignados
          </span>
        </div>
        <button onClick={() => refresh()} className="px-4 py-2 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:bg-elche-gray/30 shadow-sm transition-colors">
          🔄
        </button>
      </div>

      {/* Reparto actual */}
      {porCantina.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-elche-gray/40">
          {porCantina.map(c => (
            <span key={c.id} className="text-xs font-semibold bg-elche-success/10 text-elche-success border border-elche-success/20 px-2.5 py-1 rounded-full">
              {c.name}: {c.count}
            </span>
          ))}
        </div>
      )}

      {loading && waiters.length === 0 ? (
        <div className="py-8 text-center text-elche-text-light">Cargando…</div>
      ) : waiters.length === 0 ? (
        <div className="py-8 text-center text-elche-text-light italic">
          No hay camareros activos. Da de alta camareros desde el panel principal.
        </div>
      ) : cantinas.length === 0 ? (
        <div className="py-8 text-center text-elche-text-light italic">
          Este evento no tiene cantinas asignadas todavía.
        </div>
      ) : (
        <div className="grid gap-2">
          {waiters.map(w => (
            <div key={w.id} className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-colors ${
              w.cantinaId ? 'bg-elche-success/5 border-elche-success/30' : 'bg-white border-elche-gray/50'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${w.cantinaId ? 'bg-elche-success animate-pulse' : 'bg-gray-300'}`} />
                <span className="font-bold text-elche-text truncate">{w.name}</span>
                {!w.cantinaId && (
                  <span className="text-[11px] text-elche-text-light bg-elche-gray/30 px-2 py-0.5 rounded-full shrink-0">Sin asignar</span>
                )}
              </div>

              <select
                value={w.cantinaId ?? ''}
                disabled={busyId === w.id}
                onChange={e => assignTo(w.id, e.target.value || null)}
                className="p-2.5 rounded-xl border border-elche-gray bg-white font-bold text-sm text-elche-text focus:ring-2 focus:ring-elche-primary focus:outline-none disabled:opacity-50 min-w-[200px] shrink-0"
              >
                <option value="">— Sin asignar —</option>
                {cantinas.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-elche-text-light mt-3">
        Mover a un camarero cierra su turno anterior (imputando las horas) y abre uno nuevo en la cantina elegida.
      </p>
    </section>
  );
}
