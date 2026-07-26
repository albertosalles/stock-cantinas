'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { useCantinasGrid, CantinaGridRow } from '../hooks/useCantinasGrid';
import { CANTINA_QR_PREFIX } from '@/lib/waiters';
import { cantinaIcon, cantinaIconBg, eurShort } from '@/lib/adminUi';

interface EventCantinasHubProps {
  eventId: string;
}

export default function EventCantinasHub({ eventId }: EventCantinasHubProps) {
  const router = useRouter();
  const { cantinas, loading, refresh, toggleAssign, createCantina } = useCantinasGrid(eventId);
  const [qrCantina, setQrCantina] = useState<CantinaGridRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [creating, setCreating] = useState(false);

  const assigned = cantinas.filter(c => c.assigned);
  const unassigned = cantinas.filter(c => !c.assigned);
  const openCount = assigned.filter(c => c.active_waiters > 0).length;

  const handleCreate = async () => {
    if (!newName.trim() || !newPin.trim() || creating) return;
    setCreating(true);
    try {
      await createCantina(newName, newPin);
      setNewName(''); setNewPin(''); setShowCreate(false);
    } catch (e: any) {
      alert(e.message || 'Error al crear la cantina');
    } finally {
      setCreating(false);
    }
  };

  const inputClass =
    'w-full rounded-[10px] border border-[#e0efe7] bg-[#f9fcfb] px-3 py-2.5 text-[13.5px] text-elche-text outline-none focus:border-elche-primary focus:bg-white';
  const labelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]';

  return (
    <div className="mx-auto max-w-[1440px] animate-fade-in">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center gap-2 rounded-full bg-elche-primary/[0.09] px-3.5 py-1.5">
            <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-elche-primary" />
            <span className="text-xs font-bold tracking-wide text-elche-primary">{openCount} abiertas</span>
          </div>
          <span className="text-[12.5px] font-semibold text-[#8aa397]">
            {assigned.length} asignadas · {cantinas.length} registradas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            title="Refrescar"
            className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-elche-gray bg-white text-elche-text-light transition-colors hover:text-elche-primary"
          >
            <span className={`ms text-xl ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
          <button
            onClick={() => setShowCreate(s => !s)}
            className="flex items-center gap-1.5 rounded-[11px] bg-elche-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(0,150,79,.28)] transition-colors hover:bg-elche-secondary"
          >
            <span className="ms text-lg">{showCreate ? 'close' : 'add_business'}</span>
            {showCreate ? 'Cancelar' : 'Nueva cantina'}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-4 flex animate-fade-in flex-wrap items-end gap-3 rounded-2xl border border-elche-gray bg-white p-4">
          <div className="min-w-[200px] flex-1">
            <label className={labelClass}>Nombre de la cantina</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Fondo Norte" className={inputClass} />
          </div>
          <div className="w-32">
            <label className={labelClass}>PIN</label>
            <input value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="0000" className={`${inputClass} text-center font-bold`} />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newPin.trim()}
            className="rounded-[10px] bg-elche-primary px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-elche-secondary disabled:opacity-50"
          >
            {creating ? '⏳' : 'Crear y asignar'}
          </button>
        </div>
      )}

      {loading && cantinas.length === 0 ? (
        <div className="py-10 text-center text-elche-text-light">Cargando cantinas…</div>
      ) : (
        <>
          {/* ---------------- Asignadas ---------------- */}
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="ms ms-fill text-xl text-elche-primary">check_circle</span>
            <h3 className="m-0 text-[15px] font-extrabold tracking-tight text-elche-text">Asignadas a este evento</h3>
            <span className="rounded-full bg-elche-primary/10 px-2.5 py-0.5 text-[11px] font-extrabold text-elche-primary">
              {assigned.length}
            </span>
          </div>

          {assigned.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-elche-border bg-white/50 py-10 text-center italic text-elche-text-light">
              Ninguna cantina asignada. Actívalas abajo o crea una nueva.
            </div>
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
              {assigned.map(c => (
                <CantinaCard
                  key={c.cantina_id}
                  c={c}
                  onOpen={() => router.push(`/admin/${eventId}/cantina/${c.cantina_id}`)}
                  onToggle={() => toggleAssign(c.cantina_id, false)}
                  onShowQr={() => setQrCantina(c)}
                />
              ))}
            </div>
          )}

          {/* ---------------- No asignadas ---------------- */}
          {unassigned.length > 0 && (
            <div className="mt-8">
              <div className="mb-3.5 flex items-center gap-2.5">
                <span className="ms text-xl text-[#8aa397]">radio_button_unchecked</span>
                <h3 className="m-0 text-[15px] font-extrabold tracking-tight text-elche-text-light">
                  No asignadas a este evento
                </h3>
                <span className="rounded-full bg-[#f0f4f2] px-2.5 py-0.5 text-[11px] font-extrabold text-[#8aa397]">
                  {unassigned.length}
                </span>
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
                {unassigned.map(c => (
                  <div
                    key={c.cantina_id}
                    className="flex items-center gap-3 rounded-[13px] border border-dashed border-[#d3ddd7] bg-[#f9fbfa] px-4 py-3.5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eef2f0]">
                      <span className="ms text-[19px] text-[#94a39a]">{cantinaIcon(c.cantina_id)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-extrabold text-elche-text-light">{c.cantina_name}</div>
                    </div>
                    <AssignSwitch on={false} onChange={() => toggleAssign(c.cantina_id, true)} title="Asignar al evento" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal QR */}
      {qrCantina && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setQrCantina(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-1 text-xl font-extrabold text-elche-text">{qrCantina.cantina_name}</div>
            <div className="mb-6 text-xs font-medium text-elche-text-light">
              QR de acceso — los camareros lo escanean para abrir su POS
            </div>
            <div className="inline-block rounded-2xl border-2 border-elche-gray bg-white p-4">
              <QRCode value={`${CANTINA_QR_PREFIX}${qrCantina.qr_token}`} size={200} />
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-[11px] bg-elche-primary py-3 text-sm font-bold text-white transition-colors hover:bg-elche-secondary"
              >
                Imprimir
              </button>
              <button
                onClick={() => setQrCantina(null)}
                className="flex-1 rounded-[11px] border border-elche-gray bg-white py-3 text-sm font-bold text-elche-text transition-colors hover:bg-elche-bg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CantinaCard({ c, onOpen, onToggle, onShowQr }: {
  c: CantinaGridRow; onOpen: () => void; onToggle: () => void; onShowQr: () => void;
}) {
  const open = c.active_waiters > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-elche-gray bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(16,40,26,.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-elche-primary"
    >
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-b border-[#f0f6f2] px-4 py-3.5">
        <div
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl"
          style={{ background: cantinaIconBg(c.cantina_id) }}
        >
          <span className="ms text-[22px] text-white">{cantinaIcon(c.cantina_id)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-extrabold tracking-tight text-elche-text">{c.cantina_name}</span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                open ? 'bg-elche-primary/10 text-elche-primary' : 'bg-[#fff4e5] text-[#b0790a]'
              }`}
            >
              <span className="h-[5px] w-[5px] rounded-full bg-current" />
              {open ? 'Abierta' : 'En espera'}
            </span>
          </div>
        </div>
        <AssignSwitch on onChange={onToggle} title="Quitar del evento" />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-px bg-[#f0f6f2]">
        <div className="bg-white px-4 py-3">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">Recaudación</div>
          <div className="mt-0.5 text-lg font-extrabold text-elche-primary">{eurShort(c.total_cents)}</div>
        </div>
        <div className="bg-white px-4 py-3">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8aa397]">Tickets</div>
          <div className="mt-0.5 text-lg font-extrabold text-elche-text">{c.num_sales.toLocaleString('es-ES')}</div>
        </div>
      </div>

      {/* Productos destacados */}
      {c.featured.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-[#f0f6f2] px-4 py-3">
          {c.featured.map((f, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11.5px] font-bold ${
                f.qty <= 0
                  ? 'border-[#f5b5b5] bg-[#fdecec] text-[#d63838]'
                  : 'border-[#dcefe4] bg-[#eef6f1] text-[#2a6b45]'
              }`}
            >
              {f.name} · {f.qty}
            </span>
          ))}
        </div>
      )}

      {/* Pie */}
      <div className="mt-auto flex items-center gap-2.5 border-t border-[#f0f6f2] px-4 py-3">
        <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-elche-text-light">
          <span className="ms text-[17px] text-[#8aa397]">groups</span>
          {c.active_waiters}
        </div>

        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
            c.pending_incidents > 0 ? 'bg-red-500/10 text-[#d63838]' : 'bg-[#eef6f1] text-[#2a6b45]'
          }`}
        >
          <span className="ms text-[14px]">{c.pending_incidents > 0 ? 'error' : 'check_circle'}</span>
          {c.pending_incidents}
        </div>

        {c.low_stock_count > 0 && (
          <div className="inline-flex items-center gap-1 rounded-full bg-[#fff7e6] px-2.5 py-1 text-[11.5px] font-bold text-[#b0790a]">
            <span className="ms text-[14px]">trending_down</span>
            {c.low_stock_count}
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={e => { e.stopPropagation(); onShowQr(); }}
          title="Código QR"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8aa397] transition-colors hover:bg-[#f0f6f2] hover:text-elche-primary"
        >
          <span className="ms text-[19px]">qr_code_2</span>
        </button>
        <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-elche-primary">
          Ver detalle
          <span className="ms text-[17px]">arrow_forward</span>
        </span>
      </div>
    </div>
  );
}

function AssignSwitch({ on, onChange, title }: { on: boolean; onChange: () => void; title: string }) {
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors ${on ? 'bg-elche-primary' : 'bg-[#d3ddd7]'}`}
    >
      <span
        className={`absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.22)] transition-[left] ${
          on ? 'left-[22px]' : 'left-[3px]'
        }`}
      />
    </button>
  );
}
