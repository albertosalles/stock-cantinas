-- ─────────────────────────────────────────────────────────────────────────────
-- S2 · PIN hasheado y credenciales fuera del navegador
--
-- Hoy `cantina_access.pin_code` y `waiters.pin_code` están en claro y ambas
-- tablas son legibles con la clave `anon`, que va en el bundle: todos los PIN
-- y todos los `qr_token` son públicos. El login por QR no aporta seguridad,
-- sólo comodidad.
--
-- Esta migración hace tres cosas:
--   1. Guarda los PIN hasheados con bcrypt (pgcrypto ya estaba instalado).
--   2. Los PIN los sigue ELIGIENDO EL ADMIN, tanto el de cantina como el de
--      camarero (2026-08-03). Las firmas de `set_cantina_pin` y `set_waiter_pin`
--      no cambian: cambia lo que guardan. Lo que se pierde es consultarlos
--      después, porque hashear y consultar son excluyentes — el admin ve la
--      ficha de acceso de la barra (si hay PIN, si está activo, cuándo se
--      cambió) pero no el código, y si se le olvida vuelve a fijarlo.
--   3. Saca del navegador todas las funciones de credenciales: las ejecuta
--      `service_role` desde las rutas de login, y nadie más.
--
-- NO se aplica a producción todavía. A diferencia de fases anteriores, aquí la
-- migración rompe el código que aún no está adaptado (5 puntos: el alta de
-- cantina, el alta de camarero, la ficha de camareros, el login de cantina y
-- la identificación de camarero). Producción se actualiza al cerrar S2, con el
-- código y la migración juntos.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

-- ─── 1. Credenciales de cantina ──────────────────────────────────────────────

alter table public.cantina_access add column if not exists pin_hash text;

update public.cantina_access
   set pin_hash = extensions.crypt(pin_code, extensions.gen_salt('bf'))
 where pin_hash is null;

alter table public.cantina_access alter column pin_hash set not null;
alter table public.cantina_access drop column if exists pin_code;

comment on column public.cantina_access.pin_hash is
  'Hash bcrypt del PIN. No es reversible: el admin ve si hay PIN configurado, nunca cuál es. Para conocer uno hay que regenerarlo con set_cantina_pin().';

-- ─── 2. Credenciales de camarero ─────────────────────────────────────────────
-- Se pierde la unicidad del PIN, que hasta ahora garantizaba un índice único
-- sobre el texto: dos hashes bcrypt del mismo código son distintos porque
-- llevan sal distinta. Lo asume `set_waiter_pin`, que comprueba colisiones
-- antes de asignar, y con el volumen real (5 camareros) el recorrido es
-- irrelevante.

alter table public.waiters add column if not exists pin_hash text;

update public.waiters
   set pin_hash = extensions.crypt(pin_code, extensions.gen_salt('bf'))
 where pin_code is not null and pin_hash is null;

alter table public.waiters drop constraint if exists waiters_pin_code_key;
alter table public.waiters drop column if exists pin_code;

comment on column public.waiters.pin_hash is
  'Hash bcrypt del PIN personal, usado como alternativa al QR de acreditación. NULL = sin PIN.';

-- ─── 3. Asignación de PIN ────────────────────────────────────────────────────
-- Los PIN los ELIGE EL ADMIN, tanto el de cantina como el de camarero
-- (decidido el 2026-08-03). Las firmas no cambian: cambia lo que guardan. Lo
-- que se pierde es poder consultarlos después, porque un hash no se deshace —
-- si se olvida uno, se vuelve a fijar.

create or replace function public.set_cantina_pin(p_cantina_id uuid, p_pin_code text, p_is_active boolean default true)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin_code is null or btrim(p_pin_code) !~ '^[0-9]{4,8}$' then
    raise exception 'El PIN debe tener entre 4 y 8 dígitos';
  end if;

  insert into cantina_access (cantina_id, pin_hash, is_active)
  values (p_cantina_id, crypt(btrim(p_pin_code), gen_salt('bf')), p_is_active)
  on conflict (cantina_id) do update
    set pin_hash = excluded.pin_hash,
        is_active = excluded.is_active,
        updated_at = now();

  return true;
end $$;

comment on function public.set_cantina_pin(uuid, text, boolean) is
  'Fija el PIN que elige el admin para la cantina, guardando sólo su hash. No se puede consultar después: si se olvida, se vuelve a fijar.';

create or replace function public.set_waiter_pin(p_waiter_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- PIN vacío = quitarle el PIN. Entonces sólo podrá entrar con su QR.
  if p_pin is null or btrim(p_pin) = '' then
    update waiters set pin_hash = null where id = p_waiter_id;
    if not found then raise exception 'Camarero no encontrado'; end if;
    return;
  end if;

  p_pin := btrim(p_pin);

  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'El PIN debe tener entre 4 y 8 dígitos';
  end if;

  -- El PIN identifica al camarero por sí solo, así que no puede repetirse. El
  -- índice único de antes iba sobre el texto y ya no sirve: dos hashes bcrypt
  -- del mismo código difieren porque llevan sal distinta. Hay que recorrer.
  if exists (
    select 1 from waiters w
    where w.id <> p_waiter_id
      and w.pin_hash is not null
      and w.pin_hash = crypt(p_pin, w.pin_hash)
  ) then
    raise exception 'Ese PIN ya lo tiene otro camarero';
  end if;

  update waiters set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_waiter_id;
  if not found then raise exception 'Camarero no encontrado'; end if;
end $$;

comment on function public.set_waiter_pin(uuid, text) is
  'Asigna el PIN personal que elige el admin, guardando sólo su hash. Rechaza el PIN si ya lo tiene otro camarero: identifica por sí solo. PIN vacío se lo quita, y entonces sólo entra con QR.';

-- El alta de camarero pasa a ser UNA operación. Antes era un solo INSERT con el
-- PIN dentro; al separarlo en «crear» + «fijar PIN» aparecía un hueco: si el
-- PIN colisionaba, el camarero ya estaba creado y quedaba a medias, sin PIN y
-- sin que el admin se enterara. Verificado en local: pasó de verdad.
create or replace function public.create_waiter(p_name text, p_surname text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'El nombre es obligatorio';
  end if;

  insert into waiters (name, surname)
  values (btrim(p_name), nullif(btrim(coalesce(p_surname, '')), ''))
  returning id into v_id;

  -- Misma transacción: si el PIN colisiona o es inválido, el alta se deshace
  -- entera y no queda ningún camarero suelto.
  perform set_waiter_pin(v_id, p_pin);

  return v_id;
end $$;

comment on function public.create_waiter(text, text, text) is
  'Alta de camarero con su PIN en una sola transacción. Si el PIN falla, no se crea el camarero.';

-- ─── 3 bis. El hash tampoco viaja ────────────────────────────────────────────
-- El panel de camareros necesita saber si alguien tiene PIN, no cuál es ni su
-- hash. Un bcrypt de cuatro dígitos se rompe fuera de línea en segundos, así
-- que mandarlo al navegador sería casi tan malo como mandar el PIN.
--
-- OJO: esta vista NO lleva `security_invoker`, igual que las seis anteriores.
-- Se lo pone S3 junto con las demás; hasta entonces se ejecuta como su
-- propietario, que es el estado que la matriz sigue marcando en rojo.

create or replace view public.v_waiters_admin as
  select w.id, w.name, w.surname, w.active, w.qr_token,
         (w.pin_hash is not null) as has_pin,
         w.created_at
  from public.waiters w;

comment on view public.v_waiters_admin is
  'Camareros para el panel de admin, sin el hash del PIN. Incluye qr_token porque el admin imprime la acreditación.';

-- ─── 4. Verificación contra el hash ──────────────────────────────────────────

create or replace function public.verify_cantina_pin(p_cantina_id uuid, p_pin text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from cantina_access ca
    where ca.cantina_id = p_cantina_id
      and ca.is_active
      and ca.pin_hash = crypt(p_pin, ca.pin_hash)
  );
$$;

create or replace function public.validate_cantina_access(p_event_id uuid, p_cantina_id uuid, p_pin_code text)
returns table(success boolean, message text, event_name text, cantina_name text, event_status text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event_status text;
  v_event_name text;
  v_cantina_name text;
  v_is_active boolean;
  v_hash text;
  v_is_assigned boolean;
begin
  select e.status, e.name into v_event_status, v_event_name
  from events e where e.id = p_event_id;
  if not found then
    return query select false, 'El evento no existe'::text, null::text, null::text, null::text;
    return;
  end if;

  if v_event_status <> 'live' then
    return query select
      false,
      case
        when v_event_status = 'draft'  then 'El evento aún no ha comenzado'
        when v_event_status = 'closed' then 'El evento ha finalizado'
        else 'El evento no está disponible'
      end::text,
      v_event_name, null::text, v_event_status;
    return;
  end if;

  select c.name into v_cantina_name from cantinas c where c.id = p_cantina_id;
  if not found then
    return query select false, 'La cantina no existe'::text, v_event_name, null::text, v_event_status;
    return;
  end if;

  select exists (
    select 1 from event_cantinas ec
    where ec.event_id = p_event_id and ec.cantina_id = p_cantina_id
  ) into v_is_assigned;

  if not v_is_assigned then
    return query select false, 'La cantina no está asignada a este evento'::text,
      v_event_name, v_cantina_name, v_event_status;
    return;
  end if;

  select ca.pin_hash, ca.is_active into v_hash, v_is_active
  from cantina_access ca where ca.cantina_id = p_cantina_id;

  if not found then
    return query select false, 'No hay credenciales configuradas para esta cantina'::text,
      v_event_name, v_cantina_name, v_event_status;
    return;
  end if;

  if not v_is_active then
    return query select false, 'El acceso para esta cantina está deshabilitado'::text,
      v_event_name, v_cantina_name, v_event_status;
    return;
  end if;

  -- Comparación contra el hash. `crypt` extrae la sal del propio hash.
  if v_hash <> crypt(p_pin_code, v_hash) then
    return query select false, 'Código PIN incorrecto'::text,
      v_event_name, v_cantina_name, v_event_status;
    return;
  end if;

  return query select true, 'Acceso concedido'::text, v_event_name, v_cantina_name, v_event_status;
end $$;

-- El PIN ya no se puede buscar por igualdad, así que hay que recorrer los
-- camareros activos comparando hashes. Con el volumen real es irrelevante, y
-- si algún día deja de serlo, el camino es el QR (o WebAuthn en S6), no
-- deshacer el hash.
create or replace function public.identify_waiter(p_qr_token uuid default null, p_pin text default null)
returns table(waiter_id uuid, waiter_name text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select w.id, trim(w.name || ' ' || coalesce(w.surname, ''))
  from waiters w
  where w.active = true
    and (
      (p_qr_token is not null and w.qr_token = p_qr_token)
      or (p_qr_token is null and p_pin is not null and w.pin_hash is not null
          and w.pin_hash = crypt(p_pin, w.pin_hash))
    )
  limit 1;
$$;

-- ─── 5. Las credenciales salen del navegador ─────────────────────────────────
-- Estas funciones las ejecuta `service_role` desde las rutas de login, que son
-- también quienes firman el token. Ningún cliente las alcanza.
--
-- OJO, y costó una vuelta al comprobarlo: revocar sólo a `anon` NO SIRVE DE
-- NADA. Postgres concede `EXECUTE` a **PUBLIC** en cada función nueva, y `anon`
-- es miembro de PUBLIC, así que `has_function_privilege('anon', …)` seguía
-- devolviendo `true` con el REVOKE puesto. Hay que revocar a PUBLIC y volver a
-- conceder explícitamente a quien deba tenerlo.
--
-- Es la misma clase de defecto que los DEFAULT PRIVILEGES del esquema, que
-- hacen nacer expuesta cualquier tabla nueva: el sistema concede por omisión y
-- hay que quitar, no añadir.

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.validate_cantina_access(uuid, uuid, text)',
    'public.verify_cantina_pin(uuid, text)',
    'public.identify_waiter(uuid, text)',
    'public.resolve_cantina_qr(uuid)',
    'public.set_cantina_pin(uuid, text, boolean)',
    'public.set_waiter_pin(uuid, text)',
    'public.create_waiter(text, text, text)',
    'public.toggle_cantina_access(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_fn);
    execute format('grant execute on function %s to service_role', v_fn);
  end loop;
end $$;
