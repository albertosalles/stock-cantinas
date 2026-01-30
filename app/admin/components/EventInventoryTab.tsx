import React from 'react';
import { EventProductRow } from '../hooks/useAdminCatalog';
import { InventoryRow } from '../hooks/useAdminInventory';

interface EventInventoryTabProps {
  cantinas: { id: string; name: string; assigned: boolean }[];
  selectedCantinaId: string;
  setSelectedCantinaId: (id: string) => void;
  loading: boolean;
  inventory: InventoryRow[];
  products: EventProductRow[];

  initForm: Record<string, number>;
  setInitForm: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  adjustForm: Record<string, number>;
  setAdjustForm: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  adjustType: string;
  setAdjustType: (val: any) => void;
  adjustReason: string;
  setAdjustReason: (val: string) => void;

  finalForm: Record<string, number>;
  setFinalForm: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  onSaveInit: () => void;
  onApplyAdjust: () => void;
  onSaveFinal: () => void;
  onRefresh: () => void;
}

export default function EventInventoryTab({
  cantinas, selectedCantinaId, setSelectedCantinaId, loading, inventory, products,
  initForm, setInitForm, adjustForm, setAdjustForm, adjustType, setAdjustType, adjustReason, setAdjustReason,
  finalForm, setFinalForm, onSaveInit, onApplyAdjust, onSaveFinal, onRefresh
}: EventInventoryTabProps) {

  const invMap = new Map(inventory.map(r => [r.product_id, r]));

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="font-bold text-xl mb-6 text-elche-text border-b border-elche-gray/50 pb-4 flex items-center gap-2">
        <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">📦</span>
        Gestión de Inventario
      </div>

      {/* Selector Cantina */}
      <div className="mb-6 p-4 bg-elche-gray/20 rounded-2xl border border-elche-gray/50 flex flex-col md:flex-row gap-4 items-center">
        <span className="font-bold text-elche-text text-sm uppercase tracking-wide">Selecciona Cantina:</span>
        <select
          value={selectedCantinaId}
          onChange={e => setSelectedCantinaId(e.target.value)}
          className="flex-1 p-3 rounded-xl border border-elche-gray bg-white font-bold text-elche-text focus:ring-2 focus:ring-elche-primary focus:outline-none"
        >
          <option value="">-- Seleccionar --</option>
          {cantinas.filter(c => c.assigned).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selectedCantinaId && (
          <button onClick={onRefresh} className="px-5 py-3 rounded-xl bg-white border border-elche-gray font-bold text-elche-text hover:bg-elche-gray/50 transition-colors shadow-sm">
            🔄 Refrescar
          </button>
        )}
      </div>

      {!selectedCantinaId ? (
        <div className="py-16 text-center text-elche-text-light italic bg-elche-gray/5 rounded-3xl border border-dashed border-elche-gray/50">
          Selecciona una cantina arriba para gestionar su stock
        </div>
      ) : loading ? (
        <div className="py-16 text-center flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-elche-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-elche-text-light font-medium">Cargando datos de inventario...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">

          {/* INICIAL */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
            <div className="font-bold text-lg mb-4 text-elche-text flex items-center gap-2">
              <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg text-sm">🚀</span> Inventario Inicial
            </div>
            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => (
                <div key={p.product_id} className="flex justify-between items-center p-3 bg-elche-gray/10 rounded-2xl border border-elche-gray/30">
                  <span className="font-semibold text-elche-text ml-2">{p.name}</span>
                  <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-elche-gray/30 shadow-sm">
                    <button onClick={() => setInitForm(s => ({ ...s, [p.product_id]: Math.max(0, (s[p.product_id] || 0) - 1) }))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 font-bold text-gray-500">-</button>
                    <input
                      type="number"
                      value={initForm[p.product_id] ?? 0}
                      onChange={e => setInitForm(s => ({ ...s, [p.product_id]: parseInt(e.target.value || '0', 10) }))}
                      className="w-16 text-center font-bold border-none focus:ring-0 p-0"
                    />
                    <button onClick={() => setInitForm(s => ({ ...s, [p.product_id]: (s[p.product_id] || 0) + 1 }))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 font-bold text-gray-500">+</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onSaveInit} className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
              Guardar Inicial
            </button>
          </div>

          {/* AJUSTES */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
            <div className="font-bold text-lg mb-4 text-elche-text flex items-center gap-2">
              <span className="bg-amber-100 text-amber-600 p-1.5 rounded-lg text-sm">⚙️</span> Ajustes de Stock
            </div>
            <div className="flex gap-3 mb-4">
              <select value={adjustType} onChange={e => setAdjustType(e.target.value)} className="p-3 rounded-xl border border-elche-gray bg-white font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
                <option value="ADJUSTMENT">Manual</option>
                <option value="TRANSFER_IN">Entrada</option>
                <option value="TRANSFER_OUT">Salida</option>
                <option value="WASTE">Merma</option>
              </select>
              <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="flex-1 p-3 rounded-xl border border-elche-gray focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Motivo..." />
            </div>
            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => {
                const cur = invMap.get(p.product_id)?.current_qty ?? 0;
                const delta = adjustForm[p.product_id] ?? 0;
                return (
                  <div key={p.product_id} className="flex justify-between items-center p-3 bg-elche-gray/10 rounded-2xl border border-elche-gray/30">
                    <div className="ml-2">
                      <div className="font-semibold text-elche-text">{p.name}</div>
                      <div className="text-xs text-elche-text-light">Actual: <strong>{cur}</strong></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-elche-gray/30 shadow-sm">
                        <button onClick={() => setAdjustForm(s => ({ ...s, [p.product_id]: (s[p.product_id] ?? 0) - 1 }))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 font-bold text-gray-500">-</button>
                        <input type="number" value={delta} onChange={e => setAdjustForm(s => ({ ...s, [p.product_id]: parseInt(e.target.value || '0', 10) }))} className="w-12 text-center font-bold border-none focus:ring-0 p-0" />
                        <button onClick={() => setAdjustForm(s => ({ ...s, [p.product_id]: (s[p.product_id] ?? 0) + 1 }))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 font-bold text-gray-500">+</button>
                      </div>
                      <div className={`font-bold w-10 text-center ${delta !== 0 ? 'text-amber-600' : 'text-gray-300'}`}>{cur + delta}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={onApplyAdjust} className="mt-4 w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all">
              Aplicar Ajustes
            </button>
          </div>

          {/* FINAL */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
            <div className="font-bold text-lg mb-4 text-elche-text flex items-center gap-2">
              <span className="bg-elche-primary/10 text-elche-primary p-1.5 rounded-lg text-sm">🏁</span> Inventario Final
            </div>
            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(p => {
                const cur = invMap.get(p.product_id)?.current_qty ?? 0;
                return (
                  <div key={p.product_id} className="flex justify-between items-center p-3 bg-elche-gray/10 rounded-2xl border border-elche-gray/30">
                    <div className="ml-2">
                      <div className="font-semibold text-elche-text">{p.name}</div>
                      <div className="text-xs text-elche-text-light">Calc: <strong>{cur}</strong></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={finalForm[p.product_id] ?? 0}
                        onChange={e => setFinalForm(s => ({ ...s, [p.product_id]: parseInt(e.target.value || '0', 10) }))}
                        className="w-20 p-2 text-center font-bold rounded-xl border border-elche-gray/30 focus:ring-2 focus:ring-elche-primary focus:outline-none"
                      />
                      <button onClick={() => setFinalForm(s => ({ ...s, [p.product_id]: cur }))} className="p-2 bg-white rounded-xl border border-elche-gray/30 hover:bg-gray-50 text-xs font-bold shadow-sm">
                        Usar Calc
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={onSaveFinal} className="mt-4 w-full py-3 rounded-xl bg-elche-primary text-white font-bold hover:bg-elche-secondary shadow-lg shadow-elche-primary/30 transition-all">
              Guardar Final
            </button>
          </div>

        </div>
      )}
    </section>
  );
}

