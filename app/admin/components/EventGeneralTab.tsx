'use client';

import React, { useState } from 'react';

interface EventGeneralTabProps {
  eventName: string;
  setEventName: (val: string) => void;
  eventDate: string | null;
  setEventDate: (val: string | null) => void;
  onSave: () => Promise<void> | void;
}

export default function EventGeneralTab({
  eventName,
  setEventName,
  eventDate,
  setEventDate,
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
          <div>
            <label className={labelClass}>Fecha</label>
            <input
              type="date"
              value={dateValue}
              onChange={e => setEventDate(e.target.value || null)}
              className={inputClass}
            />
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
