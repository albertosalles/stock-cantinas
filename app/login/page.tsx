'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLogin } from './hooks/useLogin';
import EventSelector from './components/EventSelector';
import CantinaSelector from './components/CantinaSelector';
import PinInput from './components/PinInput';
import ScanStep from './components/ScanStep';
import WaiterStep from './components/WaiterStep';
import { DEV_EASY_LOGIN } from '@/lib/devConfig';
import { setAccessToken } from '@/lib/session';
import { hayBiometria, entrarConPasskey } from '@/lib/passkeys';

/** Pasos del flujo de cantina, en el orden en que se recorren. */
const QR_STEPS = [
  { key: 'scan', label: 'Cantina' },
  { key: 'waiter', label: 'Camarero' },
];
const MANUAL_STEPS = [
  { key: 'event', label: 'Evento' },
  { key: 'cantina', label: 'Cantina' },
  { key: 'pin', label: 'Acceso' },
];

export default function CantinaLoginPage() {
  const router = useRouter();
  const {
    step,
    events,
    cantinas,
    selectedEvent,
    selectedCantina,
    pendingAccess,
    activeWaiters,
    pin,
    setPin,
    loading,
    error,
    handleCantinaQr,
    handleWaiterIdentify,
    loginAsWaiter,
    startManualFlow,
    selectEvent,
    selectCantina,
    goBack,
    login
  } = useLogin();

  // Acceso de administración (contraseña)
  const [mode, setMode] = useState<'cantina' | 'admin'>('cantina');
  // ─── Acceso biométrico (S6) ───
  // El botón sólo aparece si el dispositivo tiene autenticador de plataforma.
  // No se puede saber desde aquí si ADEMÁS hay una passkey registrada: eso lo
  // sabe el sistema operativo, y preguntárselo abriría el diálogo. Por eso el
  // «no está registrado» se trata como un error normal, no como algo a evitar.
  const [biometriaDisponible, setBiometriaDisponible] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState('');

  useEffect(() => { hayBiometria().then(setBiometriaDisponible); }, []);

  const handleBiometria = async () => {
    if (bioLoading) return;
    setBioLoading(true);
    setBioError('');
    try {
      const acceso = await entrarConPasskey();
      router.push(acceso.rol === 'admin' ? '/admin' : '/pos');
    } catch (e: any) {
      // 409 no es un fallo: es que el camarero no tiene turno abierto, y la
      // passkey acredita quién eres pero no en qué barra estás.
      if (e?.status === 409) setBioError(e.message);
      else if (e?.name === 'NotAllowedError') setBioError('Acceso biométrico cancelado');
      else setBioError(e?.message || 'No se pudo entrar con el acceso biométrico');
    } finally {
      setBioLoading(false);
    }
  };

  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  const handleAdminLogin = async () => {
    if (!adminPassword.trim()) return;
    setAdminLoading(true);
    setAdminError('');

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });

      if (res.ok) {
        // La cookie httpOnly la pone el servidor; aquí sólo se guarda el token
        // que supabase-js necesita mandar en cada petición.
        const { token } = await res.json();
        setAccessToken(token);
        router.push('/admin');
      } else {
        const data = await res.json();
        setAdminError(data.error || 'Contraseña incorrecta');
      }
    } catch {
      setAdminError('Error de conexión');
    } finally {
      setAdminLoading(false);
    }
  };

  const steps = step === 'scan' || step === 'waiter' ? QR_STEPS : MANUAL_STEPS;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--c-bg)] px-4 py-8">
      <div className="w-full max-w-[440px]">

        {/* ---------------- Marca ---------------- */}
        <div className="animate-fade-in mb-6 flex flex-col items-center text-center">
          <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-elche-accent to-elche-primary shadow-[var(--sh-logo)]">
            <span className="ms text-[30px] text-white">stadium</span>
          </div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--c-text)]">
            Stock Cantinas
          </h1>
          <p className="mt-1 text-[12.5px] font-semibold text-[var(--c-text-muted)]">
            {mode === 'cantina' ? 'Elche CF · Acceso a cantina' : 'Elche CF · Administración'}
          </p>
        </div>

        {/* ---------------- Tarjeta ---------------- */}
        <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--c-border)] bg-[var(--c-surface)]">

          {mode === 'cantina' ? (
            <>
              {/* Pasos */}
              <div className="flex items-center justify-center gap-2 border-b border-[var(--c-divider)] bg-[var(--c-surface-alt)] px-5 py-3">
                {steps.map((s, i) => {
                  const active = s.key === step;
                  const done = steps.findIndex(x => x.key === step) > i;
                  return (
                    <div key={s.key} className="flex items-center gap-2">
                      {i > 0 && <span className="ms text-base text-[var(--c-text-faint)]">chevron_right</span>}
                      <span
                        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                          active
                            ? 'text-[var(--c-primary)]'
                            : done
                              ? 'text-[var(--c-text-2)]'
                              : 'text-[var(--c-text-faint)]'
                        }`}
                      >
                        <span
                          className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-extrabold ${
                            active
                              ? 'bg-[var(--c-primary)] text-white'
                              : done
                                ? 'bg-[var(--c-ok-bg)] text-[var(--c-ok)]'
                                : 'bg-[var(--c-divider)] text-[var(--c-text-faint)]'
                          }`}
                        >
                          {done ? <span className="ms text-[12px]">check</span> : i + 1}
                        </span>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="p-5">
                {error && <ErrorBanner message={error} />}

                {step === 'scan' && (
                  <ScanStep loading={loading} onScan={handleCantinaQr} onManualFlow={startManualFlow} />
                )}

                {step === 'waiter' && pendingAccess && (
                  <WaiterStep
                    access={pendingAccess}
                    loading={loading}
                    onIdentify={handleWaiterIdentify}
                    onBack={goBack}
                    waiters={DEV_EASY_LOGIN ? activeWaiters : undefined}
                    onSelectWaiter={loginAsWaiter}
                  />
                )}

                {step === 'event' && (
                  <>
                    <EventSelector events={events} onSelect={selectEvent} />
                    {!DEV_EASY_LOGIN && (
                      <button
                        onClick={goBack}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--r-btn)] border border-[var(--c-border)] bg-[var(--c-bg)] py-2.5 text-[13px] font-bold text-[var(--c-text-2)] transition-colors hover:bg-[#eef6f1]"
                      >
                        <span className="ms text-lg">photo_camera</span>
                        Volver al escáner QR
                      </button>
                    )}
                  </>
                )}

                {step === 'cantina' && (
                  <CantinaSelector
                    cantinas={cantinas}
                    selectedEvent={selectedEvent}
                    onSelect={selectCantina}
                    onBack={goBack}
                  />
                )}

                {step === 'pin' && (
                  <PinInput
                    selectedEvent={selectedEvent}
                    selectedCantina={selectedCantina}
                    pin={pin}
                    loading={loading}
                    onPinChange={setPin}
                    onLogin={login}
                    onBack={goBack}
                  />
                )}
              </div>
            </>
          ) : (
            /* ---------------- Administración ---------------- */
            <div className="animate-fade-in p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="ms rounded-[var(--r-btn)] bg-[var(--c-primary-tint)] p-2.5 text-[22px] text-[var(--c-primary)]">
                  shield_person
                </span>
                <div>
                  <h2 className="m-0 text-[15px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
                    Panel de administración
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-[var(--c-text-muted)]">
                    Introduce la contraseña de administrador
                  </p>
                </div>
              </div>

              {adminError && <ErrorBanner message={adminError} />}

              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
                Contraseña
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                placeholder="••••••••"
                autoFocus
                className="w-full rounded-[10px] border border-[var(--c-border-input)] bg-[var(--c-surface-sub)] px-3 py-3 text-center text-[15px] font-bold tracking-[0.2em] text-[var(--c-text)] outline-none transition-colors placeholder:tracking-normal placeholder:text-[var(--c-placeholder)] focus:border-[var(--c-primary)] focus:bg-white"
              />

              <button
                onClick={handleAdminLogin}
                disabled={adminLoading || !adminPassword.trim()}
                className={`mt-3.5 flex w-full items-center justify-center gap-2 rounded-[var(--r-btn)] py-3.5 text-[14px] font-bold text-white transition-transform ${
                  adminLoading || !adminPassword.trim()
                    ? 'cursor-not-allowed bg-[#b9c9c0]'
                    : 'bg-[var(--c-primary)] shadow-[var(--sh-btn)] hover:bg-[var(--c-primary-hover)] active:translate-y-px'
                }`}
              >
                <span className={`ms text-xl ${adminLoading ? 'animate-spin' : ''}`}>
                  {adminLoading ? 'progress_activity' : 'login'}
                </span>
                {adminLoading ? 'Verificando…' : 'Acceder'}
              </button>

              <button
                onClick={() => { setMode('cantina'); setAdminError(''); setAdminPassword(''); }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold text-[var(--c-text-muted)] transition-colors hover:text-[var(--c-primary)]"
              >
                <span className="ms text-lg">arrow_back</span>
                Volver al acceso de cantina
              </button>
            </div>
          )}
        </div>

        {/* ---------------- Pie ---------------- */}
        <div className="mt-5 flex flex-col items-center gap-2.5">
          {biometriaDisponible && (
            <>
              <button
                onClick={handleBiometria}
                disabled={bioLoading}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--r-btn)] border border-[var(--c-primary)] bg-[var(--c-primary)] px-4 py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <span className="ms text-[19px]">fingerprint</span>
                {bioLoading ? 'Comprobando…' : 'Entrar con Face ID o huella'}
              </button>
              {bioError && (
                <p className="text-center text-[11.5px] font-semibold text-[var(--c-danger,#c0392b)]">
                  {bioError}
                </p>
              )}
            </>
          )}
          {mode === 'cantina' && (
            <button
              onClick={() => { setMode('admin'); setAdminError(''); }}
              className="flex items-center gap-1.5 rounded-[var(--r-btn)] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2.5 text-[12.5px] font-bold text-[var(--c-text-2)] transition-colors hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"
            >
              <span className="ms text-lg">shield_person</span>
              Acceso administración
            </button>
          )}
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--c-text-muted)]">
            <span className="ms text-[15px]">help</span>
            ¿Problemas de acceso? Contacta con administración
          </p>
        </div>
      </div>
    </div>
  );
}

/** Aviso de error, con los semánticos de design.md §6. */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="animate-fade-in mb-4 flex items-start gap-2.5 rounded-[12px] border border-[var(--c-crit-bd)] bg-[var(--c-crit-bg)] px-3.5 py-3">
      <span className="ms shrink-0 text-xl text-[var(--c-crit)]">error</span>
      <span className="text-[12.5px] font-semibold leading-[1.4] text-[var(--c-crit)] [text-wrap:pretty]">
        {message}
      </span>
    </div>
  );
}
