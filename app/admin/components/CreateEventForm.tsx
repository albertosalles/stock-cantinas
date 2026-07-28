'use client';

import React, { useState } from 'react';
import { SeasonRow } from '../hooks/useAdminSeasons';
import MatchMetaFields from './MatchMetaFields';

/** Datos del partido que no se pueden reconstruir después de jugarlo. */
export interface DatosPartido {
  kickoffAt?: string | null;
  opponentId?: string | null;
  matchType?: string | null;
}

interface CreateEventFormProps {
  onCreate: (name: string, date: string, seasonId?: string | null, datos?: DatosPartido) => Promise<unknown>;
  onCancel: () => void;
  seasons?: SeasonRow[];
  /** Temporada preseleccionada (normalmente la activa). */
  defaultSeasonId?: string | null;
}

/**
 * Alta de evento.
 *
 * Pide los mismos datos que la pantalla de configuración y en el mismo orden, a
 * propósito: son los campos que no se pueden reconstruir a posteriori (hora de
 * inicio, rival, competición) y pedirlos sólo al editar hacía que un evento
 * recién creado naciera incompleto, obligando a entrar después a completarlo.
 */
export default function CreateEventForm({ onCreate, onCancel, seasons = [], defaultSeasonId }: CreateEventFormProps) {
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [hora, setHora] = useState('');
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState(defaultSeasonId ?? '');
  const [loading, setLoading] = useState(false);

  // La hora se combina con la fecha para formar el instante del pitido inicial.
  const kickoffAt = (() => {
    if (!hora || !newDate) return null;
    const [h, m] = hora.split(':').map(Number);
    const d = new Date(`${newDate}T00:00:00`);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  })();

  const puertas = kickoffAt
    ? new Date(new Date(kickoffAt).getTime() - 90 * 60000)
        .toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  const handleSubmit = async () => {
    if (!newName.trim() || loading) return;
    setLoading(true);
    try {
      await onCreate(newName, newDate, seasonId || null, { kickoffAt, opponentId, matchType });
      setNewName('');
      setNewDate('');
      setHora('');
      setOpponentId(null);
      setMatchType(null);
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
    <div className="mb-4 animate-fade-in rounded-2xl border border-elche-gray bg-white p-5">
      <div className="grid max-w-2xl gap-4">
        <div>
          <label className={labelClass}>Nombre del evento</label>
          <input
            type="text"
            placeholder="Ej: Elche CF · Real Betis"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Fecha</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Hora de inicio</label>
            <input
              type="time"
              value={hora}
              disabled={!newDate}
              onChange={e => setHora(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1.5 text-[11px] font-semibold text-[#8aa397]">
              {puertas
                ? `Puertas a las ${puertas}`
                : newDate
                  ? 'Se puede definir después'
                  : 'Define antes la fecha'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MatchMetaFields
            opponentId={opponentId}
            onOpponentChange={setOpponentId}
            matchType={matchType}
            onMatchTypeChange={setMatchType}
            inputClass={inputClass}
            labelClass={labelClass}
            mostrarAyuda={false}
          />
        </div>

        {seasons.length > 0 && (
          <div className="sm:max-w-[50%]">
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

        <div className="flex flex-wrap items-center gap-2.5">
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
      </div>
    </div>
  );
}
