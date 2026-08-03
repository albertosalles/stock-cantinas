'use client';

import { useEffect, useState } from 'react';
import { hayBiometria, registrarPasskey } from '@/lib/passkeys';

/**
 * Registra este dispositivo para entrar después con Face ID o huella.
 *
 * Sólo aparece si el dispositivo tiene autenticador de plataforma. No se puede
 * saber desde el navegador si YA hay una passkey registrada para esta cuenta —
 * eso lo sabe el sistema operativo—, así que el botón se muestra siempre y el
 * caso «ya estaba» se resuelve solo: el registro excluye las credenciales ya
 * conocidas y el sistema avisa.
 *
 * El registro exige sesión iniciada, y es la regla que sostiene todo: la
 * passkey no crea identidad, hereda la que ya se demostró con el PIN, el QR o
 * la contraseña.
 */
export default function BotonRegistrarPasskey({ compacto = false }: { compacto?: boolean }) {
  const [disponible, setDisponible] = useState(false);
  const [estado, setEstado] = useState<'inicial' | 'guardando' | 'listo'>('inicial');
  const [error, setError] = useState('');

  useEffect(() => { hayBiometria().then(setDisponible); }, []);

  if (!disponible) return null;

  const registrar = async () => {
    if (estado === 'guardando') return;
    setEstado('guardando');
    setError('');
    try {
      await registrarPasskey(navigator.platform || undefined);
      setEstado('listo');
    } catch (e: any) {
      setEstado('inicial');
      if (e?.name === 'NotAllowedError') setError('Registro cancelado');
      else if (e?.name === 'InvalidStateError') setError('Este dispositivo ya estaba registrado');
      else setError(e?.message || 'No se pudo registrar');
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={registrar}
        disabled={estado !== 'inicial'}
        className={`flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold transition-colors disabled:opacity-70 ${
          compacto
            ? 'text-[var(--c-text-2)] hover:bg-[var(--c-surface-alt)]'
            : 'border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-2)] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]'
        }`}
      >
        <span className="ms text-[19px]">
          {estado === 'listo' ? 'check_circle' : 'fingerprint'}
        </span>
        {estado === 'listo'
          ? 'Dispositivo registrado'
          : estado === 'guardando'
            ? 'Registrando…'
            : 'Activar Face ID o huella'}
      </button>
      {error && (
        <p className="px-3 text-[11px] font-semibold text-[var(--c-danger,#c0392b)]">{error}</p>
      )}
    </div>
  );
}
