'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

import AdminHeader from '../../../components/AdminHeader';
import EventPanelTab from '../../../components/EventPanelTab';
import EventInventoryTab from '../../../components/EventInventoryTab';
import CantinaIncidentsPanel from '../../../components/CantinaIncidentsPanel';
import CantinaWaitersPanel from '../../../components/CantinaWaitersPanel';
import WaiterPerformanceTable from '../../../components/WaiterPerformanceTable';

import { useAdminGuard } from '../../../hooks/useAdminGuard';
import { useAdminEvent } from '../../../hooks/useAdminEvent';
import { useAdminCatalog } from '../../../hooks/useAdminCatalog';
import { useAdminInventory } from '../../../hooks/useAdminInventory';
import { useAdminMetrics } from '../../../hooks/useAdminMetrics';

export default function CantinaDetailPage() {
  const checked = useAdminGuard();
  const params = useParams() as { eventId: string; cantinaId: string };
  const { eventId, cantinaId } = params;

  const [cantinaName, setCantinaName] = useState('Cantina');
  const event = useAdminEvent(eventId);
  const catalog = useAdminCatalog(eventId);
  const inventory = useAdminInventory(eventId, cantinaId, catalog.eventProducts);
  const metrics = useAdminMetrics(eventId, [{ id: cantinaId }]);

  // Cargar nombre + fijar la cantina seleccionada para el panel de métricas
  useEffect(() => {
    supabase.from('cantinas').select('name').eq('id', cantinaId).single()
      .then(({ data }) => data?.name && setCantinaName(data.name));
  }, [cantinaId]);

  useEffect(() => {
    metrics.setPanelCantinaId(cantinaId);
  }, [cantinaId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elche-bg">
        <div className="text-center"><div className="text-5xl mb-4 animate-pulse">⏳</div>
          <div className="text-lg text-slate-600 font-medium">Verificando acceso...</div></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-elche-bg pb-24">
      <AdminHeader
        title={cantinaName}
        subtitle={event.eventName || 'Evento'}
        showBack
        backUrl={`/admin/${eventId}`}
        eventId={eventId}
      />

      <main className="max-w-[1600px] mx-auto p-4 md:p-8 grid gap-8">
        <Link href={`/admin/${eventId}`} className="text-sm font-bold text-elche-primary hover:underline w-fit">
          ← Volver a cantinas
        </Link>
        

        {/* Métricas + historial de la cantina */}
        <EventPanelTab
          cantinas={[{ id: cantinaId, name: cantinaName, assigned: true }]}
          panelCantinaId={metrics.panelCantinaId}
          setPanelCantinaId={metrics.setPanelCantinaId}
          panelTotals={metrics.panelTotals}
          panelRows={metrics.panelRows}
          salesHistory={metrics.salesHistory}
          onRefresh={() => metrics.fetchPanelData(cantinaId)}
        />

        {/* Incidencias pendientes de la cantina */}
        <CantinaIncidentsPanel eventId={eventId} cantinaId={cantinaId} />

        {/* Asignar camareros */}
        <CantinaWaitersPanel eventId={eventId} cantinaId={cantinaId} />

        {/* Rendimiento de los camareros en esta cantina */}
        <WaiterPerformanceTable eventId={eventId} cantinaId={cantinaId} compact />

        {/* Modificar inventario */}
        <EventInventoryTab
          cantinas={[{ id: cantinaId, name: cantinaName, assigned: true }]}
          selectedCantinaId={cantinaId}
          setSelectedCantinaId={() => {}}
          loading={inventory.loading}
          inventory={inventory.inventory}
          products={catalog.eventProducts}
          eventId={eventId}
          adjustForm={inventory.adjustForm}
          setAdjustForm={inventory.setAdjustForm}
          adjustType={inventory.adjustType}
          setAdjustType={inventory.setAdjustType}
          adjustReason={inventory.adjustReason}
          setAdjustReason={inventory.setAdjustReason}
          onApplyAdjust={inventory.applyAdjustments}
          finalForm={inventory.finalForm}
          setFinalForm={inventory.setFinalForm}
          onSaveFinal={inventory.saveFinalInventory}
          onRefresh={inventory.fetchInventoryData}
          hideSelector
        />
      </main>
    </div>
  );
}
