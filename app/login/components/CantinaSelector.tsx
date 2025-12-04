import React from 'react';
import { Cantina, Event } from '../hooks/useLogin';

interface CantinaSelectorProps {
  cantinas: Cantina[];
  selectedEvent: Event | null;
  onSelect: (cantina: Cantina) => void;
  onBack: () => void;
}

export default function CantinaSelector({ cantinas, selectedEvent, onSelect, onBack }: CantinaSelectorProps) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-elche-text">
          Selecciona tu cantina
        </h2>
        <button
          onClick={onBack}
          className="text-xs font-bold text-elche-text-light hover:text-elche-green uppercase tracking-wide px-3 py-1.5 rounded-lg hover:bg-elche-gray/20 transition-colors"
        >
          ← Atrás
        </button>
      </div>
      
      <div className="p-5 bg-gradient-to-br from-elche-primary to-elche-secondary rounded-2xl mb-6 text-white shadow-lg shadow-elche-primary/20">
        <div className="text-xs opacity-80 uppercase font-bold tracking-wide mb-1">Evento seleccionado</div>
        <div className="text-lg font-extrabold">{selectedEvent?.name}</div>
      </div>

      {cantinas.length === 0 ? (
        <div className="text-center py-12 bg-elche-gray/10 rounded-2xl border border-dashed border-elche-gray text-elche-text-light">
          No hay cantinas disponibles para este evento
        </div>
      ) : (
        <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {cantinas.map(cantina => {
            const disabled = !cantina.has_credentials || !cantina.access_enabled;
            return (
              <button
                key={cantina.cantina_id}
                onClick={() => onSelect(cantina)}
                disabled={disabled}
                className={`
                  p-4 rounded-2xl border-2 text-left transition-all duration-200 relative w-full
                  ${disabled 
                    ? 'bg-elche-gray/30 border-transparent opacity-60 cursor-not-allowed' 
                    : 'bg-white border-elche-gray hover:border-elche-green hover:shadow-md hover:-translate-y-0.5 cursor-pointer group'
                  }
                `}
              >
                <div className={`text-base font-bold mb-1 ${disabled ? 'text-elche-text' : 'text-elche-text group-hover:text-elche-green transition-colors'}`}>
                  {cantina.cantina_name}
                </div>
                {cantina.cantina_location && (
                  <div className="text-xs text-elche-text-light font-medium flex items-center gap-1">
                    <span>📍</span> {cantina.cantina_location}
                  </div>
                )}
                
                {/* Badges de estado */}
                <div className="flex flex-col gap-1 mt-2">
                  {!cantina.has_credentials && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded w-fit font-bold">
                      ⚠️ Sin credenciales
                    </span>
                  )}
                  {cantina.has_credentials && !cantina.access_enabled && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded w-fit font-bold">
                      🔒 Acceso cerrado
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

