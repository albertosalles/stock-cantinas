-- ─────────────────────────────────────────────────────────────────────────────
-- LÍNEA BASE · 1/4 · Extensiones, tablas, restricciones e índices
--
-- Extraída del catálogo de producción (proyecto iaiodqpukbornugdgolm) el
-- 2026-07-31, al arrancar F2 · Seguridad. Refleja el estado tras la migración
-- 20260729145606_cierre_inventario_reconcilia_stock.
--
-- POR QUÉ EXISTE: el registro de migraciones de producción empieza el
-- 2026-07-20, así que el esquema base (tablas, vistas y las RPC de F0) se creó
-- desde el editor SQL sin quedar registrado en ningún sitio. Los ficheros de
-- database/migrations/ cubren 5 de las 28 migraciones registradas. Reconstruir
-- el pasado desde ficheros incompletos daría un esquema local que parece fiel
-- sin serlo — justo el fallo que una fase de seguridad no se puede permitir.
--
-- NO APLICAR A PRODUCCIÓN. Esto describe lo que producción ya es; su único uso
-- es levantar un entorno local idéntico con `supabase db reset`. Por el mismo
-- motivo, nunca ejecutar `supabase db push` en este proyecto: el historial de
-- producción no contiene la línea base y el push intentaría recrearla.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ─── Catálogo y calendario ───────────────────────────────────────────────────

create table if not exists public.seasons (
    id uuid not null default gen_random_uuid(),
    name text not null,
    starts_on date,
    ends_on date,
    active boolean not null default false,
    status text not null default 'open'::text,
    created_at timestamp with time zone not null default now(),
    constraint seasons_pkey primary key (id),
    constraint seasons_name_key unique (name),
    constraint seasons_status_check check ((status = any (array['open'::text, 'closed'::text])))
);

-- Una sola temporada activa a la vez: índice único parcial, no restricción.
create unique index if not exists one_active_season on public.seasons using btree (active) where (active = true);

create table if not exists public.opponents (
    id uuid not null default gen_random_uuid(),
    name text not null,
    created_at timestamp with time zone not null default now(),
    constraint opponents_pkey primary key (id),
    constraint opponents_name_key unique (name)
);

comment on table public.opponents is 'Catalogo de equipos rivales. Existe para que la comparativa historica agrupe por una referencia estable y no por el nombre libre del evento.';

create table if not exists public.cantinas (
    id uuid not null default gen_random_uuid(),
    name text not null,
    location text,
    qr_token uuid not null default gen_random_uuid(),
    constraint cantinas_pkey primary key (id),
    constraint cantinas_qr_token_key unique (qr_token)
);

create table if not exists public.products (
    id uuid not null default gen_random_uuid(),
    sku smallint,
    name text not null,
    unit text default 'ud'::text,
    category text,
    constraint products_pkey primary key (id),
    constraint products_sku_key unique (sku),
    constraint products_category_check check (((category is null) or (category = any (array['Bebida'::text, 'Comida'::text, 'Snacks'::text]))))
);

create table if not exists public.users (
    id uuid not null default gen_random_uuid(),
    email text not null,
    name text,
    created_at timestamp with time zone default now(),
    constraint users_pkey primary key (id),
    constraint users_email_key unique (email)
);

create table if not exists public.waiters (
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

create table if not exists public.events (
    id uuid not null default gen_random_uuid(),
    name text not null,
    date timestamp with time zone not null,
    status text default 'draft'::text,
    season_id uuid not null,
    kickoff_at timestamp with time zone,
    opponent_id uuid,
    match_type text,
    constraint events_pkey primary key (id),
    constraint events_season_id_fkey foreign key (season_id) references public.seasons(id),
    constraint events_opponent_id_fkey foreign key (opponent_id) references public.opponents(id),
    constraint events_status_check check ((status = any (array['draft'::text, 'live'::text, 'closed'::text]))),
    constraint events_match_type_check check (((match_type is null) or (match_type = any (array['Liga'::text, 'Copa del Rey'::text, 'Amistoso'::text, 'Otro'::text]))))
);

comment on column public.events.kickoff_at is 'Hora del pitido inicial. NULL = sin definir; el mapa de calor no se puede calcular sin ella. La apertura de puertas se deriva restando 90 minutos.';
comment on column public.events.opponent_id is 'Rival, referenciado al catalogo. NULL en eventos que no son partido.';
comment on column public.events.match_type is 'Competicion. Afecta a la afluencia esperada, asi que la comparativa historica debe distinguirla en lugar de mezclar escenarios distintos.';

create index if not exists idx_events_status_date on public.events using btree (status, date desc);
create index if not exists idx_events_season on public.events using btree (season_id);
create index if not exists idx_events_opponent on public.events using btree (opponent_id);
create index if not exists idx_events_match_type on public.events using btree (match_type);

-- ─── Configuración del evento ────────────────────────────────────────────────

create table if not exists public.event_cantinas (
    id uuid not null default gen_random_uuid(),
    event_id uuid,
    cantina_id uuid,
    constraint event_cantinas_pkey primary key (id),
    constraint event_cantinas_event_id_cantina_id_key unique (event_id, cantina_id),
    constraint event_cantinas_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade,
    constraint event_cantinas_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id) on delete cascade
);

create index if not exists idx_event_cantinas_cantina on public.event_cantinas using btree (cantina_id);

create table if not exists public.event_products (
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

create index if not exists idx_event_products_product on public.event_products using btree (product_id);

-- ─── Credenciales de acceso ──────────────────────────────────────────────────
-- OJO (F2): pin_code está en claro y la tabla es legible por `anon`. Se
-- hashea en la épica S2; el comentario de la columna es de la propia BD.

create table if not exists public.cantina_access (
    cantina_id uuid not null,
    pin_code text not null,
    is_active boolean not null default true,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint cantina_access_v2_pkey primary key (cantina_id),
    constraint cantina_access_v2_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id) on delete cascade
);

comment on table public.cantina_access is 'Credenciales de acceso para cada cantina (PIN único por cantina, válido para todos los eventos)';
comment on column public.cantina_access.cantina_id is 'ID de la cantina';
comment on column public.cantina_access.pin_code is 'Código PIN de acceso (en producción debería estar hasheado)';
comment on column public.cantina_access.is_active is 'Si false, la cantina no puede acceder aunque tenga credenciales';

create index if not exists idx_cantina_access_active on public.cantina_access using btree (cantina_id) where (is_active = true);

-- ─── Operativa ───────────────────────────────────────────────────────────────

create table if not exists public.shifts (
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

-- Un solo turno abierto por camarero, garantizado por índice único parcial.
create unique index if not exists one_open_shift_per_waiter on public.shifts using btree (waiter_id) where (ended_at is null);
create index if not exists idx_shifts_cantina on public.shifts using btree (cantina_id);
create index if not exists idx_shifts_event_cantina on public.shifts using btree (event_id, cantina_id);
create index if not exists idx_shifts_open on public.shifts using btree (event_id, cantina_id) where (ended_at is null);

create table if not exists public.incidents (
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
    constraint incidents_type_check check ((type = any (array['STOCK'::text, 'TECH'::text, 'OTHER'::text]))),
    constraint incidents_status_check check ((status = any (array['pending'::text, 'resolved'::text])))
);

create index if not exists idx_incidents_event_status on public.incidents using btree (event_id, status, created_at desc);
create index if not exists idx_incidents_cantina_status on public.incidents using btree (cantina_id, status);

-- ─── Ventas ──────────────────────────────────────────────────────────────────

create table if not exists public.sales (
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
    constraint sales_status_check check ((status = any (array['OK'::text, 'CANCELED'::text])))
);

-- Idempotencia de la cola offline: una venta por client_request_id.
create unique index if not exists sales_client_request_id_uidx on public.sales using btree (client_request_id) where (client_request_id is not null);
create index if not exists idx_sales_lookup on public.sales using btree (event_id, cantina_id, created_at);
create index if not exists idx_sales_event_status_created on public.sales using btree (event_id, status, created_at);
create index if not exists idx_sales_waiter on public.sales using btree (waiter_id);

create table if not exists public.sale_line_items (
    id uuid not null default gen_random_uuid(),
    sale_id uuid,
    product_id uuid,
    qty integer not null,
    unit_price_cents integer not null,
    constraint sale_line_items_pkey primary key (id),
    constraint sale_line_items_sale_id_fkey foreign key (sale_id) references public.sales(id) on delete cascade,
    constraint sale_line_items_product_id_fkey foreign key (product_id) references public.products(id),
    constraint sale_line_items_qty_check check ((qty > 0))
);

create index if not exists idx_sli_sale on public.sale_line_items using btree (sale_id);
create index if not exists idx_sli_product on public.sale_line_items using btree (product_id);

-- ─── Stock: ledger + proyección ──────────────────────────────────────────────

create table if not exists public.stock_movements (
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
    constraint stock_movements_type_check check ((type = any (array['INIT'::text, 'SALE'::text, 'ADJUSTMENT'::text, 'TRANSFER_IN'::text, 'TRANSFER_OUT'::text, 'WASTE'::text, 'RETURN'::text])))
);

create index if not exists idx_movements_lookup on public.stock_movements using btree (event_id, cantina_id, product_id);
create index if not exists idx_movements_ref_sale on public.stock_movements using btree (ref_sale_id) where (ref_sale_id is not null);

create table if not exists public.inventory_snapshots (
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
    constraint inventory_snapshots_kind_check check ((kind = any (array['INITIAL'::text, 'FINAL'::text]))),
    constraint inventory_snapshots_qty_check check ((qty >= 0))
);

create table if not exists public.cantina_stock (
    event_id uuid not null,
    cantina_id uuid not null,
    product_id uuid not null,
    qty integer not null default 0,
    updated_at timestamp with time zone not null default now(),
    constraint cantina_stock_pkey primary key (event_id, cantina_id, product_id),
    constraint cantina_stock_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade,
    constraint cantina_stock_cantina_id_fkey foreign key (cantina_id) references public.cantinas(id) on delete cascade,
    constraint cantina_stock_product_id_fkey foreign key (product_id) references public.products(id)
);

comment on table public.cantina_stock is 'Proyeccion del stock actual, derivada de stock_movements y mantenida por trigger. NO es fuente de verdad: reconstruible desde el ledger. Verificable con verify_cantina_stock().';
