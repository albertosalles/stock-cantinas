-- ─────────────────────────────────────────────────────────────────────────────
-- Huella del esquema `public`: un md5 por familia de objetos.
--
-- Se ejecuta IDÉNTICA contra producción y contra el stack local, y las dos
-- salidas se comparan línea a línea. Como el md5 lo calcula Postgres a los dos
-- lados sobre la misma expresión, un md5 igual significa esquema igual.
--
-- Sirve para dos cosas distintas:
--   1. Verificar que la línea base de F2 reproduce producción DE VERDAD, y no
--      sólo que lo parece. Sin esto el entorno local es una fuente de falsos
--      correctos — el modo de fallo que ya costó caro en F1.
--   2. Detectar deriva: si algo se aplica a producción sin pasar por una
--      migración, la huella deja de cuadrar.
--
-- Uso:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -f database/tools/schema_fingerprint.sql
--   (y la misma consulta contra producción con el MCP de Supabase)
--
-- Si una familia no cuadra, usar schema_fingerprint_detail.sql, que devuelve
-- las líneas sueltas para hacerles `diff`.
--
-- Sólo se miran los roles de la aplicación (anon, authenticated, service_role):
-- lo que ve un cliente es lo único que importa aquí.
-- ─────────────────────────────────────────────────────────────────────────────

with columnas as (
  select 'col' as kind, c.relname || '.' || a.attname as name,
         format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' NOT NULL' else '' end
           || coalesce(' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid), '') as def
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
  left join pg_attrdef ad on ad.adrelid=c.oid and ad.adnum=a.attnum
  where n.nspname='public' and c.relkind in ('r','v')),
restricciones as (
  select 'cons', c.relname||'.'||k.conname, pg_get_constraintdef(k.oid)
  from pg_constraint k join pg_class c on c.oid=k.conrelid
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
indices as (select 'index', tablename||'.'||indexname, indexdef from pg_indexes where schemaname='public'),
vistas as (
  select 'view', c.relname, md5(pg_get_viewdef(c.oid,true))||' invoker='||
    coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name='security_invoker'),'off')
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'),
funciones as (
  select 'func', p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
    md5(pg_get_functiondef(p.oid))||case when p.prosecdef then ' SECURITY DEFINER' else ' invoker' end
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
disparadores as (
  select 'trig', c.relname||'.'||t.tgname, md5(pg_get_triggerdef(t.oid))
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
seguridad as (
  select 'rls', c.relname, case when c.relrowsecurity then 'enabled' else 'disabled' end
    || case when c.relforcerowsecurity then ' forced' else '' end
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
politicas as (
  select 'policy', tablename||'.'||policyname,
    cmd||' roles='||array_to_string(roles,',')||' using='||coalesce(md5(qual),'-')||' check='||coalesce(md5(with_check),'-')
  from pg_policies where schemaname='public'),
privilegios as (
  select 'grant', table_name||' -> '||grantee, string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated','service_role')
  group by table_name, grantee),
ejecucion as (
  select 'exec', p.proname||' -> '||r.rolname, 'EXECUTE'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join (select unnest(array['anon','authenticated','service_role']) as rolname) r
  where n.nspname='public' and has_function_privilege(r.rolname, p.oid, 'EXECUTE')),
publicacion as (
  select 'pub', pubname||'.'||schemaname||'.'||tablename, 'published'
  from pg_publication_tables where schemaname='public'),
todo as (
  select * from columnas union all select * from restricciones union all select * from indices
  union all select * from vistas union all select * from funciones union all select * from disparadores
  union all select * from seguridad union all select * from politicas union all select * from privilegios
  union all select * from ejecucion union all select * from publicacion)
select kind, count(*) as n,
       md5(string_agg(kind || rpad('', 6-length(kind)) || ' | ' || name || ' | ' || def, E'\n'
           order by kind || rpad('', 6-length(kind)) || ' | ' || name || ' | ' || def collate "C")) as md5
from todo group by kind order by kind;
