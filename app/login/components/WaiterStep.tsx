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

  return (
    <div className="grid gap-5">
      {/* Contexto resuelto */}
      <div className="bg-elche-success/5 border border-elche-success/30 rounded-2xl p-4 text-center">
        <div className="font-bold text-elche-text">{access.cantinaName}</div>
        <div className="text-xs text-elche-text-light font-medium">{access.eventName}</div>
      </div>

      <div className="text-center">
        <div className="font-bold text-elche-text text-lg mb-1">¿Quién eres?</div>
        <div className="text-sm text-elche-text-light">
          {devList ? 'Selecciona tu nombre' : mode === 'qr' ? 'Escanea el QR de tu acreditación' : 'Introduce tu PIN personal'}
        </div>
      </div>

      {/* [DEV] Listado de camareros activos */}
      {devList && (
        loading ? (
          <div className="py-12 text-center flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-elche-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-elche-text-light font-medium">Abriendo turno...</span>
          </div>
        ) : (
          <div className="grid gap-2">
            {waiters!.length === 0 ? (
              <div className="text-center text-elche-text-light italic py-6">
                No hay camareros activos. Da de alta uno desde el panel de administración.
              </div>
            ) : waiters!.map(w => (
              <button
                key={w.id}
                onClick={() => onSelectWaiter?.(w.id, w.name)}
                className="w-full p-4 rounded-2xl border border-elche-gray bg-white font-bold text-elche-text text-left hover:border-elche-primary hover:bg-elche-primary/5 active:scale-[0.99] transition-all flex items-center gap-3"
              >
                <span className="w-9 h-9 rounded-full bg-elche-primary/10 text-elche-primary flex items-center justify-center">👤</span>
                {w.name}
              </button>
            ))}
            <button onClick={onBack} className="w-full mt-2 py-2 text-sm font-bold text-elche-text-light hover:text-elche-primary transition-colors">
              ← Cambiar de cantina
            </button>
          </div>
        )
      )}

      {devList ? null : (
      <>
        {/* --- Flujo de producción (QR / PIN) --- */}

      {loading ? (
        <div className="py-16 text-center flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-elche-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-elche-text-light font-medium">Abriendo turno...</span>
        </div>
      ) : mode === 'qr' ? (
        <>
          <QrScanner onScan={(text) => onIdentify({ qrText: text })} />
          <button
            onClick={() => setMode('pin')}
            className="w-full py-3 text-sm font-bold text-elche-text-light hover:text-elche-primary transition-colors"
          >
            🔢 Usar mi PIN personal
          </button>
        </>
      ) : (
        <div className="grid gap-3">
          <input
            type="password"
            inputMode="numeric"
            value={personalPin}
            onChange={(e) => setPersonalPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && personalPin && onIdentify({ pin: personalPin })}
            placeholder="PIN personal"
            className="w-full p-4 rounded-2xl border border-elche-gray bg-elche-bg text-elche-text font-bold text-center text-2xl tracking-[0.5em] focus:ring-2 focus:ring-elche-primary focus:outline-none focus:border-elche-primary transition-all placeholder:text-elche-text-light/40 placeholder:text-base placeholder:tracking-normal"
            autoFocus
          />
          <button
            onClick={() => onIdentify({ pin: personalPin })}
            disabled={!personalPin}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-elche-primary to-elche-secondary text-white font-bold text-lg shadow-lg shadow-elche-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            ✅ Empezar turno
          </button>
          <button
            onClick={() => { setMode('qr'); setPersonalPin(''); }}
            className="w-full py-2 text-sm font-bold text-elche-text-light hover:text-elche-primary transition-colors"
          >
            📷 Volver a escanear QR
          </button>
        </div>
      )}

      <button
        onClick={onBack}
        className="w-full py-2 text-sm font-bold text-elche-text-light hover:text-elche-primary transition-colors"
      >
        ← Cambiar de cantina
      </button>
      </>
      )}
    </div>
  );
}
