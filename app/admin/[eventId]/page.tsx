'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

// Componentes UI
import AdminHeader from '../components/AdminHeader';
import EventDashboardTab from '../components/EventDashboardTab';
import EventGeneralTab from '../components/EventGeneralTab';
import EventCantinasHub from '../components/EventCantinasHub';
import EventCatalogTab from '../components/EventCatalogTab';
import WaiterPerformanceTable from '../components/WaiterPerformanceTable';
import EventGlobalTab from '../components/EventGlobalTab';

// Hooks de Lógica
import { useAdminEvent } from '../hooks/useAdminEvent';
import { useAdminCantinas } from '../hooks/useAdminCantinas';
import { useAdminCatalog } from '../hooks/useAdminCatalog';
import { useAdminGuard } from '../hooks/useAdminGuard';

type TabKey = 'dashboard' | 'general' | 'cantinas' | 'personal' | 'catalogo' | 'global';

const TAB_LABEL: Record<TabKey, string> = {
  dashboard: '📊 Dashboard',
  general: '⚙️ General',
  cantinas: '🏪 Cantinas',
  personal: '👥 Personal',
  catalogo: '🛍️ Catálogo',
  global: '🌍 Global',
};

export default function EventAdminPage() {
  const checked = useAdminGuard();
  const params = useParams();
  const eventId = (params as { eventId: string }).eventId;

  const [tab, setTab] = useState<TabKey>('dashboard');

  const eventLogic = useAdminEvent(eventId);
  const cantinasLogic = useAdminCantinas(eventId); // usado por la vista Global
  const catalogLogic = useAdminCatalog(eventId);

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

  const tabs = Object.keys(TAB_LABEL) as TabKey[];

  return (
    <div className="min-h-screen bg-elche-bg pb-24 md:pb-0">

      {/* Header y Navegación */}
      <AdminHeader
        title={eventLogic.eventName || 'Administración de Evento'}
        subtitle={eventLogic.eventDate ? new Date(eventLogic.eventDate).toLocaleDateString() : 'Cargando...'}
        showBack={true}
        backUrl="/admin"
        eventId={eventId}
      >
        <nav className="flex gap-1">
          {tabs.map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-xl text-sm transition-all whitespace-nowrap ${tab === key
                ? 'bg-white text-elche-primary font-bold shadow-sm'
                : 'bg-transparent text-white/80 font-medium hover:bg-white/10 hover:text-white'
                }`}
            >
              {TAB_LABEL[key]}
            </button>
          ))}
        </nav>
      </AdminHeader>

      {/* Navegación Móvil (Scroll horizontal sticky) */}
      <div className="md:hidden sticky top-0 z-40 bg-elche-bg/95 backdrop-blur-sm border-b border-elche-gray/50 overflow-x-auto">
        <div className="flex p-2 gap-2 min-w-max">
          {tabs.map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-full text-sm transition-all border ${tab === key
                ? 'bg-elche-primary text-white border-elche-primary font-bold shadow-md'
                : 'bg-white text-elche-muted border-gray-200 font-medium'
                }`}
            >
              {TAB_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-4 md:p-8 animate-fade-in">

        {tab === 'dashboard' && (
          <EventDashboardTab eventId={eventId} eventName={eventLogic.eventName} />
        )}

        {tab === 'general' && (
          <EventGeneralTab
            eventName={eventLogic.eventName}
            setEventName={eventLogic.setEventName}
            eventDate={eventLogic.eventDate}
            setEventDate={eventLogic.setEventDate}
            onSave={eventLogic.saveEvent}
          />
        )}

        {tab === 'cantinas' && (
          <EventCantinasHub eventId={eventId} />
        )}

        {tab === 'personal' && (
          <WaiterPerformanceTable eventId={eventId} />
        )}

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

      </main>
    </div>
  );
}
