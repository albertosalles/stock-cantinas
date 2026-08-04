'use client';

import { useMemo, useState } from 'react';

import AdminShell, { AdminNavItem, HeaderIconButton } from './components/AdminShell';
import { useAdminEvents } from './hooks/useAdminEvents';
import { useAdminGuard } from './hooks/useAdminGuard';
import { useAdminSeasons } from './hooks/useAdminSeasons';
import { useAdminWaiters } from './hooks/useAdminWaiters';
import CreateEventForm from './components/CreateEventForm';
import EventsList from './components/EventsList';
import SeasonsSection from './components/SeasonsSection';
import WaitersSection from './components/WaitersSection';

type LandingTab = 'eventos' | 'temporadas' | 'camareros';

const NAV: AdminNavItem[] = [
  { key: 'eventos', label: 'Eventos', icon: 'sports_soccer' },
  { key: 'temporadas', label: 'Temporadas', icon: 'calendar_month' },
  { key: 'camareros', label: 'Camareros', icon: 'badge' },
];

export default function AdminHome() {
  const checked = useAdminGuard();
  const { events, loading, createEvent, updateEventStatus, fetchEvents } = useAdminEvents();
  const seasonsApi = useAdminSeasons();
  const waitersApi = useAdminWaiters();

  const [tab, setTab] = useState<LandingTab>('eventos');
  const [showCreate, setShowCreate] = useState(false);

  const activeSeason = seasonsApi.seasons.find(s => s.active) ?? null;

  // Nº de eventos por temporada, para las tarjetas de temporada
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      if (e.season_id) counts[e.season_id] = (counts[e.season_id] ?? 0) + 1;
    });
    return counts;
  }, [events]);

  // La pestaña "Eventos" muestra los de la temporada activa. Si esa temporada
  // aún no tiene eventos (o no hay activa), se listan todos para no dejar la vista vacía.
  const { visibleEvents, filteredBySeason } = useMemo(() => {
    if (!activeSeason) return { visibleEvents: events, filteredBySeason: false };
    const inSeason = events.filter(e => e.season_id === activeSeason.id);
    return inSeason.length > 0
      ? { visibleEvents: inSeason, filteredBySeason: true }
      : { visibleEvents: events, filteredBySeason: false };
  }, [events, activeSeason]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-elche-bg">
        <div className="text-center">
          <div className="ms mb-4 animate-pulse text-5xl text-elche-primary">hourglass_top</div>
          <div className="text-lg font-medium text-elche-text-light">Verificando acceso...</div>
        </div>
      </div>
    );
  }

  const subtitle = activeSeason
    ? `${activeSeason.name} · Elche CF`
    : 'Elche CF · Estadio Martínez Valero';

  return (
    <AdminShell
      title="Panel de Administración"
      subtitle={subtitle}
      navSectionLabel="General"
      navItems={NAV}
      activeKey={tab}
      onNavigate={key => setTab(key as LandingTab)}
      headerActions={
        <HeaderIconButton icon="refresh" title="Refrescar" onClick={() => fetchEvents()} spinning={loading} />
      }
    >
      <div className="mx-auto max-w-[1360px]">
        {tab === 'eventos' && (
          <section className="animate-fade-in">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <span className="ms rounded-xl bg-elche-primary/[0.09] p-2.5 text-[22px] text-elche-primary">
                  sports_soccer
                </span>
                <div>
                  <h2 className="m-0 text-[17px] font-extrabold tracking-tight">
                    Eventos{filteredBySeason ? ` · ${activeSeason!.name}` : ''}
                  </h2>
                  <div className="text-xs font-medium text-elche-text-light">
                    {filteredBySeason
                      ? 'Selecciona un evento para gestionarlo'
                      : 'Todos los eventos · selecciona uno para gestionarlo'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCreate(s => !s)}
                className="flex items-center gap-1.5 rounded-[11px] bg-elche-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(0,150,79,.28)] transition-colors hover:bg-elche-secondary"
              >
                <span className="ms text-lg">{showCreate ? 'close' : 'add'}</span>
                {showCreate ? 'Cancelar' : 'Nuevo evento'}
              </button>
            </div>

            {showCreate && (
              <CreateEventForm
                onCreate={createEvent}
                onCancel={() => setShowCreate(false)}
                seasons={seasonsApi.seasons}
                defaultSeasonId={activeSeason?.id}
              />
            )}

            <EventsList events={visibleEvents} loading={loading} onUpdateStatus={updateEventStatus} />
          </section>
        )}

        {tab === 'temporadas' && (
          <SeasonsSection
            seasons={seasonsApi.seasons}
            loading={seasonsApi.loading}
            onCreate={seasonsApi.createSeason}
            onActivate={seasonsApi.activateSeason}
            onClose={seasonsApi.closeSeason}
            eventCounts={eventCounts}
          />
        )}

        {tab === 'camareros' && (
          <WaitersSection
            waiters={waitersApi.waiters}
            loading={waitersApi.loading}
            onCreate={waitersApi.createWaiter}
            onToggleActive={waitersApi.toggleActive}
            onSetPin={waitersApi.cambiarPin}
          />
        )}
      </div>
    </AdminShell>
  );
}
