'use client';

import React, { useEffect } from 'react';

export type PosTab = 'venta' | 'stock' | 'historial';

interface PosSection {
  id: PosTab;
  label: string;
  icon: string;
  desc: string;
}

const SECTIONS: PosSection[] = [
  { id: 'venta', label: 'Venta', icon: 'sell', desc: 'Grid de productos y cobro' },
  { id: 'stock', label: 'Stock', icon: 'inventory_2', desc: 'Existencias y reposición' },
  { id: 'historial', label: 'Historial', icon: 'receipt_long', desc: 'Tickets del día' },
];

interface PosShellProps {
  cantinaName: string;
  eventName: string;
  waiterName: string;
  tab: PosTab;
  onTabChange: (tab: PosTab) => void;
  /** Abre el formulario de reporte de incidencia (acción sin contador). */
  onReportIncident?: () => void;
  /** Ventas encoladas sin subir (modo offline). */
  pendingUploads?: number;
  /** Estado del canal de tiempo real; 'disconnected' muestra el aviso en cabecera. */
  realtimeStatus?: 'connecting' | 'connected' | 'disconnected';
  onSync?: () => void;
  onRefresh?: () => void;
  onLogout: () => void;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Armazón del POS (design.md §5 · README "POS — shell"):
 * cabecera verde con identidad + acciones, contenido por pestaña y
 * cajón lateral derecho para cambiar de sección.
 */
export default function PosShell({
  cantinaName,
  eventName,
  waiterName,
  tab,
  onTabChange,
  onReportIncident,
  pendingUploads = 0,
  realtimeStatus = 'connecting',
  onSync,
  onRefresh,
  onLogout,
  drawerOpen,
  onDrawerOpenChange,
  children,
}: PosShellProps) {
  const initial = (waiterName || 'C').charAt(0).toUpperCase();

  // Cerrar el cajón con Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDrawerOpenChange(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, onDrawerOpenChange]);

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[var(--c-bg)]">
      {/* ================= HEADER ================= */}
      <header
        className="relative z-20 flex-none px-4 pb-2.5 pt-[calc(10px+env(safe-area-inset-top))] shadow-[0_6px_18px_-8px_rgba(0,80,42,.55)]"
        style={{ background: 'var(--pos-header)' }}
      >
        <div className="flex items-start gap-2.5">
          <div className="relative min-w-0 flex-1">
            <h1 className="m-0 truncate text-xl font-extrabold tracking-[-0.02em] text-white">
              {cantinaName}
            </h1>
            <span className="mt-1.5 inline-flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-[var(--pos-header-solid)]">
                {initial}
              </span>
              <span className="truncate text-[11.5px] font-bold text-white">{waiterName || 'Camarero'}</span>
            </span>
          </div>

          <div className="flex flex-none items-center gap-1.5">
            {/* Conexión en tiempo real caída.
                Hasta ahora la degradación era silenciosa: el TPV seguía mostrando
                el stock de la última sincronización sin avisar, y en una barra eso
                significa vender contra existencias que ya no son las reales. */}
            {realtimeStatus === 'disconnected' && (
              <span
                title="Sin conexión en tiempo real: el stock mostrado puede no estar actualizado"
                aria-label="Sin conexión en tiempo real"
                className="flex h-11 items-center gap-1.5 rounded-[var(--r-btn)] bg-[var(--pos-alert-badge)] px-3 text-[var(--pos-header-solid)]"
              >
                <span className="ms text-[19px]">cloud_off</span>
                <span className="hidden text-[13px] font-extrabold sm:inline">Sin conexión</span>
              </span>
            )}

            {/* Ventas pendientes de subir (offline) */}
            {pendingUploads > 0 && (
              <button
                onClick={onSync}
                title={`${pendingUploads} ventas pendientes de subir`}
                className="flex h-11 items-center gap-1.5 rounded-[var(--r-btn)] border-none bg-[var(--pos-alert-badge)] px-3 text-[var(--pos-header-solid)] transition-transform active:scale-95"
              >
                <span className="ms text-[19px]">cloud_upload</span>
                <span className="text-[13px] font-extrabold">{pendingUploads}</span>
              </button>
            )}

            {/* Reportar una incidencia al administrador. Es una acción, no un
                indicador: no lleva contador. */}
            {onReportIncident && (
              <button
                onClick={onReportIncident}
                title="Reportar incidencia"
                aria-label="Reportar incidencia"
                className="flex h-11 w-11 items-center justify-center rounded-[var(--r-btn)] border-none bg-white/[0.16] transition-colors active:bg-white/[0.28]"
              >
                <span className="ms text-[22px]" style={{ color: 'var(--pos-alert-icon)' }}>warning</span>
              </button>
            )}

            <button
              onClick={() => onDrawerOpenChange(true)}
              title="Menú"
              aria-label="Abrir menú"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-[var(--r-btn)] border-none bg-white/[0.16] text-white transition-colors active:bg-white/[0.28]"
            >
              <span className="ms text-[23px]">menu</span>
            </button>
          </div>
        </div>

        <div className="mt-0.5 truncate text-[12.5px] font-semibold text-white/[0.82]">{eventName}</div>
      </header>

      {/* ================= CONTENIDO ================= */}
      {children}

      {/* ================= CAJÓN LATERAL ================= */}
      {drawerOpen && (
        <>
          <div
            onClick={() => onDrawerOpenChange(false)}
            className="animate-overlay absolute inset-0 z-30 bg-[rgba(10,30,20,.45)]"
            aria-hidden
          />
          <div
            role="dialog"
            aria-label="Menú del terminal"
            className="animate-drawerin absolute bottom-0 right-0 top-0 z-40 flex w-[76%] max-w-[300px] flex-col bg-[var(--c-bg)] shadow-[-12px_0_40px_rgba(10,30,20,.28)]"
          >
            {/* Perfil */}
            <div
              className="flex-none px-[18px] pb-4 pt-[calc(14px+env(safe-area-inset-top))]"
              style={{ background: 'var(--pos-header)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-white text-base font-extrabold text-[var(--pos-header-solid)]">
                    {initial}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-extrabold text-white">{waiterName || 'Camarero'}</div>
                    <div className="truncate text-[11.5px] font-semibold text-white/[0.82]">
                      {cantinaName} · {eventName}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onDrawerOpenChange(false)}
                  title="Cerrar"
                  aria-label="Cerrar menú"
                  className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] border-none bg-white/[0.18] text-white transition-colors active:bg-white/30"
                >
                  <span className="ms text-xl">close</span>
                </button>
              </div>
            </div>

            {/* Secciones */}
            <div className="noscroll flex-1 overflow-y-auto px-3 py-3.5">
              <div className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
                Secciones
              </div>
              <div className="flex flex-col gap-1">
                {SECTIONS.map(s => {
                  const on = s.id === tab;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { onTabChange(s.id); onDrawerOpenChange(false); }}
                      className={`flex w-full items-center gap-3 rounded-[13px] border-none px-3.5 py-3 text-left transition-colors ${
                        on ? 'bg-[var(--c-primary-tint)]' : 'bg-transparent active:bg-black/[0.04]'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 flex-none items-center justify-center rounded-[var(--r-btn)] ${
                          on ? 'bg-[var(--c-primary)] text-white' : 'bg-[#eef4f1] text-[var(--c-text-2)]'
                        }`}
                      >
                        <span className="ms text-[22px]">{s.icon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[14.5px] font-extrabold tracking-[-0.01em] ${
                            on ? 'text-[var(--c-primary)]' : 'text-[var(--c-text)]'
                          }`}
                        >
                          {s.label}
                        </span>
                        <span className="mt-px block text-[11.5px] font-semibold text-[var(--c-text-muted)]">
                          {s.desc}
                        </span>
                      </span>
                      {on && <span className="ms text-xl text-[var(--c-primary)]">check_circle</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pie */}
            <div className="flex flex-none flex-col gap-1.5 border-t border-[#e6efea] px-3 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
              <button
                onClick={() => { onRefresh?.(); onDrawerOpenChange(false); }}
                className="flex w-full items-center gap-3 rounded-[13px] border-none bg-[var(--c-surface)] px-3.5 py-3 text-left transition-colors active:bg-[#eef6f1]"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[var(--r-btn)] bg-[#eef4f1] text-[var(--c-primary)]">
                  <span className="ms text-[22px]">sync</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-extrabold tracking-[-0.01em] text-[var(--c-text)]">
                    Refrescar datos
                  </span>
                  <span className="mt-px block text-[11.5px] font-semibold text-[var(--c-text-muted)]">
                    Sincronizar stock y ventas
                  </span>
                </span>
              </button>

              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-[13px] border-none bg-[var(--c-surface)] px-3.5 py-3 text-left transition-colors active:bg-[#fdeeee]"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[var(--r-btn)] bg-[#fdeeee] text-[var(--c-crit)]">
                  <span className="ms text-[22px]">logout</span>
                </span>
                <span className="text-[14.5px] font-extrabold tracking-[-0.01em] text-[var(--c-crit)]">
                  Cerrar sesión
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { SECTIONS as POS_SECTIONS };
