-- ============================================================================
-- Materialización del stock actual y retirada del advisory lock por cantina
--
-- ADR: «Materializar el stock actual en tabla mantenida por trigger»
-- Informes: INF-1 (límites 2 y 3), INF-2 (medición: factor 8,2× por el lock)
--
-- PRINCIPIO: `stock_movements` sigue siendo la ÚNICA fuente de verdad.
-- `cantina_stock` es una proyección derivada y reconstruible, mantenida por el
-- MOTOR dentro de la misma transacción — nunca por la aplicación. Esa es la
-- diferencia con el antipatrón del monedero de FestiApp, que materializa el
-- saldo desde el código y sufre descuadres.
--
-- DESPLIEGUE: sin evento en curso. El backfill recorre todo el histórico.
--
-- DEBE EJECUTARSE DENTRO DE UNA TRANSACCIÓN (por el LOCK TABLE del paso 0):
--   psql --single-transaction -f este_fichero.sql
-- El `apply_migration` de Supabase ya envuelve la migración en una transacción,
-- así que allí no hay que hacer nada. Si se ejecuta sentencia a sentencia, el
-- paso 0 falla con «LOCK TABLE can only be used in transaction blocks».
--
-- Tras aplicar, comprobar SIEMPRE: select count(*) from verify_cantina_stock();
-- Debe devolver 0. Si no, ejecutar select rebuild_cantina_stock();
-- ============================================================================

-- ─────────────────────── 0. Cerrojo de migración ───────────────────────
-- Sin esto hay una carrera real: si un movimiento se confirma entre el momento
-- en que el backfill toma su instantánea y el momento en que el trigger empieza
-- a aplicarse, su efecto se pierde (el backfill sobrescribe con una suma que no
-- lo incluía). Bloquear las escrituras de la tabla durante la migración lo evita.
-- Es un bloqueo de segundos; aun así, desplegar sin evento en curso.

lock table public.stock_movements in share row exclusive mode;

-- ─────────────────────── 1. Proyección ───────────────────────

create table if not exists public.cantina_stock (
  event_id   uuid not null references public.events(id)   on delete cascade,
  cantina_id uuid not null references public.cantinas(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty        integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (event_id, cantina_id, product_id)
);

comment on table public.cantina_stock is
  'Proyección del stock actual, derivada de stock_movements y mantenida por trigger. '
  'NO es fuente de verdad: reconstruible en cualquier momento desde el ledger. '
  'Verificable con verify_cantina_stock().';

-- ─────────────────────── 2. Único escritor: el trigger ───────────────────────
-- Se ejecuta en la misma transacción que la inserción del movimiento, así que
-- la proyección no puede divergir por un fallo de la aplicación.

create or replace function public.apply_stock_movement() returns trigger
language plpgsql as $$
begin
  insert into public.cantina_stock (event_id, cantina_id, product_id, qty)
  values (new.event_id, new.cantina_id, new.product_id, new.qty)
  on conflict (event_id, cantina_id, product_id)
  do update set qty = public.cantina_stock.qty + excluded.qty, updated_at = now();
  return null;
end $$;

drop trigger if exists trg_apply_stock_movement on public.stock_movements;
create trigger trg_apply_stock_movement
  after insert on public.stock_movements
  for each row
  when (new.event_id is not null and new.cantina_id is not null and new.product_id is not null)
  execute function public.apply_stock_movement();

-- ─────────────────────── 3. Backfill desde el ledger ───────────────────────

insert into public.cantina_stock (event_id, cantina_id, product_id, qty)
select event_id, cantina_id, product_id, sum(qty)::int
from public.stock_movements
where event_id is not null and cantina_id is not null and product_id is not null
group by event_id, cantina_id, product_id
on conflict (event_id, cantina_id, product_id)
do update set qty = excluded.qty, updated_at = now();

-- ─────────────────────── 4. Verificación de la invariante ───────────────────────
-- Debe devolver 0 filas. Ejecutar al cerrar cada evento.

create or replace function public.verify_cantina_stock()
returns table(event_id uuid, cantina_id uuid, product_id uuid, ledger int, proyeccion int)
language sql stable as $$
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
$$;

comment on function public.verify_cantina_stock is
  'Compara la proyección contra el ledger. 0 filas = invariante intacta. '
  'Si devuelve filas, reconstruir con rebuild_cantina_stock().';

create or replace function public.rebuild_cantina_stock() returns void
language sql as $$
  insert into public.cantina_stock (event_id, cantina_id, product_id, qty)
  select event_id, cantina_id, product_id, sum(qty)::int
  from public.stock_movements
  where event_id is not null and cantina_id is not null and product_id is not null
  group by event_id, cantina_id, product_id
  on conflict (event_id, cantina_id, product_id)
  do update set qty = excluded.qty, updated_at = now();
$$;

-- ─────────────────────── 5. Lectura de stock en O(1) ───────────────────────
-- Misma firma de columnas que la vista anterior; deja de agregar el histórico.

create or replace view public.v_cantina_inventory as
select ep.event_id,
       ec.cantina_id,
       ep.product_id,
       coalesce(cs.qty, 0) as current_qty,
       coalesce(ep.low_stock_threshold, 0) as low_stock_threshold
from public.event_products ep
join public.event_cantinas ec on ec.event_id = ep.event_id
left join public.cantina_stock cs
  on cs.event_id = ec.event_id and cs.cantina_id = ec.cantina_id and cs.product_id = ep.product_id;

-- ─────────────────────── 6. create_sale sin advisory lock ───────────────────────
--
-- El cerrojo pasa de ser de BARRA ENTERA a ser de FILA POR PRODUCTO:
--   · dos camareros de la misma barra vendiendo productos distintos ya no se esperan
--   · el conteo inicial deja de bloquear las ventas
--
-- Dos cuidados imprescindibles:
--   1. Las líneas se recorren ORDENADAS por product_id. Sin un orden determinista,
--      dos ventas con los mismos productos en distinto orden se interbloquearían.
--   2. Las líneas del mismo producto se AGREGAN antes de validar. La versión
--      anterior comprobaba cada línea contra el stock total por separado, así que
--      un carrito con el mismo producto repetido podía sobrevender.

create or replace function public.create_sale(
  p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb,
  p_client_request_id uuid, p_allow_oversell boolean default false, p_waiter_id uuid default null::uuid)
 returns table(sale_id uuid, total_cents integer, total_items integer)
 language plpgsql
 security definer
as $function$
declare
  v_sale_id uuid := gen_random_uuid();
  v_total_cents int := 0;
  v_total_items int := 0;
  v_price int;
  v_current int;
  v_existing sales%rowtype;
  v_line record;
begin
  -- Idempotencia: fuera de cualquier cerrojo, es sólo una lectura por índice único.
  if p_client_request_id is not null then
    select * into v_existing from sales where client_request_id = p_client_request_id;
    if found then
      return query select v_existing.id, v_existing.total_cents, v_existing.total_items;
      return;
    end if;
  end if;

  -- Asegurar que existe la fila de proyección de cada producto, para poder bloquearla.
  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, p_cantina_id, (l->>'productId')::uuid, 0
  from jsonb_array_elements(p_lines) l
  order by 1
  on conflict (event_id, cantina_id, product_id) do nothing;

  -- Validar y bloquear, en orden determinista y con las cantidades ya agregadas.
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

    -- Cerrojo de FILA: serializa sólo a quien venda este mismo producto en esta barra.
    select qty into v_current
    from cantina_stock
    where event_id = p_event_id and cantina_id = p_cantina_id and product_id = v_line.pid
    for update;

    if not p_allow_oversell and coalesce(v_current, 0) - v_line.qty < 0 then
      raise exception 'Stock insuficiente para producto % (disp: %, pedido: %)',
        v_line.pid, coalesce(v_current, 0), v_line.qty;
    end if;

    v_total_cents := v_total_cents + v_price * v_line.qty;
    v_total_items := v_total_items + v_line.qty;
  end loop;

  insert into sales (id, event_id, cantina_id, user_id, total_cents, total_items, status, client_request_id, waiter_id)
  values (v_sale_id, p_event_id, p_cantina_id, p_user_id, v_total_cents, v_total_items, 'OK', p_client_request_id, p_waiter_id);

  -- Líneas y movimientos. El trigger actualiza cantina_stock: aquí NO se toca.
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
    values (p_event_id, p_cantina_id, v_line.pid, -v_line.qty, 'SALE', 'Venta', v_sale_id);
  end loop;

  return query select v_sale_id, v_total_cents, v_total_items;
end; $function$;

-- ─────────────────────── 7. Ajustes y conteo inicial sin advisory lock ───────────────────────

create or replace function public.adjust_stock_bulk(
  p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 returns void
 language plpgsql
 security definer
as $function$
declare
  v_line record; v_current int;
begin
  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, p_cantina_id, (l->>'productId')::uuid, 0
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
    where event_id = p_event_id and cantina_id = p_cantina_id and product_id = v_line.pid
    for update;

    if coalesce(v_current, 0) + v_line.delta < 0 then
      raise exception 'Stock insuficiente (prod %, actual %, delta %)',
        v_line.pid, coalesce(v_current, 0), v_line.delta;
    end if;

    insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
    values (p_event_id, p_cantina_id, v_line.pid, v_line.delta, v_line.mtype, v_line.reason, p_user_id);
  end loop;
end $function$;

create or replace function public.set_initial_inventory_bulk(
  p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 returns void
 language plpgsql
 security definer
as $function$
declare
  v_line record; v_prev int; v_delta int; v_current int;
begin
  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, p_cantina_id, (l->>'productId')::uuid, 0
  from jsonb_array_elements(p_lines) l
  order by 1
  on conflict (event_id, cantina_id, product_id) do nothing;

  for v_line in
    select (l->>'productId')::uuid as pid, max(greatest(0, (l->>'qty')::int)) as qty
    from jsonb_array_elements(p_lines) l
    group by 1
    order by 1
  loop
    -- El cerrojo de fila se toma ANTES de leer el snapshot: garantiza que dos
    -- camareros contando el mismo producto no calculen el delta sobre el mismo
    -- valor previo y lo apliquen dos veces.
    select qty into v_current from cantina_stock
    where event_id = p_event_id and cantina_id = p_cantina_id and product_id = v_line.pid
    for update;

    select qty into v_prev from inventory_snapshots
    where event_id = p_event_id and cantina_id = p_cantina_id
      and product_id = v_line.pid and kind = 'INITIAL';

    if v_prev is null then
      insert into inventory_snapshots (event_id, cantina_id, product_id, kind, qty, created_at, created_by)
      values (p_event_id, p_cantina_id, v_line.pid, 'INITIAL', v_line.qty, now(), p_user_id);
      v_prev := 0;
    else
      update inventory_snapshots set qty = v_line.qty, created_at = now(), created_by = p_user_id
       where event_id = p_event_id and cantina_id = p_cantina_id
         and product_id = v_line.pid and kind = 'INITIAL';
    end if;

    v_delta := v_line.qty - v_prev;

    if v_delta <> 0 then
      if coalesce(v_current, 0) + v_delta < 0 then
        raise exception 'Ajuste dejaría stock negativo para producto % (actual %, delta %)',
          v_line.pid, coalesce(v_current, 0), v_delta;
      end if;

      insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
      values (p_event_id, p_cantina_id, v_line.pid, v_delta, 'ADJUSTMENT', 'Ajuste inventario inicial', p_user_id);
    end if;
  end loop;
end $function$;

-- void_sale: sólo devuelve stock, nunca puede dejarlo negativo, así que no
-- necesita validar ni bloquear. Se retira igualmente el advisory lock.

create or replace function public.void_sale(p_sale_id uuid, p_waiter_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
as $function$
declare
  v_sale sales%rowtype; v_line record;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;

  if v_sale.status = 'CANCELED' then return; end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo de anulación es obligatorio';
  end if;

  update sales
     set status = 'CANCELED', voided_at = now(), voided_by = p_waiter_id, void_reason = btrim(p_reason)
   where id = p_sale_id;

  for v_line in select product_id, qty from sale_line_items where sale_id = p_sale_id order by product_id loop
    insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, ref_sale_id)
    values (v_sale.event_id, v_sale.cantina_id, v_line.product_id, v_line.qty, 'SALE', 'Anulación', p_sale_id);
  end loop;
end $function$;
