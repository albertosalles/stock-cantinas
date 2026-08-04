'use client';

import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { WaiterRow } from '../hooks/useAdminWaiters';
import { WAITER_QR_PREFIX } from '@/lib/waiters';
import { avatarBg } from '@/lib/adminUi';

interface WaitersSectionProps {
  waiters: WaiterRow[];
  loading: boolean;
  onCreate: (name: string, surname: string, pin: string) => Promise<void>;
  onToggleActive: (id: string, active: boolean) => Promise<void>;
  onSetPin: (id: string, pin: string) => Promise<void>;
}

export default function WaitersSection({ waiters, loading, onCreate, onToggleActive, onSetPin }: WaitersSectionProps) {
  // Cambio de PIN en línea. No hay «ver el PIN» porque no existe: se guarda
  // hasheado, así que la única operación posible es fijar uno nuevo.
  const [editandoPin, setEditandoPin] = useState<string | null>(null);
  const [pinNuevo, setPinNuevo] = useState('');
  const [guardandoPin, setGuardandoPin] = useState(false);

  const guardarPin = async (id: string) => {
    if (guardandoPin) return;
    setGuardandoPin(true);
    try {
      await onSetPin(id, pinNuevo);
      setEditandoPin(null);
      setPinNuevo('');
    } catch (e: any) {
      alert(e.message || 'No se pudo cambiar el PIN');
    } finally {
      setGuardandoPin(false);
    }
  };

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [qrWaiter, setQrWaiter] = useState<WaiterRow | null>(null);

  const onShift = waiters.filter(w => w.on_shift).length;

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

  const inputClass =
    'w-full rounded-[10px] border border-[#e0efe7] bg-[#f9fcfb] px-3 py-2.5 text-[13.5px] text-elche-text outline-none focus:border-elche-primary focus:bg-white';
  const labelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]';
  const thClass =
    'px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8aa397]';

  return (
    <section className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center gap-2 rounded-full bg-elche-primary/[0.09] px-3.5 py-1.5">
            <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-elche-primary" />
            <span className="text-xs font-bold tracking-wide text-elche-primary">{onShift} en turno</span>
          </div>
          <span className="text-[12.5px] font-semibold text-[#8aa397]">
            {waiters.length} camareros registrados
          </span>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 rounded-[11px] bg-elche-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(0,150,79,.28)] transition-colors hover:bg-elche-secondary"
        >
          <span className="ms text-lg">{showForm ? 'close' : 'person_add'}</span>
          {showForm ? 'Cancelar' : 'Alta de camarero'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 flex animate-fade-in flex-wrap items-end gap-3 rounded-2xl border border-elche-gray bg-white p-4">
          <div className="min-w-[160px] flex-1">
            <label className={labelClass}>Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: María" className={inputClass} />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className={labelClass}>Apellidos</label>
            <input value={surname} onChange={e => setSurname(e.target.value)} placeholder="Ej: García López" className={inputClass} />
          </div>
          <div className="w-32">
            <label className={labelClass}>PIN</label>
            <input
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="0000"
              className={`${inputClass} text-center font-bold`}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="rounded-[10px] bg-elche-primary px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-elche-secondary disabled:opacity-50"
          >
            {saving ? '⏳' : 'Crear'}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-elche-gray bg-white">
        <div className="flex items-center gap-2.5 border-b border-[#f0f6f2] px-5 py-4">
          <span className="ms text-xl text-elche-primary">badge</span>
          <h3 className="m-0 text-[15px] font-extrabold tracking-tight">Camareros</h3>
        </div>

        {loading && waiters.length === 0 ? (
          <div className="py-10 text-center text-elche-text-light">Cargando camareros...</div>
        ) : waiters.length === 0 ? (
          <div className="py-12 text-center italic text-elche-text-light">Aún no hay camareros dados de alta</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-[#f7fbf9]">
                  <th className={`text-left ${thClass} pl-5`}>Camarero</th>
                  <th className={`text-center ${thClass}`}>Estado</th>
                  <th className={`text-right ${thClass}`}>Horas</th>
                  <th className={`text-center ${thClass}`}>PIN</th>
                  <th className={`text-right ${thClass} pr-5`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {waiters.map((w, i) => {
                  const fullName = `${w.name} ${w.surname ?? ''}`.trim();
                  return (
                    <tr key={w.id} className="border-t border-[#f0f6f2] transition-colors hover:bg-[#fafcfb]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold text-white ${
                              w.active ? '' : 'opacity-50'
                            }`}
                            style={{ background: avatarBg(i) }}
                          >
                            {w.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-[13.5px] font-bold text-elche-text">{fullName}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            w.on_shift
                              ? 'bg-elche-primary/10 text-elche-primary'
                              : w.active
                                ? 'bg-[#f0f2f1] text-[#94a39a]'
                                : 'bg-red-50 text-red-500'
                          }`}
                        >
                          {w.on_shift && <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-current" />}
                          {w.on_shift ? 'En turno' : w.active ? 'Sin turno' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[13.5px] font-semibold tabular-nums text-elche-text-light">
                        {w.total_hours.toFixed(1)} h
                      </td>
                      {/* El PIN se guarda hasheado desde S2 y no se puede
                          consultar. Se indica sólo si lo tiene configurado; si
                          se olvida, se vuelve a fijar. */}
                      <td className="px-4 py-3 text-center text-[12.5px] font-semibold text-elche-text-light">
                        {editandoPin === w.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              autoFocus
                              value={pinNuevo}
                              onChange={e => setPinNuevo(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') guardarPin(w.id); if (e.key === 'Escape') setEditandoPin(null); }}
                              placeholder="Nuevo PIN"
                              className="w-[86px] rounded-[8px] border border-[#e0efe7] bg-[#f9fcfb] px-2 py-1.5 text-center text-[12.5px] outline-none focus:border-elche-primary focus:bg-white"
                            />
                            <button
                              onClick={() => guardarPin(w.id)}
                              disabled={guardandoPin}
                              title="Guardar"
                              className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-elche-primary text-white disabled:opacity-60"
                            >
                              <span className="ms text-[16px]">check</span>
                            </button>
                            <button
                              onClick={() => { setEditandoPin(null); setPinNuevo(''); }}
                              title="Cancelar"
                              className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] border border-[#e0efe7] text-[#8aa397]"
                            >
                              <span className="ms text-[16px]">close</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditandoPin(w.id); setPinNuevo(''); }}
                            title={w.has_pin
                              ? 'Tiene PIN. No se puede consultar (se guarda cifrado): pulsa para poner uno nuevo.'
                              : 'Sin PIN: sólo entra con su QR. Pulsa para asignarle uno.'}
                            className="rounded-[8px] px-2 py-1 transition-colors hover:bg-elche-primary/10 hover:text-elche-primary"
                          >
                            {w.has_pin ? '••••' : '—'}
                          </button>
                        )}
                      </td>
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setQrWaiter(w)}
                            title="QR de acreditación"
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#e0efe7] bg-white text-[#8aa397] transition-colors hover:border-[#bfe3cf] hover:bg-elche-primary/10 hover:text-elche-primary"
                          >
                            <span className="ms text-[19px]">qr_code_2</span>
                          </button>
                          <button
                            onClick={() => onToggleActive(w.id, !w.active)}
                            className={`rounded-[9px] border px-3 py-2 text-[11.5px] font-bold transition-colors ${
                              w.active
                                ? 'border-[#e0efe7] bg-white text-elche-text-light hover:border-elche-danger/40 hover:text-elche-danger'
                                : 'border-[#bfe3cf] bg-elche-primary/10 text-elche-primary hover:bg-elche-primary/20'
                            }`}
                          >
                            {w.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal QR de acreditación */}
      {qrWaiter && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setQrWaiter(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-1 text-xl font-extrabold text-elche-text">
              {qrWaiter.name} {qrWaiter.surname ?? ''}
            </div>
            <div className="mb-6 text-xs font-medium text-elche-text-light">
              QR de acreditación — Stock Cantinas · Elche CF
            </div>
            <div className="inline-block rounded-2xl border-2 border-elche-gray bg-white p-4">
              <QRCode value={`${WAITER_QR_PREFIX}${qrWaiter.qr_token}`} size={200} />
            </div>
            <div className="mt-4 text-[11px] font-medium text-elche-text-light">
              Imprime este código y añádelo a la acreditación del camarero.
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-[11px] bg-elche-primary py-3 text-sm font-bold text-white transition-colors hover:bg-elche-secondary"
              >
                Imprimir
              </button>
              <button
                onClick={() => setQrWaiter(null)}
                className="flex-1 rounded-[11px] border border-elche-gray bg-white py-3 text-sm font-bold text-elche-text transition-colors hover:bg-elche-bg"
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
