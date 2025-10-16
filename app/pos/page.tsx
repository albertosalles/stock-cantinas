'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { createSale } from '@/lib/sales';
import { useLiveInventory } from '@/hooks/useLiveInventory';

type Product = { id: string; name: string; price_cents: number };
type InventoryRow = { product_id: string; current_qty: number; low_stock_threshold: number };
type InitRow = { product_id: string; qty: number };
type Totals = { num_sales: number; total_cents: number; total_items: number };

// Representa una venta con sus líneas. Se usa en la pestaña "ventas" para mostrar el historial
// La API de Supabase devuelve cada venta con un array de sale_line_items. Normalizamos aquí el nombre
// y los campos para evitar depender de la estructura interna en el resto de la UI.
type Sale = {
  id: string;
  created_at: string;
  total_cents: number;
  total_items: number;
  sale_lines: { product_id: string; qty: number; price_cents: number }[];
};

// Usuario de respaldo (MVP sin Supabase Auth)
// Asegúrate de que este id exista en public.users
const FALLBACK_USER_ID = process.env.NEXT_PUBLIC_APP_USER_ID!;


// Número de ventas por página en el listado de historial
const SALES_PER_PAGE = 10;

export default function PosPage() {
  const router = useRouter();
  
  // Estados de sesión
  const [eventId, setEventId] = useState<string>('');
  const [cantinaId, setCantinaId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [sessionChecked, setSessionChecked] = useState(false);
  
  const [eventName, setEventName] = useState<string>('Evento');
  const [cantinaName, setCantinaName] = useState<string>('Cantina');

  // TODOS los hooks deben estar ANTES de cualquier return condicional
  const [tab, setTab] = useState<'venta'|'inventario'|'ventas'>('venta');

  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [initSnap, setInitSnap] = useState<InitRow[]>([]);
  const [initForm, setInitForm] = useState<Record<string, number>>({}); // productId -> qty
  const [totals, setTotals] = useState<Totals>({ num_sales:0, total_cents:0, total_items:0 });

  // Estados para el historial de ventas
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSales, setTotalSales] = useState(0);
  const [loadingSales, setLoadingSales] = useState(false);

  const [cart, setCart] = useState<{ productId: string; qty: number }[]>([]);
  
  // Ajustes de stock actual
  const [adjustForm, setAdjustForm] = useState<Record<string, number>>({}); // productId -> delta
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT'|'WASTE'|'TRANSFER_IN'|'TRANSFER_OUT'|'RETURN'>('ADJUSTMENT');
  const [adjustReason, setAdjustReason] = useState<string>('Ajuste manual');

  // Inventario final (editable)
  const [finalForm, setFinalForm] = useState<Record<string, number>>({});

  const changes = useLiveInventory(eventId, cantinaId);

  // Memoizaciones (DEBEN estar ANTES del return condicional)
  const totalEur = useMemo(() =>
    cart.reduce((sum, line) => {
      const p = products.find(x => x.id === line.productId);
      return sum + (p ? (p.price_cents/100)*line.qty : 0);
    }, 0)
  , [cart, products]);

  const invMap = useMemo(() => {
    const m = new Map<string, InventoryRow>();
    inventory.forEach(r => m.set(r.product_id, r));
    return m;
  }, [inventory]);

  // -------- Effects (ANTES del return condicional) --------
  // Cargar nombres del evento y cantina
  useEffect(() => { 
    if (!sessionChecked || !eventId || !cantinaId) return;
    
    (async () => {
      const [ev, cn] = await Promise.all([
        supabase.from('events').select('name').eq('id', eventId).single(),
        supabase.from('cantinas').select('name').eq('id', cantinaId).single()
      ]);
      if (ev.data?.name) setEventName(ev.data.name);
      if (cn.data?.name) setCantinaName(cn.data.name);
    })();
  }, [sessionChecked, eventId, cantinaId]);

  // Cargar productos del evento
  useEffect(() => { 
    if (!sessionChecked || !eventId) return;
    
    (async () => {
      const { data, error } = await supabase
        .from('event_products')
        .select('product_id, price_cents, products(name)')
        .eq('event_id', eventId)
        .eq('active', true)
        .order('product_id');
      if (!error) {
        setProducts((data ?? []).map((row: any) => ({
          id: row.product_id,
          name: row.products?.name ?? '—',
          price_cents: row.price_cents,
        })));
      }
    })();
  }, [sessionChecked, eventId]);

  // Cargar inventario y totales al montar
  useEffect(() => { 
    if (!sessionChecked || !eventId || !cantinaId) return;
    
    (async () => {
      // Inventario
      const { data: invData } = await supabase
        .from('v_cantina_inventory')
        .select('product_id, current_qty, low_stock_threshold')
        .match({ event_id: eventId, cantina_id: cantinaId });
      setInventory(invData ?? []);
      
      // Totales
      const { data: totalsData } = await supabase
        .from('v_sales_by_cantina')
        .select('*')
        .match({ event_id: eventId, cantina_id: cantinaId })
        .maybeSingle();
      if (totalsData) {
        setTotals({
          num_sales: totalsData.num_sales ?? 0,
          total_cents: totalsData.total_cents ?? 0,
          total_items: totalsData.total_items ?? 0
        });
      }
    })();
  }, [sessionChecked, eventId, cantinaId]);

  // Actualizar inventario en tiempo real
  useEffect(() => { 
    if (!sessionChecked || !eventId || !cantinaId || !changes) return;
    
    (async () => {
      const { data } = await supabase
        .from('v_cantina_inventory')
        .select('product_id, current_qty, low_stock_threshold')
        .match({ event_id: eventId, cantina_id: cantinaId });
      setInventory(data ?? []);
    })();
  }, [changes, sessionChecked, eventId, cantinaId]);

  // Cargar ventas cuando se abre la pestaña
  useEffect(() => {
    if (!sessionChecked || tab !== 'ventas' || !eventId || !cantinaId) return;
    
    (async () => {
      setLoadingSales(true);
      const from = (currentPage - 1) * SALES_PER_PAGE;
      const to = from + SALES_PER_PAGE - 1;
      
      const { data, error, count } = await supabase
        .from('sales')
        .select('id, created_at, total_cents, total_items, sale_line_items(product_id, qty, unit_price_cents)', { count: 'exact' })
        .eq('event_id', eventId)
        .eq('cantina_id', cantinaId)
        .eq('status', 'OK')
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (!error && data) {
        const normalized: Sale[] = data.map((s: any) => ({
          id: s.id,
          created_at: s.created_at,
          total_cents: s.total_cents,
          total_items: s.total_items,
          sale_lines: (s.sale_line_items ?? []).map((li: any) => ({
            product_id: li.product_id,
            qty: li.qty,
            price_cents: li.unit_price_cents
          }))
        }));
        setSales(normalized);
        setTotalSales(count ?? 0);
      }
      setLoadingSales(false);
    })();
  }, [tab, currentPage, sessionChecked, eventId, cantinaId]);

  // Cargar snapshot inicial cuando hay productos
  useEffect(() => { 
    if (!sessionChecked || !eventId || !cantinaId || products.length === 0) return;
    
    (async () => {
      const { data } = await supabase
        .from('inventory_snapshots')
        .select('product_id, qty')
        .eq('event_id', eventId)
        .eq('cantina_id', cantinaId)
        .eq('kind','INITIAL');
      
      const rows = (data ?? []) as InitRow[];
      setInitSnap(rows);
      
      // precarga formulario
      const map: Record<string, number> = {};
      products.forEach(p => {
        const found = rows.find(r => r.product_id === p.id);
        map[p.id] = found?.qty ?? 0;
      });
      setInitForm(map);
    })();
  }, [products, sessionChecked, eventId, cantinaId]);

  // Actualizar formulario de inventario final
  useEffect(() => {
    if (!sessionChecked || inventory.length === 0 || products.length === 0) return;
    
    const m: Record<string, number> = {};
    products.forEach(p => {
      const r = inventory.find(i => i.product_id === p.id);
      m[p.id] = r?.current_qty ?? 0;
    });
    setFinalForm(m);
  }, [inventory, products, sessionChecked]);

  // Verificar sesión al cargar
  useEffect(() => {
    const sessionData = localStorage.getItem('cantina_session');
    
    if (!sessionData) {
      // No hay sesión, redirigir al login
      router.push('/login');
      return;
    }

    try {
      const session = JSON.parse(sessionData);
      
      // Verificar que el evento siga activo
      supabase
        .from('events')
        .select('status, name')
        .eq('id', session.eventId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            alert('Error al verificar el evento');
            localStorage.removeItem('cantina_session');
            router.push('/login');
            return;
          }

          if (data.status !== 'live') {
            alert('El evento ya no está activo');
            localStorage.removeItem('cantina_session');
            router.push('/login');
            return;
          }

          // Sesión válida
          setEventId(session.eventId);
          setCantinaId(session.cantinaId);
          setUserId(FALLBACK_USER_ID);
          setEventName(session.eventName);
          setCantinaName(session.cantinaName);
          setSessionChecked(true);
        });
    } catch (e) {
      console.error('Error parsing session:', e);
      localStorage.removeItem('cantina_session');
      router.push('/login');
    }
  }, [router]);

  // Si no se ha verificado la sesión, no renderizar nada
  if (!sessionChecked) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--elche-bg)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 18, color: 'var(--elche-text)' }}>Verificando sesión...</div>
        </div>
      </div>
    );
  }

  // -------- Fetch helpers --------
  async function fetchNames() {
    const [ev, cn] = await Promise.all([
      supabase.from('events').select('name').eq('id', eventId).single(),
      supabase.from('cantinas').select('name').eq('id', cantinaId).single()
    ]);
    if (ev.data?.name) setEventName(ev.data.name);
    if (cn.data?.name) setCantinaName(cn.data.name);
  }

  async function fetchProducts() {
    const { data, error } = await supabase
      .from('event_products')
      .select('product_id, price_cents, products(name)')
      .eq('event_id', eventId)
      .eq('active', true)
      .order('product_id');
    if (!error) {
      setProducts((data ?? []).map((row: any) => ({
        id: row.product_id,
        name: row.products?.name ?? '—',
        price_cents: row.price_cents,
      })));
    }
  }

  async function fetchInventory() {
    const { data } = await supabase
      .from('v_cantina_inventory')
      .select('product_id, current_qty, low_stock_threshold')
      .match({ event_id: eventId, cantina_id: cantinaId });
    setInventory(data ?? []);
  }

  async function fetchInitialSnapshot() {
    const { data } = await supabase
      .from('inventory_snapshots')
      .select('product_id, qty')
      .eq('event_id', eventId).eq('cantina_id', cantinaId).eq('kind','INITIAL');
    const rows = (data ?? []) as InitRow[];
    setInitSnap(rows);
    // precarga formulario (si falta alguno, 0)
    const map: Record<string, number> = {};
    products.forEach(p => {
      const found = rows.find(r => r.product_id === p.id);
      map[p.id] = found?.qty ?? 0;
    });
    setInitForm(map);
  }

  async function fetchTotals() {
    const { data } = await supabase
      .from('v_sales_by_cantina')
      .select('num_sales,total_cents,total_items')
      .match({ event_id: eventId, cantina_id: cantinaId })
      .single();
    setTotals({
      num_sales: data?.num_sales ?? 0,
      total_cents: data?.total_cents ?? 0,
      total_items: data?.total_items ?? 0,
    });
  }

  /**
   * Obtiene las ventas paginadas de la cantina para mostrar el historial.
   * Carga el número total de registros y las líneas de venta (sale_line_items) de la página solicitada.
   */
  async function fetchSales(page: number = 1) {
    setLoadingSales(true);
    try {
      // Contar el total de ventas para esta cantina y evento
      const { count } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('cantina_id', cantinaId);
      setTotalSales(count ?? 0);

      // Calcular rango de filas a recuperar
      const from = (page - 1) * SALES_PER_PAGE;
      const to = from + SALES_PER_PAGE - 1;

      // Obtener ventas con sus líneas
      const { data: salesData } = await supabase
        .from('sales')
        .select(
          `
            id,
            created_at,
            sale_line_items (
              product_id,
              qty,
              unit_price_cents
            )
          `
        )
        .eq('event_id', eventId)
        .eq('cantina_id', cantinaId)
        .order('created_at', { ascending: false })
        .range(from, to);

      // Formatear ventas: calcular totales por venta y mapear sale_line_items a sale_lines
      const formatted: Sale[] = (salesData ?? []).map((sale: any) => {
        const lines: { product_id: string; qty: number; price_cents: number }[] =
          sale.sale_line_items?.map((line: any) => ({
            product_id: line.product_id,
            qty: line.qty,
            price_cents: line.unit_price_cents,
          })) ?? [];
        const total_cents = lines.reduce((sum, line) => sum + line.price_cents * line.qty, 0);
        const total_items = lines.reduce((sum, line) => sum + line.qty, 0);
        return {
          id: sale.id,
          created_at: sale.created_at,
          total_cents,
          total_items,
          sale_lines: lines,
        };
      });
      setSales(formatted);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoadingSales(false);
    }
  }

  async function saveAdjustments() {
  const lines = Object.entries(adjustForm)
    .filter(([,delta]) => delta && delta !== 0)
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
  await fetchInventory();
  alert('Ajustes aplicados ✅');
}

async function saveFinalSnapshot() {
  const lines = Object.entries(finalForm).map(([productId, qty]) => ({ productId, qty: Math.max(0, Number(qty||0)) }));
  const { error } = await supabase.rpc('set_final_inventory_bulk', {
    p_event_id: eventId,
    p_cantina_id: cantinaId,
    p_user_id: userId,
    p_lines: lines
  });
  if (error) { alert(error.message); return; }
  alert('Inventario final guardado ✅');
}

  // -------- POS (venta) --------
  const addOne = (pid: string) => setCart((c) => {
    const i = c.findIndex(x => x.productId === pid);
    if (i >= 0) { const n=[...c]; n[i] = {...n[i], qty: n[i].qty+1}; return n; }
    return [...c, {productId: pid, qty: 1}];
  });
  const decOne = (pid: string) => setCart((c) => {
    const i = c.findIndex(x => x.productId === pid);
    if (i === -1) return c;
    const n=[...c];
    const q = n[i].qty - 1;
    if (q <= 0) return n.filter(l => l.productId !== pid);
    n[i] = {...n[i], qty: q}; return n;
  });

  const setDelta = (pid: string, val: number) =>
  setAdjustForm(s => ({ ...s, [pid]: val }));

const incDelta = (pid: string, step=1) =>
  setAdjustForm(s => ({ ...s, [pid]: (s[pid]??0) + step }));

const decDelta = (pid: string, step=1) =>
  setAdjustForm(s => ({ ...s, [pid]: (s[pid]??0) - step }));


  const clearCart = () => setCart([]);

  const sell = async () => {
    if (!cart.length) return;
    try {
      await createSale(eventId, cantinaId, userId, cart);
      clearCart();
      await Promise.all([fetchInventory(), fetchTotals()]);
      // Si estamos en la pestaña de ventas, recarga el historial para reflejar la venta recién creada
      if (tab === 'ventas') {
        fetchSales(currentPage);
      }
      alert('Venta registrada ✅');
    } catch (e:any) {
      alert(e?.message ?? 'Error al vender');
    }
  };

  // estilos rápidos
  const card: React.CSSProperties = { 
    padding: 20, 
    borderRadius: 16, 
    boxShadow: '0 2px 12px rgba(0, 150, 79, 0.08)',
    background: 'white'
  };
  
  const dot = (status:'ok'|'bajo'|'agotado') => ({
    width: 10,
    height: 10,
    borderRadius: 9999,
    background: status === 'ok' ? '#00964f' : status === 'bajo' ? '#f59e0b' : '#dc2626',
    display: 'inline-block'
  } as React.CSSProperties);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--elche-bg)' }}>
      {/* Barra superior */}
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
          <div>
            <div style={{ fontSize: '24px', fontWeight: '800', marginBottom: '2px' }}>{eventName}</div>
            <div style={{ opacity: 0.9, fontSize: '14px' }}>📍 {cantinaName}</div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {/* Tabs de navegación */}
            <nav style={{ display: 'flex', gap: 8, background: 'rgba(255, 255, 255, 0.1)', padding: '6px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
              {(['venta', 'inventario', 'ventas'] as const).map(t => (
                <button key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    background: tab === t ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
                    color: 'white',
                    fontWeight: tab === t ? 700 : 500,
                    fontSize: '14px',
                    transition: 'all 0.2s ease'
                  }}>
                  {t === 'venta' ? '💰 Venta' : t === 'inventario' ? '📦 Inventario' : '📊 Ventas'}
                </button>
              ))}
            </nav>

            {/* Botón de cerrar sesión */}
            <button
              onClick={() => {
                if (confirm('¿Seguro que quieres cerrar sesión?')) {
                  localStorage.removeItem('cantina_session');
                  router.push('/login');
                }
              }}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.15)',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }}>
              🚪 Salir
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px 32px' }}>

      {/* --- TAB: VENTA --- */}
      {tab === 'venta' && (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
          {/* Productos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {products.map((p) => {
              const inv = invMap.get(p.id);
              const qty = inv?.current_qty ?? 0;
              const low = inv?.low_stock_threshold ?? 0;
              const status: 'ok'|'bajo'|'agotado' = qty <= 0 ? 'agotado' : qty <= low ? 'bajo' : 'ok';
              return (
                <button key={p.id} onClick={() => qty>0 && addOne(p.id)} disabled={qty<=0}
                        style={{ 
                          ...card, 
                          textAlign: 'left', 
                          opacity: qty <= 0 ? 0.5 : 1,
                          border: '2px solid transparent',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (qty > 0) {
                            e.currentTarget.style.borderColor = 'var(--elche-green)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--elche-text)', marginBottom: 6 }}>{p.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--elche-green)', marginBottom: 12 }}>
                    {(p.price_cents/100).toFixed(2)} €
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <span style={{ color: 'var(--elche-text-light)' }}>Stock: <strong>{qty}</strong></span>
                    <span style={dot(status)} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Carrito */}
          <aside style={{ 
            ...card, 
            position: 'sticky', 
            top: 100, 
            alignSelf: 'start', 
            display: 'grid', 
            gap: 16,
            height: 'fit-content'
          }}>
            <div style={{ 
              fontWeight: 700, 
              fontSize: 18, 
              color: 'var(--elche-text)',
              paddingBottom: 12,
              borderBottom: '2px solid var(--elche-gray)'
            }}>
              🛒 Carrito
            </div>

            <div style={{ display: 'grid', gap: 12, maxHeight: '400px', overflowY: 'auto' }}>
              {cart.length === 0 && (
                <div style={{ 
                  opacity: 0.6, 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  color: 'var(--elche-text-light)'
                }}>
                  Carrito vacío
                </div>
              )}
              {cart.map((l) => {
                const p = products.find(x => x.id === l.productId)!;
                return (
                  <div key={l.productId} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    gap: 12,
                    padding: '12px',
                    background: 'var(--elche-gray)',
                    borderRadius: 12
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--elche-text)', marginBottom: 2 }}>{p.name}</div>
                      <div style={{ color: 'var(--elche-green)', fontSize: 14, fontWeight: 600 }}>
                        {(p.price_cents/100).toFixed(2)} €
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button 
                        onClick={() => decOne(l.productId)} 
                        style={{ 
                          padding: '6px 12px', 
                          borderRadius: 8,
                          background: 'white',
                          fontWeight: 700,
                          fontSize: 16
                        }}>
                        −
                      </button>
                      <div style={{ fontWeight: 700, fontSize: 16, minWidth: 24, textAlign: 'center' }}>
                        {l.qty}
                      </div>
                      <button 
                        onClick={() => addOne(l.productId)} 
                        style={{ 
                          padding: '6px 12px', 
                          borderRadius: 8,
                          background: 'white',
                          fontWeight: 700,
                          fontSize: 16
                        }}>
                        ＋
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginTop: 8, 
              paddingTop: 16,
              borderTop: '2px solid var(--elche-gray)',
              fontSize: 20,
              fontWeight: 700
            }}>
              <span style={{ color: 'var(--elche-text)' }}>Total</span>
              <span style={{ color: 'var(--elche-green)' }}>{totalEur.toFixed(2)} €</span>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <button 
                onClick={sell} 
                disabled={!cart.length}
                style={{ 
                  padding: '16px 20px', 
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, var(--elche-green) 0%, var(--elche-green-light) 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 16,
                  boxShadow: '0 4px 16px rgba(0, 150, 79, 0.3)'
                }}>
                💳 Vender ({cart.reduce((a,b)=>a+b.qty,0)} artículos)
              </button>
              <button 
                onClick={clearCart} 
                disabled={!cart.length} 
                style={{ 
                  padding: '12px 20px', 
                  borderRadius: 12,
                  background: 'var(--elche-gray)',
                  color: 'var(--elche-text-light)',
                  fontWeight: 600
                }}>
                🗑️ Vaciar carrito
              </button>
            </div>
          </aside>
        </section>
      )}

      {/* --- TAB: INVENTARIO (inicial) --- */}
      {tab === 'inventario' && (
  <section style={{ display: 'grid', gap: 20 }}>

    {/* ---- Inventario inicial ---- */}
    <div style={{ ...card }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
        📦 Inventario inicial
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {products.map(p => {
          const value = initForm[p.id] ?? 0;
          return (
            <div key={p.id} style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 160px', 
              gap: 12, 
              alignItems: 'center',
              padding: '12px',
              background: 'var(--elche-gray)',
              borderRadius: 12
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--elche-text)', marginBottom: 4 }}>{p.name}</div>
                <div style={{ color: 'var(--elche-text-light)', fontSize: 13 }}>
                  Precio: {(p.price_cents/100).toFixed(2)} €
                </div>
              </div>
              <input
                type="number" min={0} value={value}
                onChange={e => setInitForm(s => ({ ...s, [p.id]: parseInt(e.target.value || '0', 10) }))}
                style={{ 
                  padding: '10px 12px', 
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  textAlign: 'center'
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button
          onClick={async () => {
            const lines = Object.entries(initForm).map(([productId, qty]) => ({ productId, qty }));
            const { error } = await supabase.rpc('set_initial_inventory_bulk', {
              p_event_id: eventId, p_cantina_id: cantinaId, p_user_id: userId, p_lines: lines
            });
            if (error) { alert(error.message); return; }
            await Promise.all([fetchInventory(), fetchInitialSnapshot()]);
            alert('Inventario inicial actualizado ✅');
          }}
          style={{ 
            padding: '12px 24px', 
            borderRadius: 12, 
            background: 'var(--elche-green)',
            color: 'white',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0, 150, 79, 0.2)'
          }}
        >
          💾 Guardar cambios
        </button>
        <button 
          onClick={() => fetchInitialSnapshot()} 
          style={{ 
            padding: '12px 24px', 
            borderRadius: 12,
            background: 'var(--elche-gray)',
            color: 'var(--elche-text-light)',
            fontWeight: 600
          }}>
          ↩️ Deshacer cambios
        </button>
      </div>
    </div>

    {/* ---- Ajustes de stock actual (entradas/salidas) ---- */}
    <div style={{ ...card }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
        ⚙️ Ajustes de stock (actual)
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select 
          value={adjustType} 
          onChange={e => setAdjustType(e.target.value as any)} 
          style={{ 
            padding: '10px 14px', 
            borderRadius: 8,
            fontWeight: 600,
            flex: '0 0 auto'
          }}>
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
          style={{ 
            flex: 1, 
            padding: '10px 14px', 
            borderRadius: 8,
            fontSize: 15
          }}
        />
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {products.map(p => {
          const inv = inventory.find(i => i.product_id === p.id);
          const cur = inv?.current_qty ?? 0;
          const delta = adjustForm[p.id] ?? 0;
          return (
            <div key={p.id} style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 220px 140px', 
              gap: 12, 
              alignItems: 'center',
              padding: '12px',
              background: 'var(--elche-gray)',
              borderRadius: 12
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--elche-text)', marginBottom: 4 }}>{p.name}</div>
                <div style={{ color: 'var(--elche-text-light)', fontSize: 13 }}>Stock actual: <strong>{cur}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                <button 
                  onClick={() => decDelta(p.id)} 
                  style={{ 
                    padding: '8px 14px', 
                    borderRadius: 8,
                    background: 'white',
                    fontWeight: 700,
                    fontSize: 16
                  }}>
                  −1
                </button>
                <input 
                  type="number" 
                  value={delta}
                  onChange={e => setDelta(p.id, parseInt(e.target.value || '0', 10))}
                  style={{ 
                    width: 80, 
                    padding: '8px 12px', 
                    borderRadius: 8,
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 16
                  }}
                />
                <button 
                  onClick={() => incDelta(p.id)} 
                  style={{ 
                    padding: '8px 14px', 
                    borderRadius: 8,
                    background: 'white',
                    fontWeight: 700,
                    fontSize: 16
                  }}>
                  +1
                </button>
              </div>
              <div style={{ 
                color: delta !== 0 ? 'var(--elche-green)' : 'var(--elche-text-light)', 
                fontSize: 14,
                fontWeight: 600,
                textAlign: 'center'
              }}>
                Resultado: <span style={{ fontSize: 18, fontWeight: 700 }}>{cur + delta}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button 
          onClick={saveAdjustments} 
          style={{ 
            padding: '12px 24px', 
            borderRadius: 12,
            background: 'var(--elche-green)',
            color: 'white',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0, 150, 79, 0.2)'
          }}>
          ✅ Aplicar ajustes
        </button>
        <button 
          onClick={() => setAdjustForm({})} 
          style={{ 
            padding: '12px 24px', 
            borderRadius: 12,
            background: 'var(--elche-gray)',
            color: 'var(--elche-text-light)',
            fontWeight: 600
          }}>
          🧹 Limpiar
        </button>
      </div>
    </div>

    {/* ---- Inventario final (snapshot editable) ---- */}
    <div style={{ ...card }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
        📋 Inventario final (sugerido = stock actual)
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {products.map(p => {
          const value = finalForm[p.id] ?? 0;
          const cur = inventory.find(i => i.product_id === p.id)?.current_qty ?? 0;
          return (
            <div key={p.id} style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 140px 150px', 
              gap: 12, 
              alignItems: 'center',
              padding: '12px',
              background: 'var(--elche-gray)',
              borderRadius: 12
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--elche-text)', marginBottom: 4 }}>{p.name}</div>
                <div style={{ color: 'var(--elche-text-light)', fontSize: 13 }}>Calculado: <strong>{cur}</strong></div>
              </div>
              <input
                type="number" min={0} value={value}
                onChange={e => setFinalForm(s => ({ ...s, [p.id]: Math.max(0, parseInt(e.target.value || '0', 10)) }))}
                style={{ 
                  padding: '10px 12px', 
                  borderRadius: 8,
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: 16
                }}
              />
              <button 
                onClick={() => setFinalForm(s => ({ ...s, [p.id]: cur }))} 
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 8,
                  background: 'white',
                  fontWeight: 600,
                  fontSize: 13
                }}>
                📊 Usar calculado
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button 
          onClick={saveFinalSnapshot} 
          style={{ 
            padding: '12px 24px', 
            borderRadius: 12,
            background: 'var(--elche-green)',
            color: 'white',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0, 150, 79, 0.2)'
          }}>
          💾 Guardar inventario final
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
          style={{ 
            padding: '12px 24px', 
            borderRadius: 12,
            background: 'var(--elche-gray)',
            color: 'var(--elche-text-light)',
            fontWeight: 600
          }}>
          📊 Rellenar con calculado
        </button>
      </div>
    </div>

  </section>
)}


      {/* --- TAB: VENTAS (totales) --- */}
      {tab === 'ventas' && (
        <section style={{ display: 'grid', gap: 24 }}>
          {/* Resumen de ventas */}
          <div style={{ ...card }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--elche-text)' }}>
              📊 Totales de ventas
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ 
                ...card, 
                background: 'linear-gradient(135deg, var(--elche-green) 0%, var(--elche-green-light) 100%)',
                color: 'white'
              }}>
                <div style={{ opacity: 0.9, marginBottom: 8 }}>Tickets</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{totals.num_sales}</div>
              </div>
              <div style={{ 
                ...card, 
                background: 'linear-gradient(135deg, var(--elche-green-light) 0%, var(--elche-green) 100%)',
                color: 'white'
              }}>
                <div style={{ opacity: 0.9, marginBottom: 8 }}>Artículos</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{totals.total_items}</div>
              </div>
              <div style={{ 
                ...card, 
                background: 'linear-gradient(135deg, var(--elche-green-dark) 0%, var(--elche-green) 100%)',
                color: 'white'
              }}>
                <div style={{ opacity: 0.9, marginBottom: 8 }}>Ingresos</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{(totals.total_cents/100).toFixed(2)} €</div>
              </div>
            </div>
            <button 
              onClick={() => {
                fetchTotals();
                fetchSales(currentPage);
              }} 
              style={{ 
                marginTop: 20, 
                padding: '12px 24px', 
                borderRadius: 12,
                background: 'var(--elche-green)',
                color: 'white',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(0, 150, 79, 0.2)'
              }}>
              🔄 Refrescar
            </button>
          </div>

          {/* Historial de ventas */}
          <div style={{ ...card }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: '2px solid var(--elche-gray)'
            }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--elche-text)' }}>
                🧾 Historial de ventas
              </div>
              <div style={{ color: 'var(--elche-text-light)', fontSize: 14 }}>
                Mostrando {sales.length} de {totalSales} ventas
              </div>
            </div>
            {loadingSales ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: 'var(--elche-text-light)' 
              }}>
                Cargando ventas...
              </div>
            ) : sales.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: 'var(--elche-text-light)' 
              }}>
                No hay ventas registradas aún
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: 12 }}>
                  {sales.map((sale) => {
                    const date = new Date(sale.created_at);
                    const timeStr = date.toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });
                    const dateStr = date.toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });
                    return (
                      <div key={sale.id} style={{
                        padding: '16px',
                        background: 'var(--elche-gray)',
                        borderRadius: 12,
                        border: '1px solid rgba(0, 150, 79, 0.1)'
                      }}>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr auto auto', 
                          gap: 16, 
                          alignItems: 'center',
                          marginBottom: 12
                        }}>
                          <div>
                            <div style={{ 
                              fontSize: 12, 
                              color: 'var(--elche-text-light)',
                              marginBottom: 4
                            }}>
                              {dateStr} · {timeStr}
                            </div>
                            <div style={{ 
                              fontSize: 11, 
                              color: 'var(--elche-text-light)',
                              fontFamily: 'monospace'
                            }}>
                              ID: {sale.id.substring(0, 8)}...
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ 
                              fontSize: 13, 
                              color: 'var(--elche-text-light)',
                              marginBottom: 2
                            }}>
                              {sale.total_items} artículo{sale.total_items !== 1 ? 's' : ''}
                            </div>
                            <div style={{ 
                              fontSize: 20, 
                              fontWeight: 700,
                              color: 'var(--elche-green)'
                            }}>
                              {(sale.total_cents / 100).toFixed(2)} €
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const detailsId = `details-${sale.id}`;
                              const element = document.getElementById(detailsId);
                              if (element) {
                                element.style.display = element.style.display === 'none' ? 'block' : 'none';
                              }
                            }}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 8,
                              background: 'white',
                              color: 'var(--elche-green)',
                              fontWeight: 600,
                              fontSize: 13
                            }}>
                            Ver detalle
                          </button>
                        </div>
                        {/* Detalle de líneas (oculto por defecto) */}
                        <div id={`details-${sale.id}`} style={{ display: 'none', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0, 150, 79, 0.2)' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--elche-text)', marginBottom: 8 }}>
                            Productos vendidos:
                          </div>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {sale.sale_lines.map((line, idx) => {
                              const product = products.find(p => p.id === line.product_id);
                              return (
                                <div key={idx} style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  background: 'white',
                                  borderRadius: 8,
                                  fontSize: 13
                                }}>
                                  <div style={{ color: 'var(--elche-text)' }}>
                                    <strong>{line.qty}x</strong> {product?.name ?? 'Producto desconocido'}
                                  </div>
                                  <div style={{ color: 'var(--elche-green)', fontWeight: 600 }}>
                                    {((line.price_cents * line.qty) / 100).toFixed(2)} €
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Paginación */}
                {totalSales > SALES_PER_PAGE && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 20,
                    paddingTop: 20,
                    borderTop: '2px solid var(--elche-gray)'
                  }}>
                    <button
                      onClick={() => fetchSales(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        background: currentPage === 1 ? 'var(--elche-gray)' : 'white',
                        color: currentPage === 1 ? 'var(--elche-text-light)' : 'var(--elche-green)',
                        fontWeight: 600,
                        border: '2px solid var(--elche-gray)'
                      }}>
                      ← Anterior
                    </button>
                    <div style={{ color: 'var(--elche-text)', fontWeight: 600 }}>
                      Página {currentPage} de {Math.ceil(totalSales / SALES_PER_PAGE)}
                    </div>
                    <button
                      onClick={() => fetchSales(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalSales / SALES_PER_PAGE)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        background: currentPage >= Math.ceil(totalSales / SALES_PER_PAGE) ? 'var(--elche-gray)' : 'white',
                        color: currentPage >= Math.ceil(totalSales / SALES_PER_PAGE) ? 'var(--elche-text-light)' : 'var(--elche-green)',
                        fontWeight: 600,
                        border: '2px solid var(--elche-gray)'
                      }}>
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
