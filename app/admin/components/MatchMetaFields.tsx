'use client';

import React, { useState } from 'react';
import { useOpponents, TIPOS_PARTIDO } from '../hooks/useOpponents';

/**
 * Rival y competición del partido.
 *
 * Vive en un componente propio porque estos dos campos aparecen tanto al CREAR
 * el evento como al editarlo, y son justo los datos que no se pueden reconstruir
 * después: si las dos pantallas divergieran —una con alta de rival en línea y la
 * otra sin ella, por ejemplo— acabaría habiendo partidos capturados a medias
 * según por dónde se crearon.
 */

interface Props {
  opponentId: string | null;
  onOpponentChange: (id: string | null) => void;
  matchType: string | null;
  onMatchTypeChange: (t: string | null) => void;
  inputClass: string;
  labelClass: string;
  /** La ayuda bajo la competición sobra en el formulario compacto de creación. */
  mostrarAyuda?: boolean;
}

export default function MatchMetaFields({
  opponentId, onOpponentChange, matchType, onMatchTypeChange,
  inputClass, labelClass, mostrarAyuda = true,
}: Props) {
  const { opponents, crearRival } = useOpponents();
  const [nuevoRival, setNuevoRival] = useState('');
  const [anadiendo, setAnadiendo] = useState(false);

  const anadirRival = async () => {
    if (!nuevoRival.trim()) return;
    try {
      onOpponentChange(await crearRival(nuevoRival));
      setNuevoRival('');
      setAnadiendo(false);
    } catch (e: any) {
      alert(e.message || 'No se pudo añadir el rival');
    }
  };

  return (
    <>
      <div>
        <label className={labelClass}>Rival</label>
        {anadiendo ? (
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={nuevoRival}
              placeholder="Nombre del equipo"
              onChange={e => setNuevoRival(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); anadirRival(); }
                if (e.key === 'Escape') setAnadiendo(false);
              }}
              className={inputClass}
            />
            <button
              type="button"
              onClick={anadirRival}
              className="shrink-0 rounded-[10px] bg-elche-primary px-3 text-[12.5px] font-bold text-white"
            >
              Añadir
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={opponentId ?? ''}
              onChange={e => onOpponentChange(e.target.value || null)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">Sin rival</option>
              {opponents.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAnadiendo(true)}
              title="Añadir un rival nuevo"
              aria-label="Añadir un rival nuevo"
              className="shrink-0 rounded-[10px] border border-[#e0efe7] px-3 text-[13px] font-bold text-elche-primary transition-colors hover:bg-elche-bg"
            >
              +
            </button>
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Competición</label>
        <select
          value={matchType ?? ''}
          onChange={e => onMatchTypeChange(e.target.value || null)}
          className={`${inputClass} cursor-pointer`}
        >
          <option value="">Sin especificar</option>
          {TIPOS_PARTIDO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {mostrarAyuda && (
          <p className="mt-1.5 text-[11px] font-semibold text-[#8aa397]">
            Un amistoso y una eliminatoria no llenan igual
          </p>
        )}
      </div>
    </>
  );
}
