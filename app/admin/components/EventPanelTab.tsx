import React from 'react';
import { PanelRow } from '../hooks/useAdminMetrics';

interface EventPanelTabProps {
  cantinas: { id: string; name: string; assigned: boolean }[];
  panelCantinaId: string | null;
  setPanelCantinaId: (id: string | null) => void;
  panelTotals: { num_sales: number; total_cents: number; total_items: number };
  panelRows: PanelRow[];
  salesHistory: any[];
  onRefresh: () => void;
}

export default function EventPanelTab({
  cantinas, panelCantinaId, setPanelCantinaId, panelTotals, panelRows, salesHistory, onRefresh
}: EventPanelTabProps) {
  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50 mb-10">
      <div className="flex items-center justify-between mb-6 border-b border-elche-gray/50 pb-4 gap-3 flex-wrap">
        <div className="font-bold text-xl text-elche-text flex items-center gap-2">
          <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">📈</span>
          {panelCantinaId ? `Detalle · ${cantinas.find(c => c.id === panelCantinaId)?.name ?? ''}` : 'Detalle por cantina'}
        </div>
        {panelCantinaId && (
          <button
            onClick={onRefresh}
            className="px-5 py-2.5 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:bg-elche-gray/50 shadow-sm transition-colors"
          >
            🔄 Refrescar
          </button>
        )}
      </div>

      {!panelCantinaId ? (
        <div className="py-12 text-center text-elche-text-light italic bg-elche-gray/5 rounded-2xl border border-dashed border-elche-gray/50">
          👆 Selecciona una cantina del grid de arriba para ver su detalle
        </div>
      ) : (
      <>
      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <div className="bg-gradient-to-br from-elche-primary to-elche-secondary p-6 rounded-3xl shadow-lg shadow-elche-primary/20 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <div className="relative z-10">
            <div className="text-xs font-bold mb-2 uppercase tracking-widest opacity-80">Tickets</div>
            <div className="text-5xl font-extrabold">{panelTotals.num_sales}</div>
          </div>
          <div className="absolute -bottom-6 -right-6 text-8xl opacity-10 group-hover:opacity-20 transition-opacity">🎫</div>
        </div>

        <div className="bg-gradient-to-br from-elche-accent to-elche-primary p-6 rounded-3xl shadow-lg shadow-elche-accent/20 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <div className="relative z-10">
            <div className="text-xs font-bold mb-2 uppercase tracking-widest opacity-80">Artículos</div>
            <div className="text-5xl font-extrabold">{panelTotals.total_items}</div>
          </div>
          <div className="absolute -bottom-6 -right-6 text-8xl opacity-10 group-hover:opacity-20 transition-opacity">📦</div>
        </div>

        <div className="bg-gradient-to-br from-elche-text to-elche-secondary p-6 rounded-3xl shadow-lg shadow-elche-text/20 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <div className="relative z-10">
            <div className="text-xs font-bold mb-2 uppercase tracking-widest opacity-80">Facturación</div>
            <div className="text-5xl font-extrabold">{(panelTotals.total_cents / 100).toFixed(2)} €</div>
          </div>
          <div className="absolute -bottom-6 -right-6 text-8xl opacity-10 group-hover:opacity-20 transition-opacity">💰</div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="font-bold mb-4 text-elche-text text-lg">Inventario actual</div>
      <div className="overflow-x-auto rounded-2xl border border-elche-gray/50 shadow-sm mb-10">
        <table className="w-full border-collapse min-w-[300px]">
          <thead>
            <tr className="bg-elche-gray/20 text-elche-text-light text-xs font-bold uppercase tracking-wider">
              <th className="p-4 text-left">Producto</th>
              <th className="p-4 text-right">Inv. Inicial</th>
              <th className="p-4 text-right">Stock</th>
              <th className="p-4 text-right">Vendidos</th>
              <th className="p-4 text-right">Umbral</th>
              <th className="p-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-elche-gray/30">
            {panelRows.map(r => {
              const status = r.current_qty <= 0 ? 'agotado' : r.current_qty <= r.low_stock_threshold ? 'bajo' : 'ok';
              const dotColor = status === 'ok' ? 'bg-elche-success' : status === 'bajo' ? 'bg-elche-warning' : 'bg-elche-danger';
              return (
                <tr key={r.product_id} className="hover:bg-elche-gray/5 transition-colors">
                  <td className="p-4 text-elche-text font-bold">{r.name}</td>
                  <td className="p-4 text-right font-mono text-elche-text-light font-medium">{r.initial_qty !== null ? r.initial_qty : '—'}</td>
                  <td className="p-4 text-right font-mono font-bold text-lg text-elche-text">{r.current_qty}</td>
                  <td className="p-4 text-right font-mono font-bold text-elche-primary">
                    {r.sold_qty}
                  </td>
                  <td className="p-4 text-right font-mono text-elche-text-light font-medium">{r.low_stock_threshold}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${status === 'ok' ? 'bg-elche-success/10 text-elche-success border border-elche-success/20' :
                      status === 'bajo' ? 'bg-elche-warning/10 text-elche-warning border border-elche-warning/20' :
                        'bg-elche-danger/10 text-elche-danger border border-elche-danger/20'
                      }`}>
                      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                      {status === 'ok' ? 'OK' : status === 'bajo' ? 'Bajo' : 'Agotado'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sales History List */}
      {salesHistory && salesHistory.length > 0 && (
        <>
          <div className="font-bold mb-4 text-elche-text text-lg flex items-center gap-2">
            <span>🧾</span> Historial de Ventas (Últimos 15)
          </div>
          <div className="grid gap-3">
            {salesHistory.map(sale => (
              <EventSaleCard key={sale.id} sale={sale} />
            ))}
          </div>
        </>
      )}
      </>
      )}
    </section>
  );
}

function EventSaleCard({ sale }: { sale: any }) {
  const [expanded, setExpanded] = React.useState(false);
  const date = new Date(sale.created_at);
  const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className={`p-4 bg-elche-gray/20 rounded-2xl border transition-all duration-200 ${expanded ? 'border-elche-primary shadow-md bg-white' : 'border-elche-gray/50 hover:border-elche-primary/30 hover:bg-white'}`}>
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Left: ID & Time */}
        <div>
          <div className="text-xs text-elche-text-light mb-1 font-bold uppercase tracking-wide flex gap-2">
            <span>{dateStr}</span>
            <span className="opacity-50">|</span>
            <span>{timeStr}</span>
          </div>
          <div className="text-[10px] text-elche-text-light font-mono bg-white px-2 py-0.5 rounded border border-elche-gray/30 w-fit">
            ID: {sale.id.substring(0, 8)}
          </div>
        </div>

        {/* Right: Totals */}
        <div className="text-right">
          <div className="text-xs text-elche-text-light mb-0.5 font-medium">
            {sale.total_items} art.
          </div>
          <div className="text-xl font-bold text-elche-success">
            {(sale.total_cents / 100).toFixed(2)} €
          </div>
        </div>

        {/* Button */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={`px-4 py-2 rounded-xl border font-semibold text-xs shadow-sm transition-all ${expanded
            ? 'bg-elche-primary text-white border-elche-primary active:scale-95'
            : 'bg-white border-elche-gray/50 text-elche-text hover:bg-elche-gray/20'
            }`}>
          {expanded ? 'Ocultar' : 'Ver'}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-elche-gray/30 animate-in slide-in-from-top-2 duration-200">
          <div className="text-xs font-bold text-elche-text mb-2 uppercase tracking-wide opacity-70">
            Productos vendidos
          </div>
          <div className="grid gap-2">
            {sale.sale_line_items?.map((line: any, idx: number) => (
              <div key={idx} className="flex justify-between p-3 bg-elche-gray/10 rounded-xl text-sm border border-elche-gray/20">
                <div className="text-elche-text font-medium flex items-center">
                  <span className="bg-white border border-elche-gray/30 px-2 py-0.5 rounded-md text-elche-text-light mr-3 font-bold shadow-sm text-xs">{line.qty}x</span>
                  {line.product?.name ?? 'Producto desconocido'}
                </div>
                <div className="text-elche-success font-bold">
                  {((line.unit_price_cents * line.qty) / 100).toFixed(2)} €
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

