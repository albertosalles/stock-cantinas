'use client';

import React, { useState } from 'react';
import { eur } from '@/lib/adminUi';

interface Props {
  sales: any[];
  onRefresh?: () => void;
}

/** Últimas ventas de la cantina, plegables para ver las líneas del ticket. */
export default function CantinaSalesHistory({ sales, onRefresh }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-elche-gray bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#f0f6f2] px-5 py-4">
        <span className="ms text-xl text-elche-primary">receipt_long</span>
        <h3 className="m-0 flex-1 text-[15px] font-extrabold tracking-tight text-elche-text">
          Historial de ventas
          <span className="ml-2 text-[11.5px] font-semibold text-[#8aa397]">últimas {sales.length}</span>
        </h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refrescar"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-elche-gray bg-elche-bg text-elche-text-light transition-colors hover:text-elche-primary"
          >
            <span className="ms text-lg">refresh</span>
          </button>
        )}
      </div>

      {sales.length === 0 ? (
        <div className="py-10 text-center text-elche-text-light">
          <span className="ms text-3xl text-[#bfe3cf]">receipt</span>
          <div className="mt-1.5 text-[12.5px] font-semibold">Todavía no hay ventas en esta cantina</div>
        </div>
      ) : (
        <div className="flex flex-col">
          {sales.map(sale => (
            <SaleRow key={sale.id} sale={sale} />
          ))}
        </div>
      )}
    </div>
  );
}

function SaleRow({ sale }: { sale: any }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(sale.created_at);
  const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  const canceled = sale.status === 'CANCELED';

  return (
    <div className="border-t border-[#f6faf8]">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[#fafcfb]"
      >
        <span
          className={`ms flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-lg ${
            canceled ? 'bg-red-50 text-red-500' : 'bg-elche-primary/10 text-elche-primary'
          }`}
        >
          {canceled ? 'block' : 'shopping_bag'}
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold text-elche-text">
            {dateStr} · {timeStr}
            {canceled && <span className="ml-2 text-[10.5px] font-bold text-red-500">ANULADA</span>}
          </div>
          <div className="text-[11px] font-semibold text-[#8aa397]">
            {sale.total_items} art. · #{String(sale.id).substring(0, 8)}
          </div>
        </div>

        <div className={`shrink-0 text-[14px] font-extrabold ${canceled ? 'text-[#b3c1b9] line-through' : 'text-elche-primary'}`}>
          {eur(sale.total_cents)}
        </div>
        <span className="ms shrink-0 text-lg text-[#8aa397]">{expanded ? 'expand_less' : 'expand_more'}</span>
      </button>

      {expanded && (
        <div className="animate-fade-in bg-[#fbfdfc] px-5 pb-3.5 pt-1">
          <div className="flex flex-col gap-1.5">
            {(sale.sale_line_items ?? []).map((line: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="flex min-w-0 items-center gap-2 text-elche-text">
                  <span className="shrink-0 rounded-md border border-[#e0efe7] bg-white px-1.5 py-0.5 text-[11px] font-bold text-elche-text-light">
                    {line.qty}×
                  </span>
                  <span className="truncate font-medium">{line.product?.name ?? 'Producto desconocido'}</span>
                </span>
                <span className="shrink-0 font-bold text-elche-text-light">
                  {eur(line.unit_price_cents * line.qty)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
