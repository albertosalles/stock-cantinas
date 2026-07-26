-- ============================================================================
-- Esquema base del banco de pruebas de carga
--
-- Réplica fiel del esquema de producción (proyecto Supabase `Cantinator`),
-- reconstruida desde el catálogo de Postgres el 2026-07-26. Se mantiene a mano:
-- si cambia una RPC en producción, hay que reflejarlo aquí o las mediciones
-- dejan de ser comparables.
--
-- Deliberadamente NO incluye: RLS (hoy deshabilitado en producción), la
-- publicación de Realtime (el banco mide el lado Postgres, no el WebSocket)
-- ni los roles de Supabase (anon/authenticated), que no afectan al coste medido.
-- ============================================================================

drop schema if exists public cascade;
create schema public;

-- ─────────────────────────── Tablas ───────────────────────────

create table public.seasons (
  id uuid not null default gen_random_uuid(),
  name text not null,
  starts_on date,
  ends_on date,
  active boolean not null default false,
  status text not null default 'open'::text,
  created_at timestamp with time zone not null default now(),
  constraint seasons_pkey primary key (id),
  constraint seasons_name_key unique (name),
  constraint seasons_status_check check (status = any (array['open'::text, 'closed'::text]))
);

create table public.users (
  id uuid not null default gen_random_uuid(),
  email text not null,
  name text,
  created_at timestamp with time zone default now(),
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email)
);

create table public.events (
  id uuid not null default gen_random_uuid(),
  name text not null,
  date timestamp with time zone not null,
  status text default 'draft'::text,
  season_id uuid not null,
  constraint events_pkey primary key (id),
  constraint events_season_id_fkey foreign key (season_id) references public.seasons(id),
  constraint events_status_check check (status = any (array['draft'::text, 'live'::text, 'closed'::text]))
);

create table public.cantinas (
  id uuid not null default gen_random_uuid(),
  name text not null,
  location text,
  qr_token uuid not null default gen_random_uuid(),
  constraint cantinas_pkey primary key (id),
  constraint cantinas_qr_token_key unique (qr_token)
);

create table public.cantina_access (
  cantina_id uuid not null,
  pin_code text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint cantina_access_v2_pkey primary key (cantina_id),
  constraint cantina_access_v2_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id) on delete cascade
);

create table public.products (
  id uuid not null default gen_random_uuid(),
  sku smallint,
  name text not null,
  unit text default 'ud'::text,
  category text,
  constraint products_pkey primary key (id),
  constraint products_sku_key unique (sku),
  constraint products_category_check check (category is null or (category = any (array['Bebida'::text, 'Comida'::text, 'Snacks'::text])))
);

create table public.waiters (
  id uuid not null default gen_random_uuid(),
  name text not null,
  surname text,
  active boolean not null default true,
  qr_token uuid not null default gen_random_uuid(),
  pin_code text,
  created_at timestamp with time zone not null default now(),
  constraint waiters_pkey primary key (id),
  constraint waiters_qr_token_key unique (qr_token),
  constraint waiters_pin_code_key unique (pin_code)
);

create table public.event_cantinas (
  id uuid not null default gen_random_uuid(),
  event_id uuid,
  cantina_id uuid,
  constraint event_cantinas_pkey primary key (id),
  constraint event_cantinas_event_id_cantina_id_key unique (event_id, cantina_id),
  constraint event_cantinas_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade,
  constraint event_cantinas_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id) on delete cascade
);

create table public.event_products (
  id uuid not null default gen_random_uuid(),
  event_id uuid,
  product_id uuid,
  price_cents integer not null,
  active boolean default true,
  low_stock_threshold integer default 0,
  sort_order integer default 0,
  featured boolean not null default false,
  constraint event_products_pkey primary key (id),
  constraint event_products_event_id_product_id_key unique (event_id, product_id),
  constraint event_products_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade,
  constraint event_products_product_id_fkey foreign key (product_id) references public.products(id)
);

create table public.sales (
  id uuid not null default gen_random_uuid(),
  event_id uuid,
  cantina_id uuid,
  user_id uuid,
  total_cents integer not null,
  total_items integer not null,
  status text default 'OK'::text,
  created_at timestamp with time zone default now(),
  client_request_id uuid,
  waiter_id uuid,
  voided_at timestamp with time zone,
  voided_by uuid,
  void_reason text,
  constraint sales_pkey primary key (id),
  constraint sales_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade,
  constraint sales_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id) on delete cascade,
  constraint sales_user_id_fkey foreign key (user_id) references public.users(id),
  constraint sales_waiter_id_fkey foreign key (waiter_id) references public.waiters(id),
  constraint sales_voided_by_fkey foreign key (voided_by) references public.waiters(id),
  constraint sales_status_check check (status = any (array['OK'::text, 'CANCELED'::text]))
);

create table public.sale_line_items (
  id uuid not null default gen_random_uuid(),
  sale_id uuid,
  product_id uuid,
  qty integer not null,
  unit_price_cents integer not null,
  constraint sale_line_items_pkey primary key (id),
  constraint sale_line_items_sale_id_fkey foreign key (sale_id) references public.sales(id) on delete cascade,
  constraint sale_line_items_product_id_fkey foreign key (product_id) references public.products(id),
  constraint sale_line_items_qty_check check (qty > 0)
);

create table public.stock_movements (
  id uuid not null default gen_random_uuid(),
  event_id uuid,
  cantina_id uuid,
  product_id uuid,
  qty integer not null,
  type text,
  reason text,
  ref_sale_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now(),
  constraint stock_movements_pkey primary key (id),
  constraint stock_movements_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade,
  constraint stock_movements_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id) on delete cascade,
  constraint stock_movements_product_id_fkey foreign key (product_id) references public.products(id),
  constraint stock_movements_created_by_fkey foreign key (created_by) references public.users(id),
  constraint stock_movements_type_check check (type = any (array['INIT'::text, 'SALE'::text, 'ADJUSTMENT'::text, 'TRANSFER_IN'::text, 'TRANSFER_OUT'::text, 'WASTE'::text, 'RETURN'::text]))
);

create table public.inventory_snapshots (
  id uuid not null default gen_random_uuid(),
  event_id uuid,
  cantina_id uuid,
  product_id uuid,
  kind text,
  qty integer not null,
  created_by uuid,
  created_at timestamp with time zone default now(),
  constraint inventory_snapshots_pkey primary key (id),
  constraint inventory_snapshots_event_id_cantina_id_product_id_kind_key unique (event_id, cantina_id, product_id, kind),
  constraint inventory_snapshots_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade,
  constraint inventory_snapshots_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id) on delete cascade,
  constraint inventory_snapshots_product_id_fkey foreign key (product_id) references public.products(id),
  constraint inventory_snapshots_created_by_fkey foreign key (created_by) references public.users(id),
  constraint inventory_snapshots_kind_check check (kind = any (array['INITIAL'::text, 'FINAL'::text])),
  constraint inventory_snapshots_qty_check check (qty >= 0)
);

create table public.shifts (
  id uuid not null default gen_random_uuid(),
  waiter_id uuid not null,
  cantina_id uuid not null,
  event_id uuid not null,
  started_at timestamp with time zone not null default now(),
  ended_at timestamp with time zone,
  hours numeric(10,2),
  constraint shifts_pkey primary key (id),
  constraint shifts_waiter_id_fkey foreign key (waiter_id) references public.waiters(id),
  constraint shifts_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id),
  constraint shifts_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade
);

-- Proyección del stock actual (migración 2026-07-26_materialize_stock).
-- Derivada de stock_movements y mantenida por trigger; NO es fuente de verdad.
create table public.cantina_stock (
  event_id   uuid not null references public.events(id)   on delete cascade,
  cantina_id uuid not null references public.cantinas(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty        integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (event_id, cantina_id, product_id)
);

create table public.incidents (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  cantina_id uuid not null,
  waiter_id uuid,
  type text not null,
  product_ids uuid[],
  description text,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone,
  constraint incidents_pkey primary key (id),
  constraint incidents_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade,
  constraint incidents_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id) on delete cascade,
  constraint incidents_waiter_id_fkey foreign key (waiter_id) references public.waiters(id),
  constraint incidents_type_check check (type = any (array['STOCK'::text, 'TECH'::text, 'OTHER'::text])),
  constraint incidents_status_check check (status = any (array['pending'::text, 'resolved'::text]))
);

-- ─────────────────────────── Índices ───────────────────────────
-- Incluye los 11 añadidos en la épica de higiene (migración perf_missing_indexes_inf1).

create unique index one_active_season on public.seasons using btree (active) where (active = true);
create index idx_events_season on public.events using btree (season_id);
create index idx_events_status_date on public.events using btree (status, date desc);
create index idx_cantina_access_active on public.cantina_access using btree (cantina_id) where (is_active = true);
create index idx_event_cantinas_cantina on public.event_cantinas using btree (cantina_id);
create index idx_event_products_product on public.event_products using btree (product_id);
create index idx_sales_lookup on public.sales using btree (event_id, cantina_id, created_at);
create index idx_sales_waiter on public.sales using btree (waiter_id);
create unique index sales_client_request_id_uidx on public.sales using btree (client_request_id) where (client_request_id is not null);
create index idx_sales_event_status_created on public.sales using btree (event_id, status, created_at);
create index idx_sli_sale on public.sale_line_items using btree (sale_id);
create index idx_sli_product on public.sale_line_items using btree (product_id);
create index idx_movements_lookup on public.stock_movements using btree (event_id, cantina_id, product_id);
create index idx_movements_ref_sale on public.stock_movements using btree (ref_sale_id) where (ref_sale_id is not null);
create unique index one_open_shift_per_waiter on public.shifts using btree (waiter_id) where (ended_at is null);
create index idx_shifts_event_cantina on public.shifts using btree (event_id, cantina_id);
create index idx_shifts_open on public.shifts using btree (event_id, cantina_id) where (ended_at is null);
create index idx_shifts_cantina on public.shifts using btree (cantina_id);
create index idx_incidents_event_status on public.incidents using btree (event_id, status, created_at desc);
create index idx_incidents_cantina_status on public.incidents using btree (cantina_id, status);

-- ─────────────────────────── Vistas ───────────────────────────

create view public.v_inventory_current as
 select event_id, cantina_id, product_id, (sum(qty))::integer as current_qty
   from public.stock_movements
  group by event_id, cantina_id, product_id;

-- Lectura de stock en O(1): lee la proyección en lugar de agregar el histórico.
create view public.v_cantina_inventory as
 select ep.event_id,
    ec.cantina_id,
    ep.product_id,
    coalesce(cs.qty, 0) as current_qty,
    coalesce(ep.low_stock_threshold, 0) as low_stock_threshold
   from public.event_products ep
   join public.event_cantinas ec on ec.event_id = ep.event_id
   left join public.cantina_stock cs
     on cs.event_id = ec.event_id and cs.cantina_id = ec.cantina_id and cs.product_id = ep.product_id;

create view public.v_sales_by_cantina as
 select event_id, cantina_id, count(*) as num_sales,
    (sum(total_cents))::integer as total_cents,
    (sum(total_items))::integer as total_items
   from public.sales s
  where (status = 'OK'::text)
  group by event_id, cantina_id;

create view public.v_sold_by_cantina_product as
 select event_id, cantina_id, product_id,
    (coalesce(sum((- qty)), (0)::bigint))::integer as sold_qty
   from public.stock_movements
  where (type = 'SALE'::text)
  group by event_id, cantina_id, product_id;

create view public.v_event_products_eur as
 select ep.event_id, ep.product_id, p.name,
    ((ep.price_cents)::numeric / (100)::numeric) as price_eur,
    ep.active, ep.low_stock_threshold
   from (public.event_products ep
     join public.products p on ((p.id = ep.product_id)));

create view public.v_available_cantinas as
 select e.id as event_id, e.name as event_name, e.status as event_status,
    c.id as cantina_id, c.name as cantina_name, c.location as cantina_location,
    ca.is_active as access_enabled,
    case when (ca.cantina_id is null) then false else true end as has_credentials
   from (((public.events e
     join public.event_cantinas ec on ((ec.event_id = e.id)))
     join public.cantinas c on ((c.id = ec.cantina_id)))
     left join public.cantina_access ca on ((ca.cantina_id = c.id)))
  where (e.status = 'live'::text)
  order by e.date desc, c.name;
