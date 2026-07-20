'use client';

import React, { useState } from 'react';
import { SeasonRow } from '../hooks/useAdminSeasons';

interface SeasonsSectionProps {
  seasons: SeasonRow[];
  loading: boolean;
  onCreate: (name: string, startsOn?: string, endsOn?: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  onClose: (id: string) => Promise<void>;
}

export default function SeasonsSection({ seasons, loading, onCreate, onActivate, onClose }: SeasonsSectionProps) {
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
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="flex items-center justify-between mb-5 border-b border-elche-gray/50 pb-4">
        <div className="font-bold text-xl text-elche-text flex items-center gap-2">
          <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">🗓️</span>
          Temporadas
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-4 py-2 rounded-xl bg-elche-primary/10 text-elche-primary font-bold text-sm hover:bg-elche-primary/20 transition-colors"
        >
          {showForm ? 'Cancelar' : '➕ Nueva temporada'}
        </button>
      </div>

      {showForm && (
        <div className="mb-5 p-4 bg-elche-gray/20 rounded-2xl border border-elche-gray/50 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Nombre (ej: Temporada 2026-27)"
            className="p-3 rounded-xl border border-elche-gray bg-white font-bold focus:ring-2 focus:ring-elche-primary focus:outline-none"
          />
          <input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)}
            className="p-3 rounded-xl border border-elche-gray bg-white text-sm focus:ring-2 focus:ring-elche-primary focus:outline-none" />
          <input type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)}
            className="p-3 rounded-xl border border-elche-gray bg-white text-sm focus:ring-2 focus:ring-elche-primary focus:outline-none" />
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="px-6 py-3 rounded-xl bg-elche-primary text-white font-bold disabled:opacity-50 hover:bg-elche-secondary transition-colors"
          >
            {saving ? '⏳' : 'Crear'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-elche-text-light">Cargando temporadas...</div>
      ) : (
        <div className="grid gap-3">
          {seasons.map(s => (
            <div key={s.id} className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border gap-3 ${s.active ? 'bg-elche-success/5 border-elche-success/30' : 'bg-white border-elche-gray/50'}`}>
              <div>
                <div className="font-bold text-elche-text flex items-center gap-2">
                  {s.name}
                  {s.active && (
                    <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-green-200">
                      Activa
                    </span>
                  )}
                  {s.status === 'closed' && (
                    <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-gray-200">
                      Cerrada
                    </span>
                  )}
                </div>
                <div className="text-xs text-elche-text-light font-medium mt-0.5">
                  {s.starts_on ? new Date(s.starts_on).toLocaleDateString('es-ES') : '—'} → {s.ends_on ? new Date(s.ends_on).toLocaleDateString('es-ES') : '—'}
                </div>
              </div>
              <div className="flex gap-2">
                {!s.active && s.status === 'open' && (
                  <button
                    onClick={() => confirm(`¿Activar "${s.name}"? La temporada activa actual dejará de estarlo.`) && onActivate(s.id)}
                    className="px-4 py-2 rounded-xl bg-elche-primary text-white font-bold text-xs hover:bg-elche-secondary transition-colors"
                  >
                    Activar
                  </button>
                )}
                {s.status === 'closed' && (
                  <button
                    onClick={() => confirm(`¿Reabrir y activar "${s.name}"?`) && onActivate(s.id)}
                    className="px-4 py-2 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-xs hover:bg-elche-gray/30 transition-colors"
                  >
                    Reabrir
                  </button>
                )}
                {s.status === 'open' && (
                  <button
                    onClick={() => confirm(`¿Cerrar la temporada "${s.name}"?`) && onClose(s.id)}
                    className="px-4 py-2 rounded-xl bg-white border border-elche-gray text-elche-text-light font-bold text-xs hover:text-elche-danger hover:border-elche-danger/40 transition-colors"
                  >
                    🔒 Cerrar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
