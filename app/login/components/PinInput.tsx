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

export default function PinInput({
  selectedEvent, selectedCantina, pin, loading, onPinChange, onLogin, onBack,
}: PinInputProps) {
  return (
    <div className="animate-fade-in grid gap-4">
      {/* Resumen de lo elegido */}
      <div className="overflow-hidden rounded-[var(--r-card-md)] border border-[var(--c-border)]">
        <div className="flex items-center gap-3 border-b border-[var(--c-divider)] bg-[var(--c-surface-alt)] px-3.5 py-2.5">
          <span className="ms text-lg text-[var(--c-text-muted)]">sports_soccer</span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
              Evento
            </div>
            <div className="truncate text-[13px] font-bold text-[var(--c-text)]">{selectedEvent?.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[var(--c-surface-alt)] px-3.5 py-2.5">
          <span className="ms text-lg text-[var(--c-text-muted)]">storefront</span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
              Cantina
            </div>
            <div className="truncate text-[13px] font-bold text-[var(--c-text)]">
              {selectedCantina?.cantina_name}
            </div>
          </div>
          <button
            onClick={onBack}
            title="Cambiar de cantina"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--c-border-input)] bg-white text-[var(--c-text-2)] transition-colors hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"
          >
            <span className="ms text-lg">edit</span>
          </button>
        </div>
      </div>

      {/* PIN */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
          Código de acceso de la cantina
        </label>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => onPinChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && pin) onLogin(); }}
          placeholder="••••"
          autoFocus
          maxLength={8}
          className="w-full rounded-[10px] border border-[var(--c-border-input)] bg-[var(--c-surface-sub)] px-3 py-4 text-center text-2xl font-extrabold tracking-[0.4em] text-[var(--c-text)] outline-none transition-colors placeholder:tracking-[0.3em] placeholder:text-[var(--c-placeholder)] focus:border-[var(--c-primary)] focus:bg-white"
        />
      </div>

      <button
        onClick={onLogin}
        disabled={!pin || loading}
        className={`flex w-full items-center justify-center gap-2 rounded-[var(--r-btn)] py-3.5 text-[14px] font-bold text-white transition-transform ${
          !pin || loading
            ? 'cursor-not-allowed bg-[#b9c9c0]'
            : 'bg-[var(--c-primary)] shadow-[var(--sh-btn)] hover:bg-[var(--c-primary-hover)] active:translate-y-px'
        }`}
      >
        <span className={`ms text-xl ${loading ? 'animate-spin' : ''}`}>
          {loading ? 'progress_activity' : 'login'}
        </span>
        {loading ? 'Validando…' : 'Iniciar sesión'}
      </button>
    </div>
  );
}
