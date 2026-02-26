'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

// Componentes UI
import AdminHeader from '../components/AdminHeader';
import EventGeneralTab from '../components/EventGeneralTab';
import EventCantinasTab from '../components/EventCantinasTab';
import EventCatalogTab from '../components/EventCatalogTab';
import EventInventoryTab from '../components/EventInventoryTab';
import EventPanelTab from '../components/EventPanelTab';
import EventGlobalTab from '../components/EventGlobalTab';

// Hooks de Lógica
import { useAdminEvent } from '../hooks/useAdminEvent';
import { useAdminCantinas } from '../hooks/useAdminCantinas';
import { useAdminCatalog } from '../hooks/useAdminCatalog';
import { useAdminInventory } from '../hooks/useAdminInventory';
import { useAdminMetrics } from '../hooks/useAdminMetrics';
import { useAdminGuard } from '../hooks/useAdminGuard';

type TabKey = 'general' | 'cantinas' | 'catalogo' | 'inventario' | 'panel' | 'global';

export default function EventAdminPage() {
  const checked = useAdminGuard();
  const params = useParams();
  const eventId = (params as { eventId: string }).eventId;

  // Estado de Navegación
  const [tab, setTab] = useState<TabKey>('general');

  // --- Hooks de Lógica ---

  // 1. General del Evento
  const eventLogic = useAdminEvent(eventId);

  // 2. Cantinas
  const cantinasLogic = useAdminCantinas(eventId);

  // 3. Catálogo de Productos
  const catalogLogic = useAdminCatalog(eventId);

  // 4. Inventario (requiere cantina seleccionada)
  const [inventoryCantinaId, setInventoryCantinaId] = useState<string>('');
  const inventoryLogic = useAdminInventory(eventId, inventoryCantinaId, catalogLogic.eventProducts);

  // 5. Métricas / Panel
  const metricsLogic = useAdminMetrics(eventId, cantinasLogic.cantinas.filter(c => c.assigned));

  // Manejadores de UI auxiliares
  const handleTabChange = (newTab: TabKey) => {
    setTab(newTab);
    // Al entrar al panel, asegurar que tenemos datos frescos si hay cantina seleccionada
    if (newTab === 'panel' && metricsLogic.panelCantinaId) {
      metricsLogic.fetchPanelData(metricsLogic.panelCantinaId);
    }
  };

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
          {(['general', 'cantinas', 'catalogo', 'inventario', 'panel', 'global'] as TabKey[]).map(key => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`px-4 py-2 rounded-xl text-sm transition-all whitespace-nowrap ${tab === key
                ? 'bg-white text-elche-primary font-bold shadow-sm'
                : 'bg-transparent text-white/80 font-medium hover:bg-white/10 hover:text-white'
                }`}
            >
              {key === 'general' && '⚙️ General'}
              {key === 'cantinas' && '🏪 Cantinas'}
              {key === 'catalogo' && '🛍️ Catálogo'}
              {key === 'inventario' && '📦 Inventario'}
              {key === 'panel' && '📈 Panel'}
              {key === 'global' && '🌍 Global'}
            </button>
          ))}
        </nav>
      </AdminHeader>

      {/* Navegación Móvil (Scroll horizontal sticky) */}
      <div className="md:hidden sticky top-0 z-40 bg-elche-bg/95 backdrop-blur-sm border-b border-elche-gray/50 overflow-x-auto">
        <div className="flex p-2 gap-2 min-w-max">
          {(['general', 'cantinas', 'catalogo', 'inventario', 'panel', 'global'] as TabKey[]).map(key => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`px-4 py-2 rounded-full text-sm transition-all border ${tab === key
                ? 'bg-elche-primary text-white border-elche-primary font-bold shadow-md'
                : 'bg-white text-elche-muted border-gray-200 font-medium'
                }`}
            >
              {key === 'general' && '⚙️ General'}
              {key === 'cantinas' && '🏪 Cantinas'}
              {key === 'catalogo' && '🛍️ Catálogo'}
              {key === 'inventario' && '📦 Inventario'}
              {key === 'panel' && '📈 Panel'}
              {key === 'global' && '🌍 Global'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-4 md:p-8 animate-fade-in">

        {/* Renderizado Condicional de Tabs */}

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
          <EventCantinasTab
            cantinas={cantinasLogic.cantinas}
            loading={cantinasLogic.loading}
            onToggle={cantinasLogic.toggleCantina}
            onCreate={cantinasLogic.createCantina}
          />
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

        {tab === 'inventario' && (
          <EventInventoryTab
            cantinas={cantinasLogic.cantinas} // Pasamos todas, el componente filtra las asignadas
            selectedCantinaId={inventoryCantinaId}
            setSelectedCantinaId={setInventoryCantinaId}
            loading={inventoryLogic.loading}
            inventory={inventoryLogic.inventory}
            products={catalogLogic.eventProducts}
            eventId={eventId}

            adjustForm={inventoryLogic.adjustForm}
            setAdjustForm={inventoryLogic.setAdjustForm}
            adjustType={inventoryLogic.adjustType}
            setAdjustType={inventoryLogic.setAdjustType}
            adjustReason={inventoryLogic.adjustReason}
            setAdjustReason={inventoryLogic.setAdjustReason}
            onApplyAdjust={inventoryLogic.applyAdjustments}

            finalForm={inventoryLogic.finalForm}
            setFinalForm={inventoryLogic.setFinalForm}
            onSaveFinal={inventoryLogic.saveFinalInventory}

            onRefresh={inventoryLogic.fetchInventoryData}
          />
        )}

        {tab === 'panel' && (
          <EventPanelTab
            cantinas={cantinasLogic.cantinas}
            panelCantinaId={metricsLogic.panelCantinaId}
            setPanelCantinaId={metricsLogic.setPanelCantinaId}
            panelTotals={metricsLogic.panelTotals}
            panelRows={metricsLogic.panelRows}
            salesHistory={metricsLogic.salesHistory}
            onRefresh={() => metricsLogic.panelCantinaId && metricsLogic.fetchPanelData(metricsLogic.panelCantinaId)}
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
