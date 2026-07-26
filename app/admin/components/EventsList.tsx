'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { EventRow } from '../hooks/useAdminEvents';
import { statusMeta } from './AdminShell';

interface EventsListProps {
  events: EventRow[];
  loading: boolean;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}

const eurShort = (cents: number) =>
  cents === 0 ? '—' : Math.round(cents / 100).toLocaleString('es-ES') + ' €';

const dateLabel = (date?: string | null) =>
  date
    ? new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : 'Sin fecha';

export default function EventsList({ events, loading, onUpdateStatus }: EventsListProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-elche-text-light">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-elche-primary border-t-transparent" />
        Cargando eventos...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-elche-border bg-white/50 py-12 text-center italic text-elche-text-light">
        No hay eventos registrados
      </div>
    );
  }

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
      {events.map(evt => {
        const meta = statusMeta(evt.status);
        return (
          <div
            key={evt.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/admin/${evt.id}`)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push(`/admin/${evt.id}`);
              }
            }}
            className="animate-fade-in cursor-pointer overflow-hidden rounded-2xl border border-elche-gray bg-white transition-all hover:-translate-y-[3px] hover:border-[#cfe8db] hover:shadow-[0_10px_26px_rgba(16,40,26,.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-elche-primary"
          >
            <div className="h-1" style={{ background: meta.strip }} />
            <div className="px-[17px] pb-[17px] pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                  style={{ color: meta.fg, background: meta.bg }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {meta.label}
                </span>
                <span className="flex items-center gap-1 text-[11.5px] font-semibold text-elche-text-light">
                  <span className="ms text-[15px]">event</span>
                  {dateLabel(evt.date)}
                </span>
              </div>

              <div className="text-[16.5px] font-extrabold leading-tight tracking-tight text-elche-text">
                {evt.name}
              </div>

              <div className="mt-[15px] grid grid-cols-3 gap-2 border-t border-[#f0f6f2] pt-3.5">
                <div>
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">Recaudación</div>
                  <div className="mt-0.5 text-sm font-extrabold text-elche-primary">{eurShort(evt.total_cents)}</div>
                </div>
                <div>
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">Tickets</div>
                  <div className="mt-0.5 text-sm font-extrabold text-elche-text">
                    {evt.num_sales > 0 ? evt.num_sales.toLocaleString('es-ES') : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">Cantinas</div>
                  <div className="mt-0.5 text-sm font-extrabold text-elche-text">{evt.num_cantinas}</div>
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-[#f0f6f2] pt-3">
                {/* El selector de estado no debe abrir el evento */}
                <select
                  value={evt.status || 'draft'}
                  onClick={e => e.stopPropagation()}
                  onChange={async e => {
                    e.stopPropagation();
                    const next = e.target.value;
                    if (confirm(`¿Cambiar estado a ${next.toUpperCase()}?`)) {
                      await onUpdateStatus(evt.id, next);
                    }
                  }}
                  className="cursor-pointer rounded-[9px] border border-[#e0efe7] bg-[#f9fcfb] px-2.5 py-1.5 text-[11.5px] font-semibold text-elche-text outline-none focus:border-elche-primary"
                >
                  <option value="draft">Borrador</option>
                  <option value="live">En vivo</option>
                  <option value="closed">Cerrado</option>
                </select>

                <span className="flex items-center gap-1 text-[12.5px] font-bold text-elche-primary">
                  Entrar
                  <span className="ms text-[17px]">arrow_forward</span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
