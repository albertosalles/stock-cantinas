'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { supabase } from '@/lib/supabaseClient';

import AdminShell, { AdminNavItem, HeaderIconButton } from '../../../components/AdminShell';
import EventInventoryTab from '../../../components/EventInventoryTab';
import CantinaIncidentsPanel from '../../../components/CantinaIncidentsPanel';
import CantinaWaitersPanel from '../../../components/CantinaWaitersPanel';
import SalesHeatmap from '../../../components/SalesHeatmap';
import { useSalesBySlot, type Tramo } from '../../../hooks/useSalesBySlot';
import CantinaSalesHistory from '../../../components/CantinaSalesHistory';
import IncidentsBell from '../../../components/IncidentsBell';
import NotificationBell from '../../../components/NotificationBell';

import { useAdminGuard } from '../../../hooks/useAdminGuard';
import { useAdminEvent } from '../../../hooks/useAdminEvent';
import { useAdminCatalog } from '../../../hooks/useAdminCatalog';
import { useAdminInventory } from '../../../hooks/useAdminInventory';
import { useAdminMetrics } from '../../../hooks/useAdminMetrics';
import { useIncidents } from '../../../hooks/useIncidents';
import { useCantinaWaiters } from '../../../hooks/useCantinaWaiters';
import { CANTINA_QR_PREFIX } from '@/lib/waiters';
import { cantinaIcon, cantinaIconBg, eur } from '@/lib/adminUi';

const NAV: AdminNavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'cantinas', label: 'Cantinas', icon: 'storefront' },
  { key: 'personal', label: 'Personal', icon: 'groups' },
  { key: 'catalogo', label: 'Catálogo', icon: 'inventory_2' },
  { key: 'global', label: 'Global', icon: 'public' },
  { key: 'general', label: 'General', icon: 'settings' },
];

export default function CantinaDetailPage() {
  const checked = useAdminGuard();
  const router = useRouter();
  const params = useParams() as { eventId: string; cantinaId: string };
  const { eventId, cantinaId } = params;

  const [tramo, setTramo] = useState<Tramo>(15);
  const { slots, sinKickoff, loading: cargandoSlots } = useSalesBySlot(eventId, tramo, cantinaId);

  const [cantinaName, setCantinaName] = useState('Cantina');
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const event = useAdminEvent(eventId);
  const catalog = useAdminCatalog(eventId);
  const inventory = useAdminInventory(eventId, cantinaId, catalog.eventProducts);
  const cantinaList = useMemo(() => [{ id: cantinaId }], [cantinaId]);
  const metrics = useAdminMetrics(eventId, cantinaList);
  const { incidents } = useIncidents(eventId);
  const { waiters } = useCantinaWaiters(eventId, cantinaId);

  // Nombre + token QR de la cantina
  useEffect(() => {
    supabase.from('cantinas').select('name, qr_token').eq('id', cantinaId).single()
      .then(({ data }) => {
        if (!data) return;
        setCantinaName(data.name);
        setQrToken((data as any).qr_token ?? null);
      });
  }, [cantinaId]);

  useEffect(() => {
    metrics.setPanelCantinaId(cantinaId);
  }, [cantinaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingIncidents = incidents.filter(i => i.cantinaId === cantinaId).length;
  const staffHere = waiters.filter(w => w.here).length;
  const totals = metrics.panelTotals;
  const avgTicket = totals.num_sales > 0 ? totals.total_cents / totals.num_sales : 0;
  const open = staffHere > 0;

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

  const refreshAll = () => {
    metrics.fetchPanelData(cantinaId);
    inventory.fetchInventoryData();
  };

  return (
    <AdminShell
      title={event.eventName || 'Evento'}
      subtitle={`Cantina · ${cantinaName}`}
      navSectionLabel="Evento"
      navItems={NAV}
      activeKey="cantinas"
      onNavigate={key => router.push(`/admin/${eventId}?tab=${key}`)}
      backHref="/admin"
      status={event.eventStatus}
      headerActions={
        <>
          <HeaderIconButton icon="refresh" title="Refrescar" onClick={refreshAll} />
          <IncidentsBell eventId={eventId} />
          <NotificationBell eventId={eventId} />
        </>
      }
    >
      <div className="mx-auto max-w-[1440px] animate-fade-in">
        <button
          onClick={() => router.push(`/admin/${eventId}?tab=cantinas`)}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#8aa397] transition-colors hover:text-elche-primary"
        >
          <span className="ms text-lg">arrow_back</span>
          Cantinas
        </button>

        {/* ---------------- Cabecera de la cantina ---------------- */}
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-elche-gray bg-white px-5 py-4">
          <div
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl"
            style={{ background: cantinaIconBg(cantinaId) }}
          >
            <span className="ms text-[27px] text-white">{cantinaIcon(cantinaId)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="m-0 text-[21px] font-extrabold tracking-tight text-elche-text">{cantinaName}</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  open ? 'bg-elche-primary/10 text-elche-primary' : 'bg-[#fff4e5] text-[#b0790a]'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {open ? 'Abierta' : 'En espera'}
              </span>
            </div>
            <div className="mt-0.5 text-[12.5px] font-semibold text-[#8aa397]">
              {event.eventName || 'Evento'}
            </div>
          </div>
          <button
            onClick={() => setShowQr(true)}
            disabled={!qrToken}
            className="flex items-center gap-1.5 rounded-[11px] border border-[#e0efe7] bg-white px-3.5 py-2.5 text-[13px] font-bold text-elche-text-light transition-colors hover:border-elche-primary hover:text-elche-primary disabled:opacity-50"
          >
            <span className="ms text-lg">qr_code_2</span>
            QR
          </button>
        </div>

        {/* ---------------- KPIs ---------------- */}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <DetailKpi icon="payments" label="Recaudación" value={eur(totals.total_cents)} fg="#00964f" bg="rgba(0,150,79,.10)" />
          <DetailKpi icon="receipt_long" label="Tickets" value={totals.num_sales.toLocaleString('es-ES')} fg="#1a2e1f" bg="#eef6f1" />
          <DetailKpi icon="inventory_2" label="Artículos" value={totals.total_items.toLocaleString('es-ES')} fg="#1a2e1f" bg="#eef6f1" />
          <DetailKpi icon="sell" label="Ticket medio" value={eur(avgTicket)} fg="#1a2e1f" bg="#eef6f1" />
          <DetailKpi icon="groups" label="Camareros en turno" value={String(staffHere)} fg="#1a2e1f" bg="#eef6f1" />
          <DetailKpi
            icon={pendingIncidents > 0 ? 'report' : 'verified'}
            label="Incidencias"
            value={String(pendingIncidents)}
            fg={pendingIncidents > 0 ? '#d63838' : '#00964f'}
            bg={pendingIncidents > 0 ? 'rgba(239,68,68,.10)' : 'rgba(0,150,79,.10)'}
          />
        </div>

        {/* ---------------- Evolución de la afluencia ----------------
            Va aquí, entre los totales y el detalle operativo, porque cierra la
            lectura del resultado: los KPIs dicen CUÁNTO vendió esta barra y esta
            curva dice CÓMO se repartió. A partir de aquí la página baja al
            trabajo del día (inventario, historial, personal, incidencias). */}
        <div className="mb-4">
          <SalesHeatmap
            titulo="Afluencia en esta cantina"
            slots={slots}
            tramo={tramo}
            onTramoChange={setTramo}
            sinKickoff={sinKickoff}
            loading={cargandoSlots}
            totalReferencia={totals.num_sales}
            onDefinirKickoff={() => router.push(`/admin/${eventId}?tab=general`)}
          />
        </div>

        {/* ---------------- Inventario + paneles ---------------- */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
          <div className="grid gap-4">
            <EventInventoryTab
              eventId={eventId}
              cantinaId={cantinaId}
              loading={inventory.loading}
              inventory={inventory.inventory}
              products={catalog.eventProducts}
              adjustForm={inventory.adjustForm}
              setAdjustForm={inventory.setAdjustForm}
              adjustType={inventory.adjustType}
              setAdjustType={inventory.setAdjustType}
              adjustReason={inventory.adjustReason}
              setAdjustReason={inventory.setAdjustReason}
              finalForm={inventory.finalForm}
              setFinalForm={inventory.setFinalForm}
              onApplyAdjust={inventory.applyAdjustments}
              onSaveFinal={inventory.saveFinalInventory}
              onRefresh={inventory.fetchInventoryData}
            />

            <CantinaSalesHistory
              sales={metrics.salesHistory}
              onRefresh={() => metrics.fetchPanelData(cantinaId)}
            />
          </div>

          <div className="flex flex-col gap-4">
            <CantinaWaitersPanel eventId={eventId} cantinaId={cantinaId} />
            <CantinaIncidentsPanel eventId={eventId} cantinaId={cantinaId} />
          </div>
        </div>
      </div>

      {/* Modal QR */}
      {showQr && qrToken && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowQr(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-1 text-xl font-extrabold text-elche-text">{cantinaName}</div>
            <div className="mb-6 text-xs font-medium text-elche-text-light">
              QR de acceso — los camareros lo escanean para abrir su POS
            </div>
            <div className="inline-block rounded-2xl border-2 border-elche-gray bg-white p-4">
              <QRCode value={`${CANTINA_QR_PREFIX}${qrToken}`} size={200} />
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-[11px] bg-elche-primary py-3 text-sm font-bold text-white transition-colors hover:bg-elche-secondary"
              >
                Imprimir
              </button>
              <button
                onClick={() => setShowQr(false)}
                className="flex-1 rounded-[11px] border border-elche-gray bg-white py-3 text-sm font-bold text-elche-text transition-colors hover:bg-elche-bg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function DetailKpi({ icon, label, value, fg, bg }: {
  icon: string; label: string; value: string; fg: string; bg: string;
}) {
  return (
    <div className="rounded-[15px] border border-elche-gray bg-white px-4 py-4">
      <span className="ms rounded-[11px] p-2 text-xl" style={{ color: fg, background: bg }}>
        {icon}
      </span>
      <div className="mt-3 text-xl font-extrabold tracking-tight" style={{ color: fg }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8aa397]">{label}</div>
    </div>
  );
}
