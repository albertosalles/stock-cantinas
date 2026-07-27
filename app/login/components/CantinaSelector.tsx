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
    <div className="animate-fade-in grid gap-4">
      {/* Evento ya elegido */}
      <div className="flex items-center gap-3 rounded-[var(--r-card-md)] border border-[#cdeede] bg-[#eef8f2] px-3.5 py-3">
        <span className="ms text-xl text-[var(--c-primary)]">sports_soccer</span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-ok)]">Evento</div>
          <div className="truncate text-[14px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
            {selectedEvent?.name}
          </div>
        </div>
        <button
          onClick={onBack}
          title="Cambiar de evento"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--c-border-input)] bg-white text-[var(--c-text-2)] transition-colors hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"
        >
          <span className="ms text-lg">edit</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="ms rounded-[var(--r-btn)] bg-[var(--c-primary-tint)] p-2.5 text-[22px] text-[var(--c-primary)]">
          storefront
        </span>
        <div>
          <div className="text-[15px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
            Selecciona tu cantina
          </div>
          <div className="mt-0.5 text-xs font-medium text-[var(--c-text-muted)]">
            Sólo aparecen las de este evento
          </div>
        </div>
      </div>

      {cantinas.length === 0 ? (
        <div className="rounded-[var(--r-card-md)] border border-dashed border-[var(--c-border)] py-10 text-center">
          <span className="ms text-[36px] text-[#bfe3cf]">storefront</span>
          <div className="mt-2 text-[12.5px] font-bold text-[var(--c-text-2)]">Sin cantinas disponibles</div>
          <div className="mt-0.5 text-[11px] font-semibold text-[var(--c-text-muted)]">
            Este evento no tiene cantinas asignadas
          </div>
        </div>
      ) : (
        <div className="sc-scroll grid max-h-[340px] gap-2.5 overflow-y-auto pr-1">
          {cantinas.map(cantina => {
            const disabled = !cantina.has_credentials || !cantina.access_enabled;
            return (
              <button
                key={cantina.cantina_id}
                onClick={() => onSelect(cantina)}
                disabled={disabled}
                className={`group flex w-full items-center gap-3 rounded-[var(--r-card-md)] border px-3.5 py-3 text-left transition-all ${
                  disabled
                    ? 'cursor-not-allowed border-[var(--c-border)] bg-[var(--c-bg)] opacity-60'
                    : 'border-[var(--c-border)] bg-[var(--c-surface)] hover:-translate-y-px hover:border-[var(--c-primary)] hover:shadow-[var(--sh-card-hover)]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
                    {cantina.cantina_name}
                  </div>

                  {cantina.cantina_location && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--c-text-muted)]">
                      <span className="ms text-[15px]">location_on</span>
                      {cantina.cantina_location}
                    </div>
                  )}

                  {/* Motivo por el que no se puede entrar */}
                  {!cantina.has_credentials && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--c-crit-bg)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--c-crit)]">
                      <span className="ms text-[13px]">error</span>
                      Sin credenciales
                    </span>
                  )}
                  {cantina.has_credentials && !cantina.access_enabled && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--c-warn-bg)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--c-warn)]">
                      <span className="ms text-[13px]">lock</span>
                      Acceso cerrado
                    </span>
                  )}
                </div>

                {!disabled && (
                  <span className="ms shrink-0 text-lg text-[var(--c-text-muted)] transition-colors group-hover:text-[var(--c-primary)]">
                    arrow_forward
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
