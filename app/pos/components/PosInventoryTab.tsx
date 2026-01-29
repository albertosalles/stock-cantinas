import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Product, InventoryRow } from '../hooks/usePosData';

interface PosInventoryTabProps {
  eventId: string;
  cantinaId: string;
  userId: string;
  products: Product[];
  inventory: InventoryRow[];
  onRefresh: () => void;
}

export default function PosInventoryTab({ eventId, cantinaId, userId, products, inventory, onRefresh }: PosInventoryTabProps) {
  // --- Estados Locales ---
  const [initForm, setInitForm] = useState<Record<string, number | ''>>({});

  const [adjustForm, setAdjustForm] = useState<Record<string, number>>({});
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT' | 'WASTE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'RETURN'>('ADJUSTMENT');
  const [adjustReason, setAdjustReason] = useState<string>('Ajuste manual');

  const [finalForm, setFinalForm] = useState<Record<string, number>>({});

  // --- Effects ---

  // Cargar inventario inicial
  useEffect(() => {
    if (!eventId || !cantinaId || products.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('inventory_snapshots')
        .select('product_id, qty')
        .eq('event_id', eventId)
        .eq('cantina_id', cantinaId)
        .eq('kind', 'INITIAL');

      const rows = data ?? [];
      const map: Record<string, number | ''> = {};
      products.forEach(p => {
        const found = rows.find((r: any) => r.product_id === p.id);
        map[p.id] = found ? found.qty : '';
      });
      setInitForm(map);
    })();
  }, [eventId, cantinaId, products]);

  // Pre-cargar form final con stock actual
  useEffect(() => {
    if (inventory.length === 0 || products.length === 0) return;
    const m: Record<string, number> = {};
    products.forEach(p => {
      const r = inventory.find(i => i.product_id === p.id);
      m[p.id] = r?.current_qty ?? 0;
    });
    setFinalForm(prev => Object.keys(prev).length === 0 ? m : prev);
  }, [inventory, products]);

  // --- Handlers ---

  const saveInitial = async () => {
    // FILTRAR: solo enviamos los productos que tengan un número válido (incluido 0).
    // Los vacíos ('') se ignoran para no sobrescribir lo que otro usuario no haya tocado.
    const lines = Object.entries(initForm)
      .filter(([_, qty]) => qty !== '')
      .map(([productId, qty]) => ({ productId, qty: Number(qty) }));

    if (lines.length === 0) {
      alert('No hay datos para guardar (campos vacíos se ignoran).');
      return;
    }

    const { error } = await supabase.rpc('set_initial_inventory_bulk', {
      p_event_id: eventId, p_cantina_id: cantinaId, p_user_id: userId, p_lines: lines
    });
    if (error) { alert(error.message); return; }
    onRefresh();
    alert('Inventario inicial actualizado ✅');
  };

  const saveAdjustments = async () => {
    const lines = Object.entries(adjustForm)
      .filter(([, delta]) => delta && delta !== 0)
      .map(([productId, delta]) => ({ productId, delta, movementType: adjustType, reason: adjustReason }));

    if (!lines.length) { alert('No hay cambios'); return; }

    const { error } = await supabase.rpc('adjust_stock_bulk', {
      p_event_id: eventId,
      p_cantina_id: cantinaId,
      p_user_id: userId,
      p_lines: lines
    });
    if (error) { alert(error.message); return; }

    setAdjustForm({});
    onRefresh();
    alert('Ajustes aplicados ✅');
  };

  const saveFinal = async () => {
    const lines = Object.entries(finalForm).map(([productId, qty]) => ({ productId, qty: Math.max(0, Number(qty || 0)) }));
    const { error } = await supabase.rpc('set_final_inventory_bulk', {
      p_event_id: eventId,
      p_cantina_id: cantinaId,
      p_user_id: userId,
      p_lines: lines
    });
    if (error) { alert(error.message); return; }
    alert('Inventario final guardado ✅');
  };

  // Helpers
  const incDelta = (pid: string, step = 1) => setAdjustForm(s => ({ ...s, [pid]: (s[pid] ?? 0) + step }));
  const decDelta = (pid: string, step = 1) => setAdjustForm(s => ({ ...s, [pid]: (s[pid] ?? 0) - step }));

  // Helper para inventario inicial
  const setInitVal = (pid: string, val: string | number) => {
    setInitForm(s => ({ ...s, [pid]: val === '' ? '' : Number(val) }));
  };
  const incInit = (pid: string) => setInitForm(s => ({ ...s, [pid]: ((s[pid] === '' ? 0 : s[pid]) as number) + 1 }));
  const decInit = (pid: string) => setInitForm(s => ({ ...s, [pid]: Math.max(0, ((s[pid] === '' ? 0 : s[pid]) as number) - 1) }));

  return (
    <section className="grid gap-6 pb-24 md:pb-0">

      {/* ---- Inventario inicial ---- */}
      <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="font-bold text-xl mb-5 text-elche-text flex items-center gap-3">
          <span className="bg-elche-primary/10 text-elche-primary p-2 rounded-xl text-xl">📦</span> Inventario inicial
        </div>
        <div className="grid gap-2">
          {products.map(p => {
            const value = initForm[p.id] ?? '';
            return (
              <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between p-2 bg-elche-gray/30 rounded-2xl border border-elche-border/50 gap-2 hover:border-elche-primary/20 transition-colors">
                <div>
                  <div className="font-bold text-elche-text text-base">{p.name}</div>
                  <div className="text-elche-muted text-sm font-medium">
                    Precio: {(p.price_cents / 100).toFixed(2)} €
                  
                  
                  
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto bg-white p-1 rounded-lg border border-elche-border/50 shadow-sm">
                  <button
                    onClick={() => decInit(p.id)}
                    className="w-8 h-8 rounded-md bg-elche-gray/20 text-elche-text font-bold active:scale-90 transition-transform flex items-center justify-center text-lg hover:bg-elche-gray/40">
                    −
                  </button>
                  <input
                    type="number" min={0} value={value}
                    placeholder="-"
                    onChange={e => setInitVal(p.id, e.target.value)}
                    className="w-8 h-8 text-center font-bold border-none rounded-md bg-transparent focus:ring-0 p-0 text-base placeholder-gray-300"
                  />
                  <button
                    onClick={() => incInit(p.id)}
                    className="w-8 h-8 rounded-md bg-elche-gray/20 text-elche-text font-bold active:scale-90 transition-transform flex items-center justify-center text-lg hover:bg-elche-gray/40">
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col md:flex-row gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={saveInitial}
            className="w-full md:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-elche-primary to-elche-secondary text-white font-bold shadow-lg shadow-elche-primary/30 active:scale-95 transition-all hover:shadow-elche-primary/40"
          >
            Guardar cambios
          </button>
        </div>
      </div>

      {/* ---- Ajustes de stock actual ---- */}
      <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-elche-border">
        <div className="font-bold text-xl mb-5 text-elche-text flex items-center gap-3">
          <span className="bg-elche-primary/10 text-elche-primary p-2 rounded-xl text-xl">⚙️</span> Ajustes de stock (actual)
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-5 p-4 bg-elche-gray/30 rounded-2xl border border-elche-border/50">
          <select
            value={adjustType}
            onChange={e => setAdjustType(e.target.value as any)}
            className="p-3.5 rounded-xl font-bold bg-white border border-elche-border shrink-0 focus:ring-2 focus:ring-elche-primary focus:outline-none shadow-sm text-sm">
            <option value="ADJUSTMENT">Ajuste manual</option>
            <option value="TRANSFER_IN">Entrada / Traspaso recibido</option>
            <option value="TRANSFER_OUT">Salida / Traspaso enviado</option>
            <option value="WASTE">Roto / Consumo</option>
            <option value="RETURN">Devolución</option>
          </select>
          <input
            placeholder="Motivo (opcional)"
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value)}
            className="flex-1 p-3.5 rounded-xl text-sm border border-elche-border focus:ring-2 focus:ring-elche-primary focus:outline-none shadow-sm"
          />
        </div>

        <div className="grid gap-3">
          {products.map(p => {
            const inv = inventory.find(i => i.product_id === p.id);
            const cur = inv?.current_qty ?? 0;
            const delta = adjustForm[p.id] ?? 0;
            return (
              <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-elche-gray/30 rounded-xl border border-elche-border/50 gap-2 hover:border-elche-primary/20 transition-colors">
                <div>
                  <div className="font-bold text-elche-text text-base">{p.name}</div>
                  <div className="text-elche-muted text-sm font-medium mt-0.5">Stock actual: <strong className="text-elche-text bg-white px-1.5 py-0 rounded border border-elche-border/50">{cur}</strong></div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-elche-border/50 shadow-sm">
                    <button
                      onClick={() => decDelta(p.id)}
                      className="w-8 h-8 rounded-md bg-elche-gray/20 text-elche-text font-bold active:scale-90 transition-transform flex items-center justify-center text-lg hover:bg-elche-gray/40">
                      −
                    </button>
                    <div className="w-8 text-center font-bold text-base">{delta > 0 ? `+${delta}` : delta}</div>
                    <button
                      onClick={() => incDelta(p.id)}
                      className="w-8 h-8 rounded-md bg-elche-gray/20 text-elche-text font-bold active:scale-90 transition-transform flex items-center justify-center text-lg hover:bg-elche-gray/40">
                      +
                    </button>
                  </div>
                  <div className={`text-xs font-semibold text-center px-3 py-1.5 rounded-lg min-w-[70px] shadow-sm transition-colors ${delta !== 0 ? 'bg-elche-primary text-white' : 'text-elche-muted bg-elche-gray'}`}>
                    Total: <span className="text-base font-bold ml-1">{cur + delta}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row gap-3 mt-6 pt-4 border-t border-elche-border">
          <button
            onClick={saveAdjustments}
            className="w-full md:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-elche-primary to-elche-secondary text-white font-bold shadow-lg shadow-elche-primary/30 active:scale-95 transition-all hover:shadow-elche-primary/40">
            ✅ Aplicar ajustes
          </button>
          <button
            onClick={() => setAdjustForm({})}
            className="w-full md:w-auto px-6 py-3.5 rounded-xl bg-white border border-elche-border text-elche-muted font-bold active:bg-elche-gray/20 transition-colors hover:text-elche-text hover:border-elche-gray">
            🧹 Limpiar
          </button>
        </div>
      </div>

      {/* ---- Inventario final ---- */}
      <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-elche-border">
        <div className="font-bold text-xl mb-5 text-elche-text flex items-center gap-3">
          <span className="bg-elche-primary/10 text-elche-primary p-2 rounded-xl text-xl">📋</span> Inventario final
        </div>
        <div className="grid gap-3">
          {products.map(p => {
            const value = finalForm[p.id] ?? 0;
            const cur = inventory.find(i => i.product_id === p.id)?.current_qty ?? 0;
            return (
              <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-elche-gray/30 rounded-xl border border-elche-border/50 gap-2 hover:border-elche-primary/20 transition-colors">
                <div>
                  <div className="font-bold text-elche-text text-sm">{p.name}</div>
                  <div className="text-elche-muted text-xs font-medium mt-0.5">Calculado: <strong className="text-elche-text bg-white px-1.5 py-0 rounded border border-elche-border/50">{cur}</strong></div>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <input
                    type="number" min={0} value={value}
                    onChange={e => setFinalForm(s => ({ ...s, [p.id]: Math.max(0, parseInt(e.target.value || '0', 10)) }))}
                    className="w-20 h-9 text-center font-bold border border-elche-border rounded-lg bg-white focus:ring-2 focus:ring-elche-primary focus:outline-none shadow-sm text-base"
                  />
                  <button
                    onClick={() => setFinalForm(s => ({ ...s, [p.id]: cur }))}
                    className="h-9 px-3 rounded-lg bg-white border border-elche-border font-bold text-xs text-elche-muted active:bg-elche-gray transition-all shadow-sm flex items-center gap-1 hover:bg-elche-bg hover:text-elche-text">
                    <span className="text-base">📊</span> Usar calc.
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col md:flex-row gap-3 mt-6 pt-4 border-t border-elche-border">
          <button
            onClick={saveFinal}
            className="w-full md:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-elche-primary to-elche-secondary text-white font-bold shadow-lg shadow-elche-primary/30 active:scale-95 transition-all hover:shadow-elche-primary/40">
            💾 Guardar final
          </button>
          <button
            onClick={() => {
              const m: Record<string, number> = {};
              products.forEach(p => {
                const r = inventory.find(i => i.product_id === p.id);
                m[p.id] = r?.current_qty ?? 0;
              });
              setFinalForm(m);
            }}
            className="w-full md:w-auto px-6 py-3.5 rounded-xl bg-white border border-elche-border text-elche-muted font-bold active:bg-elche-gray/20 transition-colors hover:text-elche-text hover:border-elche-gray">
            📊 Copiar todos
          </button>
        </div>
      </div>
    </section>
  );
}
