-- ─────────────────────────────────────────────────────────────────────────────
-- S5 · RLS en el ledger y la operativa (lecturas)
--
-- La parte delicada: ventas, movimientos de stock, inventario, turnos,
-- incidencias, camareros y credenciales.
--
-- LA ACOTACIÓN ES POR CANTINA **Y** POR EVENTO, no sólo por cantina. Una barra
-- trabaja en varios partidos, así que filtrar únicamente por `cantina_id`
-- dejaría a un camarero de hoy leyendo la facturación de todas las jornadas
-- anteriores de su barra. El fixture lo comprueba: la Norte tiene una venta en
-- el evento ya cerrado, y el TPV no debe verla.
--
-- ENTREGA EN DOS PARTES. Aquí van las LECTURAS. Retirar los GRANT de escritura y
-- llevar a rutas las mutaciones que el admin hace hoy desde el navegador es la
-- segunda mitad. Aun así, activar RLS ya bloquea los INSERT: sin política que
-- los permita, quedan denegados aunque el GRANT siga puesto.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Alcance de una barra ────────────────────────────────────────────────────

create or replace function public.sc_alcance_cantina(p_event_id uuid, p_cantina_id uuid)
returns boolean
language sql
stable
as $$
  select case public.sc_app_role()
    when 'admin' then true
    when 'pos'   then p_cantina_id = public.sc_claim_uuid('cantina_id')
                  and p_event_id   = public.sc_claim_uuid('event_id')
    else false
  end;
$$;

comment on function public.sc_alcance_cantina(uuid, uuid) is
  'Si quien pregunta puede ver datos de esa barra en ese evento. El TPV queda atado a AMBAS cosas: su barra trabaja en varios partidos y el histórico de los anteriores no es suyo.';

grant execute on function public.sc_alcance_cantina(uuid, uuid) to anon, authenticated, service_role;

-- `sale_line_items` no tiene cantina: se acota a través de su venta. SECURITY
-- DEFINER para no depender de la política de `sales` desde otra política.
create or replace function public.sc_venta_visible(p_sale_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from sales s
    where s.id = p_sale_id
      and public.sc_alcance_cantina(s.event_id, s.cantina_id)
  );
$$;

grant execute on function public.sc_venta_visible(uuid) to anon, authenticated, service_role;

-- ─── Ventas ──────────────────────────────────────────────────────────────────
-- Facturación. El TPV ve la de su barra en su partido; nunca el agregado del
-- evento ni lo de otra barra. El cliente verá SUS pedidos cuando exista el rol
-- en F2.5; hoy, nada.

alter table public.sales enable row level security;

drop policy if exists sales_lectura on public.sales;
create policy sales_lectura on public.sales
  for select using (public.sc_alcance_cantina(event_id, cantina_id));

alter table public.sale_line_items enable row level security;

drop policy if exists sale_line_items_lectura on public.sale_line_items;
create policy sale_line_items_lectura on public.sale_line_items
  for select using (public.sc_venta_visible(sale_id));

-- ─── Stock ───────────────────────────────────────────────────────────────────
-- `stock_movements` es además la tabla publicada en Realtime, así que esta
-- política es la que convierte el filtro por cantina de F1.5 en una frontera de
-- seguridad: hasta ahora el aislamiento entre barras era cortesía del cliente.

alter table public.stock_movements enable row level security;

drop policy if exists stock_movements_lectura on public.stock_movements;
create policy stock_movements_lectura on public.stock_movements
  for select using (public.sc_alcance_cantina(event_id, cantina_id));

alter table public.cantina_stock enable row level security;

drop policy if exists cantina_stock_lectura on public.cantina_stock;
create policy cantina_stock_lectura on public.cantina_stock
  for select using (public.sc_alcance_cantina(event_id, cantina_id));

alter table public.inventory_snapshots enable row level security;

drop policy if exists inventory_snapshots_lectura on public.inventory_snapshots;
create policy inventory_snapshots_lectura on public.inventory_snapshots
  for select using (public.sc_alcance_cantina(event_id, cantina_id));

-- ─── Turnos ──────────────────────────────────────────────────────────────────
-- Son datos laborales y alimentan la métrica de rendimiento por camarero.

alter table public.shifts enable row level security;

drop policy if exists shifts_lectura on public.shifts;
create policy shifts_lectura on public.shifts
  for select using (public.sc_alcance_cantina(event_id, cantina_id));

-- ─── Incidencias ─────────────────────────────────────────────────────────────
-- Única escritura directa que se conserva: reportar una incidencia es un aviso,
-- no una transacción de stock. El WITH CHECK la ata a la barra de quien la
-- reporta, así que no hace falta pasar por RPC. Resolverla es del admin.

alter table public.incidents enable row level security;

drop policy if exists incidents_lectura on public.incidents;
create policy incidents_lectura on public.incidents
  for select using (public.sc_alcance_cantina(event_id, cantina_id));

drop policy if exists incidents_alta_tpv on public.incidents;
create policy incidents_alta_tpv on public.incidents
  for insert
  with check (
    public.sc_app_role() = 'pos'
    and cantina_id = public.sc_claim_uuid('cantina_id')
    and event_id   = public.sc_claim_uuid('event_id')
    -- Sin esto, un TPV podría reportar incidencias a nombre de otro camarero,
    -- que es la misma falsificación de autoría que cerró S3 en las ventas.
    and (waiter_id is null or waiter_id = public.sc_claim_uuid('waiter_id'))
  );

drop policy if exists incidents_resolver_admin on public.incidents;
create policy incidents_resolver_admin on public.incidents
  for update
  using (public.sc_app_role() = 'admin')
  with check (public.sc_app_role() = 'admin');

-- ─── Camareros ───────────────────────────────────────────────────────────────
-- El TPV necesita nombres para atribuir la venta. Los secretos no viajan:
-- `pin_hash` porque un bcrypt de cuatro dígitos se rompe fuera de línea en
-- segundos, y `qr_token` porque es la credencial de la acreditación — quien la
-- leyera podría identificarse como ese camarero, que es la falsificación de
-- autoría de siempre.
--
-- Otra vez: son COLUMNAS, no filas, así que RLS no las tapa. Y el admin, que
-- imprime la acreditación, no puede distinguirse por GRANT porque comparte el
-- rol `authenticated` con el TPV. Recibe el QR por una RPC con guarda.

alter table public.waiters enable row level security;

drop policy if exists waiters_lectura on public.waiters;
create policy waiters_lectura on public.waiters
  for select using (public.sc_app_role() in ('pos', 'admin'));

revoke select on public.waiters from anon, authenticated;
grant select (id, name, surname, active, created_at) on public.waiters to anon, authenticated;

-- La vista de S2 leía qr_token, y con `security_invoker` ya no puede: pasa a
-- ser una RPC con guarda, que además es donde tenía que estar.
drop view if exists public.v_waiters_admin;

create or replace function public.get_waiters_admin()
returns table(id uuid, name text, surname text, active boolean, qr_token uuid, has_pin boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select public.sc_exigir_admin();
  select w.id, w.name, w.surname, w.active, w.qr_token,
         (w.pin_hash is not null), w.created_at
  from waiters w
  order by w.name;
$$;

comment on function public.get_waiters_admin() is
  'Camareros para el panel de admin, con el QR de la acreditación y si tienen PIN, pero nunca el hash.';

revoke all on function public.get_waiters_admin() from public, anon;
grant execute on function public.get_waiters_admin() to authenticated, service_role;

-- ─── Credenciales de cantina ─────────────────────────────────────────────────
-- El admin ve la ficha —si hay PIN, si está activo, cuándo se cambió— y nunca
-- el código ni su hash.

alter table public.cantina_access enable row level security;

drop policy if exists cantina_access_lectura on public.cantina_access;
create policy cantina_access_lectura on public.cantina_access
  for select using (public.sc_app_role() = 'admin');

revoke select on public.cantina_access from anon, authenticated;
grant select (cantina_id, is_active, created_at, updated_at) on public.cantina_access to anon, authenticated;

-- ─── users ───────────────────────────────────────────────────────────────────
-- Resto del MVP sin auth, con correos dentro. RLS activado y SIN política: nadie
-- la lee desde el navegador. `service_role` sigue pudiendo, que es lo que
-- necesitan las rutas de servidor.

alter table public.users enable row level security;

-- ─── Nota sobre las escrituras ───────────────────────────────────────────────
-- Activar RLS ya deniega los INSERT en todas estas tablas: sin política que los
-- permita, quedan bloqueados aunque el GRANT siga puesto. Lo que NO se puede
-- afirmar todavía es que UPDATE y DELETE estén cerrados por privilegio; hoy lo
-- están por ausencia de política, que es suficiente pero menos explícito.
-- Retirar los GRANT es la segunda mitad de S5.

-- ─── Las vistas heredan el alcance ───────────────────────────────────────────
-- Detectado al pasar la matriz: `v_cantina_inventory` combina event_products
-- con event_cantinas y hace LEFT JOIN al stock, así que las filas aparecen
-- aunque el stock quede filtrado por RLS — un anónimo veía el inventario
-- entero con cantidades a cero, y un TPV veía las líneas de la otra barra.
--
-- `security_invoker` no basta: protege lo que la vista LEE, no lo que la vista
-- COMBINA. El acotado tiene que estar dentro de la propia vista.

create or replace view public.v_cantina_inventory as
 select ep.event_id,
    ec.cantina_id,
    ep.product_id,
    coalesce(cs.qty, 0) as current_qty,
    coalesce(ep.low_stock_threshold, 0) as low_stock_threshold
   from event_products ep
     join event_cantinas ec on ec.event_id = ep.event_id
     left join cantina_stock cs on cs.event_id = ec.event_id and cs.cantina_id = ec.cantina_id and cs.product_id = ep.product_id
  where public.sc_alcance_cantina(ec.event_id, ec.cantina_id);

alter view public.v_cantina_inventory set (security_invoker = on);

-- `v_available_cantinas` expone si una barra tiene credenciales y si están
-- activas. Desde S3 sólo la usa la ruta de login, que va con service_role, así
-- que ningún cliente necesita alcanzarla.
revoke all on public.v_available_cantinas from anon, authenticated;

-- ─── BYPASSRLS no se salta un WHERE ──────────────────────────────────────────
-- Fallo detectado al pasar la matriz: con el acotado metido dentro de
-- `v_cantina_inventory`, `service_role` pasó a ver CERO filas.
--
-- El motivo es una distinción fina que conviene tener presente para el resto de
-- la fase: `service_role` tiene BYPASSRLS, así que se salta las POLÍTICAS, pero
-- una condición escrita en el cuerpo de una vista es una expresión normal y se
-- evalúa igual para todo el mundo. Como `sc_alcance_cantina` sólo contemplaba
-- 'admin' y 'pos', cualquier llamada sin app_role —las rutas de servidor, el
-- seeder, el banco de pruebas— caía en el `else false`.
--
-- Se corrige en la función, no en la vista: es donde estaba el supuesto.

create or replace function public.sc_alcance_cantina(p_event_id uuid, p_cantina_id uuid)
returns boolean
language sql
stable
as $$
  select case public.sc_app_role()
    when 'admin' then true
    when 'pos'   then p_cantina_id = public.sc_claim_uuid('cantina_id')
                  and p_event_id   = public.sc_claim_uuid('event_id')
    -- service_role, SQL directo, seeder y banco de pruebas.
    else public.sc_es_servicio()
  end;
$$;
