'use client';

import React, { useState } from 'react';
import { Product } from '../hooks/usePosData';
import { INCIDENT_TYPES, IncidentType, incidentMeta } from '@/lib/incidents';

interface IncidentModalProps {
  visible: boolean;
  products: Product[];
  onClose: () => void;
  onSubmit: (input: { type: IncidentType; productIds: string[]; description: string }) => Promise<void>;
}

export default function IncidentModal({ visible, products, onClose, onSubmit }: IncidentModalProps) {
  const [type, setType] = useState<IncidentType | null>(null);
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const meta = type ? incidentMeta(type) : null;
  const toggleProduct = (id: string) =>
    setProductIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const canSubmit =
    !!type &&
    (!meta!.needsProducts || productIds.size > 0) &&
    (!meta!.needsDescription || description.trim().length > 0);

  const reset = () => { setType(null); setProductIds(new Set()); setDescription(''); };

  const handleSubmit = async () => {
    if (!type || !canSubmit || busy) return;
    setBusy(true);
    try {
      await onSubmit({ type, productIds: Array.from(productIds), description });
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const close = () => { if (!busy) { reset(); onClose(); } };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={close}>
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-xl text-elche-text mb-1 flex items-center gap-2">
          <span>⚠️</span> Reportar incidencia
        </div>
        <div className="text-xs text-elche-text-light mb-4">Se avisará al administrador en tiempo real.</div>

        {/* Tipo */}
        <div className="grid gap-2 mb-4">
          {INCIDENT_TYPES.map(t => (
            <button
              key={t.type}
              onClick={() => setType(t.type)}
              className={`w-full p-3 rounded-2xl border text-left font-bold transition-all flex items-center gap-3 ${
                type === t.type ? 'bg-elche-primary/10 border-elche-primary text-elche-primary' : 'bg-white border-elche-gray text-elche-text hover:border-elche-primary/40'}`}>
              <span className="text-xl">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Selección de productos (STOCK) */}
        {meta?.needsProducts && (
          <div className="mb-4">
            <div className="text-sm font-bold text-elche-text mb-2">¿Qué productos faltan?</div>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className={`p-2 rounded-xl border text-sm font-medium text-left transition-all ${
                    productIds.has(p.id) ? 'bg-elche-primary text-white border-elche-primary' : 'bg-white border-elche-gray text-elche-text hover:border-elche-primary/40'}`}>
                  {productIds.has(p.id) ? '✓ ' : ''}{p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Descripción */}
        {meta && (
          <div className="mb-4">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={meta.needsDescription ? 'Describe la incidencia *' : 'Detalle (opcional)'}
              rows={3}
              className="w-full p-3 rounded-xl border border-elche-gray focus:ring-2 focus:ring-elche-primary focus:outline-none resize-none"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={close}
            disabled={busy}
            className="flex-1 py-3 rounded-xl bg-white border border-elche-gray text-elche-text font-bold hover:bg-elche-gray/20 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || busy}
            className="flex-1 py-3 rounded-xl bg-elche-primary text-white font-bold hover:bg-elche-secondary transition-colors disabled:opacity-50">
            {busy ? '⏳ Enviando...' : 'Enviar aviso'}
          </button>
        </div>
      </div>
    </div>
  );
}
