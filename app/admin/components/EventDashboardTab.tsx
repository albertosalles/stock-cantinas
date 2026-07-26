'use client';

import React from 'react';
import { useEventDashboard } from '../hooks/useEventDashboard';
import { useSalesByHour } from '../hooks/useSalesByHour';
import { useEventWaiterAssignments } from '../hooks/useEventWaiterAssignments';
import { eur } from '@/lib/adminUi';

interface EventDashboardTabProps {
  eventId: string;
}

export default function EventDashboardTab({ eventId }: EventDashboardTabProps) {
  const { kpis, ranking, loading } = useEventDashboard(eventId);
  const { buckets } = useSalesByHour(eventId);
  const { waiters } = useEventWaiterAssignments(eventId);

  const avgTicket = kpis.num_sales > 0 ? kpis.total_cents / kpis.num_sales : 0;
  const maxRank = ranking.length ? ranking[0].totalCents : 0;
  const maxHour = Math.max(...buckets.map(b => b.totalCents), 1);

  const activeTeam = waiters.filter(w => w.cantinaId);
  const totalWaiters = waiters.length;
  const activePct = totalWaiters > 0 ? Math.round((activeTeam.length / totalWaiters) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1440px] animate-fade-in">
      {/* ---------------- KPIs ---------------- */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        {/* Hero: recaudación */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-elche-primary to-elche-secondary p-[18px] text-white shadow-[0_8px_22px_rgba(0,122,61,.28)]">
          <div className="flex items-center justify-between">
            <span className="ms text-[22px] opacity-90">payments</span>
          </div>
          <div className="mt-4 min-h-[2.4em] text-[10.5px] font-bold uppercase leading-[1.2] tracking-[0.1em] opacity-80">
            Recaudación
          </div>
          <div className="mt-0.5 whitespace-nowrap text-[22px] font-extrabold tracking-tight xl:text-[24px]">
            {eur(kpis.total_cents)}
          </div>
        </div>

        <KpiCard icon="receipt_long" tone="#00964f" bg="rgba(0,150,79,.10)" label="Tickets" value={String(kpis.num_sales)} />
        <KpiCard icon="inventory_2" tone="#20b368" bg="rgba(32,179,104,.12)" label="Artículos vendidos" value={String(kpis.total_items)} />
        <KpiCard icon="confirmation_number" tone="#007a3d" bg="rgba(0,122,61,.10)" label="Ticket medio" value={eur(avgTicket)} />
        <KpiCard
          icon="groups" tone="#f59e0b" bg="rgba(245,158,11,.12)" label="Personal activo"
          value={String(kpis.active_waiters)} suffix={totalWaiters > 0 ? `/${totalWaiters}` : undefined}
        />
        <KpiCard
          icon="storefront" tone="#00964f" bg="rgba(0,150,79,.10)" label="Cantinas activas"
          value={String(kpis.active_cantinas)} suffix={`/${kpis.num_cantinas}`}
        />
      </div>

      {kpis.star_product && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-elche-gray bg-white px-5 py-3.5">
          <span className="ms rounded-[11px] bg-amber-100 p-2 text-xl text-amber-500">star</span>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#8aa397]">Producto estrella</div>
            <div className="text-[15px] font-extrabold text-elche-text">
              {kpis.star_product}
              <span className="ml-2 text-xs font-semibold text-elche-text-light">{kpis.star_units} uds</span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Ventas por hora + equipo ---------------- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-elche-gray bg-white p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="ms text-xl text-elche-primary">show_chart</span>
              <h3 className="m-0 text-[15px] font-extrabold tracking-tight">Ventas por hora</h3>
            </div>
            <span className="rounded-md bg-elche-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">
              Recaudación · €
            </span>
          </div>

          {buckets.length === 0 ? (
            <div className="flex h-[190px] flex-col items-center justify-center gap-2 text-elche-text-light">
              <span className="ms text-4xl text-[#bfe3cf]">bar_chart</span>
              <span className="text-[12.5px] font-semibold">Aún no hay ventas registradas</span>
            </div>
          ) : (
            <div className="flex h-[190px] items-end gap-3 pt-2.5">
              {buckets.map(b => (
                <div key={b.hora} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="text-[11px] font-bold text-elche-primary">{Math.round(b.totalCents / 100)}€</div>
                  <div
                    className="w-full max-w-[46px] rounded-t-lg bg-gradient-to-b from-elche-accent to-elche-primary shadow-[0_3px_10px_rgba(0,150,79,.2)] transition-[height] duration-500"
                    style={{ height: `${Math.max(6, (b.totalCents / maxHour) * 100)}%` }}
                    title={`${b.numSales} tickets · ${eur(b.totalCents)}`}
                  />
                  <div className="text-[11px] font-semibold text-[#8aa397]">{b.hora}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Equipo en turno */}
        <div className="rounded-2xl border border-elche-gray bg-white p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="ms text-xl text-elche-primary">diversity_3</span>
            <h3 className="m-0 text-[15px] font-extrabold tracking-tight">Equipo en turno</h3>
          </div>

          <div className="mb-4 flex items-center gap-4">
            <div
              className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#00964f ${activePct}%, #eef6f1 0)` }}
            >
              <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-[17px] font-extrabold leading-none text-elche-primary">{activePct}%</span>
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold leading-none tracking-tight text-elche-text">
                {activeTeam.length}
                <span className="text-[15px] font-semibold text-[#8aa397]">/{totalWaiters}</span>
              </div>
              <div className="mt-0.5 text-xs font-semibold text-elche-text-light">camareros en barra</div>
            </div>
          </div>

          <div className="sc-scroll flex max-h-[150px] flex-col gap-0.5 overflow-y-auto">
            {activeTeam.length === 0 ? (
              <div className="py-4 text-center text-[12.5px] italic text-elche-text-light">
                Nadie asignado todavía
              </div>
            ) : (
              activeTeam.map(w => (
                <div key={w.id} className="flex items-center gap-2.5 px-1 py-1.5">
                  <span className="h-[7px] w-[7px] shrink-0 animate-pulse rounded-full bg-elche-primary" />
                  <span className="flex-1 truncate text-[13px] font-semibold text-elche-text">{w.name}</span>
                  <span className="shrink-0 text-[11.5px] font-semibold text-elche-text-light">
                    {w.cantinaName ?? '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---------------- Ranking de cantinas ---------------- */}
      <div className="rounded-2xl border border-elche-gray bg-white p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="ms text-xl text-amber-500">leaderboard</span>
          <h3 className="m-0 text-[15px] font-extrabold tracking-tight">Cantinas por facturación</h3>
        </div>

        {loading && ranking.length === 0 ? (
          <div className="py-8 text-center text-elche-text-light">Cargando…</div>
        ) : ranking.length === 0 ? (
          <div className="py-8 text-center italic text-elche-text-light">Aún no hay ventas en este evento</div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {ranking.map((r, i) => (
              <div key={r.cantinaId} className="flex items-center gap-3.5">
                <div
                  className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-[12.5px] font-extrabold ${
                    i === 0
                      ? 'bg-elche-primary text-white'
                      : i < 3
                        ? 'bg-elche-primary/[0.12] text-elche-primary'
                        : 'bg-[#f0f6f2] text-[#8aa397]'
                  }`}
                >
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center justify-between gap-2.5">
                    <span className="truncate text-[13.5px] font-bold text-elche-text">{r.name}</span>
                    <span className="shrink-0 text-[13.5px] font-extrabold text-elche-primary">{eur(r.totalCents)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-md bg-[#eef6f1]">
                    <div
                      className="h-full rounded-md bg-gradient-to-r from-elche-primary to-elche-accent transition-[width] duration-500"
                      style={{ width: maxRank > 0 ? `${Math.max(4, (r.totalCents / maxRank) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
                <div className="w-[74px] shrink-0 text-right text-[11.5px] font-semibold text-[#8aa397]">
                  {r.numSales} tickets
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, tone, bg, label, value, suffix }: {
  icon: string; tone: string; bg: string; label: string; value: string; suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-elche-gray bg-white p-[18px]">
      <span className="ms rounded-[11px] p-2 text-[22px]" style={{ color: tone, background: bg }}>
        {icon}
      </span>
      <div className="mt-3.5 min-h-[2.4em] text-[10.5px] font-bold uppercase leading-[1.2] tracking-[0.1em] text-[#8aa397]">
        {label}
      </div>
      <div className="mt-0.5 whitespace-nowrap text-[22px] font-extrabold tracking-tight text-elche-text">
        {value}
        {suffix && <span className="text-sm font-semibold text-[#8aa397]">{suffix}</span>}
      </div>
    </div>
  );
}
