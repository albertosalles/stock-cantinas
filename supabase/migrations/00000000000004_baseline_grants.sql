-- ─────────────────────────────────────────────────────────────────────────────
-- LÍNEA BASE · 4/4 · Privilegios, publicación de Realtime y estado de RLS
--
-- Extraídos del catálogo de producción el 2026-07-31.
--
-- ESTE FICHERO ES EL RETRATO DEL PROBLEMA QUE ABRE F2. No refleja lo que
-- queremos, sino lo que hay: reproducirlo en local es imprescindible para que
-- la matriz de expectativas de S1 salga en rojo por los mismos motivos que
-- producción. Cada épica de F2 lo irá desmontando.
--
-- Lo que describe, medido y no supuesto:
--   · Las 17 tablas y las 6 vistas conceden a `anon` y `authenticated` los
--     siete privilegios, DELETE y TRUNCATE incluidos.
--   · Los DEFAULT PRIVILEGES del esquema repiten esa concesión, así que
--     cualquier tabla nueva nace igual de expuesta sin que nadie lo decida.
--   · Las 27 funciones son ejecutables por `anon`.
--   · RLS deshabilitado en las 17 tablas y 0 políticas definidas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Privilegios por defecto del esquema ─────────────────────────────────────
-- Origen de que todo nazca abierto: se conceden ANTES de crear los objetos.

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ─── Privilegios sobre los objetos existentes ────────────────────────────────

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Sólo dos tablas publicadas. `sales` NO está publicada a propósito (INF-1):
-- activarla con la agregación en cliente convertiría un sondeo de 60 s en
-- varias descargas por segundo. El TPV escucha stock_movements filtrando por
-- cantina_id en servidor; en F2 ese filtro pasa a ser frontera de seguridad y
-- no sólo un recorte de tráfico.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_movements'
  ) then
    alter publication supabase_realtime add table public.stock_movements;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incidents'
  ) then
    alter publication supabase_realtime add table public.incidents;
  end if;
end $$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Deshabilitado en las 17 tablas, 0 políticas. Se deja explícito para que el
-- entorno local reproduzca el estado de partida y la matriz de S1 mida lo
-- mismo aquí y en producción.

alter table public.cantina_access      disable row level security;
alter table public.cantina_stock       disable row level security;
alter table public.cantinas            disable row level security;
alter table public.event_cantinas      disable row level security;
alter table public.event_products      disable row level security;
alter table public.events              disable row level security;
alter table public.incidents           disable row level security;
alter table public.inventory_snapshots disable row level security;
alter table public.opponents           disable row level security;
alter table public.products            disable row level security;
alter table public.sale_line_items     disable row level security;
alter table public.sales               disable row level security;
alter table public.seasons             disable row level security;
alter table public.shifts              disable row level security;
alter table public.stock_movements     disable row level security;
alter table public.users               disable row level security;
alter table public.waiters             disable row level security;
