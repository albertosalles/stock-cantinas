'use client';

import React, { useMemo, useState } from 'react';
import { useEventWaiterAssignments } from '../hooks/useEventWaiterAssignments';
import { useWaiterPerformance } from '../hooks/useWaiterPerformance';
import { useAdminWaiters } from '../hooks/useAdminWaiters';
import { avatarBg, eur } from '@/lib/adminUi';

interface Props {
  eventId: string;
}

type SortKey = 'name' | 'tickets' | 'totalCents' | 'eurPerHour' | 'salesPerHour' | 'hours';

/**
 * Personal del evento: asignación a cantina y rendimiento en una sola tabla.
 * Cambiar la cantina de un camarero cierra su turno anterior y abre uno nuevo.
 */
export default function EventPersonalTab({ eventId }: Props) {
  const { waiters, cantinas, loading, busyId, assignTo, refresh } = useEventWaiterAssignments(eventId);
  const { waiters: perf } = useWaiterPerformance(eventId);
  const { createWaiter, fetchWaiters } = useAdminWaiters();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSurname, setNewSurname] = useState('');
  const [newPin, setNewPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('totalCents');

  const perfById = useMemo(
    () => new Map(perf.map(p => [p.waiter_id, p])),
    [perf]
  );

  const rows = useMemo(() => {
    const merged = waiters.map(w => {
      const p = perfById.get(w.id);
      const hours = p?.hours ?? 0;
      const totalCents = p?.total_cents ?? 0;
      const tickets = p?.num_sales ?? 0;
      return {
        ...w,
        hours,
        tickets,
        totalCents,
        eurPerHour: hours > 0 ? totalCents / 100 / hours : 0,
        salesPerHour: hours > 0 ? tickets / hours : 0,
        onShift: !!w.cantinaId,
      };
    });

    return merged.sort((a, b) =>
      sortKey === 'name' ? a.name.localeCompare(b.name) : (b[sortKey] as number) - (a[sortKey] as number)
    );
  }, [waiters, perfById, sortKey]);

  const onShiftCount = rows.filter(r => r.onShift).length;

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await createWaiter(newName, newSurname, newPin);
      setNewName(''); setNewSurname(''); setNewPin(''); setShowAdd(false);
      await Promise.all([fetchWaiters(), refresh()]);
    } catch (e: any) {
      alert(e.message || 'Error al dar de alta al camarero');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-[10px] border border-[#e0efe7] bg-[#f9fcfb] px-3 py-2.5 text-[13.5px] text-elche-text outline-none focus:border-elche-primary focus:bg-white';
  const labelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]';

  const Th = ({ label, k, align = 'right' }: { label: string; k?: SortKey; align?: 'left' | 'center' | 'right' }) => (
    <th
      onClick={k ? () => setSortKey(k) : undefined}
      title={k ? 'Ordenar' : undefined}
      className={`px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8aa397] ${
        align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'
      } ${k ? 'cursor-pointer select-none hover:text-elche-primary' : ''}`}
    >
      {label}{k && sortKey === k ? ' ▾' : ''}
    </th>
  );

  return (
    <div className="mx-auto max-w-[1440px] animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center gap-2 rounded-full bg-elche-primary/[0.09] px-3.5 py-1.5">
            <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-elche-primary" />
            <span className="text-xs font-bold tracking-wide text-elche-primary">{onShiftCount} en turno</span>
          </div>
          <span className="text-[12.5px] font-semibold text-[#8aa397]">
            {rows.length} camareros disponibles
          </span>
        </div>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-1.5 rounded-[11px] bg-elche-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(0,150,79,.28)] transition-colors hover:bg-elche-secondary"
        >
          <span className="ms text-lg">{showAdd ? 'close' : 'person_add'}</span>
          {showAdd ? 'Cancelar' : 'Alta de camarero'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 flex animate-fade-in flex-wrap items-end gap-3 rounded-2xl border border-elche-gray bg-white p-4">
          <div className="min-w-[160px] flex-1">
            <label className={labelClass}>Nombre</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: María" className={inputClass} />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className={labelClass}>Apellidos</label>
            <input value={newSurname} onChange={e => setNewSurname(e.target.value)} placeholder="Ej: García López" className={inputClass} />
          </div>
          <div className="w-32">
            <label className={labelClass}>PIN</label>
            <input
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" placeholder="0000"
              className={`${inputClass} text-center font-bold`}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            className="rounded-[10px] bg-elche-primary px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-elche-secondary disabled:opacity-50"
          >
            {saving ? '⏳' : 'Crear'}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-elche-gray bg-white">
        <div className="flex items-center gap-2.5 border-b border-[#f0f6f2] px-5 py-4">
          <span className="ms text-xl text-elche-primary">badge</span>
          <h3 className="m-0 flex-1 text-[15px] font-extrabold tracking-tight">Camareros</h3>
          <button
            onClick={() => refresh()}
            title="Refrescar"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-elche-gray bg-elche-bg text-elche-text-light transition-colors hover:text-elche-primary"
          >
            <span className="ms text-lg">refresh</span>
          </button>
        </div>

        {loading && rows.length === 0 ? (
          <div className="py-10 text-center text-elche-text-light">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center italic text-elche-text-light">
            No hay camareros activos. Da de alta camareros desde aquí o desde el panel principal.
          </div>
        ) : cantinas.length === 0 ? (
          <div className="py-12 text-center italic text-elche-text-light">
            Este evento no tiene cantinas asignadas todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="bg-[#f7fbf9]">
                  <Th label="Camarero" k="name" align="left" />
                  <Th label="Cantina asignada" align="left" />
                  <Th label="Estado" align="center" />
                  <Th label="Tickets" k="tickets" />
                  <Th label="Facturación" k="totalCents" />
                  <Th label="€/h" k="eurPerHour" />
                  <Th label="Ventas/h" k="salesPerHour" />
                  <Th label="Horas" k="hours" />
                </tr>
              </thead>
              <tbody>
                {rows.map((w, i) => (
                  <tr key={w.id} className="border-t border-[#f0f6f2] transition-colors hover:bg-[#fafcfb]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold text-white"
                          style={{ background: avatarBg(i) }}
                        >
                          {w.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-[13.5px] font-bold text-elche-text">{w.name}</div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={w.cantinaId ?? ''}
                        disabled={busyId === w.id}
                        onChange={e => assignTo(w.id, e.target.value || null)}
                        className={`min-w-[150px] cursor-pointer rounded-[9px] px-3 py-2 text-[12.5px] font-semibold outline-none disabled:opacity-50 ${
                          w.cantinaId
                            ? 'border border-[#cbe6d8] bg-[#f4fbf7] text-elche-text'
                            : 'border border-[#e0efe7] bg-white text-[#94a39a]'
                        }`}
                      >
                        <option value="">— Sin asignar —</option>
                        {cantinas.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          w.onShift ? 'bg-elche-primary/10 text-elche-primary' : 'bg-[#f0f2f1] text-[#94a39a]'
                        }`}
                      >
                        {w.onShift && <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-current" />}
                        {w.onShift ? 'En turno' : 'Sin turno'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right text-[13.5px] font-bold tabular-nums text-elche-text">{w.tickets}</td>
                    <td className="px-4 py-3 text-right text-[13.5px] font-extrabold tabular-nums text-elche-primary">{eur(w.totalCents)}</td>
                    <td className="px-4 py-3 text-right text-[13.5px] font-bold tabular-nums text-elche-text">{w.eurPerHour.toFixed(2)} €</td>
                    <td className="px-4 py-3 text-right text-[13.5px] font-semibold tabular-nums text-elche-text-light">{w.salesPerHour.toFixed(1)}</td>
                    <td className="py-3 pl-4 pr-5 text-right text-[13.5px] font-semibold tabular-nums text-elche-text-light">{w.hours.toFixed(1)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-1.5 border-t border-[#f0f6f2] px-5 py-3 text-[11.5px] text-[#8aa397]">
          <span className="ms text-[15px]">info</span>
          Cambiar la cantina de un camarero cierra su turno anterior (imputando horas) y abre uno nuevo. Las ventas anuladas no computan.
        </div>
      </div>
    </div>
  );
}
