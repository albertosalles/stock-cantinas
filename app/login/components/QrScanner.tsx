'use client';

import { useEffect, useId, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  /** Se llama con el texto decodificado. El padre decide qué hacer (y desmonta el scanner). */
  onScan: (text: string) => void;
}

/**
 * Escáner QR con la cámara trasera (html5-qrcode).
 * Reutilizado en el login (QR de cantina) y en la identificación del camarero.
 */
export default function QrScanner({ onScan }: QrScannerProps) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  // id único por instancia (html5-qrcode ancla al DOM por id).
  // useId es estable entre servidor y cliente (evita errores de hidratación).
  const reactId = useId();
  const idRef = useRef(`qr-reader-${reactId.replace(/[^a-zA-Z0-9-]/g, '')}`);

  useEffect(() => {
    const scanner = new Html5Qrcode(idRef.current);
    let stopped = false;
    let lastText = '';

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decoded) => {
          if (stopped || decoded === lastText) return;
          lastText = decoded; // evita disparos repetidos del mismo código
          onScanRef.current(decoded);
        },
        () => { /* errores por frame: ignorar */ }
      )
      .catch((err) => console.error('No se pudo iniciar la cámara:', err));

    return () => {
      stopped = true;
      scanner.stop().then(() => scanner.clear()).catch(() => { /* ya parado */ });
    };
  }, []);

  return (
    <div>
      <div
        id={idRef.current}
        className="min-h-[240px] w-full overflow-hidden rounded-[var(--r-card-md)] border border-[var(--c-border)] bg-black/90"
      />
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-[var(--c-text-muted)]">
        <span className="ms text-[15px]">center_focus_weak</span>
        Apunta la cámara al código QR
      </div>
    </div>
  );
}
