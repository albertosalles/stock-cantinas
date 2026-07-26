'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export interface AdminNavItem {
  key: string;
  label: string;
  icon: string;
}

export type EventStatus = 'live' | 'draft' | 'closed';

export const STATUS_META: Record<EventStatus, { label: string; fg: string; bg: string; strip: string }> = {
  live: { label: 'Live', fg: '#00964f', bg: 'rgba(0,150,79,.10)', strip: 'linear-gradient(90deg,#00964f,#20b368)' },
  draft: { label: 'Borrador', fg: '#b0790a', bg: 'rgba(245,158,11,.14)', strip: '#f0d9a8' },
  closed: { label: 'Cerrado', fg: '#6b7d72', bg: 'rgba(107,125,114,.12)', strip: '#d7e2db' },
};

export function statusMeta(status?: string | null) {
  return STATUS_META[(status as EventStatus)] ?? STATUS_META.draft;
}

interface AdminShellProps {
  /** Título principal de la cabecera. */
  title: string;
  subtitle?: string;
  /** Etiqueta de sección sobre la navegación ("Evento" / "General"). */
  navSectionLabel?: string;
  navItems: AdminNavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  /** Botón "Volver a eventos" en la barra lateral. */
  backHref?: string;
  backLabel?: string;
  /** Estado del evento: pinta el badge junto al título. */
  status?: string | null;
  /** Acciones a la derecha de la cabecera (refrescar, campanas…). */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

const COLLAPSE_KEY = 'admin-sidebar-collapsed';

export default function AdminShell({
  title,
  subtitle,
  navSectionLabel = 'General',
  navItems,
  activeKey,
  onNavigate,
  backHref,
  backLabel = 'Volver a eventos',
  status,
  headerActions,
  children,
}: AdminShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Recordar el estado plegado entre visitas
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  const toggleCollapse = () => {
    setCollapsed(c => {
      const next = !c;
      try { window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* almacenamiento no disponible */ }
      return next;
    });
  };

  const handleNavigate = (key: string) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const meta = statusMeta(status);
  const showStatus = !!status;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-elche-bg">
      {/* Velo para la barra lateral en móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* ---------------- Barra lateral ---------------- */}
      <aside
        className={`sc-scroll fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#0d3a23] to-[#082a1b] transition-transform duration-300 md:static md:translate-x-0 md:transition-[width] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } max-md:w-64 ${collapsed ? 'md:w-[76px]' : 'md:w-64'}`}
      >
        {/* Marca */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 pb-[18px] pt-[22px]">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-elche-accent to-elche-primary shadow-[0_4px_12px_rgba(0,150,79,.35)]">
            <span className="ms text-[22px] text-white">stadium</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="whitespace-nowrap text-sm font-extrabold leading-tight tracking-tight text-white">
                Stock Cantinas
              </div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e9fff0]/50">
                Elche CF · Admin
              </div>
            </div>
          )}
        </div>

        {/* Volver */}
        {backHref && (
          <button
            onClick={() => router.push(backHref)}
            title={backLabel}
            className="mx-[14px] mb-1.5 mt-3.5 flex w-[calc(100%-28px)] items-center gap-2.5 rounded-[11px] border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-[12.5px] font-semibold text-[#e9fff0]/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <span className="ms shrink-0 text-lg">arrow_back</span>
            {!collapsed && <span className="truncate">{backLabel}</span>}
          </button>
        )}

        {!collapsed && (
          <div className="px-[22px] pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#e9fff0]/40">
            {navSectionLabel}
          </div>
        )}

        {/* Navegación */}
        <nav className="flex flex-1 flex-col gap-[3px] px-3 py-1">
          {navItems.map(item => {
            const active = item.key === activeKey;
            return (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.key)}
                title={item.label}
                className={`flex w-full items-center rounded-[11px] px-[13px] py-2.5 text-left text-[13.5px] font-semibold transition-colors ${
                  collapsed ? 'justify-center gap-0' : 'gap-[13px]'
                } ${
                  active
                    ? 'bg-[#20b368]/[0.16] text-[#eafff3] shadow-[inset_3px_0_0_#4be08f]'
                    : 'bg-transparent text-[#e9fff0]/[0.62] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span
                  className={`ms shrink-0 text-[21px] ${active ? 'ms-fill text-[#4be08f]' : 'text-[#e9fff0]/50'}`}
                >
                  {item.icon}
                </span>
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Pie */}
        <div className="flex flex-col gap-[3px] border-t border-white/[0.07] p-3">
          <button
            onClick={toggleCollapse}
            className="hidden items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[#e9fff0]/[0.55] transition-colors hover:bg-white/[0.06] hover:text-white md:flex"
          >
            <span className="ms shrink-0 text-xl">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
            {!collapsed && <span className="whitespace-nowrap">Colapsar</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[#e9fff0]/[0.55] transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <span className="ms shrink-0 text-xl">logout</span>
            {!collapsed && <span className="whitespace-nowrap">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ---------------- Contenido ---------------- */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[66px] shrink-0 items-center justify-between gap-4 border-b border-elche-gray bg-white px-4 md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-elche-gray bg-elche-bg text-elche-text-light md:hidden"
              title="Menú"
            >
              <span className="ms text-xl">menu</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="truncate text-[17px] font-extrabold tracking-tight text-elche-text md:text-[19px]">
                  {title}
                </h1>
                {showStatus && (
                  <span
                    className="hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide sm:inline-flex"
                    style={{ color: meta.fg, background: meta.bg }}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                    {meta.label}
                  </span>
                )}
              </div>
              {subtitle && (
                <div className="truncate text-[12.5px] font-medium text-elche-text-light">{subtitle}</div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <div className="ml-1 hidden items-center gap-2.5 rounded-3xl border border-elche-gray bg-elche-bg py-[5px] pl-1.5 pr-3 sm:flex">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-elche-accent to-elche-secondary text-xs font-bold text-white">
                AD
              </div>
              <span className="text-[12.5px] font-semibold text-elche-text">Admin</span>
            </div>
          </div>
        </header>

        <div className="sc-scroll flex-1 overflow-y-auto p-4 md:p-7">{children}</div>
      </main>
    </div>
  );
}

/** Botón de acción circular de la cabecera (refrescar, campanas…). */
export function HeaderIconButton({
  icon,
  title,
  onClick,
  badge,
  badgeColor = '#ef4444',
  hoverClass = 'hover:bg-elche-gray hover:text-elche-primary',
  spinning,
}: {
  icon: string;
  title: string;
  onClick?: () => void;
  badge?: number;
  badgeColor?: string;
  hoverClass?: string;
  spinning?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative flex h-10 w-10 items-center justify-center rounded-[11px] border border-elche-gray bg-elche-bg text-elche-text-light transition-colors ${hoverClass}`}
    >
      <span className={`ms text-xl ${spinning ? 'animate-spin' : ''}`}>{icon}</span>
      {!!badge && badge > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] border-2 border-white px-1 text-[10px] font-bold text-white"
          style={{ background: badgeColor }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
