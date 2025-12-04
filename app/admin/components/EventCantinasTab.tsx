import React, { useState } from 'react';
import { CantinaRow } from '../hooks/useAdminCantinas';

interface EventCantinasTabProps {
  cantinas: CantinaRow[];
  loading: boolean;
  onToggle: (id: string, assigned: boolean) => void;
  onCreate: (name: string) => void;
}

export default function EventCantinasTab({ cantinas, loading, onToggle, onCreate }: EventCantinasTabProps) {
  const [newName, setNewName] = useState('');

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="font-bold text-xl mb-6 text-elche-text border-b border-elche-gray/50 pb-4 flex items-center gap-2">
        <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">🏪</span>
        Cantinas asignadas
      </div>
      
      {loading ? (
        <div className="p-10 text-center text-elche-text-light flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-elche-primary border-t-transparent rounded-full animate-spin"/>
          Cargando cantinas...
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {cantinas.map(c => (
              <div key={c.id} className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${c.assigned ? 'bg-elche-success/5 border-elche-success/30' : 'bg-white border-elche-gray hover:border-elche-gray/80'}`}>
                <span className={`font-bold ${c.assigned ? 'text-elche-text' : 'text-elche-text-light'}`}>{c.name}</span>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <span className={`text-xs font-bold uppercase tracking-wide ${c.assigned ? 'text-elche-success' : 'text-elche-text-light'}`}>
                    {c.assigned ? 'Asignada' : 'No asignada'}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={c.assigned}
                      onChange={e => onToggle(c.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-elche-success"></div>
                  </div>
                </label>
              </div>
            ))}
          </div>

          {/* Create New Cantina */}
          <div className="mt-4 p-5 bg-elche-gray/30 rounded-2xl border border-elche-gray/50">
            <div className="font-bold text-elche-text mb-3">➕ Nueva cantina</div>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Nombre de la cantina"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="flex-1 p-3 rounded-xl border border-elche-gray bg-white focus:outline-none focus:ring-2 focus:ring-elche-primary"
              />
              <button
                onClick={() => { onCreate(newName); setNewName(''); }}
                disabled={!newName.trim()}
                className="px-5 py-3 rounded-xl bg-elche-text text-white font-bold shadow-sm hover:bg-elche-primary transition-colors disabled:opacity-50 disabled:shadow-none"
              >
                Crear y Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

