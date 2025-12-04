import React from 'react';
import { Event, Cantina } from '../hooks/useLogin';

interface PinInputProps {
  selectedEvent: Event | null;
  selectedCantina: Cantina | null;
  pin: string;
  loading: boolean;
  onPinChange: (val: string) => void;
  onLogin: () => void;
  onBack: () => void;
}

export default function PinInput({ selectedEvent, selectedCantina, pin, loading, onPinChange, onLogin, onBack }: PinInputProps) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-elche-text">
          Código de acceso
        </h2>
        <button
          onClick={onBack}
          className="text-xs font-bold text-elche-text-light hover:text-elche-green uppercase tracking-wide px-3 py-1.5 rounded-lg hover:bg-elche-gray/20 transition-colors"
        >
          ← Atrás
        </button>
      </div>

      <div className="bg-elche-gray/30 rounded-2xl p-5 mb-8 border border-elche-gray/50">
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-elche-gray/30">
          <span className="text-lg">📅</span>
          <div>
            <div className="text-xs font-bold text-elche-text-light uppercase">Evento</div>
            <div className="text-sm font-bold text-elche-text">{selectedEvent?.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg">🏪</span>
          <div>
            <div className="text-xs font-bold text-elche-text-light uppercase">Cantina</div>
            <div className="text-sm font-bold text-elche-text">{selectedCantina?.cantina_name}</div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-xs font-bold mb-2 text-elche-text-light uppercase tracking-wide text-center">
          Introduce el PIN de 4 dígitos
        </label>
        <input
          type="password"
          value={pin}
          onChange={(e) => onPinChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pin) {
              onLogin();
            }
          }}
          placeholder="••••"
          autoFocus
          maxLength={8}
          className="w-full p-4 text-3xl text-center tracking-[0.5em] rounded-2xl border-2 border-elche-gray font-mono font-bold text-elche-text focus:border-elche-green focus:ring-4 focus:ring-elche-green/10 focus:outline-none transition-all placeholder:tracking-[0.5em] placeholder:text-elche-gray/50 shadow-inner bg-white"
        />
      </div>

      <button
        onClick={onLogin}
        disabled={!pin || loading}
        className={`
          w-full p-4 rounded-2xl font-bold text-base text-white shadow-lg transition-all flex items-center justify-center gap-2
          ${loading 
            ? 'bg-elche-gray cursor-not-allowed' 
            : 'bg-gradient-to-br from-elche-primary to-elche-secondary hover:shadow-elche-primary/30 hover:-translate-y-0.5 active:translate-y-0 hover:scale-[1.01] active:scale-[0.99]'
          }
        `}
      >
        {loading ? (
          <>
            <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span> Validando...
          </>
        ) : (
          <>
            🔓 Iniciar sesión
          </>
        )}
      </button>
    </div>
  );
}

