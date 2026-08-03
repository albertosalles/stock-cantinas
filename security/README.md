# Matriz de expectativas de seguridad

Banco de pruebas de **F2 · Seguridad**. Define el contrato de acceso que la fase
debe cumplir y lo comprueba contra el stack local atacando **PostgREST con un
token por rol**.

```bash
colima start && supabase start        # una vez
node security/matrix.mjs --reset      # ejecuta la matriz
node security/matrix.mjs --verbose    # detalla cada comprobación en rojo
```

## Por qué existe antes de implementar nada

Mismo principio que en F1.5, donde el banco de pruebas de carga fue **antes** de
optimizar: primero el criterio medible, después el cambio. Aquí el criterio es
qué debe poder hacer cada rol, y se escribe antes de tocar una sola política
para que no acabe describiendo lo que salió, sino lo que se quería.

La progresión rojo → verde sobre esta misma matriz es la evidencia del capítulo
de seguridad, igual que INF-2 → INF-6 lo fue del de rendimiento.

## Línea base · 2026-07-31

Antes de empezar S2:

| | verde | rojo |
|---|---:|---:|
| Lectura | 30 | 62 |
| Escritura | 2 | 202 |
| RPC (`EXECUTE` de `anon`) | 0 | 27 |
| Suplantación | 0 | 1 |
| Realtime | 0 | 1 |
| **Total** | **32** | **293** |

**32 de 325 (9,8 %).** Los dos únicos verdes de escritura son los legítimos:
que el TPV pueda insertar una incidencia y el admin resolverla.

Hallazgos representativos, con las palabras que devuelve el runner:

```
lectura · cantina_access/anon: ve 2 filas (debería no ver ninguna)
lectura · cantinas/anon:       expone qr_token
lectura · waiters/pos:         expone pin_code, qr_token
lectura · sales/pos:           3 filas de otra cantina
lectura · events/anon:         1 filas de otro evento
suplantación:                  VENTA CREADA en otra cantina y atribuida a otro camarero
realtime:                      recibe 1 movimiento(s) de la otra cantina
```

## Cómo está construido

**`contract.mjs`** es el contrato: los cuatro roles con sus claims, y por tabla
qué ámbito de lectura y qué escrituras corresponden a cada uno, con el porqué
escrito al lado. Es el fichero que hay que discutir; `matrix.mjs` sólo lo
ejecuta.

**El fixture tiene asimetría deliberada** (`supabase/seed.sql`): dos cantinas
con datos distintos y dos eventos, uno en curso y otro cerrado. Sin eso, «este
rol no ve estas filas» y «la tabla está vacía» dan el mismo resultado, y la
matriz saldría verde sin haber medido nada. Por el mismo motivo el ámbito
`own_cantina` exige **ver algo y ver menos que el total**: si un TPV viera las
filas de las dos barras, un contador que sólo mirase «ve algo» lo daría por
bueno.

**Los tokens los firma el propio runner** con el secreto local, así que el
contrato se verifica desde el primer día, antes de que exista la emisión de
tokens de S2. Las claims que firma son exactamente las que decide el ADR.

**`UPDATE` y `DELETE` se sondean con un id inexistente**: si hay privilegio
devuelven 2xx sin tocar nada, y si no, 4xx. El `INSERT` no admite ese truco, por
eso todas las lecturas se ejecutan antes que las escrituras y conviene pasar
`--reset`.

**Se distingue «sin privilegio» de «petición inválida»**: 401, 403 y el código
`42501` de Postgres son denegación; un 400 significa que la petición llegó y el
rol sí tenía acceso. Confundirlos daría verdes falsos en cuanto un payload de
sonda estuviera mal formado.

## Dos comprobaciones que no son sobre RLS

Están aparte porque **ninguna política las arreglaría**, y son las que sostienen
las decisiones de la fase:

**Suplantación.** El camarero de la Cantina Norte llama a `create_sale` con la
cantina de la Sur y el id de otro camarero. Hoy la venta se crea. `create_sale`
es `SECURITY DEFINER`, así que se salta el RLS por definición y se fía de sus
argumentos: se puede activar RLS en las 17 tablas y esto seguiría pasando. Lo
arregla **S3**, quitando esos parámetros de la firma.

**Realtime.** Un TPV se suscribe a `stock_movements` y se insertan dos
movimientos, uno en su barra y otro en la ajena. Debe recibir el primero y no el
segundo. Es la razón por la que el ADR eligió el JWT propio: `postgres_changes`
aplica RLS con el token de la conexión, así que esto sólo puede quedar en verde
si la identidad viaja en el token.

## Progreso

| Hito | Verde | Total | |
|---|---:|---:|---|
| S1 · línea base (2026-07-31) | 32 | 325 | 9,8 % |
| S2 · credenciales fuera del navegador (2026-08-03) | 41 | 332 | 12,3 % |

El salto de S2 son las **8 funciones de credenciales** cerradas a `anon` (las
siete del login más `create_waiter`). El total sube porque aparecen
`verify_cantina_pin`, `set_waiter_pin`, `create_waiter` y la vista
`v_waiters_admin`.

Sigue casi todo en rojo, y es lo esperado: S2 saca las credenciales del
navegador, pero **no activa ninguna política**. Las 202 escrituras y las 65
lecturas las cierran S4 y S5.

## Cuatro falsos verdes que ya nos ha ahorrado

Merece la pena dejarlos escritos, porque son del mismo tipo que los tres fallos
que en F1 sólo se vieron mirando la pantalla — y porque **el propio banco de
pruebas es lo primero de lo que hay que desconfiar**: un arnés de seguridad que
se equivoca hacia el verde es peor que no tenerlo.

1. **La primera versión de la prueba de Realtime sólo comprobaba la fuga**, no
   que el canal recibiera lo suyo. Salió **verde** en un sistema sin RLS
   ninguno: el canal no estaba entregando nada y «no recibe nada de otra
   cantina» se cumplía trivialmente. Ahora se comprueban las dos mitades, y si
   no llegan los propios la comprobación se declara inválida en vez de correcta.
2. **La opción `accessToken` del cliente de Supabase no llega al canal.** Con
   ella la suscripción se establece —`SUBSCRIBED`— pero no entrega nada. El
   token hay que ponerlo con `realtime.setAuth()`. Es exactamente el modo de
   fallo del punto 1: todo parecía correcto capa por capa.

3. **La comprobación de RPC sacaba el universo de funciones de la lista de
   concedidas**, así que una función bien revocada desaparecía del recuento en
   vez de contar como verde. Justo después de cerrar siete funciones, el
   marcador dijo «0 de 22 cerradas». Ahora se enumeran todas y se pregunta por
   cada una.
4. **`psql` imprime los booleanos como `true`/`false`, no como `t`/`f`.**
   Compararlos con `'t'` daba siempre falso y la sección entera salió verde:
   **29 de 29 funciones «cerradas»** cuando sólo se habían cerrado siete, y el
   marcador global subió de 32 a 61 sin que nada hubiera mejorado. Ahora se
   normaliza el valor y se **aborta** ante cualquier cosa inesperada, antes que
   volver a inventarse un verde.

Además, tras `supabase db reset` el contenedor de Realtime rehace su slot de
replicación y tarda unos segundos en entregar; el runner reintenta para que eso
no se confunda con un hallazgo de seguridad.

> Los cuatro comparten forma: **la comprobación no podía observar lo que decía
> observar**, y el fallo caía siempre del lado tranquilizador. De ahí la regla
> que se ha ido aplicando: cuando una sección salte a verde de golpe, comprobar
> a mano un caso antes de creérselo.

## Qué épica pone verde cada sección

| Sección | La cierra |
|---|---|
| RPC · `EXECUTE` de `anon` | S3 |
| Suplantación | S3 |
| Lectura · columnas expuestas (`pin_code`, `qr_token`) | S3 y S5 |
| Lectura · catálogo y evento en curso | S4 |
| Lectura · ledger acotado por cantina | S5 |
| Escritura · retirada de `GRANT` | S5 |
| Realtime | S5 |

Cuando todo esté en verde, la tabla de esta página es el cuerpo de
**INF-7 · Línea base de seguridad**.
