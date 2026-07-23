'use client';

import React, { useMemo, useState } from 'react';
import { useWaiterPerformance, WaiterPerformance } from '../hooks/useWaiterPerformance';

type SortKey = 'total_cents' | 'eurPerHour' | 'salesPerHour' | 'hours' | 'num_sales';

interface Props {
  eventId: string;
  /** Si se pasa, limita el rendimiento a esa cantina. */
  cantinaId?: string;
  /** Vista compacta (para la página de una cantina). */
  compact?: boolean;
}

export default function WaiterPerformanceTable({ eventId, cantinaId, compact }: Props) {
  const { waiters, loading, refresh } = useWaiterPerformance(eventId, cantinaId);
  const [sortKey, setSortKey] = useState<SortKey>('total_cents');

  const rows = useMemo(() => {
    const withRates = waiters.map(w => ({
      ...w,
      eurPerHour: w.hours > 0 ? w.total_cents / 100 / w.hours : 0,
      salesPerHour: w.hours > 0 ? w.num_sales / w.hours : 0,
    }));
    return withRates.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  }, [waiters, sortKey]);

  const eur = (cents: number) => (cents / 100).toFixed(2) + ' €';

  const Th = ({ label, k, right }: { label: string; k?: SortKey; right?: boolean }) => (
    <th className={`p-3 ${right ? 'text-right' : 'text-left'} ${k ? 'cursor-pointer select-none hover:text-elche-primary' : ''}`}
      onClick={k ? () => setSortKey(k) : undefined}
      title={k ? 'Ordenar' : undefined}>
      {label}{k && sortKey === k ? ' ▾' : ''}
    </th>
  );

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="font-bold text-xl text-elche-text flex items-center gap-2">
          <span className="bg-elche-primary/10 text-elche-primary p-2 rounded-xl">👥</span>
          {compact ? 'Rendimiento en esta cantina' : 'Rendimiento por camarero'}
        </div>
        <button onClick={() => refresh()} className="px-4 py-2 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:bg-elche-gray/30 shadow-sm transition-colors">
          🔄
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-8 text-center text-elche-text-light">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-elche-text-light italic bg-elche-gray/5 rounded-2xl border border-dashed border-elche-gray/50">
          Todavía no hay actividad de camareros {compact ? 'en esta cantina' : 'en este evento'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-elche-gray/50">
          <table className="w-full border-collapse min-w-[620px]">
            <thead>
              <tr className="bg-elche-gray/20 text-elche-text-light text-xs font-bold uppercase tracking-wider">
                <Th label="Camarero" />
                {!compact && <Th label="Cantinas" />}
                <Th label="Horas" k="hours" right />
                <Th label="Tickets" k="num_sales" right />
                <Th label="Facturación" k="total_cents" right />
                <Th label="€/hora" k="eurPerHour" right />
                <Th label="Ventas/hora" k="salesPerHour" right />
              </tr>
            </thead>
            <tbody className="divide-y divide-elche-gray/30">
              {rows.map(w => (
                <tr key={w.waiter_id} className="hover:bg-elche-gray/5 transition-colors">
                  <td className="p-3 font-bold text-elche-text">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${w.is_active ? 'bg-elche-success animate-pulse' : 'bg-gray-300'}`}
                        title={w.is_active ? 'En turno' : 'Sin turno abierto'} />
                      {w.waiter_name}
                    </span>
                  </td>
                  {!compact && (
                    <td className="p-3 text-xs text-elche-text-light max-w-[220px] truncate" title={w.cantinas}>
                      {w.cantinas || '—'}
                    </td>
                  )}
                  <td className="p-3 text-right font-mono text-elche-text-light">{w.hours.toFixed(2)}</td>
                  <td className="p-3 text-right font-mono font-bold text-elche-text">{w.num_sales}</td>
                  <td className="p-3 text-right font-mono font-bold text-elche-primary">{eur(w.total_cents)}</td>
                  <td className="p-3 text-right font-mono font-bold text-elche-text">{w.eurPerHour.toFixed(2)} €</td>
                  <td className="p-3 text-right font-mono text-elche-text-light">{w.salesPerHour.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-elche-text-light mt-3">
        Las horas de un turno abierto se cuentan en vivo. Las ventas anuladas no computan.
      </p>
    </section>
  );
}
