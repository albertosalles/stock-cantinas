# CANTINEITOR PLUS

# App de gestión y monitorización de stock para eventos


## 1) Objetivo y alcance

Digitalizar el control de stock de varias **Cantinas** en un estadio durante **Eventos** (partidos, conciertos), permitiendo a:

- **Administrador**: configurar evento, asignar cantinas, definir catálogo, ver panel en tiempo real, cerrar evento y consolidar resultados.
- **Cantina**: fijar inventario inicial, **registrar ventas** (descuentan stock), realizar ajustes (mermas/traspasos), ver inventario final y total de ventas.

## 2) Roles y capacidades

**Administrador**

- Crear/editar **Evento**.
- Agregar **Cantinas** al evento.
- Añadir/editar **Producto** en **Catálogo del evento** (precio, activación por cantina).
- Panel por cantina: ver inventario actual, modificar inventario inicial/final, ver ventas.

**Cantina**

- Seleccionar su cantina en el evento.
- Añadir/modificar inventario inicial.
- Registrar venta (disminuye stock).
- Ver total de ventas.
- Ver inventario final.

> Sugerencia: añadir ajustes de stock (merma/rotura/consumo interno/traspaso) con motivos y responsable, y umbrales de alerta por producto.
> 

---

## 3) Modelo de dominio y datos

Entidades principales (scope **por evento**):

- `Event`: partido/concierto (fecha, estado: draft|live|closed).
- `Cantina`: punto de venta físico.
- `EventCantina`: asignación de una cantina a un evento (posibles overrides como nombre de turno, ubicación).
- `Product`: referencia global (sku, nombre, unidad).
- `EventProduct`: configuración del producto **para ese evento** (precio, activo, umbral_alerta, habilitado_por_cantina?).
- `InventorySnapshot`: fotografía de inventario **inicial** y **final** por cantina-producto.
- `StockMovement`: movimientos atómicos (+/-) con tipo: `INIT`, `SALE`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `WASTE`, `RETURN`, con `reason`, `user_id` y referencia opcional.
- `Sale` y `SaleLineItem`: venta (totales, método de pago opcional) y sus líneas.
- `User`, `RoleAssignment` (RBAC por evento/cantina).
- (Opcional) `InventoryCache` o vista materializada para lecturas rápidas en tiempo real.

### Reglas clave

- El **inventario actual** = `sum(StockMovement.qty)` por (evento, cantina, producto). El `INIT` se genera automáticamente desde el snapshot inicial.
- Ventas generan movimientos `SALE` negativos (+ líneas detalladas en `SaleLineItem`).
- No permitir inventario negativo (validación en servidor + constraint transaccional).
- Todos los cambios quedan auditados en `StockMovement`.

### Esquema SQL (DDL simplificado)

```sql
-- Usuarios y roles
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE events (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  date timestamptz NOT NULL,
  status text CHECK (status IN ('draft','live','closed')) DEFAULT 'draft'
);

CREATE TABLE cantinas (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  location text
);

CREATE TABLE event_cantinas (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  cantina_id uuid REFERENCES cantinas(id) ON DELETE CASCADE,
  UNIQUE(event_id, cantina_id)
);

CREATE TABLE products (
  id uuid PRIMARY KEY,
  sku text UNIQUE,
  name text NOT NULL,
  unit text DEFAULT 'ud'
);

CREATE TABLE event_products (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  price_cents integer NOT NULL,
  active boolean DEFAULT true,
  low_stock_threshold integer DEFAULT 0,
  UNIQUE(event_id, product_id)
);

CREATE TABLE inventory_snapshots (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  cantina_id uuid REFERENCES cantinas(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  kind text CHECK (kind IN ('INITIAL','FINAL')),
  qty integer NOT NULL CHECK (qty >= 0),
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, cantina_id, product_id, kind)
);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  cantina_id uuid REFERENCES cantinas(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  qty integer NOT NULL, -- negative for SALE/TRANSFER_OUT/WASTE
  type text CHECK (type IN ('INIT','SALE','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT','WASTE','RETURN')),
  reason text,
  ref_sale_id uuid,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sales (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  cantina_id uuid REFERENCES cantinas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  total_cents integer NOT NULL,
  total_items integer NOT NULL,
  status text CHECK (status IN ('OK','CANCELED')) DEFAULT 'OK',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sale_line_items (
  id uuid PRIMARY KEY,
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  qty integer NOT NULL CHECK (qty > 0),
  unit_price_cents integer NOT NULL
);

-- Índices sugeridos
CREATE INDEX idx_movements_lookup ON stock_movements (event_id, cantina_id, product_id);
CREATE INDEX idx_sales_lookup ON sales (event_id, cantina_id, created_at);

```

---

## 4) Flujo operativo por jornada

1. **Pre-evento (Admin/Cantina)**
    - Crear evento y asignar cantinas.
    - Cargar catálogo del evento (precios) y umbrales.
    - Cada cantina introduce **inventario inicial** → genera `INIT`.
2. **Durante evento (Cantina)**
    - **Registrar ventas** (rápido: lector de código de barras/atajos).
    - Registrar ajustes (mermas, traspasos) cuando ocurran.
    - El Admin ve panel **en tiempo real** con alertas de bajo stock.
3. **Cierre (Admin/Cantina)**
    - Introducir **snapshot final** por cantina-producto.
    - Conciliación: inicial + entradas - salidas vs ventas + mermas.
    - Exportes: CSV/PDF por cantina y global.

---

## 5) Tiempo real (opciones)

**A. Supabase/Postgres Realtime (rápido)**

- Postgres + Realtime (escucha WAL) emite cambios en `stock_movements`, `sales`.
- Frontend suscrito por `channel: event:{event_id}`.

**B. Backend propio + WebSockets/Socket.IO (escalable)**

- API (NestJS/Express) + **Redis** pub/sub.
- Tras cada transacción, publicar evento `inventory.updated` / `sale.created` con payload mínimo (ids, agregados por cantina-producto) y el cliente re-hidrata.

> En ambos casos, consolidar en servidor para evitar cálculos pesados en cliente.
> 

---

## 6) Autenticación y autorización

- **Auth**: email+password o magic link; opcional SSO interno.
- **RBAC**: `RoleAssignment(user_id, role, event_id, cantina_id?)` → un usuario puede ser Admin global o de un evento; Cantinero ligado a una cantina de un evento.
- **RLS/Policies** (si Postgres-Supabase): políticas por `event_id` y `cantina_id`.

---

## 7) Integridad y concurrencia

- Usar **transacciones**: crear `sale` + `sale_line_items` + `stock_movements(SALE)` en un commit.
- **Bloqueo optimista**: impedimos que la venta deje stock < 0 (CHECK vía función antes de commit o `EXCLUDE`/trigger).
- **Idempotencia** para ventas (clave externa `client_request_id`).

---

## 8) Offline-first (PWA)

- **Service Worker** + **IndexedDB** para cola de ventas y movimientos si se cae la red.
- Estrategia: `queue → sync background → server` con reintento exponencial.
- Resolución de conflictos: servidor manda rechazo si stock quedaría negativo; UI muestra corrección.

---

## 9) API (REST) de ejemplo

Base: `/api/v1` (todas con `event_id` contextual)

**Ventas**

- `POST /events/:eventId/cantinas/:cantinaId/sales`
    
    ```json
    {
      "lines": [{"productId": "...", "qty": 2}],
      "clientRequestId": "uuid"
    }
    
    ```
    
    → crea `Sale` y `StockMovement` por línea (`SALE`, qty negativo). Respuesta incluye totales.
    

**Inventario**

- `POST /events/:eventId/cantinas/:cantinaId/initial-inventory` → genera snapshots + movimientos `INIT`.
- `POST /events/:eventId/cantinas/:cantinaId/adjustments` → `{ productId, qty, type: 'WASTE'|'ADJUSTMENT'|'TRANSFER_OUT'|'TRANSFER_IN', reason }`.
- `GET /events/:eventId/cantinas/:cantinaId/inventory` → cantidades actuales + umbrales.

**Catálogo**

- `POST /events/:eventId/products` → alta/edición de `EventProduct`.
- `GET /events/:eventId/products` → lista con precios vigentes.

**Realtime**

- WS topic: `events.{eventId}.cantinas.{cantinaId}` → `inventory.updated`, `sale.created`.

---

## 10) UI/UX (pantallas clave)

**Admin Dashboard (evento en vivo)**

- Tarjetas por cantina: ventas € y uds, top productos, **semáforo** de stock (verde/amarillo/rojo), alertas.
- Tabla global de productos con agregados.

**Modo Cantina**

- Selector de producto con búsqueda/teclas rápidas, botón `+1`, `+2`, etc.
- Contador visible por producto (stock restante).
- Botón **Ajuste** (merma/traspaso) con motivo.
- Resumen de ventas e inventario final.

---

## 11) Alertas y reglas

- Bajo stock: `current <= low_stock_threshold`.
- Desviación cierre: `|esperado - final| > X%`.
- Desconexión: cliente sin latido > N segundos.

---

## 12) Observabilidad y auditoría

- Tabla `audit_log` (user, acción, entidad, diff JSON, timestamp).
- Métricas: TPS ventas, latencia API, errores, drops de conexión.
- Exportes CSV/PDF por cantina y consolidado.

---

## 13) Infraestructura y stack sugerido

**Rápido (MVP)**

- Frontend: **Next.js** (React), PWA.
- Backend: **Supabase** (Auth, Postgres, Realtime, RLS) o **Hasura**.

**Escalable (propio)**

- Backend: **NestJS** (TypeScript), **Prisma** ORM.
- DB: **PostgreSQL**. Cache y pub/sub: **Redis**.
- Realtime: **Socket.IO** o **WebSocket nativo**.
- CI/CD: GitHub Actions + Docker + Fly.io/Render/Hetzner.

---

## 14) Seguridad y RGPD

- Mínimos datos personales (nombre/email). Logs con pseudonimización.
- RLS/Policies o middleware de autorización.
- Backups automáticos; cifrado en tránsito.

---

## 15) Roadmap (3 sprints x 1-2 semanas)

**Sprint 1 (MVP funcional)**

- Auth + creación de evento y cantinas.
- Catálogo del evento.
- Inventario inicial y registro de ventas (online).
- Dashboard admin con lista en vivo.

**Sprint 2**

- Ajustes de stock, alertas de bajo stock.
- Exportes (CSV), cierre con inventario final y conciliación.
- PWA offline básico (cola de ventas).

**Sprint 3**

- Auditoría completa, traspasos entre cantinas, reportes PDF.
- Optimizaciones de performance (cache/materialized views).

---

## 16) Prompts útiles (para acelerar desarrollo)

- **Generar datos de prueba**: "Crea 50 productos de bebidas y snacks con precios en céntimos y umbrales de stock, en JSON compatible con `event_products`".
- **SQL helpers**: "Escribe una vista que agregue inventario actual por cantina-producto a partir de `stock_movements`".
- **Testing**: "Genera 30 ventas aleatorias sin dejar stock negativo basado en este catálogo".

---

## 17) Plan de pruebas

- **Unidad**: servicios de ventas y movimientos (incluye no-negativo).
- **Integración**: transacción `sale` + `stock_movements` + emisión realtime.
- **E2E**: flujo completo por jornada.
- **Carga**: 50 cantinas, 10 ventas/seg → latencia < 200ms P95.

---

## 18) Ejemplos prácticos

**Vista de inventario actual (SQL)**

```sql
CREATE OR REPLACE VIEW v_inventory_current AS
SELECT event_id, cantina_id, product_id,
       SUM(qty)::int AS current_qty
FROM stock_movements
GROUP BY event_id, cantina_id, product_id;

```

**Payload de evento WS `inventory.updated`**

```json
{
  "eventId": "...",
  "cantinaId": "...",
  "changes": [{"productId": "...", "currentQty": 34}],
  "at": "2025-10-07T19:12:00Z"
}

```

---

### Siguientes pasos propuestos

1. Elegir stack (MVP rápido vs escalable).
2. Definir catálogo inicial y campos mínimos por producto.
3. Implementar `sale.create` y vista `v_inventory_current` con emisión realtime.
4. Construir UI **Modo Cantina** (venta rápida) y **Dashboard Admin** (en vivo).

---

## 19) Stack elegido (MVP rápido) y checklist

**Stack:** Next.js (App Router) + Supabase (Auth, Postgres, Realtime) + TypeScript.

**Checklist de arranque**

1. Crear proyecto en Supabase y cargar el **DDL** (sección 3) + ajustes de UUID por defecto (abajo).
2. Ejecutar **seeds** de catálogo (Agua, Cocacola, Palomitas, Bocatas) y crear 1 **Evento**.
3. Crear tus **Cantinas** y asignarlas al evento.
4. Para cada cantina, cargar **Inventario Inicial** (snapshot + movimientos `INIT`).
5. Desplegar Next.js y configurar **Realtime** sobre `stock_movements` y `sales`.

---

## 20) SQL — ajustes de UUID por defecto (Supabase)

```sql
-- Habilitar extensión (ya viene en Supabase normalmente)
create extension if not exists pgcrypto;

-- Asegurar UUID por defecto en tablas principales
alter table users              alter column id set default gen_random_uuid();
alter table events             alter column id set default gen_random_uuid();
alter table cantinas           alter column id set default gen_random_uuid();
alter table event_cantinas     alter column id set default gen_random_uuid();
alter table products           alter column id set default gen_random_uuid();
alter table event_products     alter column id set default gen_random_uuid();
alter table inventory_snapshots alter column id set default gen_random_uuid();
alter table stock_movements    alter column id set default gen_random_uuid();
alter table sales              alter column id set default gen_random_uuid();
alter table sale_line_items    alter column id set default gen_random_uuid();

```

---

## 21) Seed — Catálogo inicial + Evento (idempotente, usa precios en **euros**)

> Soluciona tu error: en Postgres/Supabase no puedes usar variables tipo :event_id dentro de un script. Este seed captura el event_id con CTEs y usa euros en el código, convirtiéndolos a céntimos al guardar.
> 

```sql
-- 1) Productos base (upsert por SKU)
insert into products (sku, name, unit) values
 ('AGUA-50CL',      'Agua',       'ud'),
 ('COCA-33CL',      'Cocacola',   'ud'),
 ('PALOMITAS-STD',  'Palomitas',  'ud'),
 ('BOCATA-MIX',     'Bocatas',    'ud')
on conflict (sku) do update set name = excluded.name, unit = excluded.unit;

-- 2) Crear (o reutilizar) un evento y capturar su id
with evt_ins as (
  insert into events (name, date, status)
  values ('Partido 01', '2025-10-07 20:00:00+02', 'draft')
  on conflict do nothing
  returning id
), evt as (
  select id from evt_ins
  union all
  select id from events where name = 'Partido 01' and date = '2025-10-07 20:00:00+02'
)
-- 3) Configurar precios del evento en **euros** (se convierten a céntimos al guardar)
insert into event_products (event_id, product_id, price_cents, active, low_stock_threshold)
select (select id from evt) as event_id,
       p.id,
       round((case p.name
         when 'Agua' then 1.50
         when 'Cocacola' then 2.50
         when 'Palomitas' then 3.00
         when 'Bocatas' then 4.50
       end) * 100)::int as price_cents,
       true,
       case p.name when 'Agua' then 30 when 'Cocacola' then 30 when 'Palomitas' then 15 when 'Bocatas' then 20 end
from products p
where p.name in ('Agua','Cocacola','Palomitas','Bocatas')
on conflict (event_id, product_id) do update
set price_cents = excluded.price_cents,
    active = excluded.active,
    low_stock_threshold = excluded.low_stock_threshold;

```

**Opcional (comodidad para trabajar en euros)**

```sql
-- Vista para leer precios en euros
create or replace view v_event_products_eur as
select ep.event_id, ep.product_id, p.name,
       (ep.price_cents::numeric / 100) as price_eur,
       ep.active, ep.low_stock_threshold
from event_products ep
join products p on p.id = ep.product_id;

-- Helper para actualizar precio en euros
create or replace function set_event_product_price_eur(p_event_id uuid, p_product_id uuid, p_price_eur numeric)
returns void language sql as $$
  update event_products
  set price_cents = round(p_price_eur * 100)::int
  where event_id = p_event_id and product_id = p_product_id;
$$;

```

> En el frontend ya mostramos price_cents/100 → verás los precios en euros. Para escribir nuevos precios desde SQL o RPC, pasa euros y convierte con *100 como en el seed, o usa la función set_event_product_price_eur.
> 

## 22) Carga de Cantinas y Asignación al Evento

```sql
-- Crea tus cantinas
insert into cantinas (name, location) values ('Cantina Norte','Grada Norte'), ('Cantina Sur','Grada Sur')
returning id;
-- Copia sus ids para :cantina_norte_id y :cantina_sur_id

-- Asigna al evento
insert into event_cantinas (event_id, cantina_id) values (:event_id, :cantina_norte_id), (:event_id, :cantina_sur_id);

```

---

## 23) Inventario Inicial (snapshot + movimiento INIT)

```sql
-- Ejemplo de inventario inicial para una cantina
-- Repite por cada producto/cantina con la cantidad deseada
with p as (
  select id, name from products where name in ('Agua','Cocacola','Palomitas','Bocatas')
), ins as (
  insert into inventory_snapshots (event_id, cantina_id, product_id, kind, qty)
  select :event_id, :cantina_id, id, 'INITIAL',
         case name when 'Agua' then 100 when 'Cocacola' then 100 when 'Palomitas' then 50 when 'Bocatas' then 40 end
  from p
  returning product_id, qty
)
insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason)
select :event_id, :cantina_id, product_id, qty, 'INIT', 'Carga inventario inicial'
from ins;

```

---

## 24) Vista de inventario actual

```sql
create or replace view v_inventory_current as
select event_id, cantina_id, product_id, sum(qty)::int as current_qty
from stock_movements
group by event_id, cantina_id, product_id;

```

---

## 25) RPC transaccional: `create_sale` (ventas + movimientos)

> Inserta una venta con sus líneas y crea movimientos SALE negativos, evitando stock negativo.
> 

```sql
create or replace function create_sale(
  p_event_id uuid,
  p_cantina_id uuid,
  p_user_id uuid,
  p_lines jsonb,              -- [{"productId":"uuid","qty":1}]
  p_client_request_id uuid    -- para idempotencia (opcional)
) returns table (sale_id uuid, total_cents int, total_items int)
language plpgsql security definer as $$
declare
  v_sale_id uuid := gen_random_uuid();
  v_total_cents int := 0;
  v_total_items int := 0;
  v_line jsonb;
  v_product uuid;
  v_qty int;
  v_price int;
  v_current int;
begin
  perform 1; -- marcador
  -- Calcular totales y validaciones previas
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product := (v_line->>'productId')::uuid;
    v_qty := (v_line->>'qty')::int;
    if v_qty <= 0 then raise exception 'Qty debe ser > 0'; end if;

    select ep.price_cents into v_price
    from event_products ep
    where ep.event_id = p_event_id and ep.product_id = v_product and ep.active = true;
    if v_price is null then raise exception 'Producto no activo en el evento'; end if;

    -- Comprobar stock suficiente
    select coalesce(sum(qty),0) into v_current
    from stock_movements
    where event_id = p_event_id and cantina_id = p_cantina_id and product_id = v_product;
    if v_current - v_qty < 0 then
      raise exception 'Stock insuficiente para producto % (disp: %, pedido: %)', v_product, v_current, v_qty;
    end if;

    v_total_cents := v_total_cents + v_price * v_qty;
    v_total_items := v_total_items + v_qty;
  end loop;

  -- Crear venta
  insert into sales (id, event_id, cantina_id, user_id, total_cents, total_items, status)
  values (v_sale_id, p_event_id, p_cantina_id, p_user_id, v_total_cents, v_total_items, 'OK');

  -- Crear líneas + movimientos
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product := (v_line->>'productId')::uuid;
    v_qty := (v_line->>'qty')::int;
    select ep.price_cents into v_price from event_products ep where ep.event_id = p_event_id and ep.product_id = v_product;

    insert into sale_line_items (sale_id, product_id, qty, unit_price_cents)
    values (v_sale_id, v_product, v_qty, v_price);

    insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, ref_sale_id)
    values (p_event_id, p_cantina_id, v_product, -v_qty, 'SALE', 'Venta', v_sale_id);
  end loop;

  return query select v_sale_id, v_total_cents, v_total_items;
end; $$;

```

---

## 26) (Opcional) RLS mínimo para entorno controlado del MVP

> Para desarrollo en entorno cerrado: permitir a cualquier usuario autenticado leer y escribir. No usar en producción.
> 

```sql
alter table users enable row level security;
alter table events enable row level security;
alter table cantinas enable row level security;
alter table event_cantinas enable row level security;
alter table products enable row level security;
alter table event_products enable row level security;
alter table inventory_snapshots enable row level security;
alter table stock_movements enable row level security;
alter table sales enable row level security;
alter table sale_line_items enable row level security;

create policy "dev read" on public.events for select using (auth.role() = 'authenticated');
create policy "dev write" on public.events for insert with check (auth.role() = 'authenticated');
create policy "dev update" on public.events for update using (auth.role() = 'authenticated');
-- Repite (read/write/update) para el resto de tablas en fase MVP.

```

---

## 27) Frontend (Next.js) — piezas clave

**Instala dependencias**

```bash
npm i @supabase/supabase-js @supabase/auth-helpers-nextjs

```

**`lib/supabaseClient.ts`**

```tsx
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

```

**Hook de inventario en vivo**

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useLiveInventory(eventId: string, cantinaId: string) {
  const [changes, setChanges] = useState<any[]>([]);
  useEffect(() => {
    const channel = supabase
      .channel(`evt-${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'stock_movements',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
        if ((payload.new as any)?.cantina_id === cantinaId) {
          setChanges((prev) => [payload, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, cantinaId]);
  return changes;
}

```

**Registrar venta (cliente)**

```tsx
export async function createSale(eventId: string, cantinaId: string, userId: string, lines: {productId: string, qty: number}[]) {
  const { data, error } = await supabase.rpc('create_sale', {
    p_event_id: eventId,
    p_cantina_id: cantinaId,
    p_user_id: userId,
    p_lines: lines,
    p_client_request_id: crypto.randomUUID()
  });
  if (error) throw error;
  return data;
}

```

**UI Cantina (esqueleto)**

```tsx
'use client';
import { useState } from 'react';
import { createSale } from '@/lib/sales';

export default function CantinaPOS({ eventId, cantinaId, userId, products }: any) {
  const [cart, setCart] = useState<{productId:string, qty:number}[]>([]);
  const addOne = (pid: string) => setCart((c) => {
    const i = c.findIndex(x => x.productId === pid);
    if (i >= 0) { const n=[...c]; n[i] = {...n[i], qty: n[i].qty+1}; return n; }
    return [...c, {productId: pid, qty: 1}];
  });
  const sell = async () => { await createSale(eventId, cantinaId, userId, cart); setCart([]); };
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {products.map((p:any) => (
        <button key={p.id} className="rounded-2xl shadow p-6 text-left" onClick={() => addOne(p.id)}>
          <div className="text-xl font-semibold">{p.name}</div>
          <div className="opacity-70">{(p.price_cents/100).toFixed(2)} €</div>
        </button>
      ))}
      <div className="col-span-2 mt-4 flex gap-3">
        <button className="rounded-2xl shadow px-6 py-3" onClick={sell} disabled={!cart.length}>Vender ({cart.reduce((a,b)=>a+b.qty,0)})</button>
        <pre className="text-sm opacity-70">{JSON.stringify(cart)}</pre>
      </div>
    </div>
  );
}

```

**Consulta de productos activos para la cantina/evento**

```sql
-- Consulta para hidratar la UI con nombre y precio
select ep.product_id as id, p.name, ep.price_cents
from event_products ep
join products p on p.id = ep.product_id
where ep.event_id = :event_id and ep.active = true
order by p.name;

```

---

## 28) Siguientes pasos prácticos

1. Ejecuta 20)–24) en Supabase (migración + seeds).
2. Crea 1–2 cantinas y su inventario inicial (23).
3. Conecta el frontend (27) y prueba ventas → verifica `v_inventory_current`.
4. Activa el **Dashboard Admin** (10) con tarjetas por cantina + alertas por umbral.