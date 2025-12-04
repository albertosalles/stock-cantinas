import React from 'react';
import { Event } from '../hooks/useLogin';

interface EventSelectorProps {
  events: Event[];
  onSelect: (event: Event) => void;
}

export default function EventSelector({ events, onSelect }: EventSelectorProps) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-bold mb-6 text-elche-text text-center">
        ¿En qué evento estás trabajando?
      </h2>
      {events.length === 0 ? (
        <div className="text-center py-12 bg-elche-gray/10 rounded-2xl border border-dashed border-elche-gray text-elche-text-light">
          No hay eventos activos en este momento
        </div>
      ) : (
        <div className="grid gap-3">
          {events.map(event => (
            <button
              key={event.id}
              onClick={() => onSelect(event)}
              className="p-4 rounded-2xl border-2 border-elche-gray bg-white text-left transition-all duration-200 hover:border-elche-green hover:bg-elche-green/5 hover:-translate-y-0.5 hover:shadow-md cursor-pointer group relative w-full"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-bold text-elche-text mb-1 group-hover:text-elche-green transition-colors">
                    {event.name}
                  </div>
                  <div className="text-xs text-elche-text-light font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <span>📅</span>
                    {new Date(event.date).toLocaleDateString('es-ES', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric'
                    })}
                  </div>
                </div>
                <div className="bg-elche-gray/30 px-2.5 py-1 rounded-lg text-xs font-bold text-elche-text-light group-hover:bg-white group-hover:text-elche-green transition-colors shadow-sm">
                  {event.cantinas_count} 🏪
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

