'use client';

import React, { useState } from 'react';
import QrScanner from './QrScanner';
import { CantinaAccess } from '@/lib/waiters';
import type { ActiveWaiter } from '../hooks/useLogin';

interface WaiterStepProps {
  access: CantinaAccess;
  loading: boolean;
  onIdentify: (opts: { qrText?: string; pin?: string }) => void;
  onBack: () => void;
  /** [DEV] Si se pasa, se muestra un listado de camareros en vez del QR/PIN. */
  waiters?: ActiveWaiter[];
  onSelectWaiter?: (id: string, name: string) => void;
}

/** Identificación del camarero: QR de su acreditación, o PIN personal como alternativa. */
export default function WaiterStep({ access, loading, onIdentify, onBack, waiters, onSelectWaiter }: WaiterStepProps) {
  const [mode, setMode] = useState<'qr' | 'pin'>('qr');
  const [personalPin, setPersonalPin] = useState('');
  const devList = !!waiters; // modo desarrollo: elegir de la lista

  const backButton = (
    <button
      onClick={onBack}
      className="flex w-full items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold text-[var(--c-text-muted)] transition-colors hover:text-[var(--c-primary)]"
    >
      <span className="ms text-lg">arrow_back</span>
      Cambiar de cantina
    </button>
  );

  return (
    <div className="animate-fade-in grid gap-4">
      {/* Contexto resuelto por el QR */}
      <div className="flex items-center gap-3 rounded-[var(--r-card-md)] border border-[#cdeede] bg-[#eef8f2] px-3.5 py-3">
        <span className="ms text-xl text-[var(--c-primary)]">storefront</span>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
            {access.cantinaName}
          </div>
          <div className="truncate text-[11.5px] font-semibold text-[var(--c-ok)]">{access.eventName}</div>
        </div>
        <span className="ms ms-fill ml-auto shrink-0 text-xl text-[var(--c-primary)]">check_circle</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="ms rounded-[var(--r-btn)] bg-[var(--c-primary-tint)] p-2.5 text-[22px] text-[var(--c-primary)]">
          badge
        </span>
        <div>
          <div className="text-[15px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">¿Quién eres?</div>
          <div className="mt-0.5 text-xs font-medium text-[var(--c-text-muted)]">
            {devList
              ? 'Selecciona tu nombre'
              : mode === 'qr'
                ? 'Escanea el QR de tu acreditación'
                : 'Introduce tu PIN personal'}
          </div>
        </div>
      </div>

      {/* [DEV] Listado de camareros activos */}
      {devList && (
        loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="ms animate-spin text-[32px] text-[var(--c-primary)]">progress_activity</span>
            <span className="text-[13px] font-semibold text-[var(--c-text-muted)]">Abriendo turno…</span>
          </div>
        ) : (
          <div className="grid gap-2">
            {waiters!.length === 0 ? (
              <div className="py-8 text-center">
                <span className="ms text-[36px] text-[#bfe3cf]">person_off</span>
                <div className="mt-2 text-[12.5px] font-bold text-[var(--c-text-2)]">No hay camareros activos</div>
                <div className="mt-0.5 text-[11px] font-semibold text-[var(--c-text-muted)]">
                  Da de alta uno desde el panel de administración
                </div>
              </div>
            ) : waiters!.map((w, i) => (
              <button
                key={w.id}
                onClick={() => onSelectWaiter?.(w.id, w.name)}
                className="flex w-full items-center gap-3 rounded-[var(--r-card-md)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3 text-left transition-all hover:-translate-y-px hover:border-[var(--c-primary)] hover:shadow-[var(--sh-card-hover)]"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold text-white"
                  style={{ background: `linear-gradient(145deg,#20b368,#007a3d)`, opacity: 1 - (i % 3) * 0.08 }}
                >
                  {w.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 truncate text-[13.5px] font-bold text-[var(--c-text)]">{w.name}</span>
                <span className="ms text-lg text-[var(--c-text-muted)]">arrow_forward</span>
              </button>
            ))}
            {backButton}
          </div>
        )
      )}

      {devList ? null : (
        <>
          {/* --- Flujo de producción (QR / PIN) --- */}
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="ms animate-spin text-[32px] text-[var(--c-primary)]">progress_activity</span>
              <span className="text-[13px] font-semibold text-[var(--c-text-muted)]">Abriendo turno…</span>
            </div>
          ) : mode === 'qr' ? (
            <>
              <QrScanner onScan={(text) => onIdentify({ qrText: text })} />
              <button
                onClick={() => setMode('pin')}
                className="flex w-full items-center justify-center gap-1.5 rounded-[var(--r-btn)] border border-[var(--c-border)] bg-[var(--c-bg)] py-3 text-[13px] font-bold text-[var(--c-text-2)] transition-colors hover:bg-[#eef6f1] hover:text-[var(--c-primary)]"
              >
                <span className="ms text-lg">dialpad</span>
                Usar mi PIN personal
              </button>
            </>
          ) : (
            <div className="grid gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
                  PIN personal
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={personalPin}
                  onChange={(e) => setPersonalPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && personalPin && onIdentify({ pin: personalPin })}
                  placeholder="••••"
                  autoFocus
                  className="w-full rounded-[10px] border border-[var(--c-border-input)] bg-[var(--c-surface-sub)] px-3 py-3.5 text-center text-xl font-extrabold tracking-[0.4em] text-[var(--c-text)] outline-none transition-colors placeholder:tracking-[0.3em] placeholder:text-[var(--c-placeholder)] focus:border-[var(--c-primary)] focus:bg-white"
                />
              </div>
              <button
                onClick={() => onIdentify({ pin: personalPin })}
                disabled={!personalPin}
                className={`flex w-full items-center justify-center gap-2 rounded-[var(--r-btn)] py-3.5 text-[14px] font-bold text-white transition-transform ${
                  !personalPin
                    ? 'cursor-not-allowed bg-[#b9c9c0]'
                    : 'bg-[var(--c-primary)] shadow-[var(--sh-btn)] hover:bg-[var(--c-primary-hover)] active:translate-y-px'
                }`}
              >
                <span className="ms text-xl">play_circle</span>
                Empezar turno
              </button>
              <button
                onClick={() => { setMode('qr'); setPersonalPin(''); }}
                className="flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-bold text-[var(--c-text-muted)] transition-colors hover:text-[var(--c-primary)]"
              >
                <span className="ms text-lg">photo_camera</span>
                Volver a escanear QR
              </button>
            </div>
          )}

          {backButton}
        </>
      )}
    </div>
  );
}
