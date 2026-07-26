'use client';

import React, { useEffect } from 'react';
import { TerminalStatus } from '../hooks/useStripeTerminal';
import { eurFromCents } from '@/lib/posUi';

export type PayMethod = 'efectivo' | 'tarjeta';

export interface TicketLine {
  productId: string;
  name: string;
  unitCents: number;
  qty: number;
}

interface TicketSheetProps {
  open: boolean;
  onClose: () => void;
  lines: TicketLine[];
  totalCents: number;
  pay: PayMethod;
  onPayChange: (m: PayMethod) => void;
  onInc: (productId: string) => void;
  onDec: (productId: string) => void;
  onConfirm: () => void;
  /** Cobro en curso (efectivo o tarjeta). */
  processing: boolean;
  terminalStatus: TerminalStatus;
  terminalError: string | null;
  readerConnected: boolean;
}

const PAY_DEFS: { id: PayMethod; label: string; icon: string }[] = [
  { id: 'efectivo', label: 'Efectivo', icon: 'payments' },
  { id: 'tarjeta', label: 'Tarjeta', icon: 'credit_card' },
];

/** Estados del lector de tarjeta, con icono Material Symbols. */
const TERMINAL_MESSAGES: Record<TerminalStatus, { icon: string; text: string; hint?: string }> = {
  idle: { icon: 'credit_card', text: 'Preparando cobro…' },
  loading: { icon: 'hourglass_top', text: 'Cargando terminal…' },
  discovering: { icon: 'search', text: 'Buscando lector…' },
  connecting: { icon: 'link', text: 'Conectando al lector…' },
  ready: { icon: 'check_circle', text: 'Lector conectado' },
  collecting: { icon: 'contactless', text: 'Esperando tarjeta…', hint: 'Acerca la tarjeta al lector' },
  processing: { icon: 'sync', text: 'Procesando pago…' },
  succeeded: { icon: 'task_alt', text: '¡Pago completado!' },
  error: { icon: 'error', text: 'Error en el pago' },
};

const BUSY_STATUSES: TerminalStatus[] = ['loading', 'discovering', 'connecting', 'collecting', 'processing'];

/**
 * Ticket y cobro en un único bottom sheet (README "Ticket / Cobro").
 * Sustituye al carrito lateral y al modal de método de pago anteriores.
 */
export default function TicketSheet({
  open,
  onClose,
  lines,
  totalCents,
  pay,
  onPayChange,
  onInc,
  onDec,
  onConfirm,
  processing,
  terminalStatus,
  terminalError,
  readerConnected,
}: TicketSheetProps) {
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const empty = count === 0;

  const terminalBusy = pay === 'tarjeta' && BUSY_STATUSES.includes(terminalStatus);
  const terminalDone = pay === 'tarjeta' && terminalStatus === 'succeeded';
  const terminalFailed = pay === 'tarjeta' && terminalStatus === 'error';
  // Mientras el lector trabaja, el sheet muestra su estado en lugar de las líneas
  const showTerminalPanel = terminalBusy || terminalDone || terminalFailed;
  const locked = processing || terminalBusy;

  // El sheet se cierra con Escape, salvo mientras se cobra
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !locked) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, locked, onClose]);

  if (!open) return null;

  const msg = TERMINAL_MESSAGES[terminalStatus];

  return (
    <>
      <div
        onClick={locked ? undefined : onClose}
        className="animate-overlay absolute inset-0 z-40 bg-[rgba(10,30,20,.45)]"
        aria-hidden
      />

      <div
        role="dialog"
        aria-label="Ticket"
        className="animate-sheetup absolute bottom-0 left-0 right-0 z-50 flex max-h-[86%] flex-col rounded-t-[26px] bg-[var(--c-surface)] shadow-[0_-12px_40px_rgba(10,30,20,.25)]"
      >
        {/* Asa */}
        <div className="flex flex-none justify-center pb-1 pt-2.5">
          <span className="h-[5px] w-10 rounded-[3px] bg-[#dbe5e0]" />
        </div>

        <div className="flex flex-none items-center justify-between border-b border-[var(--c-divider)] px-5 pb-3 pt-1.5">
          <h2 className="m-0 text-lg font-extrabold tracking-[-0.02em] text-[var(--c-text)]">Ticket</h2>
          <span className="text-[12.5px] font-bold text-[var(--c-text-muted)]">
            {count} {count === 1 ? 'artículo' : 'artículos'}
          </span>
        </div>

        {/* ---------- Cuerpo ---------- */}
        {showTerminalPanel ? (
          <div className="flex-1 overflow-y-auto px-5 py-8 text-center">
            <span
              className={`ms text-[44px] ${
                terminalFailed
                  ? 'text-[var(--c-crit)]'
                  : terminalDone
                    ? 'text-[var(--c-primary)]'
                    : 'animate-pulse text-[var(--c-primary)]'
              }`}
            >
              {msg.icon}
            </span>
            <div className="mt-3 text-[17px] font-extrabold text-[var(--c-text)]">{msg.text}</div>
            {msg.hint && !terminalFailed && (
              <div className="mt-1 text-[12.5px] font-semibold text-[var(--c-text-muted)]">{msg.hint}</div>
            )}
            {terminalFailed && (
              <div className="mx-auto mt-3 max-w-[280px] rounded-[var(--r-input)] bg-[var(--c-crit-bg)] px-3 py-2.5 text-[12.5px] font-semibold text-[var(--c-crit)]">
                {terminalError || 'Ha ocurrido un error desconocido'}
              </div>
            )}
            {terminalFailed && (
              <button
                onClick={() => onPayChange('efectivo')}
                className="mt-4 rounded-[var(--r-btn)] border border-[var(--c-border-input)] bg-[var(--c-bg)] px-4 py-2.5 text-[13px] font-bold text-[var(--c-text-2)] transition-colors active:bg-[#eef6f1]"
              >
                Cobrar en efectivo
              </button>
            )}
          </div>
        ) : (
          <div className="noscroll flex-1 overflow-y-auto px-5 py-1.5">
            {empty ? (
              <div className="py-10 text-center">
                <span className="ms text-[40px] text-[#cfe7da]">shopping_cart</span>
                <div className="mt-2 text-[13.5px] font-bold text-[var(--c-text-2)]">El ticket está vacío</div>
                <div className="mt-0.5 text-xs font-semibold text-[var(--c-text-muted)]">
                  Añade productos desde la venta
                </div>
              </div>
            ) : (
              lines.map(l => (
                <div
                  key={l.productId}
                  className="flex items-center gap-3 border-b border-[var(--c-divider-soft)] py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[var(--c-text)]">{l.name}</div>
                    <div className="mt-0.5 text-xs font-semibold text-[var(--c-text-muted)]">
                      {eurFromCents(l.unitCents)} · ud
                    </div>
                  </div>

                  <div className="flex flex-none items-center gap-2.5">
                    <button
                      onClick={() => onDec(l.productId)}
                      aria-label={`Quitar una unidad de ${l.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--c-border-input)] bg-[var(--c-surface-alt)] text-[var(--c-text-2)] transition-transform active:scale-90"
                    >
                      <span className="ms text-[19px]">remove</span>
                    </button>
                    <span className="min-w-[22px] text-center text-[15px] font-extrabold tabular-nums text-[var(--c-text)]">
                      {l.qty}
                    </span>
                    <button
                      onClick={() => onInc(l.productId)}
                      aria-label={`Añadir una unidad de ${l.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#cdeede] bg-[#eef8f2] text-[var(--c-primary)] transition-transform active:scale-90"
                    >
                      <span className="ms text-[19px]">add</span>
                    </button>
                  </div>

                  <div className="w-16 flex-none text-right text-sm font-extrabold text-[var(--c-text)]">
                    {eurFromCents(l.unitCents * l.qty)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ---------- Pie: método, total y confirmación ---------- */}
        <div className="flex-none border-t border-[var(--c-divider)] bg-[var(--c-surface)] px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3.5">
          {!showTerminalPanel && (
            <div className="mb-3 flex gap-2.5">
              {PAY_DEFS.map(m => {
                const on = pay === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onPayChange(m.id)}
                    disabled={locked}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-[13.5px] font-bold transition-colors disabled:opacity-50 ${
                      on
                        ? 'border-[1.5px] border-[var(--c-primary)] bg-[#eef8f2] text-[var(--c-primary)]'
                        : 'border-[1.5px] border-[#e6efea] bg-[var(--c-surface)] text-[var(--c-text-muted)]'
                    }`}
                  >
                    <span className="ms text-[19px]">{m.icon}</span>
                    {m.label}
                    {m.id === 'tarjeta' && readerConnected && (
                      <span className="ms text-sm text-[var(--c-primary)]">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--c-text-muted)]">Total</span>
            <span className="text-[26px] font-extrabold tracking-[-0.02em] text-[var(--c-text)]">
              {eurFromCents(totalCents)}
            </span>
          </div>

          {terminalDone ? (
            <button
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2.5 rounded-[14px] border-none bg-[var(--c-primary)] px-4 py-4 text-[15.5px] font-extrabold text-white shadow-[0_6px_16px_rgba(0,150,79,.34)]"
            >
              <span className="ms text-[22px]">check_circle</span>
              Hecho
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={empty || locked}
              className={`flex w-full items-center justify-center gap-2.5 rounded-[14px] border-none px-4 py-4 text-[15.5px] font-extrabold text-white transition-transform ${
                empty || locked
                  ? 'cursor-not-allowed bg-[#b9c9c0]'
                  : 'bg-[var(--c-primary)] shadow-[0_6px_16px_rgba(0,150,79,.34)] active:translate-y-px'
              }`}
            >
              <span className={`ms text-[22px] ${locked ? 'animate-spin' : ''}`}>
                {locked ? 'progress_activity' : 'check_circle'}
              </span>
              {locked ? 'Cobrando…' : 'Confirmar cobro'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
