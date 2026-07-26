# Banco de pruebas de carga

Entorno reproducible para medir el rendimiento del lado Postgres con volumen
realista, **sin tocar la base de datos de producción**.

Épica *Banco de pruebas de carga y observabilidad* (fase F1.5). Existe para
cerrar la limitación metodológica declarada en INF-1: las cifras de saturación
de aquella auditoría eran extrapolaciones (coste unitario × frecuencia
esperada), no medición bajo concurrencia real.

## Qué mide y qué no

**Sí mide** — todo lo que ocurre dentro de Postgres: coste de `create_sale`,
contención del *advisory lock* por barra, coste de las vistas y RPC de
agregación, comportamiento al crecer el histórico.

**No mide** — la capa HTTP (PostgREST), el fan-out de Realtime ni el
rendimiento del cliente. El fan-out (épica 5) necesita un instrumento distinto,
porque su límite está en el WebSocket y en el número de refetches del navegador,
no en la base de datos.

**Aviso sobre los números absolutos.** El banco corre en local (Apple Silicon,
NVMe, caché caliente) y es sensiblemente más rápido que la instancia de Supabase
en `eu-west-3`. Los milisegundos **no son comparables con producción**; sirven
para comparar *antes y después* de un cambio con el mismo método. La métrica que
sí es independiente del hardware, y por eso se registra siempre, es el **número
de páginas de buffer** (`Buffers: shared hit`).

## Requisitos

Sólo Docker (Colima sirve). No hace falta el CLI de Supabase: el banco levanta
un `postgres:17` limpio, que es la misma versión mayor que producción.

```bash
colima start --cpu 4 --memory 6 --disk 20
```

## Puesta en marcha

```bash
docker run -d --name cantinas-bench -e POSTGRES_PASSWORD=bench -e POSTGRES_DB=cantinas -p 55432:5432 postgres:17
```

Cargar esquema, funciones, seeder y escenarios (en este orden):

```bash
for f in bench/0*.sql; do docker exec -i cantinas-bench psql -U postgres -d cantinas -v ON_ERROR_STOP=1 -q < "$f"; done
```

Generar el volumen (20 barras, 20.000 ventas, 60 camareros; ~3 s):

```bash
docker exec cantinas-bench psql -U postgres -d cantinas -c "select * from bench_seed(20, 20000, 60);"
```

Reponer stock antes de las pruebas de concurrencia, para que no fallen por
existencias agotadas (que mediría otra cosa):

```bash
docker exec cantinas-bench psql -U postgres -d cantinas -c "select bench_topup(100000);"
```

## Escenarios de concurrencia

Se usa `pgbench`, que viene en la propia imagen de Postgres y es la herramienta
estándar para medir concurrencia en este motor.

```bash
docker cp bench/pgbench cantinas-bench:/tmp/pgbench
docker exec cantinas-bench pgbench -n -U postgres -d cantinas \
  -f /tmp/pgbench/b_misma_barra.sql -c 8 -j 4 -T 8
```

| Guion | Escenario | Para qué |
|---|---|---|
| `a_barras_distintas.sql` | Clientes vendiendo en barras distintas | Techo sin contención |
| `b_misma_barra.sql` | Todos en la misma barra | Coste del advisory lock |
| `c_producto_estrella.sql` | Misma barra **y** mismo producto | Hoy ≈ B; será el punto caliente tras materializar el stock |
| `d_conteo_colaborativo.sql` | Varios camareros contando a la vez | Contención del conteo inicial |

El escenario C es importante aunque hoy no aporte nada nuevo: el ADR de
materialización advierte de que la contención se **desplazará** del cerrojo de
barra al de fila del producto más vendido. Sin esta medición previa, ese
desplazamiento pasaría inadvertido y el problema se daría por resuelto.

## Reproducibilidad

`bench_seed` fija la semilla con `setseed()`. Misma semilla ⇒ mismos datos, así
que dos mediciones separadas en el tiempo son comparables. Si se cambia la
semilla o los parámetros, hay que anotarlo en el informe correspondiente.

## Mantenimiento

`01_schema.sql` y `02_functions.sql` son copia del esquema real, reconstruida
desde el catálogo de producción. **Cuando una RPC cambie en producción hay que
reflejarlo aquí en el mismo commit**, o las mediciones dejan de ser comparables.

## Limpieza

```bash
docker rm -f cantinas-bench && colima stop
```
