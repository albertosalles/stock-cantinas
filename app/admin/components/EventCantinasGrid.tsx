'use client';

import React from 'react';
import { useCantinasOverview, CantinaOverview } from '../hooks/useCantinasOverview';

interface EventCantinasGridProps {
  eventId: string;
  selectedId: string | null;
  onSelect: (cantinaId: string) => void;
}

export default function EventCantinasGrid({ eventId, selectedId, onSelect }: EventCantinasGridProps) {
  const { cantinas, loading, refresh } = useCantinasOverview(eventId);

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="font-bold text-xl text-elche-text flex items-center gap-2">
          <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">🏪</span>
          Cantinas del evento
        </div>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:bg-elche-gray/30 shadow-sm transition-colors">
          🔄
        </button>
      </div>

      {loading && cantinas.length === 0 ? (
        <div className="py-10 text-center text-elche-text-light">Cargando cantinas…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cantinas.map(c => (
            <CantinaCard key={c.cantina_id} c={c} selected={selectedId === c.cantina_id} onClick={() => onSelect(c.cantina_id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function CantinaCard({ c, selected, onClick }: { c: CantinaOverview; selected: boolean; onClick: () => void }) {
  const eur = (c.total_cents / 100).toFixed(2);
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-2xl border transition-all active:scale-[0.99] ${
        selected
          ? 'border-elche-primary bg-elche-primary/5 shadow-md'
          : 'border-elche-gray/60 bg-white hover:border-elche-primary/40 hover:shadow-sm'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="font-bold text-elche-text truncate">{c.cantina_name}</span>
        {/* Badges de estado */}
        <div className="flex gap-1 shrink-0">
          {c.pending_incidents > 0 && (
            <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse" title="Incidencias abiertas">
              ⚠️ {c.pending_incidents}
            </span>
          )}
          {c.low_stock_count > 0 && (
            <span className="bg-red-100 text-red-600 border border-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full" title="Productos bajo mínimo">
              📉 {c.low_stock_count}
            </span>
          )}
        </div>
      </div>

      <div className="text-2xl font-extrabold text-elche-primary leading-none mb-1">{eur} €</div>
      <div className="text-xs text-elche-text-light font-medium mb-3">{c.num_sales} tickets</div>

      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
          c.active_waiters > 0
            ? 'bg-elche-success/10 text-elche-success border-elche-success/20'
            : 'bg-elche-gray/30 text-elche-text-light border-elche-gray/50'}`}>
          👥 {c.active_waiters} en turno
        </span>
      </div>
    </button>
  );
}
