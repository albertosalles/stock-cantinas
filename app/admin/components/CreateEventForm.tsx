'use client';

import React, { useState } from 'react';
import { SeasonRow } from '../hooks/useAdminSeasons';

interface CreateEventFormProps {
  onCreate: (name: string, date: string, seasonId?: string | null) => Promise<unknown>;
  onCancel: () => void;
  seasons?: SeasonRow[];
  /** Temporada preseleccionada (normalmente la activa). */
  defaultSeasonId?: string | null;
}

export default function CreateEventForm({ onCreate, onCancel, seasons = [], defaultSeasonId }: CreateEventFormProps) {
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [seasonId, setSeasonId] = useState(defaultSeasonId ?? '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newName.trim() || loading) return;
    setLoading(true);
    try {
      await onCreate(newName, newDate, seasonId || null);
      setNewName('');
      setNewDate('');
      onCancel();
    } catch (e: any) {
      alert(e.message || 'Error al crear el evento');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-[10px] border border-[#e0efe7] bg-[#f9fcfb] px-3 py-2.5 text-[13.5px] text-elche-text outline-none focus:border-elche-primary focus:bg-white';
  const labelClass =
    'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]';

  return (
    <div className="mb-4 flex animate-fade-in flex-wrap items-end gap-3 rounded-2xl border border-elche-gray bg-white p-4">
      <div className="min-w-[200px] flex-1">
        <label className={labelClass}>Nombre del evento</label>
        <input
          type="text"
          placeholder="Ej: Elche CF · Real Betis"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="min-w-[150px]">
        <label className={labelClass}>Fecha</label>
        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={inputClass} />
      </div>

      {seasons.length > 0 && (
        <div className="min-w-[170px]">
          <label className={labelClass}>Temporada</label>
          <select
            value={seasonId}
            onChange={e => setSeasonId(e.target.value)}
            className={`${inputClass} cursor-pointer font-semibold`}
          >
            <option value="">— Sin temporada —</option>
            {seasons.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!newName.trim() || loading}
        className="rounded-[10px] bg-elche-primary px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-elche-secondary disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear evento'}
      </button>
      <button
        onClick={onCancel}
        className="rounded-[10px] border border-elche-gray bg-elche-bg px-4 py-2.5 text-[13px] font-semibold text-elche-text-light transition-colors hover:bg-elche-gray"
      >
        Cancelar
      </button>
    </div>
  );
}
