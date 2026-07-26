'use client';

import React, { useState } from 'react';
import { useIncidents } from '../hooks/useIncidents';
import { incidentMeta } from '@/lib/incidents';
import { incidentTone } from '@/lib/adminUi';

export default function CantinaIncidentsPanel({ eventId, cantinaId }: { eventId: string; cantinaId: string }) {
  const { incidents, loading, resolve } = useIncidents(eventId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mine = incidents.filter(i => i.cantinaId === cantinaId);

  const handleResolve = async (id: string) => {
    setBusyId(id);
    try { await resolve(id); } finally { setBusyId(null); }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-elche-gray bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#f0f6f2] px-5 py-4">
        <span className="ms text-[19px] text-[#d63838]">report</span>
        <h3 className="m-0 flex-1 text-[14.5px] font-extrabold tracking-tight text-elche-text">
          Incidencias pendientes
        </h3>
        {mine.length > 0 && (
          <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-extrabold text-[#d63838]">
            {mine.length}
          </span>
        )}
      </div>

      {loading && mine.length === 0 ? (
        <div className="py-8 text-center text-elche-text-light">Cargando…</div>
      ) : mine.length === 0 ? (
        <div className="px-5 py-7 text-center">
          <span className="ms text-4xl text-[#bfe3cf]">verified</span>
          <div className="mt-1.5 text-[12.5px] font-bold text-elche-text-light">Sin incidencias</div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#8aa397]">Todo en orden en esta cantina</div>
        </div>
      ) : (
        <div className="flex flex-col">
          {mine.map(inc => {
            const meta = incidentMeta(inc.type);
            const tone = incidentTone(inc.type);
            const time = new Date(inc.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={inc.id} className="flex items-start gap-3 border-t border-[#f6faf8] px-5 py-3">
                <div
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  <span className="ms text-[19px]">{tone.icon}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold text-elche-text">{meta.label}</div>

                  {inc.productNames.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {inc.productNames.map((n, i) => (
                        <span
                          key={i}
                          className="rounded border border-[#f3d78f] bg-[#fff7e6] px-1.5 py-0.5 text-[10.5px] font-bold text-[#b0790a]"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}

                  {inc.description && (
                    <div className="mt-1 text-[11px] font-semibold italic text-[#8aa397]">“{inc.description}”</div>
                  )}

                  <div className="mt-1 text-[10px] font-bold text-[#b3c1b9]">
                    {time} · {inc.waiterName}
                  </div>
                </div>

                <button
                  onClick={() => handleResolve(inc.id)}
                  disabled={busyId === inc.id}
                  title="Resolver"
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-[#e0efe7] bg-white text-[#8aa397] transition-colors hover:border-[#bfe3cf] hover:bg-elche-primary/10 hover:text-elche-primary disabled:opacity-50"
                >
                  <span className="ms text-[17px]">check</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
