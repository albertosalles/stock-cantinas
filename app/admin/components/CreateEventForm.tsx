import React, { useState } from 'react';

interface CreateEventFormProps {
  onCreate: (name: string, date: string) => Promise<void>;
}

export default function CreateEventForm({ onCreate }: CreateEventFormProps) {
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newName) return;
    setLoading(true);
    try {
      await onCreate(newName, newDate);
      setNewName('');
      setNewDate('');
      // Optional: toast success
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-elche-gray/50">
      <div className="font-bold text-xl mb-6 text-elche-text flex items-center gap-3 border-b border-elche-gray/50 pb-4">
        <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">➕</span> 
        Crear nuevo evento
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="w-full">
          <label className="block text-sm font-bold text-elche-text-light mb-1.5 uppercase tracking-wide">Nombre del evento</label>
          <input
            type="text"
            placeholder="Ej: Partido Elche vs..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full p-3.5 rounded-2xl border border-elche-border bg-elche-bg/30 focus:outline-none focus:ring-2 focus:ring-elche-primary transition-all font-medium"
          />
        </div>
        
        <div className="w-full md:w-auto">
          <label className="block text-sm font-bold text-elche-text-light mb-1.5 uppercase tracking-wide">Fecha</label>
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="w-full p-3.5 rounded-2xl border border-elche-border bg-elche-bg/30 focus:outline-none focus:ring-2 focus:ring-elche-primary transition-all font-medium"
          />
        </div>

        <button 
          onClick={handleSubmit}
          disabled={!newName || loading}
          className="w-full md:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-elche-primary to-elche-secondary text-white font-bold shadow-lg shadow-elche-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:scale-100 whitespace-nowrap"
        >
          {loading ? 'Creando...' : 'Crear Evento'}
        </button>
      </div>
    </section>
  );
}


