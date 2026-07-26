-- ============================================================================
-- Funciones y triggers del camino crítico, copiados literalmente de producción
-- (2026-07-26). NO editar para "mejorar" nada: el banco mide el código real.
--
-- Cuando la épica de materialización del stock reescriba create_sale, este
-- fichero debe actualizarse en el mismo commit, y la medición de después
-- compararse contra la de antes.
--
-- Se omite SECURITY DEFINER: en local sólo hay un rol y no cambia el coste.
-- ============================================================================

create or replace function public.assign_active_season()
 returns trigger
 language plpgsql
as $function$
begin
  if new.season_id is null then
    select id into new.season_id from seasons where active = true;
    if new.season_id is null then
      raise exception 'No hay ninguna temporada activa: crea o activa una temporada antes de crear eventos';
    end if;
  end if;
  return new;
end $function$;

create or replace function public.close_event_shifts()
 returns trigger
 language plpgsql
as $function$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    update shifts
       set ended_at = now(),
           hours = round(extract(epoch from (now() - started_at))::numeric / 3600, 2)
     where event_id = new.id and ended_at is null;
  end if;
  return new;
end $function$;

create trigger trg_events_active_season before insert on public.events
  for each row execute function public.assign_active_season();
create trigger trg_close_event_shifts after update of status on public.events
  for each row execute function public.close_event_shifts();

-- ─────────────────────── create_sale (el objeto de estudio) ───────────────────────
-- Nótese: pg_advisory_xact_lock por (evento, cantina) al principio, y una
-- agregación completa de stock_movements POR CADA LÍNEA dentro de ese lock.
-- Esos son exactamente los límites 2 y 3 de INF-1.

create or replace function public.create_sale(
  p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb,
  p_client_request_id uuid, p_allow_oversell boolean default false, p_waiter_id uuid default null::uuid)
 returns table(sale_id uuid, total_cents integer, total_items integer)
 language plpgsql
as $function$
declare
  v_sale_id uuid := gen_random_uuid();
  v_total_cents int := 0;
  v_total_items int := 0;
  v_line jsonb;
  v_product uuid;
  v_qty int;
  v_price int;
  v_current int;
  v_existing sales%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_event_id::text || ':' || p_cantina_id::text));

  if p_client_request_id is not null then
    select * into v_existing from sales where client_request_id = p_client_request_id;
    if found then
      return query select v_existing.id, v_existing.total_cents, v_existing.total_items;
      return;
    end if;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product := (v_line->>'productId')::uuid;
    v_qty := (v_line->>'qty')::int;
    if v_qty <= 0 then raise exception 'Qty debe ser > 0'; end if;

    select ep.price_cents into v_price
    from event_products ep
    where ep.event_id = p_event_id and ep.product_id = v_product and ep.active = true;
    if v_price is null then raise exception 'Producto no activo en el evento'; end if;

    if not p_allow_oversell then
      select coalesce(sum(qty),0) into v_current
      from stock_movements
      where event_id = p_event_id and cantina_id = p_cantina_id and product_id = v_product;
      if v_current - v_qty < 0 then
        raise exception 'Stock insuficiente para producto % (disp: %, pedido: %)', v_product, v_current, v_qty;
      end if;
    end if;

    v_total_cents := v_total_cents + v_price * v_qty;
    v_total_items := v_total_items + v_qty;
  end loop;

  insert into sales (id, event_id, cantina_id, user_id, total_cents, total_items, status, client_request_id, waiter_id)
  values (v_sale_id, p_event_id, p_cantina_id, p_user_id, v_total_cents, v_total_items, 'OK', p_client_request_id, p_waiter_id);

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
end; $function$;

create or replace function public.set_initial_inventory_bulk(
  p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 returns void
 language plpgsql
as $function$
declare
  v_line jsonb; v_pid uuid; v_new int; v_prev int; v_delta int; v_current int;
begin
  perform pg_advisory_xact_lock(hashtext(p_event_id::text || ':' || p_cantina_id::text));

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pid := (v_line->>'productId')::uuid;
    v_new := greatest(0, (v_line->>'qty')::int);

    select qty into v_prev from inventory_snapshots
    where event_id=p_event_id and cantina_id=p_cantina_id and product_id=v_pid and kind='INITIAL';

    if v_prev is null then
      insert into inventory_snapshots (event_id,cantina_id,product_id,kind,qty,created_at,created_by)
      values (p_event_id,p_cantina_id,v_pid,'INITIAL',v_new,now(),p_user_id);
      v_prev := 0;
    else
      update inventory_snapshots set qty = v_new, created_at = now(), created_by = p_user_id
       where event_id=p_event_id and cantina_id=p_cantina_id and product_id=v_pid and kind='INITIAL';
    end if;

    v_delta := v_new - v_prev;

    if v_delta <> 0 then
      select coalesce(sum(qty),0) into v_current from stock_movements
      where event_id=p_event_id and cantina_id=p_cantina_id and product_id=v_pid;

      if v_current + v_delta < 0 then
        raise exception 'Ajuste dejaría stock negativo para producto % (actual %, delta %)', v_pid, v_current, v_delta;
      end if;

      insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
      values (p_event_id, p_cantina_id, v_pid, v_delta, 'ADJUSTMENT', 'Ajuste inventario inicial', p_user_id);
    end if;
  end loop;
end $function$;

create or replace function public.adjust_stock_bulk(
  p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 returns void
 language plpgsql
as $function$
declare
  v_line jsonb; v_pid uuid; v_delta int; v_type text; v_reason text; v_current int;
begin
  perform pg_advisory_xact_lock(hashtext(p_event_id::text || ':' || p_cantina_id::text));

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pid := (v_line->>'productId')::uuid;
    v_delta := coalesce((v_line->>'delta')::int, 0);
    v_type := coalesce((v_line->>'movementType')::text, 'ADJUSTMENT');
    v_reason := coalesce((v_line->>'reason')::text, 'Ajuste manual');

    if v_delta = 0 then continue; end if;
    if v_type not in ('ADJUSTMENT','WASTE','TRANSFER_IN','TRANSFER_OUT','RETURN') then
      raise exception 'Tipo no permitido: %', v_type;
    end if;

    select coalesce(sum(qty),0) into v_current from stock_movements
    where event_id=p_event_id and cantina_id=p_cantina_id and product_id=v_pid;

    if v_current + v_delta < 0 then
      raise exception 'Stock insuficiente (prod %, actual %, delta %)', v_pid, v_current, v_delta;
    end if;

    insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
    values (p_event_id, p_cantina_id, v_pid, v_delta, v_type, v_reason, p_user_id);
  end loop;
end $function$;

create or replace function public.void_sale(p_sale_id uuid, p_waiter_id uuid, p_reason text)
 returns void
 language plpgsql
as $function$
declare
  v_sale sales%rowtype; v_line record;
begin
  select * into v_sale from sales where id = p_sale_id;
  if not found then raise exception 'Venta no encontrada'; end if;

  perform pg_advisory_xact_lock(hashtext(v_sale.event_id::text || ':' || v_sale.cantina_id::text));

  if v_sale.status = 'CANCELED' then return; end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo de anulación es obligatorio';
  end if;

  update sales
     set status = 'CANCELED', voided_at = now(), voided_by = p_waiter_id, void_reason = btrim(p_reason)
   where id = p_sale_id;

  for v_line in select product_id, qty from sale_line_items where sale_id = p_sale_id loop
    insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, ref_sale_id)
    values (v_sale.event_id, v_sale.cantina_id, v_line.product_id, v_line.qty, 'SALE', 'Anulación', p_sale_id);
  end loop;
end $function$;

-- ─────────────────── RPC de agregación del admin (grid de cantinas) ───────────────────
-- Se incluye porque es el objeto de la épica de agregación en servidor:
-- 7 subconsultas correlacionadas por cantina, partiendo de FROM cantinas.

create or replace function public.get_event_cantinas_grid(p_event_id uuid)
 returns table(cantina_id uuid, cantina_name text, qr_token uuid, assigned boolean,
               total_cents integer, num_sales integer, active_waiters integer,
               pending_incidents integer, low_stock_count integer, featured jsonb)
 language sql
 stable
as $function$
  SELECT
    c.id, c.name, c.qr_token,
    EXISTS(SELECT 1 FROM event_cantinas ec WHERE ec.event_id = p_event_id AND ec.cantina_id = c.id) AS assigned,
    COALESCE((SELECT SUM(s.total_cents) FROM sales s WHERE s.event_id = p_event_id AND s.cantina_id = c.id AND s.status = 'OK'), 0)::int,
    COALESCE((SELECT COUNT(*) FROM sales s WHERE s.event_id = p_event_id AND s.cantina_id = c.id AND s.status = 'OK'), 0)::int,
    COALESCE((SELECT COUNT(*) FROM shifts sh WHERE sh.event_id = p_event_id AND sh.cantina_id = c.id AND sh.ended_at IS NULL), 0)::int,
    COALESCE((SELECT COUNT(*) FROM incidents i WHERE i.event_id = p_event_id AND i.cantina_id = c.id AND i.status = 'pending'), 0)::int,
    COALESCE((SELECT COUNT(*) FROM v_cantina_inventory v WHERE v.event_id = p_event_id AND v.cantina_id = c.id AND v.current_qty <= v.low_stock_threshold), 0)::int,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', p.name, 'qty', COALESCE(v.current_qty, 0)) ORDER BY p.sku)
      FROM event_products ep
      JOIN products p ON p.id = ep.product_id
      LEFT JOIN v_cantina_inventory v ON v.event_id = p_event_id AND v.cantina_id = c.id AND v.product_id = ep.product_id
      WHERE ep.event_id = p_event_id AND ep.featured = true AND ep.active = true
        AND EXISTS(SELECT 1 FROM event_cantinas ec2 WHERE ec2.event_id = p_event_id AND ec2.cantina_id = c.id)
    ), '[]'::jsonb)
  FROM cantinas c
  ORDER BY 4 DESC, 5 DESC, c.name;
$function$;
