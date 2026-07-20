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
    <div className="grid gap-5">
      <div className="text-center">
        <div className="font-bold text-elche-text text-lg mb-1">Escanea el QR de tu cantina</div>
        <div className="text-sm text-elche-text-light">Está en el cartel junto a la barra</div>
      </div>

      {loading ? (
        <div className="py-16 text-center flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-elche-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-elche-text-light font-medium">Validando acceso...</span>
        </div>
      ) : (
        <QrScanner onScan={onScan} />
      )}

      <button
        onClick={onManualFlow}
        className="w-full py-3 text-sm font-bold text-elche-text-light hover:text-elche-primary transition-colors"
      >
        ⌨️ No puedo escanear — acceso manual con PIN
      </button>
    </div>
  );
}
