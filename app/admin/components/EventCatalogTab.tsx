'use client';

import React, { useMemo, useState } from 'react';
import { EventProductRow } from '../hooks/useAdminCatalog';
import { PRODUCT_CATEGORIES, UNCATEGORIZED_LABEL } from '@/lib/categories';
import { CATEGORY_FILTERS, categoryMsIcon, categoryTone } from '@/lib/adminUi';

interface EventCatalogTabProps {
  eventProducts: EventProductRow[];
  allProducts: { id: string; name: string }[];
  loading: boolean;
  setEventProducts: React.Dispatch<React.SetStateAction<EventProductRow[]>>;
  onSave: (row: EventProductRow) => Promise<void> | void;
  onDelete: (row: EventProductRow) => void;
  onAdd: (prodId: string, price: string, threshold: string, active: boolean) => void;
  onCreateGlobal: (name: string, category?: string) => void;
}

export default function EventCatalogTab({
  eventProducts,
  allProducts,
  loading,
  setEventProducts,
  onSave,
  onDelete,
  onAdd,
  onCreateGlobal,
}: EventCatalogTabProps) {
  const [filter, setFilter] = useState<string>('Todos');
  const [showAdd, setShowAdd] = useState(false);

  // Alta: producto existente
  const [newProdId, setNewProdId] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdThreshold, setNewProdThreshold] = useState('');
  // Alta: producto global nuevo
  const [newGlobalName, setNewGlobalName] = useState('');
  const [newGlobalCategory, setNewGlobalCategory] = useState('');

  const rows = useMemo(() => {
    if (filter === 'Todos') return eventProducts;
    if (filter === UNCATEGORIZED_LABEL) return eventProducts.filter(p => !p.editCategory);
    return eventProducts.filter(p => p.editCategory === filter);
  }, [eventProducts, filter]);

  const patch = (id: string, fields: Partial<EventProductRow>) =>
    setEventProducts(list => list.map(r => (r.id === id ? { ...r, ...fields } : r)));

  /** Los toggles son acciones discretas: se guardan al instante. */
  const toggleAndSave = async (row: EventProductRow, fields: Partial<EventProductRow>) => {
    patch(row.id, fields);
    try {
      await onSave({ ...row, ...fields });
    } catch (e: any) {
      alert(e.message || 'No se pudo guardar el cambio');
    }
  };

  const dirty = (row: EventProductRow) =>
    row.editPrice !== (row.price_cents / 100).toFixed(2) ||
    row.editThreshold !== String(row.low_stock_threshold) ||
    (row.editCategory || null) !== (row.category ?? null);

  const inputClass =
    'w-full rounded-[9px] border border-[#e0efe7] bg-[#f9fcfb] px-2.5 py-2 text-[13px] font-bold text-elche-text outline-none focus:border-elche-primary focus:bg-white';
  const labelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#8aa397]';
  const thClass = 'px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8aa397]';

  return (
    <div className="mx-auto max-w-[1440px] animate-fade-in">
      {/* Filtros + alta */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_FILTERS.map(cat => {
            const active = filter === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors ${
                  active
                    ? 'border border-elche-primary bg-elche-primary text-white'
                    : 'border border-elche-gray bg-white text-elche-text-light hover:border-elche-primary hover:text-elche-primary'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-1.5 rounded-[11px] bg-elche-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(0,150,79,.28)] transition-colors hover:bg-elche-secondary"
        >
          <span className="ms text-lg">{showAdd ? 'close' : 'add'}</span>
          {showAdd ? 'Cancelar' : 'Nuevo producto'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 grid animate-fade-in gap-4 md:grid-cols-2">
          {/* Añadir al evento */}
          <div className="rounded-2xl border border-elche-gray bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-[13.5px] font-extrabold text-elche-text">
              <span className="ms text-lg text-elche-primary">playlist_add</span>
              Añadir producto existente
            </div>
            <div className="grid gap-3">
              <div>
                <label className={labelClass}>Producto</label>
                <select
                  value={newProdId}
                  onChange={e => setNewProdId(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Seleccionar producto...</option>
                  {allProducts
                    .filter(p => !eventProducts.some(ep => ep.product_id === p.id))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Precio (€)</label>
                  <input type="number" step="0.10" min="0" value={newProdPrice}
                    onChange={e => setNewProdPrice(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Umbral de stock</label>
                  <input type="number" min="0" value={newProdThreshold}
                    onChange={e => setNewProdThreshold(e.target.value)} className={inputClass} />
                </div>
              </div>
              <button
                onClick={() => {
                  onAdd(newProdId, newProdPrice, newProdThreshold, true);
                  setNewProdId(''); setNewProdPrice(''); setNewProdThreshold('');
                }}
                disabled={!newProdId}
                className="rounded-[10px] bg-elche-primary py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-elche-secondary disabled:opacity-50"
              >
                Añadir al evento
              </button>
            </div>
          </div>

          {/* Crear producto global */}
          <div className="h-fit rounded-2xl border border-elche-gray bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-[13.5px] font-extrabold text-elche-text">
              <span className="ms text-lg text-elche-primary">public</span>
              Crear producto global
            </div>
            <div className="grid gap-3">
              <div>
                <label className={labelClass}>Nombre</label>
                <input type="text" placeholder="Ej: Cerveza 33cl" value={newGlobalName}
                  onChange={e => setNewGlobalName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Categoría</label>
                <select value={newGlobalCategory} onChange={e => setNewGlobalCategory(e.target.value)}
                  className={`${inputClass} cursor-pointer`}>
                  <option value="">{UNCATEGORIZED_LABEL}</option>
                  {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button
                onClick={() => { onCreateGlobal(newGlobalName, newGlobalCategory); setNewGlobalName(''); setNewGlobalCategory(''); }}
                disabled={!newGlobalName.trim()}
                className="rounded-[10px] border border-elche-gray bg-elche-bg py-2.5 text-[13px] font-bold text-elche-text transition-colors hover:border-elche-primary hover:text-elche-primary disabled:opacity-50"
              >
                Crear producto
              </button>
              <p className="rounded-lg bg-elche-bg p-2 text-[11px] text-elche-text-light">
                Se crea en el catálogo global para poder añadirlo después a cualquier evento.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-elche-gray bg-white">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-12 text-elche-text-light">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-elche-primary border-t-transparent" />
            Cargando catálogo...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center italic text-elche-text-light">
            {eventProducts.length === 0
              ? 'Este evento no tiene productos todavía'
              : `Sin productos en la categoría "${filter}"`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="bg-[#f7fbf9]">
                  <th className={`text-left ${thClass} pl-5`}>Producto</th>
                  <th className={`text-left ${thClass}`}>Categoría</th>
                  <th className={`text-center ${thClass}`}>Precio (€)</th>
                  <th className={`text-center ${thClass}`}>Umbral</th>
                  <th className={`text-center ${thClass}`}>Activo</th>
                  <th className={`text-center ${thClass}`}>
                    <span className="ms mr-1 align-[-2px] text-[14px] text-amber-500">star</span>
                    Destacado
                  </th>
                  <th className={`${thClass} w-[110px] pr-5`} />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const tone = categoryTone(row.editCategory || null);
                  const isDirty = dirty(row);
                  return (
                    <tr key={row.id} className="border-t border-[#f0f6f2] transition-colors hover:bg-[#fafcfb]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
                            style={{ background: tone.bg }}
                          >
                            <span className="ms text-[19px]" style={{ color: tone.fg }}>
                              {categoryMsIcon(row.editCategory || null)}
                            </span>
                          </div>
                          <span className="text-[13.5px] font-bold text-elche-text">{row.name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={row.editCategory}
                          onChange={e => patch(row.id, { editCategory: e.target.value })}
                          className="cursor-pointer rounded-[9px] border border-[#e0efe7] bg-[#f9fcfb] px-2.5 py-2 text-[12.5px] font-semibold text-elche-text outline-none focus:border-elche-primary"
                        >
                          <option value="">{UNCATEGORIZED_LABEL}</option>
                          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <input
                            type="number" step="0.10" min="0" value={row.editPrice}
                            onChange={e => patch(row.id, { editPrice: e.target.value })}
                            className="w-[82px] rounded-[9px] border border-[#e0efe7] bg-[#f9fcfb] px-2.5 py-2 text-center text-[13px] font-bold text-elche-text outline-none focus:border-elche-primary focus:bg-white"
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <input
                            type="number" step="1" min="0" value={row.editThreshold}
                            onChange={e => patch(row.id, { editThreshold: e.target.value })}
                            className="w-16 rounded-[9px] border border-[#e0efe7] bg-[#f9fcfb] px-2.5 py-2 text-center text-[13px] font-bold text-elche-text outline-none focus:border-elche-primary focus:bg-white"
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAndSave(row, { editActive: !row.editActive })}
                          title="Activo para venta"
                          className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border transition-colors ${
                            row.editActive
                              ? 'border-[#bfe3cf] bg-elche-primary/10 text-elche-primary'
                              : 'border-[#e0efe7] bg-white text-[#c2cfc7]'
                          }`}
                        >
                          <span className="ms text-lg">
                            {row.editActive ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAndSave(row, { editFeatured: !row.editFeatured })}
                          title="Destacado en las tarjetas de cantina"
                          className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border transition-colors ${
                            row.editFeatured
                              ? 'border-[#f3d78f] bg-amber-500/[0.14] text-amber-500'
                              : 'border-[#e0efe7] bg-white text-[#c2cfc7]'
                          }`}
                        >
                          <span className="ms text-lg">{row.editFeatured ? 'star' : 'star_outline'}</span>
                        </button>
                      </td>

                      <td className="py-3 pl-4 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={async () => {
                              try { await onSave(row); } catch (e: any) { alert(e.message || 'Error al guardar'); }
                            }}
                            disabled={!isDirty}
                            title={isDirty ? 'Guardar cambios' : 'Sin cambios pendientes'}
                            className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border transition-colors ${
                              isDirty
                                ? 'border-[#bfe3cf] bg-elche-primary/10 text-elche-primary hover:bg-elche-primary hover:text-white'
                                : 'border-[#e0efe7] bg-white text-[#c2cfc7]'
                            }`}
                          >
                            <span className="ms text-lg">save</span>
                          </button>
                          <button
                            onClick={() => confirm(`¿Quitar "${row.name}" de este evento?`) && onDelete(row)}
                            title="Quitar del evento"
                            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#f0e0e0] bg-white text-[#c98a8a] transition-colors hover:border-[#f5b5b5] hover:bg-red-50 hover:text-red-500"
                          >
                            <span className="ms text-lg">delete</span>
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

        <div className="flex items-center gap-1.5 border-t border-[#f0f6f2] px-5 py-3 text-[11.5px] text-[#8aa397]">
          <span className="ms text-[15px]">info</span>
          Activo y Destacado se guardan al instante. Precio, umbral y categoría requieren pulsar guardar. La categoría afecta al producto en todos los eventos.
        </div>
      </div>
    </div>
  );
}
