'use client';

import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { WaiterRow } from '../hooks/useAdminWaiters';
import { WAITER_QR_PREFIX } from '@/lib/waiters';

interface WaitersSectionProps {
  waiters: WaiterRow[];
  loading: boolean;
  onCreate: (name: string, surname: string, pin: string) => Promise<void>;
  onToggleActive: (id: string, active: boolean) => Promise<void>;
}

export default function WaitersSection({ waiters, loading, onCreate, onToggleActive }: WaitersSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [qrWaiter, setQrWaiter] = useState<WaiterRow | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate(name, surname, pin);
      setName(''); setSurname(''); setPin(''); setShowForm(false);
    } catch (e: any) {
      alert(e.message || 'Error al dar de alta al camarero');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="flex items-center justify-between mb-5 border-b border-elche-gray/50 pb-4">
        <div className="font-bold text-xl text-elche-text flex items-center gap-2">
          <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">👥</span>
          Camareros
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-4 py-2 rounded-xl bg-elche-primary/10 text-elche-primary font-bold text-sm hover:bg-elche-primary/20 transition-colors"
        >
          {showForm ? 'Cancelar' : '➕ Dar de alta'}
        </button>
      </div>

      {showForm && (
        <div className="mb-5 p-4 bg-elche-gray/20 rounded-2xl border border-elche-gray/50 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Nombre *"
            className="p-3 rounded-xl border border-elche-gray bg-white font-bold focus:ring-2 focus:ring-elche-primary focus:outline-none"
          />
          <input
            value={surname} onChange={e => setSurname(e.target.value)}
            placeholder="Apellidos"
            className="p-3 rounded-xl border border-elche-gray bg-white focus:ring-2 focus:ring-elche-primary focus:outline-none"
          />
          <input
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="PIN personal"
            inputMode="numeric"
            className="p-3 rounded-xl border border-elche-gray bg-white text-center font-bold w-full md:w-32 focus:ring-2 focus:ring-elche-primary focus:outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="px-6 py-3 rounded-xl bg-elche-primary text-white font-bold disabled:opacity-50 hover:bg-elche-secondary transition-colors"
          >
            {saving ? '⏳' : 'Alta'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-elche-text-light">Cargando camareros...</div>
      ) : waiters.length === 0 ? (
        <div className="py-10 text-center text-elche-text-light italic bg-elche-gray/5 rounded-2xl border border-dashed border-elche-gray/50">
          Aún no hay camareros dados de alta
        </div>
      ) : (
        <div className="grid gap-3">
          {waiters.map(w => (
            <div key={w.id} className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border gap-3 ${w.active ? 'bg-white border-elche-gray/50' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${w.on_shift ? 'bg-elche-success animate-pulse' : 'bg-gray-300'}`}
                     title={w.on_shift ? 'En turno ahora' : 'Sin turno abierto'} />
                <div>
                  <div className="font-bold text-elche-text">
                    {w.name} {w.surname ?? ''}
                    {w.on_shift && <span className="ml-2 text-[10px] bg-elche-success/10 text-elche-success px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">En turno</span>}
                  </div>
                  <div className="text-xs text-elche-text-light font-medium mt-0.5">
                    ⏱️ {w.total_hours.toFixed(2)} h trabajadas
                    {w.pin_code && <span className="ml-2">· PIN: {w.pin_code}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => setQrWaiter(w)}
                  className="px-4 py-2 rounded-xl bg-elche-text text-white font-bold text-xs hover:bg-elche-primary transition-colors"
                >
                  🪪 QR acreditación
                </button>
                <button
                  onClick={() => onToggleActive(w.id, !w.active)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs border transition-colors ${w.active
                    ? 'bg-white border-elche-gray text-elche-text-light hover:text-elche-danger hover:border-elche-danger/40'
                    : 'bg-elche-primary/10 border-elche-primary/30 text-elche-primary hover:bg-elche-primary/20'}`}
                >
                  {w.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal QR de acreditación */}
      {qrWaiter && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setQrWaiter(null)}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="font-bold text-xl text-elche-text mb-1">
              {qrWaiter.name} {qrWaiter.surname ?? ''}
            </div>
            <div className="text-xs text-elche-text-light font-medium mb-6">
              QR de acreditación — Stock Cantinas · Elche CF
            </div>
            <div className="bg-white p-4 rounded-2xl border-2 border-elche-gray/50 inline-block">
              <QRCode value={`${WAITER_QR_PREFIX}${qrWaiter.qr_token}`} size={200} />
            </div>
            <div className="text-[11px] text-elche-text-light mt-4 font-medium">
              Imprime este código y añádelo a la acreditación del camarero.
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-elche-primary text-white font-bold text-sm hover:bg-elche-secondary transition-colors"
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={() => setQrWaiter(null)}
                className="flex-1 py-3 rounded-xl bg-white border border-elche-gray text-elche-text font-bold text-sm hover:bg-elche-gray/30 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
