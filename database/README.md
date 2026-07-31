# Base de datos · línea base y entorno local

## Por qué existe esta línea base

Al arrancar **F2 · Seguridad** (2026-07-31) se comprobó que el esquema del repo
no representaba la realidad:

| | |
|---|---|
| Migraciones registradas en producción | 28, la primera del **2026-07-20** |
| Ficheros en `database/migrations/` | 8 |
| Coincidencias | ~5 |

Dos huecos distintos:

1. **Falta el principio entero.** El registro de producción empieza el
   2026-07-20, así que todo el esquema base — las 17 tablas, las 6 vistas y las
   RPC de F0 (`create_sale` original, `validate_cantina_access`,
   `resolve_cantina_qr`…) — se creó desde el editor SQL sin quedar registrado.
2. **Faltan migraciones intermedias**: `void_sale`, `incidents`,
   `seasons_multi_edition`, `waiters_shifts_qr_login`, `get_event_dashboard`,
   `perf_missing_indexes_inf1`… están en producción y no tienen fichero local.

Reconstruir el pasado a partir de ficheros incompletos habría dado un esquema
local que *parece* fiel sin serlo. En una fase de seguridad eso es inaceptable:
las políticas RLS se verifican comparando lo que un rol puede y no puede hacer,
y si el entorno no es idéntico, la verificación miente. Así que la línea base se
extrajo **del catálogo de producción**, que es la única fuente de verdad que
quedaba.

## Qué hay aquí

```
database/
  migrations/     Histórico incompleto anterior a F2. Se conserva como registro;
                  NO es la fuente de verdad. No añadir nada nuevo aquí.
  tools/
    schema_fingerprint.sql         Resumen: un md5 por familia de objetos.
    schema_fingerprint_detail.sql  Detalle: una línea por objeto, para diff.

supabase/
  config.toml
  migrations/
    00000000000001_baseline_schema.sql     Extensiones, tablas, restricciones, índices
    00000000000002_baseline_views.sql      Las 6 vistas
    00000000000003_baseline_functions.sql  Las 27 funciones y los 3 triggers
    00000000000004_baseline_grants.sql     Privilegios, publicación Realtime, estado RLS
```

**Desde F2 las migraciones nuevas van en `supabase/migrations/`**, con marca de
tiempo, y se siguen aplicando a producción con `apply_migration` del MCP de
Supabase. El fichero local y producción deben quedar idénticos, comprobado con
la huella.

## Entorno local

```bash
supabase start
```

Levanta Postgres, PostgREST, Realtime y GoTrue en Docker y aplica las cuatro
migraciones de la línea base. Requiere el daemon de Docker arrancado
(`colima start`).

Para reaplicar desde cero tras tocar la línea base:

```bash
supabase db reset --local
```

> **Nunca ejecutar `supabase db push`.** El historial de migraciones de
> producción no contiene la línea base, así que un push intentaría recrear el
> esquema sobre datos reales.

## Verificar que el local es fiel a producción

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f database/tools/schema_fingerprint.sql
```

…y la misma consulta contra producción con el MCP de Supabase. Los dos md5 los
calcula Postgres sobre la misma expresión, así que **md5 igual = esquema igual**.

Estado verificado el **2026-07-31**, las 10 familias idénticas:

| familia | n | md5 |
|---|---|---|
| col | 144 | `2668a57e3ebf8f5b8d3226f7f6d0a348` |
| cons | 69 | `44991f407eb5e61a3cca456976e3dcdf` |
| exec | 81 | `ae9098ca5ff227e196d50b80301e941f` |
| func | 27 | `51c136d462fcdd67db5ecd6bfe124be7` |
| grant | 69 | `4167d859c8c54b233346c86da6ba8590` |
| index | 49 | `af1eb504bf0e3daba8c53ecd055d8472` |
| pub | 2 | `a8f5158af96b8219aed13dfe26c6adfa` |
| rls | 17 | `50a9c74c5098cd22a0cb51bcdc67b909` |
| trig | 3 | `45ebf81567f863e89aa24be67462d553` |
| view | 6 | `5d9db96fece5dfca0fc0031f69682751` |

Si una familia deja de cuadrar, `schema_fingerprint_detail.sql` da las líneas
sueltas para hacerles `diff`.

**Aviso que costó una vuelta**: `pg_get_functiondef` incluye los espacios al
final de línea, y cuatro funciones fallaron la comparación sólo por eso
(`get_active_events`, `set_cantina_pin`, `toggle_cantina_access`,
`validate_cantina_access`). Si un md5 de función no cuadra y el código parece
idéntico, mirar el espacio en blanco antes que la lógica; hay una consulta para
localizarlo en la cabecera de `schema_fingerprint_detail.sql`.

## Lo que la línea base retrata (y F2 va a desmontar)

`00000000000004_baseline_grants.sql` no describe lo que queremos, sino lo que
hay. Medido, no supuesto:

- Las 17 tablas y las 6 vistas conceden a `anon` los **siete** privilegios,
  `DELETE` y `TRUNCATE` incluidos.
- Los *default privileges* del esquema repiten esa concesión: cualquier tabla
  nueva **nace expuesta** sin que nadie lo decida.
- Las 27 funciones son ejecutables por `anon`; 12 son `SECURITY DEFINER`.
- RLS deshabilitado en las 17 tablas, **0 políticas**.
- Ninguna de las 6 vistas tiene `security_invoker`, así que se ejecutan como su
  propietario y se saltarían el RLS aunque se activara.

Reproducir esto en local es deliberado: la matriz de expectativas de S1 tiene
que salir en rojo aquí por los mismos motivos que en producción.
