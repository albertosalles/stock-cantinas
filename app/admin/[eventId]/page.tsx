"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useLiveInventory } from '@/hooks/useLiveInventory';

/**
 * Página de administración de un evento concreto.
 *
 * Permite editar los datos generales del evento, asignar o desasignar cantinas,
 * configurar el catálogo (precios y umbrales) y gestionar el inventario de
 * cualquier cantina asignada. Sigue la guía de diseño definida en `DESIGN.md`.
 */
export default function EventAdminPage() {
  // Extraemos el identificador del evento de la ruta dinámica
  const params = useParams();
  const router = useRouter();
  const eventId = (params as { eventId: string }).eventId;

  /** Datos del evento */
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<string | null>(null);

  /** Cantinas */
  interface CantinaRow { id: string; name: string; assigned: boolean; }
  const [cantinas, setCantinas] = useState<CantinaRow[]>([]);
  const [cantinasLoading, setCantinasLoading] = useState(true);

  /** Catálogo */
  interface EventProductRow {
    id: string; // id del registro en event_products
    product_id: string;
    name: string;
    price_cents: number;
    low_stock_threshold: number;
    active: boolean;
    // Campos de edición locales
    editPrice: string;
    editThreshold: string;
    editActive: boolean;
  }
  const [eventProducts, setEventProducts] = useState<EventProductRow[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  // Formulario para añadir nuevo producto
  const [newProdId, setNewProdId] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdThreshold, setNewProdThreshold] = useState('');
  const [newProdActive, setNewProdActive] = useState(true);

  // Nombre de la nueva cantina y del nuevo producto global
  const [newCantinaName, setNewCantinaName] = useState('');
  const [newProductName, setNewProductName] = useState('');




  // Definición de métricas por cantina para el panel
  interface CantinaMetrics {
    stock_total: number;
    low_stock: number;
    num_sales: number;
    total_items: number;
    total_cents: number;
  }
  // Mapa de métricas para cada cantina asignada
  const [metrics, setMetrics] = useState<{ [id: string]: CantinaMetrics }>({});
  const [metricsLoading, setMetricsLoading] = useState(false);

  /** Pestaña activa */
  // Se añade la pestaña `panel` para mostrar métricas de cada cantina
  type TabKey = 'general' | 'cantinas' | 'catalogo' | 'inventario' | 'panel';
  const [tab, setTab] = useState<TabKey>('general');

  /** Inventario por cantina */
  const [selectedCantinaId, setSelectedCantinaId] = useState<string>('');
  type InventoryRow = { product_id: string; current_qty: number; low_stock_threshold: number };
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [initForm, setInitForm] = useState<Record<string, number>>({});
  const [adjustForm, setAdjustForm] = useState<Record<string, number>>({});
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT'|'WASTE'|'TRANSFER_IN'|'TRANSFER_OUT'|'RETURN'>('ADJUSTMENT');
  const [adjustReason, setAdjustReason] = useState('Ajuste manual');
  const [finalForm, setFinalForm] = useState<Record<string, number>>({});
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // --- Panel de métricas (selector y datos por cantina) ---
  const [panelCantinaId, setPanelCantinaId] = useState<string | null>(null);

  type PanelRow = { product_id: string; name: string; current_qty: number; low_stock_threshold: number };
  const [panelRows, setPanelRows] = useState<PanelRow[]>([]);

  const [panelTotals, setPanelTotals] = useState<{ num_sales: number; total_cents: number; total_items: number }>({
    num_sales: 0, total_cents: 0, total_items: 0
  });

  // Hook realtime de cambios en stock
  const changes = useLiveInventory(eventId, selectedCantinaId || '');

  /**
   * Carga la información básica del evento.
   */
  async function fetchEvent() {
    const { data, error } = await supabase
      .from('events')
      .select('name, date, status')
      .eq('id', eventId)
      .single();
    if (!error && data) {
      setEventName(data.name);
      setEventDate(data.date);
      setEventStatus(data.status);
    }
  }


  /**
   * Guarda los cambios de nombre y fecha del evento.
   */
  async function saveEvent() {
    const { error } = await supabase
      .from('events')
      .update({ name: eventName, date: eventDate })
      .eq('id', eventId);
    if (error) {
      alert(error.message);
    } else {
      alert('Evento actualizado ✅');
    }
  }

  /**
   * Carga la lista de cantinas y su asignación al evento.
   */
  async function fetchCantinas() {
    setCantinasLoading(true);
    // Obtiene todas las cantinas
    const { data: all, error: errorAll } = await supabase
      .from('cantinas')
      .select('id, name')
      .order('name');
    // Obtiene las cantinas ya asignadas
    const { data: assigned } = await supabase
      .from('event_cantinas')
      .select('cantina_id')
      .eq('event_id', eventId);
    const assignedSet = new Set((assigned ?? []).map((row: any) => row.cantina_id));
    if (!errorAll && all) {
      const mapped = all.map((c: any) => ({ id: c.id, name: c.name, assigned: assignedSet.has(c.id) }));
      setCantinas(mapped);
    }
    setCantinasLoading(false);
  }

  /**
   * Asigna o desasigna una cantina al evento.
   */
  async function toggleCantina(cantinaId: string, assign: boolean) {
    if (assign) {
      const { error } = await supabase.from('event_cantinas').insert({ event_id: eventId, cantina_id: cantinaId });
      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('event_cantinas').delete().match({ event_id: eventId, cantina_id: cantinaId });
      if (error) {
        alert(error.message);
        return;
      }
    }
    // Refresca la lista de cantinas
    fetchCantinas();
  }

  /**
   * Carga el catálogo del evento y todos los productos disponibles.
   */
  async function fetchCatalog() {
    setCatalogLoading(true);
    // Obtiene los productos ya asociados al evento
    const { data: eventProds, error: errProd } = await supabase
      .from('event_products')
      .select('id, product_id, price_cents, low_stock_threshold, active, products(name)')
      .eq('event_id', eventId)
      .order('products(name)');
    if (!errProd) {
      const mapped = (eventProds ?? []).map((row: any) => ({
        id: row.id,
        product_id: row.product_id,
        name: row.products?.name ?? '—',
        price_cents: row.price_cents,
        low_stock_threshold: row.low_stock_threshold ?? 0,
        active: row.active ?? true,
        editPrice: (row.price_cents / 100).toFixed(2),
        editThreshold: String(row.low_stock_threshold ?? 0),
        editActive: row.active ?? true,
      }));
      setEventProducts(mapped);
    }
    // Obtiene todos los productos para el formulario de alta
    const { data: allProds, error: errAll } = await supabase
      .from('products')
      .select('id, name')
      .order('name');
    if (!errAll) setAllProducts(allProds ?? []);
    setCatalogLoading(false);
  }

  /** Carga el stock por producto para la cantina seleccionada (usa la vista v_cantina_inventory) */
  async function fetchPanelStock(cantinaId: string) {
    // 1) inventario actual por producto (para esa cantina)
    const { data: inv, error: e1 } = await supabase
        .from('v_cantina_inventory')
        .select('product_id,current_qty,low_stock_threshold')
        .match({ event_id: eventId, cantina_id: cantinaId });
    if (e1) { alert(e1.message); return; }
    const invMap = new Map(inv?.map(r => [r.product_id, r]) ?? []);

    // 2) listado de productos del evento con nombres
    const { data: prods, error: e2 } = await supabase
        .from('event_products')
        .select('product_id, low_stock_threshold, products(name)')
        .eq('event_id', eventId)
        .eq('active', true)
        .order('products(name)');
    if (e2) { alert(e2.message); return; }

    // 3) combinamos: nombre + qty actual + umbral
    const rows: PanelRow[] = (prods ?? []).map((ep: any) => {
      const r = invMap.get(ep.product_id);
      return {
        product_id: ep.product_id,
        name: ep.products?.name ?? '—',
        current_qty: r?.current_qty ?? 0,
        low_stock_threshold: (r?.low_stock_threshold ?? ep.low_stock_threshold ?? 0)
      };
    });

    setPanelRows(rows);
  }

  /** Totales de ventas para la cantina (tickets, items, facturación) */
  async function fetchPanelTotals(cantinaId: string) {
    const { data, error } = await supabase
        .from('v_sales_by_cantina')
        .select('num_sales,total_cents,total_items')
        .match({ event_id: eventId, cantina_id: cantinaId })
        .single();

    if (error) {
      // si aún no hay ventas, la vista puede devolver vacío
      setPanelTotals({ num_sales: 0, total_cents: 0, total_items: 0 });
      return;
    }
    setPanelTotals({
      num_sales: data?.num_sales ?? 0,
      total_cents: data?.total_cents ?? 0,
      total_items: data?.total_items ?? 0
    });
  }


  /**
   * Calcula las métricas de stock y ventas por cantina asignada al evento.
   * Agrupa el inventario actual y las ventas para cada cantina y actualiza el estado `metrics`.
   */
  async function fetchMetrics() {
    setMetricsLoading(true);
    try {
      // Crear mapa inicial para todas las cantinas asignadas con valores por defecto
      const assigned = cantinas.filter(c => c.assigned).map(c => c.id);
      const metricsMap: { [id: string]: CantinaMetrics } = {};
      assigned.forEach(id => {
        metricsMap[id] = {
          stock_total: 0,
          low_stock: 0,
          num_sales: 0,
          total_items: 0,
          total_cents: 0,
        };
      });
      if (assigned.length === 0) {
        setMetrics(metricsMap);
        setMetricsLoading(false);
        return;
      }
      // Inventario actual: sumatoria y low stock
      const { data: invRows } = await supabase
        .from('v_cantina_inventory')
        .select('cantina_id, current_qty, low_stock_threshold')
        .eq('event_id', eventId);
      if (invRows) {
        invRows.forEach((row: any) => {
          const id = row.cantina_id;
          if (!metricsMap[id]) return;
          metricsMap[id].stock_total += row.current_qty ?? 0;
          if ((row.current_qty ?? 0) <= (row.low_stock_threshold ?? 0)) {
            metricsMap[id].low_stock += 1;
          }
        });
      }
      // Ventas agregadas
      const { data: salesRows } = await supabase
        .from('v_sales_by_cantina')
        .select('cantina_id, num_sales, total_items, total_cents')
        .eq('event_id', eventId);
      if (salesRows) {
        salesRows.forEach((row: any) => {
          const id = row.cantina_id;
          if (!metricsMap[id]) return;
          metricsMap[id].num_sales = row.num_sales ?? 0;
          metricsMap[id].total_items = row.total_items ?? 0;
          metricsMap[id].total_cents = row.total_cents ?? 0;
        });
      }
      setMetrics(metricsMap);
    } catch (error) {
      console.error('Error fetching metrics', error);
    } finally {
      setMetricsLoading(false);
    }
  }

  /**
   * Crea una cantina nueva y la asigna al evento actual.
   */
  async function createNewCantina() {
    const name = newCantinaName.trim();
    if (!name) {
      alert('Indique un nombre para la cantina');
      return;
    }
    // Inserta la cantina y devuelve su ID
    const { data: insertRows, error: insertErr } = await supabase
      .from('cantinas')
      .insert({ name })
      .select('id')
      .single();
    if (insertErr) {
      alert(insertErr.message);
      return;
    }
    const cantinaId = insertRows.id;
    // Asigna la cantina al evento
    const { error: assignErr } = await supabase
      .from('event_cantinas')
      .insert({ event_id: eventId, cantina_id: cantinaId });
    if (assignErr) {
      alert(assignErr.message);
      return;
    }
    setNewCantinaName('');
    fetchCantinas();
  }

  /**
   * Crea un producto global en la tabla products.
   * Una vez creado, se podrá seleccionar en el formulario de alta del catálogo.
   */
  async function createNewProduct() {
    const name = newProductName.trim();
    if (!name) {
      alert('Indique un nombre para el producto');
      return;
    }
    const { error } = await supabase.from('products').insert({ name });
    if (error) {
      alert(error.message);
      return;
    }
    setNewProductName('');
    // Recargar catálogo para incluir el nuevo producto
    fetchCatalog();
  }

  /**
   * Guarda un producto modificado del catálogo.
   */
  async function saveProduct(row: EventProductRow) {
    const priceNum = parseFloat(row.editPrice.replace(',', '.'));
    const thresholdNum = parseInt(row.editThreshold || '0', 10);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Precio inválido');
      return;
    }
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      alert('Umbral inválido');
      return;
    }
    const { error } = await supabase
      .from('event_products')
      .update({ price_cents: Math.round(priceNum * 100), low_stock_threshold: thresholdNum, active: row.editActive })
      .eq('id', row.id);
    if (error) {
      alert(error.message);
      return;
    }
    // Refresca catálogo
    fetchCatalog();
  }

  /**
   * Elimina un producto del catálogo del evento.
   */
  async function deleteProduct(row: EventProductRow) {
    if (!confirm(`¿Eliminar ${row.name} del evento?`)) return;
    const { error } = await supabase
      .from('event_products')
      .delete()
      .eq('id', row.id);
    if (error) {
      alert(error.message);
      return;
    }
    fetchCatalog();
  }

  /**
   * Añade un nuevo producto al evento.
   */
  async function addProduct() {
    if (!newProdId) {
      alert('Seleccione un producto');
      return;
    }
    const priceNum = parseFloat(newProdPrice.replace(',', '.'));
    const thresholdNum = parseInt(newProdThreshold || '0', 10);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Precio inválido');
      return;
    }
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      alert('Umbral inválido');
      return;
    }
    const { error } = await supabase
      .from('event_products')
      .insert({
        event_id: eventId,
        product_id: newProdId,
        price_cents: Math.round(priceNum * 100),
        low_stock_threshold: thresholdNum,
        active: newProdActive,
      });
    if (error) {
      alert(error.message);
      return;
    }
    // Limpia formulario
    setNewProdId('');
    setNewProdPrice('');
    setNewProdThreshold('');
    setNewProdActive(true);
    fetchCatalog();
  }

  /**
   * Carga el inventario y formularios de inventario para la cantina seleccionada.
   */
  async function fetchInventoryData() {
    if (!selectedCantinaId) return;
    setInventoryLoading(true);
    // Inventario actual
    const { data: inv } = await supabase
      .from('v_cantina_inventory')
      .select('product_id, current_qty, low_stock_threshold')
      .match({ event_id: eventId, cantina_id: selectedCantinaId });
    setInventory(inv ?? []);
    // Inventario inicial
    const { data: initRows } = await supabase
      .from('inventory_snapshots')
      .select('product_id, qty')
      .eq('event_id', eventId)
      .eq('cantina_id', selectedCantinaId)
      .eq('kind', 'INITIAL');
    const initMap: Record<string, number> = {};
    (initRows ?? []).forEach((row: any) => {
      initMap[row.product_id] = row.qty;
    });
    // Prepara formularios
    const initFormTemp: Record<string, number> = {};
    const finalFormTemp: Record<string, number> = {};
    eventProducts.forEach(p => {
      initFormTemp[p.product_id] = initMap[p.product_id] ?? 0;
      const curRow = inv?.find(i => i.product_id === p.product_id);
      finalFormTemp[p.product_id] = curRow?.current_qty ?? 0;
    });
    setInitForm(initFormTemp);
    setFinalForm(finalFormTemp);
    setAdjustForm({});
    setAdjustReason('Ajuste manual');
    setAdjustType('ADJUSTMENT');
    setInventoryLoading(false);
  }

  /**
   * Guarda inventario inicial para la cantina seleccionada.
   */
  async function saveInitialInventory() {
    if (!selectedCantinaId) return;
    const lines = Object.entries(initForm).map(([productId, qty]) => ({ productId, qty }));
    const { error } = await supabase.rpc('set_initial_inventory_bulk', {
      p_event_id: eventId,
      p_cantina_id: selectedCantinaId,
      p_user_id: process.env.NEXT_PUBLIC_APP_USER_ID,
      p_lines: lines,
    });
    if (error) {
      alert(error.message);
      return;
    }
    alert('Inventario inicial actualizado ✅');
    fetchInventoryData();
  }

  /**
   * Aplica ajustes de stock actual para la cantina seleccionada.
   */
  async function applyAdjustments() {
    if (!selectedCantinaId) return;
    const lines = Object.entries(adjustForm)
      .filter(([, delta]) => delta && delta !== 0)
      .map(([productId, delta]) => ({ productId, delta, movementType: adjustType, reason: adjustReason }));
    if (!lines.length) {
      alert('No hay ajustes que aplicar');
      return;
    }
    const { error } = await supabase.rpc('adjust_stock_bulk', {
      p_event_id: eventId,
      p_cantina_id: selectedCantinaId,
      p_user_id: process.env.NEXT_PUBLIC_APP_USER_ID,
      p_lines: lines,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setAdjustForm({});
    alert('Ajustes aplicados ✅');
    fetchInventoryData();
  }

  /**
   * Guarda el inventario final para la cantina seleccionada.
   */
  async function saveFinalInventory() {
    if (!selectedCantinaId) return;
    const lines = Object.entries(finalForm).map(([productId, qty]) => ({ productId, qty: Math.max(0, Number(qty || 0)) }));
    const { error } = await supabase.rpc('set_final_inventory_bulk', {
      p_event_id: eventId,
      p_cantina_id: selectedCantinaId,
      p_user_id: process.env.NEXT_PUBLIC_APP_USER_ID,
      p_lines: lines,
    });
    if (error) {
      alert(error.message);
      return;
    }
    alert('Inventario final guardado ✅');
    fetchInventoryData();
  }

  /**
   * Efectos iniciales: cargar evento, cantinas y catálogo.
   */
  useEffect(() => {
    fetchEvent();
    fetchCantinas();
    fetchCatalog();
  }, [eventId]);

  /**
   * Cuando cambia selectedCantinaId o hay cambios en inventario (realtime), recarga datos.
   */
  useEffect(() => {
    if (selectedCantinaId) {
      fetchInventoryData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCantinaId, changes]);

  /**
   * Cuando se selecciona la pestaña de panel o cambian las asignaciones de cantinas,
   * recalcula las métricas para mostrar en el dashboard.
   */
  useEffect(() => {
    if (tab === 'panel') {
      fetchMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cantinas]);

  // Si entras a la pestaña 'panel' y aún no hay cantina elegida, selecciona la primera asignada
  useEffect(() => {
    if (tab === 'panel' && !panelCantinaId && cantinas.length) {
      setPanelCantinaId(cantinas[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cantinas.length]);

// Carga datos cuando cambie la cantina del panel o al abrir el panel
  useEffect(() => {
    if (tab === 'panel' && panelCantinaId) {
      fetchPanelStock(panelCantinaId);
      fetchPanelTotals(panelCantinaId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, panelCantinaId]);

// Realtime: si hay movimientos de stock en la cantina seleccionada, refresca el grid
  const panelChanges = useLiveInventory(eventId, panelCantinaId ?? '');
  useEffect(() => {
    if (tab === 'panel' && panelCantinaId) {
      fetchPanelStock(panelCantinaId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelChanges]);


  // Mapa de inventario para facilitar búsquedas
  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryRow>();
    inventory.forEach(row => map.set(row.product_id, row));
    return map;
  }, [inventory]);

  // Estilos de tarjetas y puntos según paleta de colores
  const cardStyle: React.CSSProperties = {
    padding: 20,
    borderRadius: 16,
    boxShadow: '0 2px 12px rgba(0, 150, 79, 0.08)',
    background: 'white',
  };
  const dot = (status: 'ok' | 'bajo' | 'agotado') => ({
    width: 10,
    height: 10,
    borderRadius: 9999,
    background: status === 'ok' ? '#00964f' : status === 'bajo' ? '#f59e0b' : '#dc2626',
    display: 'inline-block',
  } as React.CSSProperties);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--elche-bg)' }}>
      {/* Barra superior con botón atrás */}
      <header style={{
        background: 'linear-gradient(135deg, var(--elche-green) 0%, var(--elche-green-dark) 100%)',
        color: 'white',
        padding: '16px 32px',
        boxShadow: '0 2px 8px rgba(0, 150, 79, 0.2)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => router.push('/admin')} style={{ color: 'white', fontSize: 20, background: 'transparent' }}>←</button>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{eventName || 'Evento'}</div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>{eventDate ? new Date(eventDate).toLocaleDateString() : 'Sin fecha'}</div>
          </div>
        </div>
        {/* Tabs de navegación */}
        <nav style={{ display: 'flex', gap: 8, marginTop: 12, background: 'rgba(255, 255, 255, 0.1)', padding: '6px', borderRadius: 12, backdropFilter: 'blur(10px)', justifyContent: 'center' }}>
          {(['general', 'cantinas', 'catalogo', 'inventario', 'panel'] as TabKey[]).map(key => (
            <button key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: tab === key ? 'rgba(255,255,255,0.25)' : 'transparent',
                color: 'white',
                fontWeight: tab === key ? 700 : 500,
                fontSize: 14,
                transition: 'all 0.2s ease'
              }}>
              {key === 'general' ? '⚙️ General' : key === 'cantinas' ? '🏪 Cantinas' : key === 'catalogo' ? '🛍️ Catálogo' : key === 'inventario' ? '📦 Inventario' : '📈 Panel'}
            </button>
          ))}
        </nav>
      </header>

      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px 32px', display: 'grid', gap: 24 }}>
        {/* General */}
        {tab === 'general' && (
          <section style={{ ...cardStyle }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
              ⚙️ Configuración del evento
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, color: 'var(--elche-text-light)', fontWeight: 600 }}>Nombre</span>
                <input type="text" value={eventName} onChange={e => setEventName(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, color: 'var(--elche-text-light)', fontWeight: 600 }}>Fecha</span>
                <input type="date" value={eventDate || ''} onChange={e => setEventDate(e.target.value || null)} style={{ padding: '10px 12px', borderRadius: 8 }} />
              </label>
              <button onClick={saveEvent} style={{ marginTop: 12, padding: '12px 20px', borderRadius: 12, background: 'var(--elche-green)', color: 'white', fontWeight: 600, width: 'fit-content' }}>
                💾 Guardar
              </button>
            </div>
          </section>
        )}

        {/* Cantinas */}
        {tab === 'cantinas' && (
          <section style={{ ...cardStyle }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
              🏪 Cantinas asignadas
            </div>
            {cantinasLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--elche-text-light)' }}>Cargando cantinas…</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {cantinas.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--elche-gray)', borderRadius: 12 }}>
                    <span style={{ fontWeight: 600, color: 'var(--elche-text)' }}>{c.name}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={c.assigned}
                        onChange={e => toggleCantina(c.id, e.target.checked)}
                      />
                      <span style={{ fontSize: 14 }}>{c.assigned ? 'Asignada' : 'No asignada'}</span>
                    </label>
                  </div>
                ))}
                {/* Formulario para crear una nueva cantina y asignarla al evento */}
                <div style={{ marginTop: 20, padding: '16px', background: 'var(--elche-gray)', borderRadius: 12, display:'grid', gap: 12 }}>
                  <div style={{ fontWeight: 600, color: 'var(--elche-text)' }}>➕ Nueva cantina</div>
                  <input
                    type="text"
                    placeholder="Nombre de la cantina"
                    value={newCantinaName}
                    onChange={e => setNewCantinaName(e.target.value)}
                    style={{ padding: '10px 12px', borderRadius: 8, fontSize: 14 }}
                  />
                  <button
                    onClick={createNewCantina}
                    style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--elche-green)', color: 'white', fontWeight: 600 }}
                  >
                    ✅ Añadir cantina
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Catálogo */}
        {tab === 'catalogo' && (
          <section style={{ ...cardStyle }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
              🛍️ Catálogo del evento
            </div>
            {catalogLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--elche-text-light)' }}>Cargando catálogo…</div>
            ) : (
              <div style={{ display: 'grid', gap: 24 }}>
                {/* Tabla de productos */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 8 }}>Producto</th>
                        <th style={{ textAlign: 'left', padding: 8 }}>Precio (€)</th>
                        <th style={{ textAlign: 'left', padding: 8 }}>Umbral</th>
                        <th style={{ textAlign: 'left', padding: 8 }}>Activo</th>
                        <th style={{ textAlign: 'right', padding: 8 }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventProducts.map(row => (
                        <tr key={row.id} style={{ borderTop: '1px solid var(--elche-gray)' }}>
                          <td style={{ padding: 8 }}>
                            <strong>{row.name}</strong>
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              step="0.01"
                              value={row.editPrice}
                              onChange={e => {
                                const val = e.target.value;
                                setEventProducts(list => list.map(r => r.id === row.id ? { ...r, editPrice: val } : r));
                              }}
                              style={{ padding: '6px 8px', borderRadius: 6, width: '80px' }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              value={row.editThreshold}
                              min={0}
                              onChange={e => {
                                const val = e.target.value;
                                setEventProducts(list => list.map(r => r.id === row.id ? { ...r, editThreshold: val } : r));
                              }}
                              style={{ padding: '6px 8px', borderRadius: 6, width: '60px' }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="checkbox"
                              checked={row.editActive}
                              onChange={e => {
                                const checked = e.target.checked;
                                setEventProducts(list => list.map(r => r.id === row.id ? { ...r, editActive: checked } : r));
                              }}
                            />
                          </td>
                          <td style={{ padding: 8, textAlign: 'right' }}>
                            <button onClick={() => saveProduct(row)} style={{ marginRight: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--elche-green)', color: 'white', fontSize: 12 }}>💾 Guardar</button>
                            <button onClick={() => deleteProduct(row)} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--elche-gray)', color: 'var(--elche-text)', fontSize: 12 }}>🗑️ Eliminar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Formulario para añadir nuevo producto al evento */}
                <div style={{ marginTop: 20, background: 'var(--elche-gray)', padding: 16, borderRadius: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>➕ Añadir producto al evento</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <select value={newProdId} onChange={e => setNewProdId(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8 }}>
                      <option value="">Seleccionar producto</option>
                      {allProducts.filter(p => !eventProducts.some(ep => ep.product_id === p.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Precio (€)"
                      value={newProdPrice}
                      onChange={e => setNewProdPrice(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8 }}
                    />
                    <input
                      type="number"
                      placeholder="Umbral"
                      min={0}
                      value={newProdThreshold}
                      onChange={e => setNewProdThreshold(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={newProdActive} onChange={e => setNewProdActive(e.target.checked)} />
                      <span style={{ fontSize: 14 }}>Activo</span>
                    </div>
                    <button onClick={addProduct} style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--elche-green)', color: 'white', fontWeight: 600 }}>Añadir</button>
                  </div>
                </div>
                {/* Formulario para crear nuevo producto global */}
                <div style={{ marginTop: 20, background: 'var(--elche-gray)', padding: 16, borderRadius: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>➕ Nuevo producto global</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Nombre del producto"
                      value={newProductName}
                      onChange={e => setNewProductName(e.target.value)}
                      style={{ padding:'8px 10px', borderRadius:8 }}
                    />
                    <button
                      onClick={createNewProduct}
                      style={{ padding:'10px 16px', borderRadius:10, background:'var(--elche-green)', color:'white', fontWeight:600 }}
                    >
                      Crear producto
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color:'var(--elche-text-light)', marginTop: 8 }}>
                    Una vez creado, podrás seleccionarlo en la lista para añadirlo al evento.
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Inventario por cantina */}
        {tab === 'inventario' && (
          <section style={{ ...cardStyle }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
              📦 Inventario por cantina
            </div>
            {/* Selección de cantina */}
            <div style={{ marginBottom: 16, display:'flex', gap: 8, alignItems:'center' }}>
              <select value={selectedCantinaId} onChange={e => setSelectedCantinaId(e.target.value)} style={{ padding:'8px 12px', borderRadius: 8 }}>
                <option value="">Selecciona cantina</option>
                {cantinas.filter(c => c.assigned).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedCantinaId && (
                <button onClick={fetchInventoryData} style={{ padding:'8px 14px', borderRadius: 8, background:'var(--elche-green)', color:'white', fontWeight:600 }}>
                  🔄 Recargar
                </button>
              )}
            </div>
            {!selectedCantinaId ? (
              <div style={{ padding: 20, textAlign:'center', color:'var(--elche-text-light)' }}>Selecciona una cantina asignada para modificar su inventario</div>
            ) : inventoryLoading ? (
              <div style={{ padding: 20, textAlign:'center', color:'var(--elche-text-light)' }}>Cargando inventario…</div>
            ) : (
              <div style={{ display:'grid', gap: 24 }}>
                {/* Inventario inicial */}
                <div style={{ ...cardStyle }}>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:12, color:'var(--elche-text)' }}>📦 Inventario inicial</div>
                  <div style={{ display:'grid', gap:10 }}>
                    {eventProducts.map(p => (
                      <div key={p.product_id} style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:8, alignItems:'center', padding:'8px', background:'var(--elche-gray)', borderRadius:8 }}>
                        <div>
                          <div style={{ fontWeight:600, color:'var(--elche-text)', marginBottom:2 }}>{p.name}</div>
                          <div style={{ color:'var(--elche-text-light)', fontSize:12 }}>Precio {(p.price_cents/100).toFixed(2)} €</div>
                        </div>
                        <input type="number" min={0} value={initForm[p.product_id] ?? 0} onChange={e => setInitForm(s => ({ ...s, [p.product_id]: parseInt(e.target.value || '0', 10) }))} style={{ padding:'6px 8px', borderRadius:6, textAlign:'center' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button onClick={saveInitialInventory} style={{ padding:'10px 16px', borderRadius:10, background:'var(--elche-green)', color:'white', fontWeight:600 }}>💾 Guardar inicial</button>
                    <button onClick={fetchInventoryData} style={{ padding:'10px 16px', borderRadius:10, background:'var(--elche-gray)', color:'var(--elche-text)', fontWeight:600 }}>↩️ Deshacer</button>
                  </div>
                </div>
                {/* Ajustes de stock */}
                <div style={{ ...cardStyle }}>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:12, color:'var(--elche-text)' }}>⚙️ Ajustes de stock</div>
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    <select value={adjustType} onChange={e => setAdjustType(e.target.value as any)} style={{ padding:'8px 10px', borderRadius:8 }}>
                      <option value="ADJUSTMENT">Ajuste manual</option>
                      <option value="TRANSFER_IN">Entrada / Traspaso recibido</option>
                      <option value="TRANSFER_OUT">Salida / Traspaso enviado</option>
                      <option value="WASTE">Merma / Rotura</option>
                      <option value="RETURN">Devolución</option>
                    </select>
                    <input placeholder="Motivo" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} style={{ flex:1, padding:'8px 10px', borderRadius:8 }} />
                  </div>
                  <div style={{ display:'grid', gap:10 }}>
                    {eventProducts.map(p => {
                      const invRow = inventoryMap.get(p.product_id);
                      const cur = invRow?.current_qty ?? 0;
                      const delta = adjustForm[p.product_id] ?? 0;
                      return (
                        <div key={p.product_id} style={{ display:'grid', gridTemplateColumns:'1fr 200px 140px', gap:8, alignItems:'center', padding:'8px', background:'var(--elche-gray)', borderRadius:8 }}>
                          <div>
                            <div style={{ fontWeight:600, color:'var(--elche-text)' }}>{p.name}</div>
                            <div style={{ color:'var(--elche-text-light)', fontSize:12 }}>Actual: {cur}</div>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'center' }}>
                            <button onClick={() => setAdjustForm(s => ({ ...s, [p.product_id]: (s[p.product_id] ?? 0) - 1 }))} style={{ padding:'6px 10px', borderRadius:8, background:'white', fontWeight:700 }}>−1</button>
                            <input type="number" value={delta} onChange={e => setAdjustForm(s => ({ ...s, [p.product_id]: parseInt(e.target.value || '0', 10) }))} style={{ width:80, padding:'6px 8px', borderRadius:6, textAlign:'center', fontWeight:700 }} />
                            <button onClick={() => setAdjustForm(s => ({ ...s, [p.product_id]: (s[p.product_id] ?? 0) + 1 }))} style={{ padding:'6px 10px', borderRadius:8, background:'white', fontWeight:700 }}>+1</button>
                          </div>
                          <div style={{ color: delta !== 0 ? 'var(--elche-green)' : 'var(--elche-text-light)', fontSize:12, fontWeight:600, textAlign:'center' }}>
                            Resultado: <span style={{ fontSize:16, fontWeight:700 }}>{cur + delta}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button onClick={applyAdjustments} style={{ padding:'10px 16px', borderRadius:10, background:'var(--elche-green)', color:'white', fontWeight:600 }}>✅ Aplicar ajustes</button>
                    <button onClick={() => setAdjustForm({})} style={{ padding:'10px 16px', borderRadius:10, background:'var(--elche-gray)', color:'var(--elche-text)', fontWeight:600 }}>🧹 Limpiar</button>
                  </div>
                </div>
                {/* Inventario final */}
                <div style={{ ...cardStyle }}>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:12, color:'var(--elche-text)' }}>📋 Inventario final</div>
                  <div style={{ display:'grid', gap:10 }}>
                    {eventProducts.map(p => {
                      const cur = inventoryMap.get(p.product_id)?.current_qty ?? 0;
                      const val = finalForm[p.product_id] ?? 0;
                      return (
                        <div key={p.product_id} style={{ display:'grid', gridTemplateColumns:'1fr 140px 120px', gap:8, alignItems:'center', padding:'8px', background:'var(--elche-gray)', borderRadius:8 }}>
                          <div>
                            <div style={{ fontWeight:600, color:'var(--elche-text)' }}>{p.name}</div>
                            <div style={{ color:'var(--elche-text-light)', fontSize:12 }}>Calculado: {cur}</div>
                          </div>
                          <input type="number" min={0} value={val} onChange={e => setFinalForm(s => ({ ...s, [p.product_id]: Math.max(0, parseInt(e.target.value || '0', 10)) }))} style={{ padding:'6px 8px', borderRadius:6, textAlign:'center' }} />
                          <button onClick={() => setFinalForm(s => ({ ...s, [p.product_id]: cur }))} style={{ padding:'6px 10px', borderRadius:8, background:'white', fontWeight:600, fontSize:13 }}>📊 Usar calculado</button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button onClick={saveFinalInventory} style={{ padding:'10px 16px', borderRadius:10, background:'var(--elche-green)', color:'white', fontWeight:600 }}>💾 Guardar final</button>
                    <button onClick={() => {
                      // Rellenar con calculado
                      const m: Record<string, number> = {};
                      eventProducts.forEach(p => {
                        const row = inventoryMap.get(p.product_id);
                        m[p.product_id] = row?.current_qty ?? 0;
                      });
                      setFinalForm(m);
                    }} style={{ padding:'10px 16px', borderRadius:10, background:'var(--elche-gray)', color:'var(--elche-text)', fontWeight:600 }}>📊 Usar calculado</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Panel de métricas */}
        {tab === 'panel' && (
            <section style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
                📈 Panel de métricas por cantina
              </div>

              {/* Selector de cantina */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <label style={{ opacity: 0.8 }}>Cantina:</label>
                <select
                    value={panelCantinaId ?? ''}
                    onChange={(e) => setPanelCantinaId(e.target.value || null)}
                    style={{ padding: '8px 12px', borderRadius: 8 }}>
                  {cantinas.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <button
                    onClick={() => panelCantinaId && (fetchPanelStock(panelCantinaId), fetchPanelTotals(panelCantinaId))}
                    style={{ padding: '8px 12px', borderRadius: 8 }}>
                  Refrescar
                </button>
              </div>

              {/* Totales de ventas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ ...cardStyle }}><div>Tickets</div><div style={{ fontSize: 20, fontWeight: 700 }}>{panelTotals.num_sales}</div></div>
                <div style={{ ...cardStyle }}><div>Artículos</div><div style={{ fontSize: 20, fontWeight: 700 }}>{panelTotals.total_items}</div></div>
                <div style={{ ...cardStyle }}><div>Facturación</div><div style={{ fontSize: 20, fontWeight: 700 }}>{(panelTotals.total_cents/100).toFixed(2)} €</div></div>
              </div>

              {/* Stock por producto */}
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Stock por artículo</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: 8 }}>Producto</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Stock</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Umbral</th>
                  <th style={{ padding: 8 }}>Estado</th>
                </tr>
                </thead>
                <tbody>
                {panelRows.map(r => {
                  const status = r.current_qty <= 0 ? 'agotado' : r.current_qty <= r.low_stock_threshold ? 'bajo' : 'ok';
                  const dotColor = status === 'ok' ? '#16a34a' : status === 'bajo' ? '#f59e0b' : '#dc2626';
                  return (
                      <tr key={r.product_id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: 8 }}>{r.name}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{r.current_qty}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{r.low_stock_threshold}</td>
                        <td style={{ padding: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 9999, background: dotColor }} />
                  {status === 'ok' ? 'OK' : status === 'bajo' ? 'Bajo' : 'Agotado'}
                </span>
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </section>
        )}

      </div>
    </div>
  );
}