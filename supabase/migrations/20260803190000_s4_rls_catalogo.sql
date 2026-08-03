-- ─────────────────────────────────────────────────────────────────────────────
-- S4 · RLS en el catálogo y la configuración
--
-- Primera activación real de políticas, a propósito sobre las tablas de MENOR
-- riesgo: eventos, productos, cantinas, temporadas y rivales. Si algo se rompe
-- se ve al instante y afecta a datos reconstruibles, no al ledger.
--
-- ACTIVAR RLS SIN POLÍTICA CORTA TODO EL ACCESO, así que cada tabla lleva su
-- política y su `enable` en la misma migración.
--
-- `service_role` tiene BYPASSRLS en Supabase, y las conexiones directas como
-- `postgres` también se saltan las políticas. Por eso el seeder, el banco de
-- pruebas y las rutas de servidor siguen funcionando sin casos especiales, y
-- las políticas sólo tienen que hablar de `anon` y `authenticated`.
--
-- ALCANCE: sólo LECTURA. Las escrituras siguen abiertas porque el panel de
-- admin todavía escribe directo en estas tablas; retirar esos GRANT y llevarlas
-- a RPC es S5. La matriz las mantiene en rojo hasta entonces.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Visibilidad de un evento ────────────────────────────────────────────────
-- SECURITY DEFINER a propósito: consulta `events` saltándose su propia política,
-- que si no habría recursión al usarla desde la política de las tablas hijas.

create or replace function public.sc_evento_visible(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sc_app_role() = 'admin'
      or exists (select 1 from events e where e.id = p_event_id and e.status = 'live');
$$;

comment on function public.sc_evento_visible(uuid) is
  'Si el evento es visible para quien pregunta: en curso para todos, cualquiera para el admin. SECURITY DEFINER para no recursar sobre la política de events.';

revoke all on function public.sc_evento_visible(uuid) from public, anon;
grant execute on function public.sc_evento_visible(uuid) to authenticated, service_role;

-- ─── events ──────────────────────────────────────────────────────────────────
-- El evento cerrado es histórico comercial: el público sólo ve el que está en
-- curso. El admin los ve todos.

alter table public.events enable row level security;

drop policy if exists events_lectura on public.events;
create policy events_lectura on public.events
  for select
  using (status = 'live' or public.sc_app_role() = 'admin');

-- ─── cantinas ────────────────────────────────────────────────────────────────
-- Nombre y ubicación son información de cartel: los ve cualquiera.
--
-- `qr_token` NO. Es la credencial que abre el paso 1 del login, así que un
-- camarero que leyera el de otra barra podría pedir sesión allí — la misma
-- escalada que S3 cerró por el lado de las RPC. Y no se puede tapar con una
-- política, porque RLS filtra FILAS y esto es una COLUMNA: hay que retirar el
-- SELECT de tabla y volver a concederlo columna a columna.
--
-- El admin sigue necesitándolo para imprimir el cartel, y lo recibe por
-- `get_event_cantinas_grid`, que pasa a SECURITY DEFINER y ya exige admin por
-- dentro desde S3. Un GRANT no habría servido: el TPV y el admin comparten el
-- rol `authenticated`.

alter table public.cantinas enable row level security;

drop policy if exists cantinas_lectura on public.cantinas;
create policy cantinas_lectura on public.cantinas
  for select using (true);

revoke select on public.cantinas from anon, authenticated;
grant select (id, name, location) on public.cantinas to anon, authenticated;

create or replace function public.get_event_cantinas_grid(p_event_id uuid)
 returns table(cantina_id uuid, cantina_name text, qr_token uuid, assigned boolean, total_cents integer, num_sales integer, active_waiters integer, pending_incidents integer, low_stock_count integer, featured jsonb)
 language sql
 stable security definer
 set search_path = public
as $function$
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

revoke all on function public.get_event_cantinas_grid(uuid) from public, anon;
grant execute on function public.get_event_cantinas_grid(uuid) to authenticated, service_role;

-- ─── event_cantinas ──────────────────────────────────────────────────────────

alter table public.event_cantinas enable row level security;

drop policy if exists event_cantinas_lectura on public.event_cantinas;
create policy event_cantinas_lectura on public.event_cantinas
  for select using (public.sc_evento_visible(event_id));

-- ─── products ────────────────────────────────────────────────────────────────
-- Catálogo maestro: nombres y unidades, sin precio ni existencias. Es lo que
-- hay escrito en la pizarra.

alter table public.products enable row level security;

drop policy if exists products_lectura on public.products;
create policy products_lectura on public.products
  for select using (true);

-- ─── event_products ──────────────────────────────────────────────────────────
-- Precios del evento en curso. Los inactivos sólo los ve el admin: son
-- configuración, no carta.

alter table public.event_products enable row level security;

drop policy if exists event_products_lectura on public.event_products;
create policy event_products_lectura on public.event_products
  for select
  using (public.sc_evento_visible(event_id)
         and (coalesce(active, true) or public.sc_app_role() = 'admin'));

-- ─── seasons y opponents ─────────────────────────────────────────────────────
-- Estructura interna del negocio. El público ve el rival en el nombre del
-- evento; no necesita el catálogo ni saber cómo se agrupan las temporadas.

alter table public.seasons enable row level security;

drop policy if exists seasons_lectura on public.seasons;
create policy seasons_lectura on public.seasons
  for select using (public.sc_app_role() = 'admin');

alter table public.opponents enable row level security;

drop policy if exists opponents_lectura on public.opponents;
create policy opponents_lectura on public.opponents
  for select using (public.sc_app_role() = 'admin');

-- ─── Escrituras ──────────────────────────────────────────────────────────────
-- Siguen abiertas. El panel de admin todavía escribe directo en estas tablas y
-- retirar los GRANT ahora lo rompería; se hace en S5, junto con el paso a RPC.
--
-- Mientras tanto hay que dejar constancia de que RLS NO las cubre: una política
-- `for select` no restringe INSERT ni UPDATE. Que la tabla tenga RLS activado
-- no significa que esté protegida en todas las operaciones, y confundir las dos
-- cosas sería justo el tipo de falso verde que esta fase persigue.

-- ─── Los helpers tienen que ser ejecutables por quien evalúa la política ─────
-- Fallo detectado al pasar la matriz: con las políticas puestas, `anon` recibía
-- «permission denied» en TODO el catálogo. La causa no era la política sino el
-- privilegio: S3 revocó estos helpers a `anon`, y una política se evalúa CON EL
-- ROL QUE CONSULTA. Si ese rol no puede ejecutar la función que la política
-- invoca, la consulta entera falla.
--
-- Concederlos no abre nada: sc_claims y compañía sólo leen el token de quien
-- pregunta, y sc_evento_visible devuelve un booleano sobre si un evento está en
-- curso, que es información pública. Lo que decide qué se ve sigue siendo la
-- política, no el privilegio sobre el helper.

grant execute on function public.sc_claims()             to anon;
grant execute on function public.sc_app_role()           to anon;
grant execute on function public.sc_es_servicio()        to anon;
grant execute on function public.sc_claim_uuid(text)     to anon;
grant execute on function public.sc_evento_visible(uuid) to anon;
