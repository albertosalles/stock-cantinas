-- ─────────────────────────────────────────────────────────────────────────────
-- Huella detallada: una línea por objeto, para hacer `diff` cuando el resumen
-- de schema_fingerprint.sql no cuadra en alguna familia.
--
-- Uso:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -At -f database/tools/schema_fingerprint_detail.sql > /tmp/local.txt
--   # la misma consulta contra producción -> /tmp/prod.txt
--   diff /tmp/local.txt /tmp/prod.txt
--
-- Aviso aprendido el 2026-07-31: los cuerpos de función se comparan por md5 de
-- pg_get_functiondef, que incluye ESPACIOS AL FINAL DE LÍNEA. Cuatro funciones
-- de la línea base fallaron sólo por eso al transcribirlas. Si un md5 de
-- función no cuadra y el código parece idéntico, mirar el espacio en blanco:
--
--   select p.proname, l.n, length(l.line) - length(rtrim(l.line)) as espacios
--   from pg_proc p
--   join pg_namespace ns on ns.oid = p.pronamespace
--   cross join lateral unnest(string_to_array(pg_get_functiondef(p.oid), E'\n'))
--        with ordinality as l(line, n)
--   where ns.nspname = 'public' and length(l.line) - length(rtrim(l.line)) > 0
--   order by 1, 2;
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
select kind || rpad('', 6-length(kind)) || ' | ' || name || ' | ' || def as linea
from todo
order by 1 collate "C";
