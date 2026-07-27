import React from 'react';
import { Event } from '../hooks/useLogin';

interface EventSelectorProps {
  events: Event[];
  onSelect: (event: Event) => void;
}

export default function EventSelector({ events, onSelect }: EventSelectorProps) {
  return (
    <div className="animate-fade-in grid gap-4">
      <div className="flex items-center gap-3">
        <span className="ms rounded-[var(--r-btn)] bg-[var(--c-primary-tint)] p-2.5 text-[22px] text-[var(--c-primary)]">
          sports_soccer
        </span>
        <div>
          <div className="text-[15px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
            ¿En qué evento trabajas?
          </div>
          <div className="mt-0.5 text-xs font-medium text-[var(--c-text-muted)]">
            Selecciona el partido de hoy
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-[var(--r-card-md)] border border-dashed border-[var(--c-border)] py-10 text-center">
          <span className="ms text-[36px] text-[#bfe3cf]">event_busy</span>
          <div className="mt-2 text-[12.5px] font-bold text-[var(--c-text-2)]">Sin eventos activos</div>
          <div className="mt-0.5 text-[11px] font-semibold text-[var(--c-text-muted)]">
            No hay ningún evento abierto en este momento
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {events.map(event => (
            <button
              key={event.id}
              onClick={() => onSelect(event)}
              className="group flex w-full items-center gap-3 rounded-[var(--r-card-md)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3 text-left transition-all hover:-translate-y-px hover:border-[var(--c-primary)] hover:shadow-[var(--sh-card-hover)]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
                  {event.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--c-text-muted)]">
                  <span className="ms text-[15px]">event</span>
                  {new Date(event.date).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--c-surface-alt)] px-2.5 py-1 text-[11px] font-bold text-[var(--c-text-2)]">
                <span className="ms text-[14px]">storefront</span>
                {event.cantinas_count}
              </span>
              <span className="ms shrink-0 text-lg text-[var(--c-text-muted)] transition-colors group-hover:text-[var(--c-primary)]">
                arrow_forward
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
