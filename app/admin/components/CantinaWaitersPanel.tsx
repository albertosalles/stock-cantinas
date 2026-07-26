'use client';

import React, { useMemo } from 'react';
import { useCantinaWaiters } from '../hooks/useCantinaWaiters';
import { useWaiterPerformance } from '../hooks/useWaiterPerformance';
import { avatarBg } from '@/lib/adminUi';

export default function CantinaWaitersPanel({ eventId, cantinaId }: { eventId: string; cantinaId: string }) {
  const { waiters, loading, busyId, assign, unassign, refresh } = useCantinaWaiters(eventId, cantinaId);
  const { waiters: perf } = useWaiterPerformance(eventId, cantinaId);

  const perfById = useMemo(() => new Map(perf.map(p => [p.waiter_id, p])), [perf]);

  // Primero los que están en turno aquí; después el resto, para poder añadirlos
  const here = waiters.filter(w => w.here);
  const others = waiters.filter(w => !w.here);

  return (
    <div className="overflow-hidden rounded-2xl border border-elche-gray bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#f0f6f2] px-5 py-4">
        <span className="ms text-[19px] text-elche-primary">groups</span>
        <h3 className="m-0 flex-1 text-[14.5px] font-extrabold tracking-tight text-elche-text">
          Camareros asignados
        </h3>
        <span className="text-[11.5px] font-bold text-[#8aa397]">
          {here.length} {here.length === 1 ? 'camarero' : 'camareros'}
        </span>
        <button
          onClick={() => refresh()}
          title="Refrescar"
          className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-elche-gray bg-elche-bg text-elche-text-light transition-colors hover:text-elche-primary"
        >
          <span className={`ms text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>

      {loading && waiters.length === 0 ? (
        <div className="py-8 text-center text-elche-text-light">Cargando…</div>
      ) : waiters.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12.5px] italic text-elche-text-light">
          No hay camareros activos. Da de alta camareros desde el panel principal.
        </div>
      ) : (
        <div className="flex flex-col">
          {here.length === 0 && (
            <div className="border-t border-[#f6faf8] px-5 py-6 text-center text-[12.5px] italic text-elche-text-light">
              Nadie en turno en esta cantina
            </div>
          )}

          {here.map((w, i) => {
            const p = perfById.get(w.id);
            return (
              <div key={w.id} className="flex items-center gap-3 border-t border-[#f6faf8] px-5 py-3">
                <div
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-sm font-extrabold text-white"
                  style={{ background: avatarBg(i) }}
                >
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-elche-text">{w.name}</div>
                  <div className="text-[11px] font-semibold text-[#8aa397]">
                    {p
                      ? `${p.num_sales} tickets · ${(p.hours > 0 ? p.num_sales / p.hours : 0).toFixed(1)}/h · ${p.hours.toFixed(1)} h`
                      : 'Sin ventas todavía'}
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-elche-primary/10 px-2.5 py-1 text-[10.5px] font-bold text-elche-primary">
                  <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-current" />
                  En turno
                </span>
                <button
                  onClick={() => unassign(w.id)}
                  disabled={busyId === w.id}
                  title="Cerrar turno aquí"
                  className="shrink-0 rounded-[9px] border border-[#e0efe7] bg-white px-3 py-1.5 text-[11.5px] font-bold text-elche-text-light transition-colors hover:border-elche-danger/40 hover:text-elche-danger disabled:opacity-50"
                >
                  {busyId === w.id ? '⏳' : 'Quitar'}
                </button>
              </div>
            );
          })}

          {others.length > 0 && (
            <>
              <div className="border-t border-[#f0f6f2] bg-[#fbfdfc] px-5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">
                Disponibles
              </div>
              {others.map(w => (
                <div key={w.id} className="flex items-center gap-3 border-t border-[#f6faf8] px-5 py-2.5">
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#d3ddd7]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-elche-text-light">{w.name}</div>
                    {w.elsewhere && (
                      <div className="text-[10.5px] font-semibold text-[#b3c1b9]">en {w.elsewhere}</div>
                    )}
                  </div>
                  <button
                    onClick={() => assign(w.id)}
                    disabled={busyId === w.id}
                    className="shrink-0 rounded-[9px] bg-elche-primary px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:bg-elche-secondary disabled:opacity-50"
                  >
                    {busyId === w.id ? '⏳' : w.elsewhere ? 'Mover aquí' : 'Asignar'}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
