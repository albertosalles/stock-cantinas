-- ─────────────────────────────────────────────────────────────────────────────
-- LÍNEA BASE · 2/4 · Vistas
--
-- Extraídas del catálogo de producción el 2026-07-31. Ver cabecera de
-- 00000000000001_baseline_schema.sql.
--
-- OJO PARA F2: ninguna de estas vistas tiene `security_invoker`, así que se
-- ejecutan con los privilegios de su propietario y SE SALTAN el RLS de las
-- tablas de debajo. Activar RLS sin tocarlas dejaría el ledger accesible por
-- la puerta de atrás. Se corrige en la épica S3.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.v_available_cantinas as
 select e.id as event_id,
    e.name as event_name,
    e.status as event_status,
    c.id as cantina_id,
    c.name as cantina_name,
    c.location as cantina_location,
    ca.is_active as access_enabled,
        case
            when ca.cantina_id is null then false
            else true
        end as has_credentials
   from events e
     join event_cantinas ec on ec.event_id = e.id
     join cantinas c on c.id = ec.cantina_id
     left join cantina_access ca on ca.cantina_id = c.id
  where e.status = 'live'::text
  order by e.date desc, c.name;

comment on view public.v_available_cantinas is 'Lista de cantinas disponibles para eventos activos (live), con información de credenciales';

create or replace view public.v_cantina_inventory as
 select ep.event_id,
    ec.cantina_id,
    ep.product_id,
    coalesce(cs.qty, 0) as current_qty,
    coalesce(ep.low_stock_threshold, 0) as low_stock_threshold
   from event_products ep
     join event_cantinas ec on ec.event_id = ep.event_id
     left join cantina_stock cs on cs.event_id = ec.event_id and cs.cantina_id = ec.cantina_id and cs.product_id = ep.product_id;

create or replace view public.v_event_products_eur as
 select ep.event_id,
    ep.product_id,
    p.name,
    ep.price_cents::numeric / 100::numeric as price_eur,
    ep.active,
    ep.low_stock_threshold
   from event_products ep
     join products p on p.id = ep.product_id;

-- Vista histórica del stock derivado del ledger. Desde la materialización de
-- F1.5 la lectura en caliente usa cantina_stock; ésta se conserva porque sigue
-- siendo la definición de la invariante.
create or replace view public.v_inventory_current as
 select event_id,
    cantina_id,
    product_id,
    sum(qty)::integer as current_qty
   from stock_movements
  group by event_id, cantina_id, product_id;

create or replace view public.v_sales_by_cantina as
 select event_id,
    cantina_id,
    count(*) as num_sales,
    sum(total_cents)::integer as total_cents,
    sum(total_items)::integer as total_items
   from sales s
  where status = 'OK'::text
  group by event_id, cantina_id;

create or replace view public.v_sold_by_cantina_product as
 select event_id,
    cantina_id,
    product_id,
    coalesce(sum(- qty), 0::bigint)::integer as sold_qty
   from stock_movements
  where type = 'SALE'::text
  group by event_id, cantina_id, product_id;
