'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

// Componentes UI
import AdminShell, { AdminNavItem, HeaderIconButton } from '../components/AdminShell';
import EventDashboardTab from '../components/EventDashboardTab';
import EventGeneralTab from '../components/EventGeneralTab';
import EventCantinasHub from '../components/EventCantinasHub';
import EventCatalogTab from '../components/EventCatalogTab';
import EventPersonalTab from '../components/EventPersonalTab';
import EventGlobalTab from '../components/EventGlobalTab';
import IncidentsBell from '../components/IncidentsBell';
import NotificationBell from '../components/NotificationBell';

// Hooks de Lógica
import { useAdminEvent } from '../hooks/useAdminEvent';
import { useAdminCantinas } from '../hooks/useAdminCantinas';
import { useAdminCatalog } from '../hooks/useAdminCatalog';
import { useAdminGuard } from '../hooks/useAdminGuard';

type TabKey = 'dashboard' | 'cantinas' | 'personal' | 'catalogo' | 'global' | 'general';

const NAV: AdminNavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'cantinas', label: 'Cantinas', icon: 'storefront' },
  { key: 'personal', label: 'Personal', icon: 'groups' },
  { key: 'catalogo', label: 'Catálogo', icon: 'inventory_2' },
  { key: 'global', label: 'Global', icon: 'public' },
  { key: 'general', label: 'General', icon: 'settings' },
];

const TAB_KEYS = NAV.map(n => n.key);

export default function EventAdminPage() {
  const checked = useAdminGuard();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const eventId = (params as { eventId: string }).eventId;

  const [tab, setTab] = useState<TabKey>('dashboard');

  // Permite entrar directamente a una pestaña vía ?tab=cantinas
  useEffect(() => {
    const queryTab = searchParams.get('tab') as TabKey;
    if (queryTab && TAB_KEYS.includes(queryTab)) setTab(queryTab);
  }, [searchParams]);

  const eventLogic = useAdminEvent(eventId);
  const cantinasLogic = useAdminCantinas(eventId); // usado por la vista Global
  const catalogLogic = useAdminCatalog(eventId);

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

  /** Refresca todo lo que depende de datos en vivo del evento. */
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['event_dashboard', eventId] });
    queryClient.invalidateQueries({ queryKey: ['cantinas_grid', eventId] });
    queryClient.invalidateQueries({ queryKey: ['sales_by_hour', eventId] });
    queryClient.invalidateQueries({ queryKey: ['waiter_performance'] });
    catalogLogic.fetchCatalog();
  };

  const subtitle = eventLogic.eventDate
    ? new Date(eventLogic.eventDate).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'Sin fecha asignada';

  return (
    <AdminShell
      title={eventLogic.eventName || 'Administración de Evento'}
      subtitle={subtitle}
      navSectionLabel="Evento"
      navItems={NAV}
      activeKey={tab}
      onNavigate={key => setTab(key as TabKey)}
      backHref="/admin"
      status={eventLogic.eventStatus}
      headerActions={
        <>
          <HeaderIconButton icon="refresh" title="Refrescar" onClick={refreshAll} />
          <IncidentsBell eventId={eventId} />
          <NotificationBell eventId={eventId} />
        </>
      }
    >
      {tab === 'dashboard' && <EventDashboardTab eventId={eventId} onIrAGeneral={() => setTab('general')} />}

      {tab === 'cantinas' && <EventCantinasHub eventId={eventId} />}

      {tab === 'personal' && <EventPersonalTab eventId={eventId} />}

      {tab === 'catalogo' && (
        <EventCatalogTab
          eventProducts={catalogLogic.eventProducts}
          allProducts={catalogLogic.allProducts}
          loading={catalogLogic.loading}
          setEventProducts={catalogLogic.setEventProducts}
          onSave={catalogLogic.saveProduct}
          onDelete={catalogLogic.deleteProduct}
          onAdd={catalogLogic.addProduct}
          onCreateGlobal={catalogLogic.createGlobalProduct}
        />
      )}

      {tab === 'global' && (
        <EventGlobalTab
          eventId={eventId}
          eventName={eventLogic.eventName}
          products={catalogLogic.eventProducts}
          cantinas={cantinasLogic.cantinas}
        />
      )}

      {tab === 'general' && (
        <EventGeneralTab
          eventName={eventLogic.eventName}
          setEventName={eventLogic.setEventName}
          eventDate={eventLogic.eventDate}
          setEventDate={eventLogic.setEventDate}
          kickoffAt={eventLogic.kickoffAt}
          setKickoffAt={eventLogic.setKickoffAt}
          onSave={eventLogic.saveEvent}
        />
      )}
    </AdminShell>
  );
}
