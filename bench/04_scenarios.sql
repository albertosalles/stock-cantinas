-- ============================================================================
-- Envoltorios para los escenarios de concurrencia de pgbench.
--
-- pgbench sólo sabe generar enteros aleatorios, así que estas funciones traducen
-- un índice a los UUID reales y llaman a `create_sale` TAL CUAL está en
-- producción. No se simplifica la llamada: el objeto de la medición es
-- justamente el coste del advisory lock y de la agregación de stock que hay
-- dentro de esa función.
-- ============================================================================

-- Índices estables para que pgbench pueda direccionar barras y productos.
create or replace view public.bench_cantina_idx as
  select id, row_number() over (order by name)::int as idx from cantinas;

create or replace view public.bench_product_idx as
  select p.id, p.sku::int as idx, p.name from products p;

-- Una venta de `p_lines` productos distintos en la barra indicada.
-- p_product_idx > 0 fuerza SIEMPRE el mismo producto: es el escenario del
-- "producto estrella" (la cerveza en el descanso), donde se espera que aparezca
-- el punto caliente tras materializar el stock.
create or replace function public.bench_sale(
  p_cantina_idx int,
  p_lines int default 2,
  p_product_idx int default 0
) returns void
language plpgsql as $$
declare
  v_event uuid; v_cantina uuid; v_user uuid; v_waiter uuid; v_lines jsonb;
begin
  select id into v_event from events where status = 'live' limit 1;
  select id into v_cantina from bench_cantina_idx where idx = p_cantina_idx;
  select id into v_user from users limit 1;
  select id into v_waiter from waiters order by surname limit 1;

  if p_product_idx > 0 then
    select jsonb_build_array(jsonb_build_object('productId', id, 'qty', 1))
      into v_lines from bench_product_idx where idx = p_product_idx;
  else
    select jsonb_agg(jsonb_build_object('productId', id, 'qty', 1))
      into v_lines
    from (select id from products order by random() limit p_lines) t;
  end if;

  perform create_sale(v_event, v_cantina, v_user, v_lines, gen_random_uuid(), false, v_waiter);
end $$;

-- Reposición de stock: los escenarios de carga consumen existencias y no deben
-- fallar por «stock insuficiente», que mediría otra cosa.
create or replace function public.bench_topup(p_qty int default 100000) returns void
language plpgsql as $$
declare v_event uuid; v_user uuid;
begin
  select id into v_event from events where status = 'live' limit 1;
  select id into v_user from users limit 1;
  insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
  select v_event, c.id, p.id, p_qty, 'ADJUSTMENT', 'Reposición para banco de pruebas', v_user
  from cantinas c cross join products p;
end $$;

-- Conteo inicial colaborativo: varios camareros guardando a la vez en la MISMA
-- barra. Es el escenario que hoy serializa contra las ventas por el advisory lock.
create or replace function public.bench_count(p_cantina_idx int, p_product_idx int) returns void
language plpgsql as $$
declare v_event uuid; v_cantina uuid; v_user uuid; v_lines jsonb;
begin
  select id into v_event from events where status = 'live' limit 1;
  select id into v_cantina from bench_cantina_idx where idx = p_cantina_idx;
  select id into v_user from users limit 1;
  select jsonb_build_array(jsonb_build_object('productId', id, 'qty', 50 + floor(random()*50)::int))
    into v_lines from bench_product_idx where idx = p_product_idx;

  perform set_initial_inventory_bulk(v_event, v_cantina, v_user, v_lines);
end $$;
