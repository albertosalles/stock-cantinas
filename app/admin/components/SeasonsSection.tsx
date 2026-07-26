'use client';

import React, { useState } from 'react';
import { SeasonRow } from '../hooks/useAdminSeasons';

interface SeasonsSectionProps {
  seasons: SeasonRow[];
  loading: boolean;
  onCreate: (name: string, startsOn?: string, endsOn?: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  onClose: (id: string) => Promise<void>;
  /** Nº de eventos por temporada (id → total). */
  eventCounts?: Record<string, number>;
}

export default function SeasonsSection({
  seasons,
  loading,
  onCreate,
  onActivate,
  onClose,
  eventCounts = {},
}: SeasonsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate(name, startsOn, endsOn);
      setName(''); setStartsOn(''); setEndsOn(''); setShowForm(false);
    } catch (e: any) {
      alert(e.message || 'Error al crear la temporada');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <span className="ms rounded-xl bg-elche-primary/[0.09] p-2.5 text-[22px] text-elche-primary">
            calendar_month
          </span>
          <div>
            <h2 className="m-0 text-[17px] font-extrabold tracking-tight">Temporadas</h2>
            <div className="text-xs font-medium text-elche-text-light">Organiza los eventos por campaña</div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 rounded-[11px] border border-elche-gray bg-white px-4 py-2.5 text-[13px] font-semibold text-elche-text transition-colors hover:border-elche-primary hover:text-elche-primary"
        >
          <span className="ms text-lg">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancelar' : 'Nueva temporada'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 grid animate-fade-in gap-3 rounded-2xl border border-elche-gray bg-white p-4 md:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">
              Nombre
            </label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Temporada 2026/27"
              className="w-full rounded-[10px] border border-[#e0efe7] bg-[#f9fcfb] px-3 py-2.5 text-[13.5px] text-elche-text outline-none focus:border-elche-primary focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">
              Inicio
            </label>
            <input
              type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)}
              className="w-full rounded-[10px] border border-[#e0efe7] bg-[#f9fcfb] px-3 py-2.5 text-[13.5px] text-elche-text outline-none focus:border-elche-primary focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">
              Fin
            </label>
            <input
              type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)}
              className="w-full rounded-[10px] border border-[#e0efe7] bg-[#f9fcfb] px-3 py-2.5 text-[13.5px] text-elche-text outline-none focus:border-elche-primary focus:bg-white"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="self-end rounded-[10px] bg-elche-primary px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-elche-secondary disabled:opacity-50"
          >
            {saving ? '⏳' : 'Crear'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-elche-text-light">Cargando temporadas...</div>
      ) : seasons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-elche-border bg-white/50 py-10 text-center italic text-elche-text-light">
          Aún no hay temporadas creadas
        </div>
      ) : (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {seasons.map(s => {
            const closed = s.status === 'closed';
            const count = eventCounts[s.id] ?? 0;
            return (
              <div
                key={s.id}
                className={`rounded-2xl border bg-white p-4 ${
                  s.active ? 'border-[#bfe3cf] shadow-[0_4px_14px_rgba(0,150,79,.09)]' : 'border-elche-gray'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-extrabold tracking-tight text-elche-text">{s.name}</div>
                    <div className="mt-0.5 text-xs font-medium text-elche-text-light">
                      {count} {count === 1 ? 'evento' : 'eventos'}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-[#8aa397]">
                      {s.starts_on ? new Date(s.starts_on).toLocaleDateString('es-ES') : '—'} →{' '}
                      {s.ends_on ? new Date(s.ends_on).toLocaleDateString('es-ES') : '—'}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                      s.active
                        ? 'bg-elche-primary/10 text-elche-primary'
                        : closed
                          ? 'bg-[#f0f2f1] text-[#8aa397]'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {s.active ? 'Activa' : closed ? 'Cerrada' : 'Abierta'}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  {s.active ? (
                    <button
                      onClick={() => confirm(`¿Cerrar la temporada "${s.name}"?`) && onClose(s.id)}
                      className="flex-1 rounded-[10px] border border-elche-gray bg-elche-bg py-2.5 text-[12.5px] font-semibold text-elche-text-light transition-colors hover:border-elche-danger/40 hover:text-elche-danger"
                    >
                      Cerrar temporada
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        confirm(
                          closed
                            ? `¿Reabrir y activar "${s.name}"?`
                            : `¿Activar "${s.name}"? La temporada activa actual dejará de estarlo.`
                        ) && onActivate(s.id)
                      }
                      className="flex-1 rounded-[10px] bg-elche-primary py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-elche-secondary"
                    >
                      {closed ? 'Reactivar' : 'Activar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
