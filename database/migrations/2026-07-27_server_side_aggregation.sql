-- ============================================================================
-- Agregación en servidor y sincronización offline por lotes
--
-- Épica «Agregación en servidor y paginación eficiente» (F1.5)
-- Informes: INF-1 (apartado 5, nivel 2), INF-3 (grid pendiente de medir limpio)
--
-- Corrige el patrón de traerse filas crudas al navegador para agregarlas en
-- JavaScript, y reescribe el grid de cantinas, que hoy ejecuta siete subconsultas
-- correlacionadas POR CADA cantina del sistema.
--
-- Ejecutar dentro de una transacción (Supabase apply_migration ya lo hace).
-- ============================================================================

-- ─────────────────── 1. Ventas por hora, agregadas en el servidor ───────────────────
-- Antes: el navegador descargaba TODAS las ventas del evento (20.000 filas en el
-- banco de pruebas) y las agrupaba en JavaScript, cada 60 s y por cada admin
-- conectado, para pintar 5 barras.

create or replace function public.get_sales_by_hour(p_event_id uuid)
returns table(hora timestamptz, total_cents integer, num_sales integer)
language sql stable as $$
  select date_trunc('hour', s.created_at) as hora,
         sum(s.total_cents)::int,
         count(*)::int
  from public.sales s
  where s.event_id = p_event_id and s.status = 'OK'
  group by 1
  order by 1;
$$;

comment on function public.get_sales_by_hour is
  'Reparte la recaudación del evento por hora natural. Sustituye la agregación '
  'en cliente, que descargaba una fila por venta.';

-- ─────────────────── 2. Alertas de stock bajo, con nombres ya resueltos ───────────────────
-- Antes: se descargaba el inventario del evento entero (productos × cantinas) y
-- luego DOS consultas más para resolver nombres de producto y de cantina.
--
-- Se conserva la regla de negocio del sistema de diseño: sólo avisa de productos
-- con umbral definido (> 0). Un umbral 0 significa «no avisar», no «avisar al
-- agotarse».

create or replace function public.get_stock_alerts(p_event_id uuid)
returns table(cantina_id uuid, cantina_name text, product_id uuid,
              product_name text, current_qty integer, threshold integer)
language sql stable as $$
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
$$;

-- ─────────────────── 3. Grid de cantinas: CTEs en vez de subconsultas correlacionadas ───────────────────
--
-- La versión anterior partía de `FROM cantinas` y ejecutaba SIETE subconsultas
-- correlacionadas por cada cantina, más un jsonb_agg que consultaba una vista
-- que a su vez agregaba el histórico. Coste medido: 76.490 páginas de buffer con
-- 20.000 ventas, para devolver 20 filas.
--
-- Se mantiene `FROM cantinas` a propósito: el grid del admin muestra también las
-- cantinas NO asignadas, para poder asignarlas desde ahí. Lo que cambia es que
-- cada métrica se agrega UNA vez para todo el evento y luego se une por cantina.

create or replace function public.get_event_cantinas_grid(p_event_id uuid)
returns table(cantina_id uuid, cantina_name text, qr_token uuid, assigned boolean,
              total_cents integer, num_sales integer, active_waiters integer,
              pending_incidents integer, low_stock_count integer, featured jsonb)
language sql stable as $$
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
$$;

-- ─────────────────── 4. Sincronización offline por lotes ───────────────────
-- Antes: la cola se vaciaba con un await por venta. 200 ventas acumuladas tras
-- un corte de red eran 200 viajes de ida y vuelta consecutivos.
--
-- Cada venta se procesa en su propia subtransacción: si una falla (p. ej. producto
-- retirado del catálogo), las demás se registran igual y sólo esa se devuelve como
-- fallida, para que el cliente la conserve en cola. Es el mismo comportamiento que
-- tenía el bucle en JavaScript, pero en un solo viaje.
--
-- La idempotencia sigue siendo por client_request_id, así que reintentar un lote
-- ya aplicado no duplica nada.

create or replace function public.create_sales_batch(p_sales jsonb)
returns table(client_request_id uuid, sale_id uuid, ok boolean, error text)
language plpgsql
security definer
as $function$
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

comment on function public.create_sales_batch is
  'Vacía la cola offline en un solo viaje. Cada venta va en su subtransacción: '
  'una que falle no impide registrar las demás. Idempotente por client_request_id.';
