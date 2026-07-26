import React, { useState, useEffect } from 'react';
import { useIncidents } from '../hooks/useIncidents';
import { incidentMeta } from '@/lib/incidents';

interface IncidentsBellProps {
  eventId: string;
}

export default function IncidentsBell({ eventId }: IncidentsBellProps) {
  const { incidents, loading, resolve } = useIncidents(eventId);
  const [isOpen, setIsOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const count = incidents.length;

  useEffect(() => {
    const close = () => setIsOpen(false);
    if (isOpen) window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [isOpen]);

  const handleResolve = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setBusyId(id);
    try { await resolve(id); } finally { setBusyId(null); }
  };

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-[11px] border border-elche-gray bg-elche-bg text-elche-text-light transition-colors hover:bg-amber-50 hover:text-amber-500"
        title="Incidencias reportadas"
      >
        <span className="ms text-xl">report</span>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] border-2 border-white bg-amber-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              ⚠️ Incidencias
              {count > 0 && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{count}</span>}
            </h3>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && count === 0 ? (
              <div className="p-4 text-center text-gray-400">Cargando...</div>
            ) : count === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                <span className="text-3xl opacity-50">✅</span>
                <span>Sin incidencias pendientes</span>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {incidents.map(inc => {
                  const meta = incidentMeta(inc.type);
                  const time = new Date(inc.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={inc.id} className="p-4 hover:bg-gray-50 transition-colors flex gap-3">
                      <div className="shrink-0 text-xl">{meta.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-gray-800 text-sm">{meta.label}</div>
                          <span className="text-[10px] text-gray-400 font-medium shrink-0">{time}</span>
                        </div>
                        <div className="text-xs text-gray-500 font-medium mt-0.5">
                          {inc.cantinaName} · {inc.waiterName}
                        </div>
                        {inc.productNames.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {inc.productNames.map((n, i) => (
                              <span key={i} className="bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5 rounded border border-amber-200">
                                {n}
                              </span>
                            ))}
                          </div>
                        )}
                        {inc.description && (
                          <div className="mt-1.5 text-xs text-gray-600 italic">"{inc.description}"</div>
                        )}
                        <button
                          onClick={(e) => handleResolve(e, inc.id)}
                          disabled={busyId === inc.id}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-elche-primary/10 text-elche-primary font-bold text-xs hover:bg-elche-primary hover:text-white transition-colors disabled:opacity-50"
                        >
                          {busyId === inc.id ? '⏳' : '✓ Resolver'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
