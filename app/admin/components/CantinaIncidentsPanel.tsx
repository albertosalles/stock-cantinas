'use client';

import React, { useState } from 'react';
import { useIncidents } from '../hooks/useIncidents';
import { incidentMeta } from '@/lib/incidents';

export default function CantinaIncidentsPanel({ eventId, cantinaId }: { eventId: string; cantinaId: string }) {
  const { incidents, loading, resolve } = useIncidents(eventId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mine = incidents.filter(i => i.cantinaId === cantinaId);

  const handleResolve = async (id: string) => {
    setBusyId(id);
    try { await resolve(id); } finally { setBusyId(null); }
  };

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="font-bold text-xl mb-4 text-elche-text flex items-center gap-2">
        <span className="bg-amber-100 text-amber-600 p-2 rounded-xl">⚠️</span>
        Incidencias pendientes
        {mine.length > 0 && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{mine.length}</span>}
      </div>

      {loading && mine.length === 0 ? (
        <div className="py-6 text-center text-elche-text-light">Cargando…</div>
      ) : mine.length === 0 ? (
        <div className="py-6 text-center text-elche-text-light italic flex items-center justify-center gap-2">
          <span className="text-2xl opacity-50">✅</span> Sin incidencias pendientes
        </div>
      ) : (
        <div className="grid gap-2">
          {mine.map(inc => {
            const meta = incidentMeta(inc.type);
            const time = new Date(inc.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={inc.id} className="flex items-start gap-3 p-3 rounded-2xl border border-elche-gray/50 bg-elche-gray/10">
                <span className="text-xl">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-elche-text text-sm">{meta.label}</span>
                    <span className="text-[10px] text-elche-text-light font-medium">{time} · {inc.waiterName}</span>
                  </div>
                  {inc.productNames.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {inc.productNames.map((n, i) => (
                        <span key={i} className="bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5 rounded border border-amber-200">{n}</span>
                      ))}
                    </div>
                  )}
                  {inc.description && <div className="mt-1 text-xs text-elche-text-light italic">"{inc.description}"</div>}
                </div>
                <button onClick={() => handleResolve(inc.id)} disabled={busyId === inc.id}
                  className="px-3 py-1.5 rounded-lg bg-elche-primary/10 text-elche-primary font-bold text-xs hover:bg-elche-primary hover:text-white transition-colors disabled:opacity-50 shrink-0">
                  {busyId === inc.id ? '⏳' : '✓ Resolver'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
