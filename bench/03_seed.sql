-- ============================================================================
-- Generador de datos sintéticos plausibles
--
-- Épica «Seeder de datos sintéticos», adelantada de F4 a F1.5 el 2026-07-26
-- porque el banco de pruebas la necesita. Se construye reutilizable a propósito:
--   · ahora  → poblar el banco de carga con volumen realista
--   · en F4  → generar histórico para desarrollar la predicción de demanda
--
-- Modela tres señales que importan para ambos usos:
--   1. Curva horaria de un partido (pre-partido, pico de descanso, post-partido),
--      no una distribución uniforme, que ocultaría los picos de concurrencia.
--   2. Popularidad desigual por producto (la cerveza domina), que es lo que crea
--      el punto caliente de contención sobre una sola fila.
--   3. Tamaño de barra desigual: unas cantinas venden mucho más que otras.
--
-- Reproducible: setseed() fijo, misma semilla ⇒ mismos datos. Sin eso, dos
-- mediciones no serían comparables y el banco no valdría para demostrar mejoras.
-- ============================================================================

create or replace function public.bench_reset() returns void
language plpgsql as $$
begin
  truncate table
    sale_line_items, stock_movements, inventory_snapshots, incidents,
    shifts, sales, event_products, event_cantinas, events, seasons,
    cantina_access, cantinas, waiters, products, users
  restart identity cascade;
end $$;

create or replace function public.bench_seed(
  p_num_cantinas int default 20,
  p_num_sales    int default 20000,
  p_num_waiters  int default 60,
  p_seed         float8 default 0.42
) returns table(evento uuid, cantinas int, productos int, ventas int, lineas int, movimientos int)
language plpgsql as $$
declare
  v_season uuid; v_event uuid; v_user uuid;
  v_lottery uuid[];      -- array de productos con repetición proporcional a su popularidad
  v_cantina_w numeric[]; -- peso relativo de cada barra
begin
  perform setseed(p_seed);
  perform bench_reset();

  -- ── Usuario de sistema, temporada y evento ──
  insert into users (email, name) values ('bench@local', 'Bench') returning id into v_user;

  insert into seasons (name, active, status, starts_on, ends_on)
  values ('Temporada de carga', true, 'open', current_date - 180, current_date + 180)
  returning id into v_season;

  insert into events (name, date, status, season_id)
  values ('Partido de carga', now(), 'live', v_season)
  returning id into v_event;

  -- ── Catálogo (30 productos, réplica del catálogo real del club) ──
  insert into products (sku, name, unit, category)
  select g,
         (array['Agua','Cocacola','Cerveza','Fanta Naranja','Fanta Limón','Tónica','Acuarius','Zero',
                'Cerveza 0.0','Vino tinto','Vino blanco','Café','Té','Bitter','Mosto','Sidra',
                'Bocadillo','Perrito','Empanadilla','Hamburguesa','Pizza','Bocata lomo',
                'Tokke','Oreo','Palomitas','Colores','Chuches','Patatas','Frutos secos','Chicles'])[g],
         'ud',
         case when g <= 16 then 'Bebida' when g <= 22 then 'Comida' else 'Snacks' end
  from generate_series(1, 30) g;

  insert into event_products (event_id, product_id, price_cents, active, low_stock_threshold, featured, sort_order)
  select v_event, p.id,
         case when p.category = 'Bebida' then 250 + (p.sku % 3) * 50
              when p.category = 'Comida' then 400 + (p.sku % 3) * 50
              else 200 + (p.sku % 2) * 50 end,
         true,
         case when p.sku <= 8 then 10 else 0 end,   -- sólo los top tienen umbral definido
         p.sku <= 4,                                 -- destacados en el grid del admin
         p.sku
  from products p;

  -- ── Cantinas y credenciales ──
  insert into cantinas (name, location)
  select 'Cantina ' || lpad(g::text, 2, '0'), 'LOC' || g
  from generate_series(1, p_num_cantinas) g;

  insert into cantina_access (cantina_id, pin_code, is_active)
  select id, lpad((1000 + row_number() over (order by name))::text, 4, '0'), true from cantinas;

  insert into event_cantinas (event_id, cantina_id) select v_event, id from cantinas;

  -- ── Camareros y turnos abiertos ──
  insert into waiters (name, surname, pin_code, active)
  select 'Camarero', 'Num' || g, lpad((5000 + g)::text, 4, '0'), true
  from generate_series(1, p_num_waiters) g;

  insert into shifts (waiter_id, cantina_id, event_id, started_at)
  select w.id,
         (select id from cantinas order by name offset (w.rn - 1) % p_num_cantinas limit 1),
         v_event,
         now() - interval '3 hours'
  from (select id, row_number() over (order by surname) rn from waiters) w;

  -- ── Stock inicial: generoso, para que las ventas no lo agoten ──
  -- INIT como movimiento + snapshot INITIAL, igual que hace la app real.
  insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by, created_at)
  select v_event, c.id, p.id,
         (400 + floor(random() * 300))::int, 'INIT', 'Carga inicial', v_user, now() - interval '4 hours'
  from cantinas c cross join products p;

  insert into inventory_snapshots (event_id, cantina_id, product_id, kind, qty, created_by, created_at)
  select v_event, sm.cantina_id, sm.product_id, 'INITIAL', sm.qty, v_user, now() - interval '4 hours'
  from stock_movements sm where sm.type = 'INIT';

  -- ── Lotería de popularidad: la cerveza sale mucho más que el vino ──
  select array_agg(p.id order by g, p.sku) into v_lottery
  from products p
  cross join lateral generate_series(1,
    case p.sku
      when 3 then 18   -- Cerveza
      when 1 then 10   -- Agua
      when 2 then 9    -- Cocacola
      when 4 then 6 when 5 then 6
      when 17 then 6   -- Bocadillo
      when 25 then 5   -- Palomitas
      when 18 then 4   -- Perrito
      else 2
    end) g;

  -- ── Peso de cada barra: unas venden mucho más que otras ──
  select array_agg(0.3 + random() * 1.7) into v_cantina_w from generate_series(1, p_num_cantinas);

  -- ── Ventas, repartidas por la curva horaria del partido ──
  -- 40 % pre-partido (2 h), 45 % concentrado en el descanso (20 min), 15 % post.
  --
  -- OJO: los valores aleatorios se calculan en la lista de selección de una CTE
  -- sobre generate_series, NO en un `cross join lateral (select random() ...)`.
  -- Un lateral sin correlación con la fila exterior lo evalúa Postgres UNA sola
  -- vez y reparte el mismo valor a todas las filas: la primera versión de este
  -- seeder generaba las 20.000 ventas en una única barra y en 20 minutos.
  with base as (
    select s as n,
           random() as bucket, random() as u_min,
           random() as pick_c, random() as pick_w
    from generate_series(1, p_num_sales) s
  ),
  cdf as (
    -- Distribución acumulada de los pesos de barra, para sorteo ponderado por rango
    select t.id,
           (sum(v_cantina_w[t.rn]) over (order by t.rn) - v_cantina_w[t.rn]) / tot.total as lo,
            sum(v_cantina_w[t.rn]) over (order by t.rn) / tot.total as hi
    from (select id, row_number() over (order by name)::int rn from cantinas) t
    cross join (select sum(x) as total from unnest(v_cantina_w) x) tot
  ),
  wl as (
    select id, row_number() over (order by surname)::int rn, count(*) over () as n_tot from waiters
  )
  insert into sales (id, event_id, cantina_id, user_id, waiter_id, total_cents, total_items, status, created_at, client_request_id)
  select gen_random_uuid(), v_event, cdf.id, v_user, wl.id, 0, 0, 'OK',
         now() - interval '4 hours' +
           (case
              when b.bucket < 0.40 then b.u_min * 120
              when b.bucket < 0.85 then 150 + b.u_min * 20
              else 200 + b.u_min * 30
            end) * interval '1 minute',
         gen_random_uuid()
  from base b
  join cdf on b.pick_c >= cdf.lo and b.pick_c < cdf.hi
  join wl on wl.rn = 1 + floor(b.pick_w * wl.n_tot)::int;

  -- ── Líneas de venta: 1-4 productos distintos por ticket ──
  -- Mismo cuidado: `k` se calcula por fila en la CTE y generate_series se
  -- correlaciona con ella, de modo que el número de líneas sí varía por ticket.
  insert into sale_line_items (sale_id, product_id, qty, unit_price_cents)
  select distinct on (x.sale_id, x.product_id)
         x.sale_id, x.product_id, x.qty, ep.price_cents
  from (
    select ps.id as sale_id,
           v_lottery[1 + floor(random() * array_length(v_lottery, 1))::int] as product_id,
           (1 + floor(random() * 2))::int as qty
    from (select id, (1 + floor(random() * 4))::int as k from sales) ps
    cross join lateral generate_series(1, ps.k) line
  ) x
  join event_products ep on ep.event_id = v_event and ep.product_id = x.product_id;

  -- ── Totales del ticket, derivados de sus líneas ──
  update sales s set
    total_cents = agg.cents,
    total_items = agg.items
  from (select sale_id, sum(qty * unit_price_cents)::int cents, sum(qty)::int items
        from sale_line_items group by sale_id) agg
  where s.id = agg.sale_id;

  -- ── Movimientos de stock derivados de las ventas (SALE, cantidad negativa) ──
  insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, ref_sale_id, created_at)
  select s.event_id, s.cantina_id, sli.product_id, -sli.qty, 'SALE', 'Venta', s.id, s.created_at
  from sale_line_items sli join sales s on s.id = sli.sale_id;

  -- ── Algunas incidencias abiertas, que el grid del admin cuenta ──
  insert into incidents (event_id, cantina_id, waiter_id, type, description, status)
  select v_event, c.id, (select id from waiters order by random() limit 1),
         (array['STOCK','TECH','OTHER'])[1 + floor(random()*3)::int],
         'Incidencia sintética', 'pending'
  from cantinas c where random() < 0.3;

  analyze;

  return query select v_event,
    (select count(*)::int from cantinas),
    (select count(*)::int from products),
    (select count(*)::int from sales),
    (select count(*)::int from sale_line_items),
    (select count(*)::int from stock_movements);
end $$;
