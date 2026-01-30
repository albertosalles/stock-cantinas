import React, { useState } from 'react';
import { EventProductRow } from '../hooks/useAdminCatalog';

interface EventCatalogTabProps {
  eventProducts: EventProductRow[];
  allProducts: { id: string; name: string }[];
  loading: boolean;
  setEventProducts: React.Dispatch<React.SetStateAction<EventProductRow[]>>;
  onSave: (row: EventProductRow) => void;
  onDelete: (row: EventProductRow) => void;
  onAdd: (prodId: string, price: string, threshold: string, active: boolean) => void;
  onCreateGlobal: (name: string) => void;
}

export default function EventCatalogTab({
  eventProducts,
  allProducts,
  loading,
  setEventProducts,
  onSave,
  onDelete,
  onAdd,
  onCreateGlobal
}: EventCatalogTabProps) {
  const [newProdId, setNewProdId] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdThreshold, setNewProdThreshold] = useState('');
  const [newProdActive, setNewProdActive] = useState(true);
  const [newGlobalName, setNewGlobalName] = useState('');

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-elche-gray/50">
      <div className="font-bold text-xl mb-6 text-elche-text border-b border-elche-gray/50 pb-4 flex items-center gap-2">
        <span className="bg-elche-primary/10 p-2 rounded-xl text-elche-primary">🛍️</span>
        Catálogo del evento
      </div>

      {loading ? (
        <div className="p-10 text-center text-elche-text-light flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-elche-primary border-t-transparent rounded-full animate-spin" />
          Cargando catálogo...
        </div>
      ) : (
        <div className="grid gap-8">
          {/* Product Table */}
          <div className="overflow-x-auto rounded-2xl border border-elche-gray/50">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-elche-gray/20 text-elche-text-light text-xs font-bold uppercase tracking-wider">
                  <th className="text-left p-3">Producto</th>
                  <th className="text-center p-3">Precio (€)</th>
                  <th className="text-center p-3">Umbral</th>
                  <th className="text-center p-3">Activo</th>
                  <th className="text-right p-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-elche-gray/30">
                {eventProducts.map(row => (
                  <tr key={row.id} className="hover:bg-elche-gray/5 transition-colors group">
                    <td className="p-3 font-bold text-elche-text">
                      {row.name}
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        step="0.5"
                        value={row.editPrice}
                        onChange={e => setEventProducts(l => l.map(r => r.id === row.id ? { ...r, editPrice: e.target.value } : r))}
                        className="p-1.5 rounded-xl w-20 border border-elche-gray/50 text-center font-bold focus:ring-2 focus:ring-elche-primary focus:outline-none"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        value={row.editThreshold}
                        min={0}
                        onChange={e => setEventProducts(l => l.map(r => r.id === row.id ? { ...r, editThreshold: e.target.value } : r))}
                        className="p-1.5 rounded-xl w-16 border border-elche-gray/50 text-center font-bold focus:ring-2 focus:ring-elche-primary focus:outline-none"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.editActive}
                        onChange={e => setEventProducts(l => l.map(r => r.id === row.id ? { ...r, editActive: e.target.checked } : r))}
                        className="w-5 h-5 accent-elche-primary rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => onSave(row)}
                        className="p-2 rounded-xl bg-elche-success/10 text-elche-success hover:bg-elche-success hover:text-white transition-all"
                        title="Guardar"
                      >
                        💾
                      </button>
                      <button
                        onClick={() => onDelete(row)}
                        className="p-2 rounded-xl bg-elche-danger/10 text-elche-danger hover:bg-elche-danger hover:text-white transition-all"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Add to Event */}
            <div className="bg-elche-gray/30 p-5 rounded-2xl border border-elche-gray/50">
              <div className="font-bold text-elche-text mb-4">➕ Añadir producto existente</div>
              <div className="grid gap-3">
                <select
                  value={newProdId}
                  onChange={e => setNewProdId(e.target.value)}
                  className="p-3 rounded-xl border border-elche-gray bg-white focus:ring-2 focus:ring-elche-primary focus:outline-none"
                >
                  <option value="">Seleccionar producto...</option>
                  {allProducts.filter(p => !eventProducts.some(ep => ep.product_id === p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="0.01" placeholder="Precio (€)" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} className="p-3 rounded-xl border border-elche-gray focus:ring-2 focus:ring-elche-primary focus:outline-none" />
                  <input type="number" placeholder="Umbral Stock" value={newProdThreshold} onChange={e => setNewProdThreshold(e.target.value)} className="p-3 rounded-xl border border-elche-gray focus:ring-2 focus:ring-elche-primary focus:outline-none" />
                </div>
                <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-elche-gray">
                  <input type="checkbox" checked={newProdActive} onChange={e => setNewProdActive(e.target.checked)} className="w-5 h-5 accent-elche-primary" />
                  <span className="font-medium text-sm">Activo para venta</span>
                </div>
                <button
                  onClick={() => { onAdd(newProdId, newProdPrice, newProdThreshold, newProdActive); setNewProdId(''); setNewProdPrice(''); setNewProdThreshold(''); }}
                  className="w-full py-3 rounded-xl bg-elche-text text-white font-bold hover:bg-elche-primary transition-colors shadow-sm"
                >
                  Añadir al evento
                </button>
              </div>
            </div>

            {/* Create Global */}
            <div className="bg-elche-gray/30 p-5 rounded-2xl border border-elche-gray/50 h-fit">
              <div className="font-bold text-elche-text mb-4">🌍 Crear nuevo producto global</div>
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Nombre del producto"
                  value={newGlobalName}
                  onChange={e => setNewGlobalName(e.target.value)}
                  className="flex-1 p-3 rounded-xl border border-elche-gray focus:ring-2 focus:ring-elche-primary focus:outline-none"
                />
                <button
                  onClick={() => { onCreateGlobal(newGlobalName); setNewGlobalName(''); }}
                  className="px-5 py-3 rounded-xl bg-elche-primary text-white font-bold hover:bg-elche-secondary transition-colors shadow-sm"
                >
                  Crear
                </button>
              </div>
              <p className="text-xs text-elche-text-light bg-white/50 p-2 rounded-lg">
                ℹ️ Crea un producto en la base de datos global para poder seleccionarlo luego en cualquier evento.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

