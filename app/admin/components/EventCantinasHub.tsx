'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { useCantinasGrid, CantinaGridRow } from '../hooks/useCantinasGrid';
import { CANTINA_QR_PREFIX } from '@/lib/waiters';

interface EventCantinasHubProps {
  eventId: string;
}

export default function EventCantinasHub({ eventId }: EventCantinasHubProps) {
  const router = useRouter();
  const { cantinas, loading, refresh, toggleAssign, createCantina } = useCantinasGrid(eventId);
  const [qrCantina, setQrCantina] = useState<CantinaGridRow | null>(null);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [creating, setCreating] = useState(false);

  const assigned = cantinas.filter(c => c.assigned);
  const unassigned = cantinas.filter(c => !c.assigned);

  const handleCreate = async () => {
    if (!newName.trim() || !newPin.trim() || creating) return;
    setCreating(true);
    try {
      await createCantina(newName, newPin);
      setNewName(''); setNewPin('');
    } catch (e: any) {
      alert(e.message || 'Error al crear la cantina');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="grid gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="font-bold text-2xl text-elche-text flex items-center gap-3">
          <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">🏪</span>
          Cantinas
        </div>
        <button onClick={() => refresh()} className="px-5 py-2.5 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:bg-elche-gray/30 shadow-sm transition-colors">
          🔄 Refrescar
        </button>
      </div>

      {loading && cantinas.length === 0 ? (
        <div className="py-10 text-center text-elche-text-light">Cargando cantinas…</div>
      ) : (
        <>
          {/* Asignadas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assigned.map(c => (
              <CantinaCard key={c.cantina_id} c={c} eventId={eventId} router={router}
                onToggle={toggleAssign} onShowQr={() => setQrCantina(c)} />
            ))}
          </div>

          {/* No asignadas */}
          {unassigned.length > 0 && (
            <div>
              <div className="text-sm font-bold text-elche-text-light uppercase tracking-wide mb-3 mt-2">
                No asignadas a este evento
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {unassigned.map(c => (
                  <div key={c.cantina_id} className="p-4 rounded-2xl border border-elche-gray/60 bg-white flex items-center justify-between gap-2">
                    <span className="font-bold text-elche-text-light truncate">{c.cantina_name}</span>
                    <AssignSwitch assigned={false} onChange={() => toggleAssign(c.cantina_id, true)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Crear cantina */}
      <div className="bg-elche-gray/20 p-5 rounded-2xl border border-elche-gray/50">
        <div className="font-bold text-elche-text mb-3">➕ Nueva cantina</div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre de la cantina"
            className="flex-1 p-3 rounded-xl border border-elche-gray bg-white focus:outline-none focus:ring-2 focus:ring-elche-primary" />
          <input value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="PIN"
            className="w-full sm:w-28 p-3 rounded-xl border border-elche-gray bg-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-elche-primary" />
          <button onClick={handleCreate} disabled={creating || !newName.trim() || !newPin.trim()}
            className="px-5 py-3 rounded-xl bg-elche-text text-white font-bold hover:bg-elche-primary transition-colors disabled:opacity-50">
            {creating ? '⏳' : 'Crear y asignar'}
          </button>
        </div>
      </div>

      {/* Modal QR */}
      {qrCantina && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setQrCantina(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-xl text-elche-text mb-1">{qrCantina.cantina_name}</div>
            <div className="text-xs text-elche-text-light font-medium mb-6">QR de acceso — los camareros lo escanean para abrir su POS</div>
            <div className="bg-white p-4 rounded-2xl border-2 border-elche-gray/50 inline-block">
              <QRCode value={`${CANTINA_QR_PREFIX}${qrCantina.qr_token}`} size={200} />
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl bg-elche-primary text-white font-bold text-sm hover:bg-elche-secondary transition-colors">🖨️ Imprimir</button>
              <button onClick={() => setQrCantina(null)} className="flex-1 py-3 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:bg-elche-gray/30 transition-colors">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CantinaCard({ c, eventId, router, onToggle, onShowQr }: {
  c: CantinaGridRow; eventId: string; router: ReturnType<typeof useRouter>;
  onToggle: (id: string, assign: boolean) => void; onShowQr: () => void;
}) {
  const goDetail = () => router.push(`/admin/${eventId}/cantina/${c.cantina_id}`);
  return (
    <div className="p-4 rounded-2xl border border-elche-gray/60 bg-white hover:border-elche-primary/40 hover:shadow-md transition-all flex flex-col gap-3">
      {/* Cabecera: nombre + switch */}
      <div className="flex items-start justify-between gap-2">
        <button onClick={goDetail} className="font-bold text-elche-text text-left hover:text-elche-primary transition-colors truncate">
          {c.cantina_name}
        </button>
        <AssignSwitch assigned onChange={() => onToggle(c.cantina_id, false)} />
      </div>

      {/* Métricas + badges */}
      <button onClick={goDetail} className="text-left">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl font-extrabold text-elche-primary leading-none">{(c.total_cents / 100).toFixed(2)} €</span>
          <span className="text-xs text-elche-text-light font-medium">· {c.num_sales} tickets</span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${c.active_waiters > 0 ? 'bg-elche-success/10 text-elche-success border-elche-success/20' : 'bg-elche-gray/30 text-elche-text-light border-elche-gray/50'}`}>
            👥 {c.active_waiters} en turno
          </span>
          {c.pending_incidents > 0 && (
            <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">⚠️ {c.pending_incidents}</span>
          )}
          {c.low_stock_count > 0 && (
            <span className="bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">📉 {c.low_stock_count}</span>
          )}
        </div>
      </button>

      {/* Productos destacados */}
      {c.featured.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-elche-gray/40">
          {c.featured.map((f, i) => (
            <span key={i} className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${f.qty <= 0 ? 'bg-red-50 text-red-500 border-red-200' : 'bg-elche-gray/20 text-elche-text border-elche-gray/50'}`}>
              {f.name}: <strong>{f.qty}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 pt-1">
        <button onClick={goDetail} className="flex-1 py-2 rounded-xl bg-elche-primary text-white font-bold text-xs hover:bg-elche-secondary transition-colors">
          Ver detalle →
        </button>
        <button onClick={onShowQr} className="px-3 py-2 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-xs hover:bg-elche-gray/20 transition-colors" title="QR de acceso">
          📱 QR
        </button>
      </div>
    </div>
  );
}

function AssignSwitch({ assigned, onChange }: { assigned: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0" title={assigned ? 'Quitar del evento' : 'Asignar al evento'} onClick={e => e.stopPropagation()}>
      <input type="checkbox" checked={assigned} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-elche-success"></div>
    </label>
  );
}
