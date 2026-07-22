'use client';

import React from 'react';
import { useEventDashboard } from '../hooks/useEventDashboard';

interface EventDashboardTabProps {
  eventId: string;
  eventName: string;
}

export default function EventDashboardTab({ eventId, eventName }: EventDashboardTabProps) {
  const { kpis, ranking, loading, refresh } = useEventDashboard(eventId);

  const eur = (cents: number) => (cents / 100).toFixed(2) + ' €';
  const avgTicket = kpis.num_sales > 0 ? kpis.total_cents / kpis.num_sales : 0;
  const maxRank = ranking.length ? ranking[0].totalCents : 0;

  return (
    <section className="grid gap-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="font-bold text-2xl text-elche-text flex items-center gap-3">
          <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">📊</span>
          {eventName || 'Dashboard'}
          <span className="text-xs font-bold uppercase tracking-wide bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded-full animate-pulse">Live</span>
        </div>
        <button
          onClick={() => refresh()}
          className="px-5 py-2.5 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:bg-elche-gray/30 shadow-sm transition-colors">
          🔄 Refrescar
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="💰" label="Recaudación" value={eur(kpis.total_cents)} gradient="from-elche-primary to-elche-secondary" big />
        <KpiCard icon="🎫" label="Tickets" value={String(kpis.num_sales)} gradient="from-elche-accent to-elche-primary" />
        <KpiCard icon="📦" label="Artículos vendidos" value={String(kpis.total_items)} gradient="from-elche-text to-elche-secondary" />
        <KpiCard icon="🧮" label="Ticket medio" value={eur(avgTicket)} gradient="from-elche-secondary to-elche-primary" />
        <KpiCard icon="⭐" label="Producto estrella" value={kpis.star_product ?? '—'} sub={kpis.star_product ? `${kpis.star_units} uds` : undefined} gradient="from-amber-400 to-amber-500" />
        <KpiCard icon="👥" label="Personal activo" value={String(kpis.active_waiters)} sub="en turno" gradient="from-elche-primary to-elche-accent" />
        <KpiCard icon="🏪" label="Cantinas del evento" value={String(kpis.num_cantinas)} sub={`${kpis.active_cantinas} con personal`} gradient="from-elche-secondary to-elche-text" />
      </div>

      {/* Ranking de cantinas por facturación */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
        <div className="font-bold text-lg text-elche-text mb-4 flex items-center gap-2">
          <span>🏆</span> Cantinas por facturación
        </div>
        {loading && ranking.length === 0 ? (
          <div className="py-8 text-center text-elche-text-light">Cargando…</div>
        ) : ranking.length === 0 ? (
          <div className="py-8 text-center text-elche-text-light italic">Aún no hay ventas en este evento</div>
        ) : (
          <div className="grid gap-2">
            {ranking.map((r, i) => (
              <div key={r.cantinaId} className="flex items-center gap-3">
                <div className="w-6 text-center font-bold text-elche-text-light text-sm">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-elche-text text-sm truncate">{r.name}</span>
                    <span className="font-bold text-elche-primary text-sm shrink-0">{eur(r.totalCents)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-elche-gray/40 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-elche-primary to-elche-accent rounded-full transition-all"
                      style={{ width: maxRank > 0 ? `${Math.max(3, (r.totalCents / maxRank) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
                <div className="text-xs text-elche-text-light font-medium w-16 text-right shrink-0">{r.numSales} tickets</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function KpiCard({ icon, label, value, sub, gradient, big }: {
  icon: string; label: string; value: string; sub?: string; gradient: string; big?: boolean;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} p-5 rounded-3xl shadow-lg text-white relative overflow-hidden group hover:scale-[1.02] transition-transform ${big ? 'col-span-2 lg:col-span-1' : ''}`}>
      <div className="relative z-10">
        <div className="text-xs font-bold mb-2 uppercase tracking-widest opacity-80">{label}</div>
        <div className="text-2xl md:text-3xl font-extrabold leading-tight truncate" title={value}>{value}</div>
        {sub && <div className="text-xs font-semibold opacity-80 mt-1">{sub}</div>}
      </div>
      <div className="absolute -bottom-5 -right-4 text-7xl opacity-10 group-hover:opacity-20 transition-opacity">{icon}</div>
    </div>
  );
}
