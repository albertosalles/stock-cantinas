'use client';

import React from 'react';
import QrScanner from './QrScanner';

interface ScanStepProps {
  loading: boolean;
  onScan: (text: string) => void;
  onManualFlow: () => void;
}

/** Paso principal de login: escanear el QR físico de la cantina. */
export default function ScanStep({ loading, onScan, onManualFlow }: ScanStepProps) {
  return (
    <div className="animate-fade-in grid gap-4">
      <div className="flex items-center gap-3">
        <span className="ms rounded-[var(--r-btn)] bg-[var(--c-primary-tint)] p-2.5 text-[22px] text-[var(--c-primary)]">
          qr_code_scanner
        </span>
        <div>
          <div className="text-[15px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
            Escanea el QR de tu cantina
          </div>
          <div className="mt-0.5 text-xs font-medium text-[var(--c-text-muted)]">
            Está en el cartel junto a la barra
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="ms animate-spin text-[32px] text-[var(--c-primary)]">progress_activity</span>
          <span className="text-[13px] font-semibold text-[var(--c-text-muted)]">Validando acceso…</span>
        </div>
      ) : (
        <QrScanner onScan={onScan} />
      )}

      <button
        onClick={onManualFlow}
        className="flex w-full items-center justify-center gap-1.5 rounded-[var(--r-btn)] border border-[var(--c-border)] bg-[var(--c-bg)] py-3 text-[13px] font-bold text-[var(--c-text-2)] transition-colors hover:bg-[#eef6f1] hover:text-[var(--c-primary)]"
      >
        <span className="ms text-lg">keyboard</span>
        No puedo escanear — acceso manual con PIN
      </button>
    </div>
  );
}
