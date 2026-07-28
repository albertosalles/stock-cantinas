'use client';

import React, { useState } from 'react';

interface EventGeneralTabProps {
  eventName: string;
  setEventName: (val: string) => void;
  eventDate: string | null;
  setEventDate: (val: string | null) => void;
  kickoffAt: string | null;
  setKickoffAt: (val: string | null) => void;
  onSave: () => Promise<void> | void;
}

export default function EventGeneralTab({
  eventName,
  setEventName,
  eventDate,
  setEventDate,
  kickoffAt,
  setKickoffAt,
  onSave,
}: EventGeneralTabProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      alert(e.message || 'Error al guardar el evento');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-[10px] border border-[#e0efe7] bg-[#f9fcfb] px-3 py-2.5 text-[13.5px] text-elche-text outline-none focus:border-elche-primary focus:bg-white';
  const labelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]';

  // El input date espera YYYY-MM-DD; la BD guarda timestamptz
  const dateValue = eventDate ? String(eventDate).slice(0, 10) : '';

  // La hora de inicio se edita como HH:MM local y se guarda como timestamptz
  // combinándola con la fecha del evento.
  const kickoffValue = kickoffAt
    ? new Date(kickoffAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  const onKickoffChange = (hhmm: string) => {
    if (!hhmm || !dateValue) { setKickoffAt(null); return; }
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(`${dateValue}T00:00:00`);
    d.setHours(h, m, 0, 0);
    setKickoffAt(d.toISOString());
  };

  // Apertura de puertas: dato derivado, no editable. Se muestra para que quede
  // claro desde cuándo se cuenta la afluencia.
  const puertas = kickoffAt
    ? new Date(new Date(kickoffAt).getTime() - 90 * 60000)
        .toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  return (
    <div className="mx-auto max-w-[1440px] animate-fade-in">
      <div className="max-w-2xl overflow-hidden rounded-2xl border border-elche-gray bg-white">
        <div className="flex items-center gap-2.5 border-b border-[#f0f6f2] px-5 py-4">
          <span className="ms text-xl text-elche-primary">settings</span>
          <h3 className="m-0 text-[15px] font-extrabold tracking-tight">Configuración del evento</h3>
        </div>

        <div className="grid gap-4 p-5">
          <div>
            <label className={labelClass}>Nombre</label>
            <input type="text" value={eventName} onChange={e => setEventName(e.target.value)} className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Fecha</label>
              <input
                type="date"
                value={dateValue}
                onChange={e => setEventDate(e.target.value || null)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Hora de inicio</label>
              <input
                type="time"
                value={kickoffValue}
                disabled={!dateValue}
                onChange={e => onKickoffChange(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1.5 text-[11px] font-semibold text-[#8aa397]">
                {puertas
                  ? `Puertas a las ${puertas} · la afluencia se mide desde ahí`
                  : dateValue
                    ? 'Necesaria para el mapa de afluencia del partido'
                    : 'Define antes la fecha'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !eventName.trim()}
              className="flex items-center gap-1.5 rounded-[11px] bg-elche-primary px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_3px_10px_rgba(0,150,79,.28)] transition-colors hover:bg-elche-secondary disabled:opacity-50"
            >
              <span className="ms text-lg">save</span>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-elche-primary">
                <span className="ms text-lg">check_circle</span>
                Guardado
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
