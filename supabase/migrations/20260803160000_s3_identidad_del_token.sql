-- ─────────────────────────────────────────────────────────────────────────────
-- S3 · La identidad se deriva del token, no se recibe por parámetro
--
-- Es la épica que más riesgo quita, y no activa una sola política.
--
-- 12 funciones son SECURITY DEFINER, así que SE SALTAN EL RLS POR DEFINICIÓN.
-- Se puede activar RLS en las 17 tablas y un token de la Cantina Norte seguirá
-- vendiendo en la Sur, porque `create_sale` no mira quién llama: se fía de sus
-- argumentos. La matriz lo demuestra con una venta real creada en otra barra y
-- atribuida a otro camarero.
--
-- Eso último no es sólo técnico: la métrica de rendimiento por camarero de F1,
-- con la que se evalúa a personas, se apoya hoy en un dato falsificable desde
-- una consola del navegador.
--
-- DESVIACIÓN DEL PLAN, y conviene dejarla escrita. El plan decía que los
-- parámetros de identidad «desaparecen de la firma». No se puede del todo: el
-- admin ajusta inventario de CUALQUIER barra, así que necesita decir cuál. Lo
-- que se hace es distinguir por quién llama:
--
--   · token de TPV   → la cantina y el camarero SE IMPONEN desde el token, y si
--                      los argumentos no coinciden, se rechaza.
--   · token de admin → puede indicar la barra (es su trabajo).
--   · service_role o SQL directo → parámetros, para el seeder y el banco.
--   · cualquier otro (anon, cliente) → rechazado.
--
-- El agujero que se cierra es el mismo: un TPV no puede actuar fuera de su
-- barra ni a nombre de otro, diga lo que diga el navegador.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helpers de claims ───────────────────────────────────────────────────────
-- Dentro de una función SECURITY DEFINER, `current_user` es el propietario y no
-- sirve para saber quién llama. Lo que sí viaja es el JWT que PostgREST deja en
-- `request.jwt.claims`, que es de donde se lee todo esto.

create or replace function public.sc_claims()
returns jsonb
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
$$;

comment on function public.sc_claims() is
  'Claims del token de la petición. NULL si no hay token (SQL directo, seeder, banco de pruebas).';

create or replace function public.sc_app_role()
returns text
language sql
stable
as $$
  select public.sc_claims() ->> 'app_role';
$$;

-- Distingue «no hay token» de «token sin app_role». anon LLEVA token (con
-- role=anon) aunque no tenga app_role: si se confundieran, anon caería en la
-- rama permisiva del SQL directo y el agujero seguiría abierto.
create or replace function public.sc_es_servicio()
returns boolean
language sql
stable
as $$
  select public.sc_claims() is null
      or (public.sc_claims() ->> 'role') = 'service_role';
$$;

comment on function public.sc_es_servicio() is
  'True si la llamada NO viene de un cliente: SQL directo, seeder, banco, o service_role desde una ruta de servidor.';

create or replace function public.sc_claim_uuid(p_clave text)
returns uuid
language plpgsql
stable
as $$
declare v text;
begin
  v := public.sc_claims() ->> p_clave;
  if v is null or v = '' then return null; end if;
  return v::uuid;
exception when others then
  return null;
end $$;

-- Cantina sobre la que la llamada puede operar de verdad.
create or replace function public.sc_cantina_efectiva(p_cantina_id uuid)
returns uuid
language plpgsql
stable
as $$
declare
  v_rol text := public.sc_app_role();
  v_tok uuid;
begin
  if v_rol = 'pos' then
    v_tok := public.sc_claim_uuid('cantina_id');
    if v_tok is null then
      raise exception 'Token de TPV sin cantina';
    end if;
    -- No se corrige en silencio: si el cliente pide otra barra, es un intento.
    if p_cantina_id is not null and p_cantina_id <> v_tok then
      raise exception 'No puedes operar sobre otra cantina';
    end if;
    return v_tok;
  end if;

  if v_rol = 'admin' or public.sc_es_servicio() then
    if p_cantina_id is null then raise exception 'Falta la cantina'; end if;
    return p_cantina_id;
  end if;

  raise exception 'Este rol no puede operar sobre el stock';
end $$;

-- Camarero al que se atribuye la operación. Con token de TPV es siempre él.
create or replace function public.sc_camarero_efectivo(p_waiter_id uuid)
returns uuid
language plpgsql
stable
as $$
declare
  v_rol text := public.sc_app_role();
  v_tok uuid;
begin
  if v_rol = 'pos' then
    v_tok := public.sc_claim_uuid('waiter_id');
    if v_tok is null then raise exception 'Token de TPV sin camarero'; end if;
    if p_waiter_id is not null and p_waiter_id <> v_tok then
      raise exception 'No puedes atribuir la operación a otro camarero';
    end if;
    return v_tok;
  end if;
  return p_waiter_id;
end $$;

create or replace function public.sc_exigir_admin()
returns boolean
language plpgsql
stable
as $$
begin
  -- El rol de Postgres es `authenticated` tanto para el TPV como para el admin:
  -- la diferencia vive en app_role, así que un GRANT no puede separarlos y la
  -- comprobación tiene que estar aquí dentro.
  if public.sc_app_role() = 'admin' or public.sc_es_servicio() then return true; end if;
  raise exception 'Esta operación es de administración';
end $$;

-- ─── Venta ───────────────────────────────────────────────────────────────────

create or replace function public.create_sale(p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb, p_client_request_id uuid, p_allow_oversell boolean default false, p_waiter_id uuid default null)
 returns table(sale_id uuid, total_cents integer, total_items integer)
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
  v_sale_id uuid := gen_random_uuid();
  v_total_cents int := 0;
  v_total_items int := 0;
  v_price int;
  v_current int;
  v_existing sales%rowtype;
  v_line record;
  v_cantina uuid;
  v_waiter uuid;
begin
  -- La barra y la persona salen del token cuando quien llama es un TPV.
  v_cantina := sc_cantina_efectiva(p_cantina_id);
  v_waiter  := sc_camarero_efectivo(p_waiter_id);

  if p_client_request_id is not null then
    select * into v_existing from sales where client_request_id = p_client_request_id;
    if found then
      return query select v_existing.id, v_existing.total_cents, v_existing.total_items;
      return;
    end if;
  end if;

  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, v_cantina, (l->>'productId')::uuid, 0
  from jsonb_array_elements(p_lines) l
  order by 1
  on conflict (event_id, cantina_id, product_id) do nothing;

  for v_line in
    select (l->>'productId')::uuid as pid, sum((l->>'qty')::int) as qty
    from jsonb_array_elements(p_lines) l
    group by 1
    order by 1
  loop
    if v_line.qty <= 0 then raise exception 'Qty debe ser > 0'; end if;

    select ep.price_cents into v_price
    from event_products ep
    where ep.event_id = p_event_id and ep.product_id = v_line.pid and ep.active = true;
    if v_price is null then raise exception 'Producto no activo en el evento'; end if;

    select qty into v_current
    from cantina_stock
    where event_id = p_event_id and cantina_id = v_cantina and product_id = v_line.pid
    for update;

    if not p_allow_oversell and coalesce(v_current, 0) - v_line.qty < 0 then
      raise exception 'Stock insuficiente para producto % (disp: %, pedido: %)',
        v_line.pid, coalesce(v_current, 0), v_line.qty;
    end if;

    v_total_cents := v_total_cents + v_price * v_line.qty;
    v_total_items := v_total_items + v_line.qty;
  end loop;

  insert into sales (id, event_id, cantina_id, user_id, total_cents, total_items, status, client_request_id, waiter_id)
  values (v_sale_id, p_event_id, v_cantina, p_user_id, v_total_cents, v_total_items, 'OK', p_client_request_id, v_waiter);

  for v_line in
    select (l->>'productId')::uuid as pid, sum((l->>'qty')::int) as qty
    from jsonb_array_elements(p_lines) l
    group by 1
    order by 1
  loop
    select ep.price_cents into v_price from event_products ep
    where ep.event_id = p_event_id and ep.product_id = v_line.pid;

    insert into sale_line_items (sale_id, product_id, qty, unit_price_cents)
    values (v_sale_id, v_line.pid, v_line.qty, v_price);

    insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, ref_sale_id)
    values (p_event_id, v_cantina, v_line.pid, -v_line.qty, 'SALE', 'Venta', v_sale_id);
  end loop;

  return query select v_sale_id, v_total_cents, v_total_items;
end; $function$;

create or replace function public.void_sale(p_sale_id uuid, p_waiter_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
  v_sale sales%rowtype; v_line record; v_waiter uuid;
begin
  v_waiter := sc_camarero_efectivo(p_waiter_id);

  select * into v_sale from sales where id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;

  -- Anular una venta de otra barra sería reescribir su stock y su facturación.
  perform sc_cantina_efectiva(v_sale.cantina_id);

  if v_sale.status = 'CANCELED' then return; end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo de anulacion es obligatorio';
  end if;

  update sales
     set status = 'CANCELED', voided_at = now(), voided_by = v_waiter, void_reason = btrim(p_reason)
   where id = p_sale_id;

  for v_line in select product_id, qty from sale_line_items where sale_id = p_sale_id order by product_id loop
    insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, ref_sale_id)
    values (v_sale.event_id, v_sale.cantina_id, v_line.product_id, v_line.qty, 'SALE', 'Anulacion', p_sale_id);
  end loop;
end $function$;

-- ─── Inventario ──────────────────────────────────────────────────────────────

create or replace function public.adjust_stock_bulk(p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
  v_line record; v_current int; v_cantina uuid;
begin
  v_cantina := sc_cantina_efectiva(p_cantina_id);

  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, v_cantina, (l->>'productId')::uuid, 0
  from jsonb_array_elements(p_lines) l
  order by 1
  on conflict (event_id, cantina_id, product_id) do nothing;

  for v_line in
    select (l->>'productId')::uuid as pid,
           sum(coalesce((l->>'delta')::int, 0)) as delta,
           min(coalesce(l->>'movementType', 'ADJUSTMENT')) as mtype,
           min(coalesce(l->>'reason', 'Ajuste manual')) as reason
    from jsonb_array_elements(p_lines) l
    group by 1
    order by 1
  loop
    if v_line.delta = 0 then continue; end if;
    if v_line.mtype not in ('ADJUSTMENT','WASTE','TRANSFER_IN','TRANSFER_OUT','RETURN') then
      raise exception 'Tipo no permitido: %', v_line.mtype;
    end if;

    select qty into v_current from cantina_stock
    where event_id = p_event_id and cantina_id = v_cantina and product_id = v_line.pid
    for update;

    if coalesce(v_current, 0) + v_line.delta < 0 then
      raise exception 'Stock insuficiente (prod %, actual %, delta %)',
        v_line.pid, coalesce(v_current, 0), v_line.delta;
    end if;

    insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
    values (p_event_id, v_cantina, v_line.pid, v_line.delta, v_line.mtype, v_line.reason, p_user_id);
  end loop;
end $function$;

create or replace function public.set_initial_inventory_bulk(p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
  v_line record; v_prev int; v_delta int; v_current int; v_cantina uuid;
begin
  v_cantina := sc_cantina_efectiva(p_cantina_id);

  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, v_cantina, (l->>'productId')::uuid, 0
  from jsonb_array_elements(p_lines) l
  order by 1
  on conflict (event_id, cantina_id, product_id) do nothing;

  for v_line in
    select (l->>'productId')::uuid as pid, max(greatest(0, (l->>'qty')::int)) as qty
    from jsonb_array_elements(p_lines) l
    group by 1
    order by 1
  loop
    select qty into v_current from cantina_stock
    where event_id = p_event_id and cantina_id = v_cantina and product_id = v_line.pid
    for update;

    select qty into v_prev from inventory_snapshots
    where event_id = p_event_id and cantina_id = v_cantina
      and product_id = v_line.pid and kind = 'INITIAL';

    if v_prev is null then
      insert into inventory_snapshots (event_id, cantina_id, product_id, kind, qty, created_at, created_by)
      values (p_event_id, v_cantina, v_line.pid, 'INITIAL', v_line.qty, now(), p_user_id);
      v_prev := 0;
    else
      update inventory_snapshots set qty = v_line.qty, created_at = now(), created_by = p_user_id
       where event_id = p_event_id and cantina_id = v_cantina
         and product_id = v_line.pid and kind = 'INITIAL';
    end if;

    v_delta := v_line.qty - v_prev;

    if v_delta <> 0 then
      if coalesce(v_current, 0) + v_delta < 0 then
        raise exception 'Ajuste dejaria stock negativo para producto % (actual %, delta %)',
          v_line.pid, coalesce(v_current, 0), v_delta;
      end if;

      insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
      values (p_event_id, v_cantina, v_line.pid, v_delta, 'ADJUSTMENT', 'Ajuste inventario inicial', p_user_id);
    end if;
  end loop;
end $function$;

create or replace function public.set_final_inventory_bulk(p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
  v_line record; v_actual int; v_delta int; v_cantina uuid;
begin
  v_cantina := sc_cantina_efectiva(p_cantina_id);

  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, v_cantina, (l->>'productId')::uuid, 0
  from jsonb_array_elements(p_lines) l
  order by 1
  on conflict (event_id, cantina_id, product_id) do nothing;

  for v_line in
    select (l->>'productId')::uuid as pid,
           max(greatest(0, (l->>'qty')::int)) as qty
    from jsonb_array_elements(p_lines) l
    group by 1
    order by 1
  loop
    select qty into v_actual
    from cantina_stock
    where event_id = p_event_id and cantina_id = v_cantina and product_id = v_line.pid
    for update;

    insert into inventory_snapshots (event_id, cantina_id, product_id, kind, qty, created_by, created_at)
    values (p_event_id, v_cantina, v_line.pid, 'FINAL', v_line.qty, p_user_id, now())
    on conflict (event_id, cantina_id, product_id, kind)
    do update set qty = excluded.qty, created_by = excluded.created_by, created_at = excluded.created_at;

    v_delta := v_line.qty - coalesce(v_actual, 0);

    if v_delta <> 0 then
      insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
      values (p_event_id, v_cantina, v_line.pid, v_delta, 'ADJUSTMENT',
              'Ajuste por recuento de cierre', p_user_id);
    end if;
  end loop;
end $function$;

-- ─── Turnos ──────────────────────────────────────────────────────────────────

create or replace function public.open_shift(p_waiter_id uuid, p_event_id uuid, p_cantina_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
  v_shift_id uuid; v_cantina uuid; v_waiter uuid;
begin
  v_cantina := sc_cantina_efectiva(p_cantina_id);
  v_waiter  := sc_camarero_efectivo(p_waiter_id);

  perform pg_advisory_xact_lock(hashtext('shift:' || v_waiter::text));

  select id into v_shift_id from shifts
  where waiter_id = v_waiter and event_id = p_event_id
    and cantina_id = v_cantina and ended_at is null;
  if found then return v_shift_id; end if;

  update shifts
     set ended_at = now(),
         hours = round(extract(epoch from (now() - started_at))::numeric / 3600, 2)
   where waiter_id = v_waiter and ended_at is null;

  insert into shifts (waiter_id, event_id, cantina_id)
  values (v_waiter, p_event_id, v_cantina)
  returning id into v_shift_id;

  return v_shift_id;
end $function$;

create or replace function public.close_shift(p_shift_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
declare v_turno shifts%rowtype;
begin
  select * into v_turno from shifts where id = p_shift_id;
  if not found then return; end if;

  -- Cerrar el turno de otro le imputa horas que no ha hecho: es un dato de
  -- nómina, y además alimenta la métrica de rendimiento por camarero.
  perform sc_camarero_efectivo(v_turno.waiter_id);

  update shifts
     set ended_at = now(),
         hours = round(extract(epoch from (now() - started_at))::numeric / 3600, 2)
   where id = p_shift_id and ended_at is null;
end $function$;

-- ─── Operaciones de administración ───────────────────────────────────────────
-- El rol de Postgres es `authenticated` para el TPV y para el admin, así que un
-- GRANT no los separa: la comprobación va dentro.

create or replace function public.set_event_product_price_eur(p_event_id uuid, p_product_id uuid, p_price_eur numeric)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
begin
  perform sc_exigir_admin();
  update event_products
  set price_cents = round(p_price_eur * 100)::int
  where event_id = p_event_id and product_id = p_product_id;
end $function$;

create or replace function public.rebuild_cantina_stock()
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
begin
  perform sc_exigir_admin();
  insert into public.cantina_stock (event_id, cantina_id, product_id, qty)
  select event_id, cantina_id, product_id, sum(qty)::int
  from public.stock_movements
  where event_id is not null and cantina_id is not null and product_id is not null
  group by event_id, cantina_id, product_id
  on conflict (event_id, cantina_id, product_id)
  do update set qty = excluded.qty, updated_at = now();
end $function$;

-- ─── Las vistas dejan de saltarse el RLS ─────────────────────────────────────
-- Sin `security_invoker` una vista se ejecuta con los privilegios de su
-- PROPIETARIO, así que devolvería todo aunque las tablas de debajo estuvieran
-- protegidas. Activar RLS en S4 y S5 sin esto dejaría el ledger accesible por
-- la puerta de atrás.

alter view public.v_available_cantinas      set (security_invoker = on);
alter view public.v_cantina_inventory       set (security_invoker = on);
alter view public.v_event_products_eur      set (security_invoker = on);
alter view public.v_inventory_current       set (security_invoker = on);
alter view public.v_sales_by_cantina        set (security_invoker = on);
alter view public.v_sold_by_cantina_product set (security_invoker = on);
alter view public.v_waiters_admin           set (security_invoker = on);

-- ─── Las agregaciones son de administración ──────────────────────────────────
-- Un token de TPV podía llamar a get_event_dashboard y leer la facturación del
-- evento entero, saltándose por completo el acotado por cantina. Y como son
-- SECURITY DEFINER, el RLS de S5 tampoco las pararía: la guarda tiene que ir
-- dentro.
--
-- En las funciones SQL se antepone la llamada a la guarda: un cuerpo SQL admite
-- varias sentencias y devuelve la última. Pierden la posibilidad de ser
-- inlineadas por el planificador, lo que aquí da igual — son paneles de admin,
-- no la ruta de venta.

CREATE OR REPLACE FUNCTION public.get_event_cantinas_grid(p_event_id uuid)
 RETURNS TABLE(cantina_id uuid, cantina_name text, qr_token uuid, assigned boolean, total_cents integer, num_sales integer, active_waiters integer, pending_incidents integer, low_stock_count integer, featured jsonb)
 LANGUAGE sql
 STABLE
AS $function$
  select public.sc_exigir_admin();
  with asignadas as (
    select ec.cantina_id from public.event_cantinas ec where ec.event_id = p_event_id
  ),
  productos as (
    select ep.product_id, coalesce(ep.low_stock_threshold, 0) as th,
           ep.featured, ep.active, p.name, p.sku
    from public.event_products ep
    join public.products p on p.id = ep.product_id
    where ep.event_id = p_event_id
  ),
  ventas as (
    select s.cantina_id, sum(s.total_cents)::int as cents, count(*)::int as n
    from public.sales s
    where s.event_id = p_event_id and s.status = 'OK'
    group by s.cantina_id
  ),
  turnos as (
    select sh.cantina_id, count(*)::int as n
    from public.shifts sh
    where sh.event_id = p_event_id and sh.ended_at is null
    group by sh.cantina_id
  ),
  incid as (
    select i.cantina_id, count(*)::int as n
    from public.incidents i
    where i.event_id = p_event_id and i.status = 'pending'
    group by i.cantina_id
  ),
  bajo as (
    select a.cantina_id, count(*)::int as n
    from asignadas a
    cross join productos pr
    left join public.cantina_stock cs
      on cs.event_id = p_event_id and cs.cantina_id = a.cantina_id and cs.product_id = pr.product_id
    where coalesce(cs.qty, 0) <= pr.th
    group by a.cantina_id
  ),
  destacados as (
    select a.cantina_id,
           jsonb_agg(jsonb_build_object('name', pr.name, 'qty', coalesce(cs.qty, 0)) order by pr.sku) as j
    from asignadas a
    cross join productos pr
    left join public.cantina_stock cs
      on cs.event_id = p_event_id and cs.cantina_id = a.cantina_id and cs.product_id = pr.product_id
    where pr.featured and pr.active
    group by a.cantina_id
  )
  select c.id, c.name, c.qr_token,
         (a.cantina_id is not null),
         coalesce(v.cents, 0),
         coalesce(v.n, 0),
         coalesce(t.n, 0),
         coalesce(i.n, 0),
         coalesce(b.n, 0),
         coalesce(d.j, '[]'::jsonb)
  from public.cantinas c
  left join asignadas   a on a.cantina_id = c.id
  left join ventas      v on v.cantina_id = c.id
  left join turnos      t on t.cantina_id = c.id
  left join incid       i on i.cantina_id = c.id
  left join bajo        b on b.cantina_id = c.id
  left join destacados  d on d.cantina_id = c.id
  order by 4 desc, 5 desc, c.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_event_cantinas_overview(p_event_id uuid)
 RETURNS TABLE(cantina_id uuid, cantina_name text, total_cents integer, num_sales integer, active_waiters integer, pending_incidents integer, low_stock_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select public.sc_exigir_admin();
  SELECT
    c.id,
    c.name,
    COALESCE((SELECT SUM(s.total_cents) FROM sales s
              WHERE s.event_id = p_event_id AND s.cantina_id = c.id AND s.status = 'OK'), 0)::int,
    COALESCE((SELECT COUNT(*) FROM sales s
              WHERE s.event_id = p_event_id AND s.cantina_id = c.id AND s.status = 'OK'), 0)::int,
    COALESCE((SELECT COUNT(*) FROM shifts sh
              WHERE sh.event_id = p_event_id AND sh.cantina_id = c.id AND sh.ended_at IS NULL), 0)::int,
    COALESCE((SELECT COUNT(*) FROM incidents i
              WHERE i.event_id = p_event_id AND i.cantina_id = c.id AND i.status = 'pending'), 0)::int,
    COALESCE((SELECT COUNT(*) FROM v_cantina_inventory v
              WHERE v.event_id = p_event_id AND v.cantina_id = c.id
                AND v.current_qty <= v.low_stock_threshold), 0)::int
  FROM event_cantinas ec
  JOIN cantinas c ON c.id = ec.cantina_id
  WHERE ec.event_id = p_event_id
  ORDER BY 3 DESC, c.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_event_waiter_performance(p_event_id uuid, p_cantina_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(waiter_id uuid, waiter_name text, hours numeric, num_sales integer, total_cents integer, total_items integer, is_active boolean, cantinas text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select public.sc_exigir_admin();
  WITH sh AS (
    SELECT s.waiter_id,
           SUM(COALESCE(s.hours, EXTRACT(EPOCH FROM (now() - s.started_at)) / 3600)) AS hours,
           BOOL_OR(s.ended_at IS NULL) AS is_active,
           STRING_AGG(DISTINCT c.name, ', ') AS cantinas
    FROM shifts s
    JOIN cantinas c ON c.id = s.cantina_id
    WHERE s.event_id = p_event_id
      AND (p_cantina_id IS NULL OR s.cantina_id = p_cantina_id)
    GROUP BY s.waiter_id
  ),
  sl AS (
    SELECT sa.waiter_id,
           COUNT(*)::int          AS num_sales,
           SUM(sa.total_cents)::int AS total_cents,
           SUM(sa.total_items)::int AS total_items
    FROM sales sa
    WHERE sa.event_id = p_event_id
      AND sa.status = 'OK'
      AND sa.waiter_id IS NOT NULL
      AND (p_cantina_id IS NULL OR sa.cantina_id = p_cantina_id)
    GROUP BY sa.waiter_id
  )
  SELECT
    w.id,
    TRIM(w.name || ' ' || COALESCE(w.surname, '')),
    ROUND(COALESCE(sh.hours, 0)::numeric, 2),
    COALESCE(sl.num_sales, 0),
    COALESCE(sl.total_cents, 0),
    COALESCE(sl.total_items, 0),
    COALESCE(sh.is_active, false),
    COALESCE(sh.cantinas, '')
  FROM waiters w
  LEFT JOIN sh ON sh.waiter_id = w.id
  LEFT JOIN sl ON sl.waiter_id = w.id
  WHERE sh.waiter_id IS NOT NULL OR sl.waiter_id IS NOT NULL
  ORDER BY COALESCE(sl.total_cents, 0) DESC, 3 DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_by_hour(p_event_id uuid)
 RETURNS TABLE(hora smallint, total_cents integer, num_sales integer)
 LANGUAGE sql
 STABLE
AS $function$
  select public.sc_exigir_admin();
  select extract(hour from s.created_at at time zone 'Europe/Madrid')::smallint as hora,
         sum(s.total_cents)::int,
         count(*)::int
  from public.sales s
  where s.event_id = p_event_id and s.status = 'OK'
  group by 1
  order by 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_by_slot(p_event_id uuid, p_slot_minutes integer DEFAULT 15, p_puertas_min integer DEFAULT 90, p_cola_min integer DEFAULT 30, p_cantina_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(slot_start timestamp with time zone, etiqueta text, minuto_relativo integer, fase text, total_cents integer, num_sales integer)
 LANGUAGE sql
 STABLE
AS $function$
  select public.sc_exigir_admin();
  with ev as (
    select e.kickoff_at as ko
    from public.events e
    where e.id = p_event_id and e.kickoff_at is not null
  ),
  rejilla as (
    select
      ev.ko + (g * p_slot_minutes) * interval '1 minute' as inicio,
      g * p_slot_minutes as minuto,
      g * p_slot_minutes + p_slot_minutes / 2.0 as centro
    from ev,
    generate_series(
      -ceil(p_puertas_min::numeric / p_slot_minutes)::int,
      ceil((105 + p_cola_min)::numeric / p_slot_minutes)::int - 1
    ) as g
  ),
  ventas as (
    select r.minuto, sum(s.total_cents)::int as cents, count(*)::int as n
    from rejilla r
    join public.sales s
      on s.event_id = p_event_id
     and s.status = 'OK'
     and (p_cantina_id is null or s.cantina_id = p_cantina_id)
     and s.created_at >= r.inicio
     and s.created_at <  r.inicio + (p_slot_minutes * interval '1 minute')
    group by r.minuto
  )
  select
    r.inicio,
    to_char(r.inicio at time zone 'Europe/Madrid', 'HH24:MI'),
    r.minuto,
    case
      when r.centro < 0   then 'Previa'
      when r.centro < 45  then '1ª parte'
      when r.centro < 60  then 'Descanso'
      when r.centro < 105 then '2ª parte'
      else 'Final'
    end,
    coalesce(v.cents, 0),
    coalesce(v.n, 0)
  from rejilla r
  left join ventas v on v.minuto = r.minuto
  order by r.minuto;
$function$;

CREATE OR REPLACE FUNCTION public.get_stock_alerts(p_event_id uuid)
 RETURNS TABLE(cantina_id uuid, cantina_name text, product_id uuid, product_name text, current_qty integer, threshold integer)
 LANGUAGE sql
 STABLE
AS $function$
  select public.sc_exigir_admin();
  select c.id, c.name, p.id, p.name,
         coalesce(cs.qty, 0)::int,
         ep.low_stock_threshold::int
  from public.event_products ep
  join public.products p on p.id = ep.product_id
  join public.event_cantinas ec on ec.event_id = ep.event_id
  join public.cantinas c on c.id = ec.cantina_id
  left join public.cantina_stock cs
    on cs.event_id = ep.event_id and cs.cantina_id = ec.cantina_id and cs.product_id = ep.product_id
  where ep.event_id = p_event_id
    and coalesce(ep.low_stock_threshold, 0) > 0
    and coalesce(cs.qty, 0) <= ep.low_stock_threshold
  order by coalesce(cs.qty, 0), c.name, p.name;
$function$;

CREATE OR REPLACE FUNCTION public.verify_cantina_stock()
 RETURNS TABLE(event_id uuid, cantina_id uuid, product_id uuid, ledger integer, proyeccion integer)
 LANGUAGE sql
 STABLE
AS $function$
  select public.sc_exigir_admin();
  select l.event_id, l.cantina_id, l.product_id, l.ledger, coalesce(cs.qty, 0)
  from (
    select event_id, cantina_id, product_id, sum(qty)::int as ledger
    from public.stock_movements
    where event_id is not null and cantina_id is not null and product_id is not null
    group by event_id, cantina_id, product_id
  ) l
  left join public.cantina_stock cs
    on cs.event_id = l.event_id and cs.cantina_id = l.cantina_id and cs.product_id = l.product_id
  where l.ledger is distinct from coalesce(cs.qty, 0);
$function$;

-- get_event_dashboard ya es plpgsql: la guarda va como primera sentencia.
create or replace function public.get_event_dashboard(p_event_id uuid)
 returns table(total_cents integer, num_sales integer, total_items integer, star_product text, star_units integer, active_waiters integer, num_cantinas integer, active_cantinas integer)
 language plpgsql
 stable security definer
 set search_path = public
as $function$
declare
  v_star_name text;
  v_star_units int;
begin
  perform sc_exigir_admin();

  select p.name, sum(v.sold_qty)::int
    into v_star_name, v_star_units
  from v_sold_by_cantina_product v
  join products p on p.id = v.product_id
  where v.event_id = p_event_id
  group by p.name
  having sum(v.sold_qty) > 0
  order by sum(v.sold_qty) desc
  limit 1;

  return query select
    coalesce((select sum(s.total_cents) from sales s where s.event_id = p_event_id and s.status = 'OK'), 0)::int,
    coalesce((select count(*)           from sales s where s.event_id = p_event_id and s.status = 'OK'), 0)::int,
    coalesce((select sum(s.total_items) from sales s where s.event_id = p_event_id and s.status = 'OK'), 0)::int,
    v_star_name,
    coalesce(v_star_units, 0),
    coalesce((select count(*) from shifts sh where sh.event_id = p_event_id and sh.ended_at is null), 0)::int,
    coalesce((select count(*) from event_cantinas ec where ec.event_id = p_event_id), 0)::int,
    coalesce((select count(distinct sh.cantina_id) from shifts sh where sh.event_id = p_event_id and sh.ended_at is null), 0)::int;
end $function$;

-- ─── Cierre de la superficie a `anon` ────────────────────────────────────────
-- Recordatorio de S2: revocar sólo a `anon` no basta, porque Postgres concede
-- EXECUTE a PUBLIC en cada función nueva y `anon` es miembro de PUBLIC.
--
-- `get_active_events` se queda ABIERTA a propósito: la pantalla de login la
-- necesita antes de que exista sesión, y sólo devuelve los eventos en curso con
-- su número de barras, que es justo lo que el contrato ya permite leer a
-- cualquiera. Se anota como excepción razonada, no como olvido.

do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.sc_claims()',
    'public.sc_app_role()',
    'public.sc_es_servicio()',
    'public.sc_claim_uuid(text)',
    'public.sc_cantina_efectiva(uuid)',
    'public.sc_camarero_efectivo(uuid)',
    'public.sc_exigir_admin()',
    'public.set_event_product_price_eur(uuid, uuid, numeric)',
    'public.rebuild_cantina_stock()',
    'public.verify_cantina_stock()',
    'public.get_event_dashboard(uuid)',
    'public.get_event_cantinas_grid(uuid)',
    'public.get_event_cantinas_overview(uuid)',
    'public.get_event_waiter_performance(uuid, uuid)',
    'public.get_sales_by_hour(uuid)',
    'public.get_sales_by_slot(uuid, integer, integer, integer, uuid)',
    'public.get_stock_alerts(uuid)',
    'public.create_sale(uuid, uuid, uuid, jsonb, uuid, boolean, uuid)',
    'public.create_sales_batch(jsonb)',
    'public.void_sale(uuid, uuid, text)',
    'public.adjust_stock_bulk(uuid, uuid, uuid, jsonb)',
    'public.set_initial_inventory_bulk(uuid, uuid, uuid, jsonb)',
    'public.set_final_inventory_bulk(uuid, uuid, uuid, jsonb)',
    'public.open_shift(uuid, uuid, uuid)',
    'public.close_shift(uuid)',
    'public.apply_stock_movement()',
    'public.assign_active_season()',
    'public.close_event_shifts()'
  ] loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated, service_role', v_fn);
  end loop;
end $$;
