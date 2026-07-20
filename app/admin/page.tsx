'use client';

import AdminHeader from './components/AdminHeader';
import { useAdminEvents } from './hooks/useAdminEvents';
import { useAdminGuard } from './hooks/useAdminGuard';
import { useAdminSeasons } from './hooks/useAdminSeasons';
import { useAdminWaiters } from './hooks/useAdminWaiters';
import CreateEventForm from './components/CreateEventForm';
import EventsList from './components/EventsList';
import SeasonsSection from './components/SeasonsSection';
import WaitersSection from './components/WaitersSection';

export default function AdminHome() {
  const checked = useAdminGuard();
  const { events, loading, createEvent, updateEventStatus } = useAdminEvents();
  const seasonsApi = useAdminSeasons();
  const waitersApi = useAdminWaiters();

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elche-bg">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <div className="text-lg text-slate-600 font-medium">Verificando acceso...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-elche-bg pb-20">
      <AdminHeader />

      <main className="max-w-[1200px] mx-auto p-6 grid gap-8">

        <SeasonsSection
          seasons={seasonsApi.seasons}
          loading={seasonsApi.loading}
          onCreate={seasonsApi.createSeason}
          onActivate={seasonsApi.activateSeason}
          onClose={seasonsApi.closeSeason}
        />

        <CreateEventForm onCreate={createEvent} />

        <section>
          <div className="font-bold text-xl mb-6 text-elche-text flex items-center gap-3">
            <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">📅</span>
            Eventos registrados
          </div>

          <EventsList
            events={events}
            loading={loading}
            onUpdateStatus={updateEventStatus}
          />
        </section>

        <WaitersSection
          waiters={waitersApi.waiters}
          loading={waitersApi.loading}
          onCreate={waitersApi.createWaiter}
          onToggleActive={waitersApi.toggleActive}
        />
      </main>
    </div>
  );
}
