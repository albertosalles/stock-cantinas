import React from 'react';

interface EventGeneralTabProps {
  eventName: string;
  setEventName: (val: string) => void;
  eventDate: string | null;
  setEventDate: (val: string | null) => void;
  onSave: () => void;
}

export default function EventGeneralTab({ eventName, setEventName, eventDate, setEventDate, onSave }: EventGeneralTabProps) {
  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="font-bold text-xl mb-6 text-elche-text border-b border-elche-gray/50 pb-4 flex items-center gap-2">
        <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">⚙️</span>
        Configuración del evento
      </div>
      <div className="grid gap-5 max-w-2xl">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-elche-text-light font-bold uppercase tracking-wide">Nombre</span>
          <input 
            type="text" 
            value={eventName} 
            onChange={e => setEventName(e.target.value)} 
            className="p-3.5 rounded-2xl border border-elche-border bg-elche-bg/30 focus:outline-none focus:ring-2 focus:ring-elche-primary transition-all" 
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm text-elche-text-light font-bold uppercase tracking-wide">Fecha</span>
          <input 
            type="date" 
            value={eventDate || ''} 
            onChange={e => setEventDate(e.target.value || null)} 
            className="p-3.5 rounded-2xl border border-elche-border bg-elche-bg/30 focus:outline-none focus:ring-2 focus:ring-elche-primary transition-all" 
          />
        </label>
        <button 
          onClick={onSave} 
          className="mt-4 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-elche-primary to-elche-secondary text-white font-bold shadow-lg shadow-elche-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all w-fit"
        >
          💾 Guardar cambios
        </button>
      </div>
    </section>
  );
}

