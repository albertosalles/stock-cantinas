-- ─────────────────────────────────────────────────────────────────────────────
-- LÍNEA BASE · 3/4 · Funciones y triggers
--
-- Extraídas del catálogo de producción el 2026-07-31 con pg_get_functiondef.
-- Ver cabecera de 00000000000001_baseline_schema.sql.
--
-- OJO PARA F2: 12 de estas 27 funciones son SECURITY DEFINER y TODAS son
-- ejecutables por `anon`. Se saltan el RLS por definición, y las que reciben
-- p_cantina_id / p_waiter_id / p_user_id se fían del argumento: hoy cualquiera
-- puede vender en cualquier barra y atribuir la venta a cualquier camarero.
-- Activar RLS no arregla nada de esto. Se corrige en la épica S3, derivando la
-- identidad del token en vez de recibirla por parámetro.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Funciones de trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  insert into public.cantina_stock (event_id, cantina_id, product_id, qty)
  values (new.event_id, new.cantina_id, new.product_id, new.qty)
  on conflict (event_id, cantina_id, product_id)
  do update set qty = public.cantina_stock.qty + excluded.qty, updated_at = now();
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.assign_active_season()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.season_id is null then
    select id into new.season_id from seasons where active = true;
    if new.season_id is null then
      raise exception 'No hay ninguna temporada activa: crea o activa una temporada antes de crear eventos';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.close_event_shifts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    update shifts
       set ended_at = now(),
           hours = round(extract(epoch from (now() - started_at))::numeric / 3600, 2)
     where event_id = new.id and ended_at is null;
  end if;
  return new;
end $function$;

drop trigger if exists trg_apply_stock_movement on public.stock_movements;
CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON public.stock_movements FOR EACH ROW WHEN (((new.event_id IS NOT NULL) AND (new.cantina_id IS NOT NULL) AND (new.product_id IS NOT NULL))) EXECUTE FUNCTION apply_stock_movement();

drop trigger if exists trg_events_active_season on public.events;
CREATE TRIGGER trg_events_active_season BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION assign_active_season();

drop trigger if exists trg_close_event_shifts on public.events;
CREATE TRIGGER trg_close_event_shifts AFTER UPDATE OF status ON public.events FOR EACH ROW EXECUTE FUNCTION close_event_shifts();

-- ─── Ventas ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_sale(p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb, p_client_request_id uuid, p_allow_oversell boolean DEFAULT false, p_waiter_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(sale_id uuid, total_cents integer, total_items integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_sale_id uuid := gen_random_uuid();
  v_total_cents int := 0;
  v_total_items int := 0;
  v_price int;
  v_current int;
  v_existing sales%rowtype;
  v_line record;
begin
  if p_client_request_id is not null then
    select * into v_existing from sales where client_request_id = p_client_request_id;
    if found then
      return query select v_existing.id, v_existing.total_cents, v_existing.total_items;
      return;
    end if;
  end if;

  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, p_cantina_id, (l->>'productId')::uuid, 0
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

CREATE OR REPLACE FUNCTION public.create_sales_batch(p_sales jsonb)
 RETURNS TABLE(client_request_id uuid, sale_id uuid, ok boolean, error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_s jsonb;
  v_sale_id uuid;
  v_crid uuid;
begin
  for v_s in select * from jsonb_array_elements(p_sales) loop
    v_crid := (v_s->>'clientRequestId')::uuid;
    begin
      select cs.sale_id into v_sale_id
      from public.create_sale(
        (v_s->>'eventId')::uuid,
        (v_s->>'cantinaId')::uuid,
        nullif(v_s->>'userId', '')::uuid,
        v_s->'lines',
        v_crid,
        coalesce((v_s->>'allowOversell')::boolean, true),
        nullif(v_s->>'waiterId', '')::uuid
      ) cs;

      client_request_id := v_crid; sale_id := v_sale_id; ok := true; error := null;
      return next;
    exception when others then
      client_request_id := v_crid; sale_id := null; ok := false; error := sqlerrm;
      return next;
    end;
  end loop;
end $function$;

comment on function public.create_sales_batch(jsonb) is 'Vacia la cola offline en un solo viaje. Cada venta va en su subtransaccion: una que falle no impide registrar las demas. Idempotente por client_request_id.';

CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id uuid, p_waiter_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_sale sales%rowtype; v_line record;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;

  if v_sale.status = 'CANCELED' then return; end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo de anulacion es obligatorio';
  end if;

  update sales
     set status = 'CANCELED', voided_at = now(), voided_by = p_waiter_id, void_reason = btrim(p_reason)
   where id = p_sale_id;

  for v_line in select product_id, qty from sale_line_items where sale_id = p_sale_id order by product_id loop
    insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, ref_sale_id)
    values (v_sale.event_id, v_sale.cantina_id, v_line.product_id, v_line.qty, 'SALE', 'Anulacion', p_sale_id);
  end loop;
end $function$;

-- ─── Inventario y stock ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.adjust_stock_bulk(p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

CREATE OR REPLACE FUNCTION public.set_initial_inventory_bulk(p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
        raise exception 'Ajuste dejaria stock negativo para producto % (actual %, delta %)',
          v_line.pid, coalesce(v_current, 0), v_delta;
      end if;

      insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
      values (p_event_id, p_cantina_id, v_line.pid, v_delta, 'ADJUSTMENT', 'Ajuste inventario inicial', p_user_id);
    end if;
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.set_final_inventory_bulk(p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_line record;
  v_actual int;
  v_delta int;
begin
  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, p_cantina_id, (l->>'productId')::uuid, 0
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
    where event_id = p_event_id and cantina_id = p_cantina_id and product_id = v_line.pid
    for update;

    insert into inventory_snapshots (event_id, cantina_id, product_id, kind, qty, created_by, created_at)
    values (p_event_id, p_cantina_id, v_line.pid, 'FINAL', v_line.qty, p_user_id, now())
    on conflict (event_id, cantina_id, product_id, kind)
    do update set qty = excluded.qty, created_by = excluded.created_by, created_at = excluded.created_at;

    v_delta := v_line.qty - coalesce(v_actual, 0);

    if v_delta <> 0 then
      insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
      values (p_event_id, p_cantina_id, v_line.pid, v_delta, 'ADJUSTMENT',
              'Ajuste por recuento de cierre', p_user_id);
    end if;
  end loop;
end $function$;

comment on function public.set_final_inventory_bulk(uuid, uuid, uuid, jsonb) is 'Registra el recuento fisico de cierre y ajusta el stock para que coincida con el. Idempotente: repetir el guardado con el mismo recuento no genera un segundo ajuste, porque el delta pasa a ser cero.';

CREATE OR REPLACE FUNCTION public.rebuild_cantina_stock()
 RETURNS void
 LANGUAGE sql
AS $function$
  insert into public.cantina_stock (event_id, cantina_id, product_id, qty)
  select event_id, cantina_id, product_id, sum(qty)::int
  from public.stock_movements
  where event_id is not null and cantina_id is not null and product_id is not null
  group by event_id, cantina_id, product_id
  on conflict (event_id, cantina_id, product_id)
  do update set qty = excluded.qty, updated_at = now();
$function$;

CREATE OR REPLACE FUNCTION public.verify_cantina_stock()
 RETURNS TABLE(event_id uuid, cantina_id uuid, product_id uuid, ledger integer, proyeccion integer)
 LANGUAGE sql
 STABLE
AS $function$
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

comment on function public.verify_cantina_stock() is 'Compara la proyeccion contra el ledger. 0 filas = invariante intacta. Si devuelve filas, reconstruir con rebuild_cantina_stock().';

-- ─── Acceso e identificación ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_cantina_access(p_event_id uuid, p_cantina_id uuid, p_pin_code text)
 RETURNS TABLE(success boolean, message text, event_name text, cantina_name text, event_status text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_event_status TEXT;
  v_event_name TEXT;
  v_cantina_name TEXT;
  v_pin_code TEXT;
  v_is_active BOOLEAN;
  v_is_assigned BOOLEAN;
BEGIN
  -- 1. Verificar que el evento existe y obtener su estado
  SELECT e.status, e.name
  INTO v_event_status, v_event_name
  FROM events e
  WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'El evento no existe'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 2. Verificar que el evento está en estado "live"
  IF v_event_status != 'live' THEN
    RETURN QUERY SELECT 
      false, 
      CASE 
        WHEN v_event_status = 'draft' THEN 'El evento aún no ha comenzado'
        WHEN v_event_status = 'closed' THEN 'El evento ha finalizado'
        ELSE 'El evento no está disponible'
      END::TEXT,
      v_event_name,
      NULL::TEXT,
      v_event_status;
    RETURN;
  END IF;

  -- 3. Verificar que la cantina existe
  SELECT c.name
  INTO v_cantina_name
  FROM cantinas c
  WHERE c.id = p_cantina_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'La cantina no existe'::TEXT, v_event_name, NULL::TEXT, v_event_status;
    RETURN;
  END IF;

  -- 4. Verificar que la cantina está asignada a este evento
  SELECT EXISTS(
    SELECT 1 
    FROM event_cantinas ec
    WHERE ec.event_id = p_event_id 
    AND ec.cantina_id = p_cantina_id
  ) INTO v_is_assigned;

  IF NOT v_is_assigned THEN
    RETURN QUERY SELECT false, 'La cantina no está asignada a este evento'::TEXT, v_event_name, v_cantina_name, v_event_status;
    RETURN;
  END IF;

  -- 5. Obtener credenciales de la cantina (ahora sin event_id)
  SELECT ca.pin_code, ca.is_active
  INTO v_pin_code, v_is_active
  FROM cantina_access ca
  WHERE ca.cantina_id = p_cantina_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No hay credenciales configuradas para esta cantina'::TEXT, v_event_name, v_cantina_name, v_event_status;
    RETURN;
  END IF;

  -- 6. Verificar que el acceso está activo
  IF NOT v_is_active THEN
    RETURN QUERY SELECT false, 'El acceso para esta cantina está deshabilitado'::TEXT, v_event_name, v_cantina_name, v_event_status;
    RETURN;
  END IF;

  -- 7. Verificar el código PIN
  IF v_pin_code != p_pin_code THEN
    RETURN QUERY SELECT false, 'Código PIN incorrecto'::TEXT, v_event_name, v_cantina_name, v_event_status;
    RETURN;
  END IF;

  -- ✅ Acceso concedido
  RETURN QUERY SELECT true, 'Acceso concedido'::TEXT, v_event_name, v_cantina_name, v_event_status;
END;
$function$;

comment on function public.validate_cantina_access(uuid, uuid, text) is 'Valida credenciales de una cantina para acceder a un evento. El PIN es único por cantina y funciona en todos los eventos.';

CREATE OR REPLACE FUNCTION public.resolve_cantina_qr(p_qr_token uuid)
 RETURNS TABLE(cantina_id uuid, cantina_name text, event_id uuid, event_name text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT c.id, c.name, e.id, e.name
  FROM cantinas c
  JOIN event_cantinas ec ON ec.cantina_id = c.id
  JOIN events e ON e.id = ec.event_id AND e.status = 'live'
  WHERE c.qr_token = p_qr_token
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.identify_waiter(p_qr_token uuid DEFAULT NULL::uuid, p_pin text DEFAULT NULL::text)
 RETURNS TABLE(waiter_id uuid, waiter_name text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT w.id, trim(w.name || ' ' || coalesce(w.surname,''))
  FROM waiters w
  WHERE w.active = true
    AND ((p_qr_token IS NOT NULL AND w.qr_token = p_qr_token)
      OR (p_qr_token IS NULL AND p_pin IS NOT NULL AND w.pin_code = p_pin))
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.set_cantina_pin(p_cantina_id uuid, p_pin_code text, p_is_active boolean DEFAULT true)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO cantina_access (cantina_id, pin_code, is_active)
  VALUES (p_cantina_id, p_pin_code, p_is_active)
  ON CONFLICT (cantina_id) 
  DO UPDATE SET 
    pin_code = EXCLUDED.pin_code,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
  
  RETURN true;
END;
$function$;

comment on function public.set_cantina_pin(uuid, text, boolean) is 'Configura o actualiza el PIN de una cantina';

CREATE OR REPLACE FUNCTION public.toggle_cantina_access(p_cantina_id uuid, p_is_active boolean)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE cantina_access
  SET is_active = p_is_active,
      updated_at = NOW()
  WHERE cantina_id = p_cantina_id;
  
  RETURN FOUND;
END;
$function$;

comment on function public.toggle_cantina_access(uuid, boolean) is 'Activa o desactiva el acceso de una cantina';

-- ─── Turnos ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.open_shift(p_waiter_id uuid, p_event_id uuid, p_cantina_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_shift_id uuid;
begin
  -- Serializa aperturas/cierres del mismo camarero
  perform pg_advisory_xact_lock(hashtext('shift:' || p_waiter_id::text));

  -- Si ya tiene un turno abierto en esta misma cantina/evento, reutilizarlo
  select id into v_shift_id from shifts
  where waiter_id = p_waiter_id and event_id = p_event_id
    and cantina_id = p_cantina_id and ended_at is null;
  if found then return v_shift_id; end if;

  -- Cerrar turnos abiertos en otra cantina/evento, imputando horas
  update shifts
     set ended_at = now(),
         hours = round(extract(epoch from (now() - started_at))::numeric / 3600, 2)
   where waiter_id = p_waiter_id and ended_at is null;

  insert into shifts (waiter_id, event_id, cantina_id)
  values (p_waiter_id, p_event_id, p_cantina_id)
  returning id into v_shift_id;

  return v_shift_id;
end $function$;

CREATE OR REPLACE FUNCTION public.close_shift(p_shift_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  UPDATE shifts
     SET ended_at = now(),
         hours = round(extract(epoch from (now() - started_at))::numeric / 3600, 2)
   WHERE id = p_shift_id AND ended_at IS NULL;
$function$;

-- ─── Catálogo ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_event_product_price_eur(p_event_id uuid, p_product_id uuid, p_price_eur numeric)
 RETURNS void
 LANGUAGE sql
AS $function$
  update event_products
  set price_cents = round(p_price_eur * 100)::int
  where event_id = p_event_id and product_id = p_product_id;
$function$;

-- ─── Agregación y métricas (F1 / F1.5) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_active_events()
 RETURNS TABLE(id uuid, name text, date timestamp with time zone, cantinas_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    e.id,
    e.name,
    e.date,
    COUNT(ec.cantina_id) as cantinas_count
  FROM events e
  LEFT JOIN event_cantinas ec ON ec.event_id = e.id
  WHERE e.status = 'live'
  GROUP BY e.id, e.name, e.date
  ORDER BY e.date DESC;
$function$;

comment on function public.get_active_events() is 'Devuelve la lista de eventos activos (live) con el número de cantinas asignadas';

CREATE OR REPLACE FUNCTION public.get_event_dashboard(p_event_id uuid)
 RETURNS TABLE(total_cents integer, num_sales integer, total_items integer, star_product text, star_units integer, active_waiters integer, num_cantinas integer, active_cantinas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
declare
  v_star_name text;
  v_star_units int;
begin
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

CREATE OR REPLACE FUNCTION public.get_event_cantinas_grid(p_event_id uuid)
 RETURNS TABLE(cantina_id uuid, cantina_name text, qr_token uuid, assigned boolean, total_cents integer, num_sales integer, active_waiters integer, pending_incidents integer, low_stock_count integer, featured jsonb)
 LANGUAGE sql
 STABLE
AS $function$
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
  select extract(hour from s.created_at at time zone 'Europe/Madrid')::smallint as hora,
         sum(s.total_cents)::int,
         count(*)::int
  from public.sales s
  where s.event_id = p_event_id and s.status = 'OK'
  group by 1
  order by 1;
$function$;

comment on function public.get_sales_by_hour(uuid) is 'Recaudacion por hora del dia (0-23) en Europe/Madrid. Agrupa por franja horaria, no por fecha: un evento puede abarcar varias jornadas y el grafico compara franjas.';

CREATE OR REPLACE FUNCTION public.get_sales_by_slot(p_event_id uuid, p_slot_minutes integer DEFAULT 15, p_puertas_min integer DEFAULT 90, p_cola_min integer DEFAULT 30, p_cantina_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(slot_start timestamp with time zone, etiqueta text, minuto_relativo integer, fase text, total_cents integer, num_sales integer)
 LANGUAGE sql
 STABLE
AS $function$
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

comment on function public.get_sales_by_slot(uuid, integer, integer, integer, uuid) is 'Reparte las ventas en tramos relativos al pitido inicial, acotado a la ventana del partido (puertas -> final + margen). Con p_cantina_id acota a una barra. Devuelve la rejilla completa, con los tramos vacios a cero. Sin kickoff_at devuelve 0 filas.';

CREATE OR REPLACE FUNCTION public.get_stock_alerts(p_event_id uuid)
 RETURNS TABLE(cantina_id uuid, cantina_name text, product_id uuid, product_name text, current_qty integer, threshold integer)
 LANGUAGE sql
 STABLE
AS $function$
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
