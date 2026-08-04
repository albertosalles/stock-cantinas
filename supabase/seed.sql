-- ─────────────────────────────────────────────────────────────────────────────
-- Fixture del entorno local de seguridad (S1)
--
-- Lo aplica `supabase db reset --local` después de la línea base. Existe para
-- que la matriz de expectativas pueda distinguir «este rol NO ve estas filas»
-- de «la tabla está vacía», que sobre una base recién creada dan el mismo
-- resultado y convertirían la matriz en un falso verde.
--
-- Por eso el fixture está construido con ASIMETRÍA DELIBERADA:
--   · Dos cantinas con datos distintos, para comprobar que un TPV ve la suya y
--     NO la otra. Con una sola cantina, «ve todo» y «ve lo suyo» serían
--     indistinguibles.
--   · Dos eventos, uno `live` y otro `closed`, para comprobar que el público
--     sólo ve el que está en curso.
--   · Los UUID son fijos y legibles para poder afirmar sobre ellos desde el
--     runner sin tener que consultarlos antes.
--
-- El stock y las ventas se generan llamando a las RPC reales
-- (set_initial_inventory_bulk, create_sale), no insertando a mano: así el
-- ledger, la proyección `cantina_stock` y el trigger quedan coherentes, y el
-- fixture ejercita el mismo camino que la aplicación.
-- ─────────────────────────────────────────────────────────────────────────────

-- Temporada (debe existir antes que los eventos: trg_events_active_season la exige)
insert into public.seasons (id, name, starts_on, ends_on, active, status) values
  ('5ea50000-0000-4000-8000-000000000001', '2026-27', '2026-07-01', '2027-06-30', true, 'open');

insert into public.opponents (id, name) values
  ('0bbe0000-0000-4000-8000-000000000001', 'Osasuna');

insert into public.users (id, email, name) values
  ('55e50000-0000-4000-8000-000000000001', 'admin@local.test', 'Admin de pruebas');

-- Dos eventos: uno en curso y uno cerrado. El cerrado NO debe verlo el público.
insert into public.events (id, name, date, status, season_id, kickoff_at, opponent_id, match_type) values
  ('e7e70000-0000-4000-8000-000000000001', 'Elche - Osasuna', '2026-08-15 00:00:00+02', 'live',
   '5ea50000-0000-4000-8000-000000000001', '2026-08-15 21:00:00+02',
   '0bbe0000-0000-4000-8000-000000000001', 'Liga'),
  ('e7e70000-0000-4000-8000-000000000002', 'Elche - Getafe (cerrado)', '2026-08-01 00:00:00+02', 'closed',
   '5ea50000-0000-4000-8000-000000000001', '2026-08-01 21:00:00+02', null, 'Liga');

insert into public.cantinas (id, name, location, qr_token) values
  ('ca00a000-0000-4000-8000-00000000000a', 'Cantina Norte', 'Grada Norte', 'a0000000-0000-4000-8000-00000000000a'),
  ('ca00b000-0000-4000-8000-00000000000b', 'Cantina Sur',   'Grada Sur',   'b0000000-0000-4000-8000-00000000000b');

insert into public.event_cantinas (event_id, cantina_id) values
  ('e7e70000-0000-4000-8000-000000000001', 'ca00a000-0000-4000-8000-00000000000a'),
  ('e7e70000-0000-4000-8000-000000000001', 'ca00b000-0000-4000-8000-00000000000b'),
  -- La Norte trabajó tambien en el evento YA CERRADO. Es la asimetria que hace
  -- medible la diferencia entre «ve su barra» y «ve su barra en SU evento»: sin
  -- esto, una politica que filtrara solo por cantina pasaria por correcta
  -- mientras deja ver el historico de partidos anteriores.
  ('e7e70000-0000-4000-8000-000000000002', 'ca00a000-0000-4000-8000-00000000000a');

insert into public.products (id, sku, name, unit, category) values
  ('9c0d0000-0000-4000-8000-000000000001', 1, 'Cerveza',   'ud', 'Bebida'),
  ('9c0d0000-0000-4000-8000-000000000002', 2, 'Agua',      'ud', 'Bebida'),
  ('9c0d0000-0000-4000-8000-000000000003', 3, 'Bocadillo', 'ud', 'Comida');

insert into public.event_products (event_id, product_id, price_cents, active, low_stock_threshold, sort_order, featured) values
  ('e7e70000-0000-4000-8000-000000000002', '9c0d0000-0000-4000-8000-000000000001', 280, true, 20, 1, false),
  ('e7e70000-0000-4000-8000-000000000001', '9c0d0000-0000-4000-8000-000000000001', 300, true, 20, 1, true),
  ('e7e70000-0000-4000-8000-000000000001', '9c0d0000-0000-4000-8000-000000000002', 150, true,  0, 2, false),
  ('e7e70000-0000-4000-8000-000000000001', '9c0d0000-0000-4000-8000-000000000003', 450, true, 10, 3, false);

-- Un camarero por cantina. Cada uno trabaja con su dispositivo personal
-- (decidido el 2026-07-31), así que el token identifica a la persona.
insert into public.waiters (id, name, surname, active, qr_token, pin_hash) values
  ('3a17e000-0000-4000-8000-00000000000a', 'Ana',  'Norte', true, 'a1000000-0000-4000-8000-00000000000a',
   extensions.crypt('1111', extensions.gen_salt('bf'))),
  ('3a17e000-0000-4000-8000-00000000000b', 'Bruno', 'Sur',  true, 'b1000000-0000-4000-8000-00000000000b',
   extensions.crypt('2222', extensions.gen_salt('bf')));

-- Credenciales hasheadas (S2). Los códigos son 1234 y 5678, fijos para poder
-- probar el login desde el runner; lo que se guarda es su hash.
insert into public.cantina_access (cantina_id, pin_hash, is_active) values
  ('ca00a000-0000-4000-8000-00000000000a', extensions.crypt('1234', extensions.gen_salt('bf')), true),
  ('ca00b000-0000-4000-8000-00000000000b', extensions.crypt('5678', extensions.gen_salt('bf')), true);

insert into public.shifts (waiter_id, cantina_id, event_id) values
  ('3a17e000-0000-4000-8000-00000000000a', 'ca00a000-0000-4000-8000-00000000000a', 'e7e70000-0000-4000-8000-000000000001'),
  ('3a17e000-0000-4000-8000-00000000000b', 'ca00b000-0000-4000-8000-00000000000b', 'e7e70000-0000-4000-8000-000000000001');

insert into public.incidents (event_id, cantina_id, waiter_id, type, product_ids, description, status) values
  ('e7e70000-0000-4000-8000-000000000001', 'ca00a000-0000-4000-8000-00000000000a',
   '3a17e000-0000-4000-8000-00000000000a', 'STOCK', array['9c0d0000-0000-4000-8000-000000000001']::uuid[],
   'Quedan pocas cervezas', 'pending'),
  ('e7e70000-0000-4000-8000-000000000001', 'ca00b000-0000-4000-8000-00000000000b',
   '3a17e000-0000-4000-8000-00000000000b', 'TECH', null,
   'El datafono no lee', 'pending');

-- ─── Stock y ventas por la ruta real ─────────────────────────────────────────
-- Cantidades distintas por cantina, para que un recuento igual entre las dos
-- delate que el filtro por cantina no está actuando.

select public.set_initial_inventory_bulk(
  'e7e70000-0000-4000-8000-000000000001',
  'ca00a000-0000-4000-8000-00000000000a',
  '55e50000-0000-4000-8000-000000000001',
  '[{"productId":"9c0d0000-0000-4000-8000-000000000001","qty":100},
    {"productId":"9c0d0000-0000-4000-8000-000000000002","qty":80},
    {"productId":"9c0d0000-0000-4000-8000-000000000003","qty":40}]'::jsonb
);

select public.set_initial_inventory_bulk(
  'e7e70000-0000-4000-8000-000000000001',
  'ca00b000-0000-4000-8000-00000000000b',
  '55e50000-0000-4000-8000-000000000001',
  '[{"productId":"9c0d0000-0000-4000-8000-000000000001","qty":60},
    {"productId":"9c0d0000-0000-4000-8000-000000000002","qty":50},
    {"productId":"9c0d0000-0000-4000-8000-000000000003","qty":25}]'::jsonb
);

-- Dos ventas en la Norte, tres en la Sur: recuentos asimétricos a propósito.
select public.create_sale(
  'e7e70000-0000-4000-8000-000000000001', 'ca00a000-0000-4000-8000-00000000000a',
  null, '[{"productId":"9c0d0000-0000-4000-8000-000000000001","qty":2}]'::jsonb,
  'aaaa0000-0000-4000-8000-000000000001', false, '3a17e000-0000-4000-8000-00000000000a');

select public.create_sale(
  'e7e70000-0000-4000-8000-000000000001', 'ca00a000-0000-4000-8000-00000000000a',
  null, '[{"productId":"9c0d0000-0000-4000-8000-000000000003","qty":1}]'::jsonb,
  'aaaa0000-0000-4000-8000-000000000002', false, '3a17e000-0000-4000-8000-00000000000a');

select public.create_sale(
  'e7e70000-0000-4000-8000-000000000001', 'ca00b000-0000-4000-8000-00000000000b',
  null, '[{"productId":"9c0d0000-0000-4000-8000-000000000001","qty":3}]'::jsonb,
  'bbbb0000-0000-4000-8000-000000000001', false, '3a17e000-0000-4000-8000-00000000000b');

select public.create_sale(
  'e7e70000-0000-4000-8000-000000000001', 'ca00b000-0000-4000-8000-00000000000b',
  null, '[{"productId":"9c0d0000-0000-4000-8000-000000000002","qty":4}]'::jsonb,
  'bbbb0000-0000-4000-8000-000000000002', false, '3a17e000-0000-4000-8000-00000000000b');

select public.create_sale(
  'e7e70000-0000-4000-8000-000000000001', 'ca00b000-0000-4000-8000-00000000000b',
  null, '[{"productId":"9c0d0000-0000-4000-8000-000000000003","qty":2}]'::jsonb,
  'bbbb0000-0000-4000-8000-000000000003', false, '3a17e000-0000-4000-8000-00000000000b');

-- Una venta en el evento CERRADO, en la misma barra Norte. El TPV no debe
-- verla: es su cantina, pero no es su evento.
select public.set_initial_inventory_bulk(
  'e7e70000-0000-4000-8000-000000000002',
  'ca00a000-0000-4000-8000-00000000000a',
  '55e50000-0000-4000-8000-000000000001',
  '[{"productId":"9c0d0000-0000-4000-8000-000000000001","qty":30}]'::jsonb
);

select public.create_sale(
  'e7e70000-0000-4000-8000-000000000002', 'ca00a000-0000-4000-8000-00000000000a',
  null, '[{"productId":"9c0d0000-0000-4000-8000-000000000001","qty":5}]'::jsonb,
  'cccc0000-0000-4000-8000-000000000001', false, '3a17e000-0000-4000-8000-00000000000a');

-- La invariante debe seguir intacta después del fixture.
do $$
declare v_desc int;
begin
  select count(*) into v_desc from public.verify_cantina_stock();
  if v_desc <> 0 then
    raise exception 'El fixture dejó % descuadres entre el ledger y cantina_stock', v_desc;
  end if;
end $$;
