# Stock Cantinas — README

Digitalizar la **gestión y monitorización en tiempo real** del **stock** y **ventas** de cantinas en un estadio de fútbol.

La app tiene dos roles:

- **Cantina**: punto de venta (POS), gestión de inventario inicial/ajustes/final y visualización de totales.
- **Administrador**: configuración del evento, asignación de cantinas, definición del catálogo del evento, panel de métricas por cantina y herramientas de inventario.

Este README explica **cómo funciona** la app, **qué hay en Supabase**, **cómo está estructurado el proyecto**, **cómo levantarlo** y **cómo continuar el desarrollo**.

---

## 1) Funcionalidades por rol

### Rol: Cantina
- **POS (ventas)**
  - Grid de productos activos del evento.
  - Carrito visible con líneas, cantidades, total € y acciones `+ / − / Vaciar`.
  - Botón **Vender** que registra ticket y descuenta stock.
  - **Historial de ventas** con paginación y detalle por ticket (líneas y subtotales).

- **Inventario**
  - **Inventario inicial**: fijación/edición en lote (por producto).
  - **Ajustes del stock actual**: entradas/salidas sin venta (tipo y motivo: *ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT, WASTE, RETURN*).
  - **Inventario final**: sugerido automáticamente (stock calculado) con opción de **sobrescribir manualmente**.

- **Estado del stock en vivo**
  - Cantidad actual y **semáforo** por producto (verde OK / ámbar Bajo / rojo Agotado).
  - **Realtime**: los cambios se reflejan automáticamente.

### Rol: Administrador
- **Eventos**
  - Crear/editar evento (nombre y fecha).
  - **Asignar cantinas** existentes al evento y **crear nuevas cantinas** con asignación inmediata.
- **Catálogo del evento**
  - Añadir/editar producto del evento: **precio**, **umbral** de bajo stock, **activar/desactivar**.
  - **Crear productos globales** (tabla `products`) y asignarlos al evento.
- **Inventario por cantina (desde Admin)**
  - Mismas acciones que en Cantina: inventario inicial, ajustes, inventario final.
- **Panel de métricas**
  - **Selector de cantina**.
  - **Totales**: tickets, artículos vendidos, facturación (€).
  - **Stock por artículo** para la cantina seleccionada, con semáforo por umbral.
  - **Realtime** del stock.

---

## 2) Cómo funciona (flujo y decisiones clave)

1. **Catálogo**  
   - Los productos “globales” viven en `products`.  
   - Por cada evento se crea `event_products` con **precio** y **umbral** propios (y flags de activación).

2. **Asignación de cantinas**  
   - Se asignan al evento en `event_cantinas`.

3. **Modelo de stock (auditado)**  
   - El **stock actual** se **deriva** de la suma de `stock_movements` (no se guarda un “stock actual” materializado).  
   - Los snapshots **INITIAL** y **FINAL** se guardan en `inventory_snapshots` para auditoría/contabilidad.  
   - Los **ajustes** (entradas/salidas) generan `stock_movements` con **type** y **reason**.

4. **Venta (POS)**  
   - El POS llama a `create_sale(p_event_id, p_cantina_id, p_user_id, p_lines[], p_client_request_id)`.  
   - La función valida stock, inserta `sales` y `sale_line_items`, y registra `stock_movements` negativos (tipo `SALE`).  
   - **Idempotencia** con `p_client_request_id` para evitar tickets duplicados.

5. **Realtime**  
   - El frontend se suscribe a `stock_movements` (filtro por `event_id`) y refresca los datos de inventario.

6. **Moneda/Precios**  
   - **Actual**: precios en `price_cents` (enteros). La UI muestra **euros** (`price_cents/100`).  
   - **Alternativa**: almacenar euros (`NUMERIC(12,2)`) → requeriría migración de columnas/RPC.

---

## 3) Esquema en Supabase (resumen)

### Tablas

- **events**: `id (uuid)`, `name (text)`, `date (date)`  
- **cantinas**: `id (uuid)`, `name (text)`  
- **event_cantinas**: `event_id (uuid)`, `cantina_id (uuid)` **PK compuesta**  
- **products**: `id (uuid)`, `name (text)`  
- **event_products**: `event_id (uuid)`, `product_id (uuid)` **PK compuesta**, `price_cents (int)`, `low_stock_threshold (int)`, `active (bool)`  
- **inventory_snapshots**: `event_id, cantina_id, product_id (uuid)`, `kind ('INITIAL'|'FINAL')`, `qty (int)`, `created_at`, `created_by`  
- **stock_movements**: `event_id, cantina_id, product_id (uuid)`, `qty (int)`, `type`, `reason`, `created_by`, `created_at`  
  - `type`: `'INIT' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'WASTE' | 'RETURN'`  
- **sales**: `id (uuid)`, `event_id, cantina_id, user_id (uuid)`, `created_at`, `total_items (int)`, `total_cents (int)`, `status ('OK'|'VOID')`, `client_request_id (uuid)`  
- **sale_line_items**: `sale_id (uuid)`, `product_id (uuid)`, `qty (int)`, `unit_price_cents (int)`, `line_total_cents (int)`

### Vistas

- **v_cantina_inventory**  
  `event_id, cantina_id, product_id, current_qty, low_stock_threshold` (stock actual por producto/cantina).

- **v_sales_by_cantina**  
  `event_id, cantina_id, num_sales, total_items, total_cents` (agregado por cantina).

- **v_top_products** *(opcional)*  
  Agregado por producto (unidades e ingresos) para ranking.

### Funciones RPC (PL/pgSQL)

- **create_sale**: crea ticket, líneas y descuenta stock (tipo `SALE`), con idempotencia.  
- **set_initial_inventory_bulk**: fija snapshot `INITIAL` y añade un `ADJUSTMENT` por la diferencia (evita negativo).  
- **adjust_stock_bulk**: entradas/salidas al stock actual (tipos permitidos, valida no negativo).  
- **set_final_inventory_bulk**: fija snapshot `FINAL` editable para cierre/reconciliación.

> **Realtime**: activar en `stock_movements` (Database → Replication → Realtime).  
> **RLS**: para producción, definir políticas por rol (admin/cantina) y ámbito (evento/cantina).

---

## 4) Estructura del proyecto (Next.js, App Router)

```
app/
  page.tsx                        # Home con accesos a Cantina y Administración
  pos/page.tsx                    # Vista Cantina (tabs: Venta, Inventario, Ventas)
  admin/
    page.tsx                      # Listado de eventos + crear evento
    [eventId]/page.tsx            # Detalle evento (General, Cantinas, Catálogo, Inventario, Panel)

components/
  CantinaPOS.tsx                  # (si se usa) POS como componente

hooks/
  useLiveInventory.ts             # suscripción Realtime a stock_movements

lib/
  supabaseClient.ts               # cliente Supabase (createClient)
  sales.ts                        # cliente para RPC create_sale

public/
  favicon.ico

styles/
  app/globals.css                 # estilos base (Tailwind opcional)

DESIGN.md                         # guía de diseño (paleta Elche CF, tarjetas y sombras)
```

**Tecnologías**: Next.js (App Router), React, Supabase JS (PostgREST + RPC), Realtime.  
**Estilos**: CSS inline (MVP). Tailwind opcional (ya documentado cómo activarlo).

---

## 5) Variables de entorno

Crea **`.env.local`** en la raíz del proyecto:

```
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>

# MVP sin auth: IDs fijos de trabajo (sustituir por Auth en fase 2)
NEXT_PUBLIC_EVENT_ID=<uuid-evento>
NEXT_PUBLIC_CANTINA_ID=<uuid-cantina>
NEXT_PUBLIC_APP_USER_ID=<uuid-usuario-app>
```

> Requiere reiniciar `npm run dev` tras cambios en `.env.local`.

---

## 6) Arranque local (Quickstart)

1. **Requisitos**: Node 18+, proyecto Supabase operativo.
2. **Base de datos**: crea tablas, vistas y RPC (ver §3). Activa **Realtime** en `stock_movements`.
3. **Semillas mínimas**:
   - `events`: crea un evento (ej. “Jornada 1”, fecha de hoy).
   - `cantinas`: crea “Cantina Norte”.  
   - `event_cantinas`: asigna la cantina al evento.  
   - `products`: *Agua, Cocacola, Palomitas, Bocatas*.  
   - `event_products`: añade cada producto con `price_cents`, `low_stock_threshold`, `active=true`.  
   - `inventory_snapshots (INITIAL)`: cantidades iniciales por producto/cantina.
4. **Instalación y ejecución**:
   ```bash
   npm i
   npm run dev
   ```
5. **Rutas principales**:
   - `http://localhost:3000/pos` — modo Cantina.  
   - `http://localhost:3000/admin` — modo Administrador.

---

## 7) Detalles de implementación (frontend)

### POS (`app/pos/page.tsx`)

- **Productos del evento**: `from('event_products').select('product_id, price_cents, products(name)')` con filtros por `event_id` y `active`.
- **Semáforo y stock**: se apoya en `v_cantina_inventory` (qty vs threshold).  
- **Realtime**: `useLiveInventory(eventId, cantinaId)` vuelve a pedir inventario al recibir cambios.  
- **Venta**: `createSale(eventId, cantinaId, userId, lines)` → RPC `create_sale`.  
- **Historial de ventas (arreglado)**: consulta `sales` **con** relación `sale_line_items`, calcula totales y muestra detalle con paginación.  
- **Inventario**:  
  - **Inicial**: `set_initial_inventory_bulk`.  
  - **Ajustes**: `adjust_stock_bulk` (valida no negativo).  
  - **Final**: `set_final_inventory_bulk` (editable).

### Admin (`app/admin/[eventId]/page.tsx`)

- **General**: editar nombre/fecha del evento.  
- **Cantinas**: listado y **toggle** de asignación (`event_cantinas`); **crear cantina** y asignar.  
- **Catálogo**: editar `price_cents`, `low_stock_threshold`, `active`; **crear producto global** y añadirlo al evento.  
- **Inventario (por cantina)**: idéntico a Cantina (inicial, ajustes, final).  
- **Panel de métricas por cantina**:  
  - Selector de **cantina**.  
  - Totales desde `v_sales_by_cantina` (tickets, artículos, facturación).  
  - Stock por artículo: `v_cantina_inventory` + nombres de `event_products -> products`.  
  - **Realtime** de stock.

---

## 8) Buenas prácticas y seguridad

- **Idempotencia** en ventas con `client_request_id` (UUID).  
- **Stock derivado** (no almacenar stock actual materializado).  
- **RLS** (en producción): políticas por rol (admin/cantina) y ámbito (evento/cantina).  
- **Moneda**:  
  - Actual: `price_cents` (enteros).  
  - Alternativa: euros `NUMERIC(12,2)` (revisar redondeos y RPC).

---

## 9) Sistema de Autenticación por Cantina (⭐ ACTUALIZADO v2.0)

Se ha implementado un sistema completo de autenticación que permite a cada cantina acceder de forma segura a su punto de venta.

### ✨ Novedades v2.0:
- ✅ **PIN único por cantina**: Cada cantina tiene UN solo código que funciona en todos los eventos (no cambia entre eventos)
- ✅ **Panel de administrador mejorado**: Cambiar estado del evento directamente desde la UI
- ✅ **Gestión simplificada**: Configurar credenciales una sola vez por temporada

### Características principales:
- ✅ **Login por PIN**: Cada cantina tiene un código único que mantiene siempre
- ✅ **Restricción por estado**: Solo eventos en "live" permiten acceso
- ✅ **Flujo en 3 pasos**: Evento → Cantina → PIN
- ✅ **Sesión persistente**: Se mantiene hasta cerrar sesión
- ✅ **Validación automática**: Verifica estado del evento al acceder al POS
- ✅ **Panel admin**: Selector de estado del evento (draft/live/closed)
- ✅ **Botón de cerrar sesión**: En el header del POS

### Estados de Evento:
| Estado | Emoji | Acceso POS | Gestión desde Admin |
|--------|-------|------------|---------------------|
| `draft` | 📝 | ❌ Bloqueado | Planificación |
| `live` | 🟢 | ✅ Permitido | Evento activo |
| `closed` | 🔒 | ❌ Bloqueado | Evento finalizado |

### Archivos relacionados:
- 📄 `database/migrations/update_cantina_auth_single_pin.sql` - **Nueva** migración a PIN único
- 📄 `database/migrations/setup_single_pin_credentials.sql` - Script de configuración actualizado
- 📄 `app/login/page.tsx` - Página de login (actualizada)
- 📄 `app/pos/page.tsx` - POS con validación de sesión
- 📄 `app/admin/page.tsx` - Panel admin con selector de estado
- 📄 `AUTH_UPDATE_V2.md` - **Documentación de la actualización v2.0**
- 📄 `AUTH_SYSTEM.md` - Documentación completa del sistema original
- 📄 `AUTH_QUICK_START.md` - Guía rápida visual

### Inicio rápido:
```bash
# 1. Ejecutar nueva migración en Supabase SQL Editor
database/migrations/update_cantina_auth_single_pin.sql

# 2. Configurar PINs (una sola vez por cantina)
SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina Norte'),
  '1234',
  true
);

# 3. Cambiar estado del evento a "live"
# Opción A: Desde /admin (UI)
# Opción B: SQL manual
UPDATE events SET status = 'live' WHERE id = '<event_id>';

# 4. Acceder a /login y usar el mismo PIN para todos los eventos
```

### Funciones SQL útiles:
```sql
-- Configurar o actualizar PIN de una cantina
SELECT set_cantina_pin('<cantina_id>', '1234', true);

-- Activar/desactivar acceso de una cantina
SELECT toggle_cantina_access('<cantina_id>', false);

-- Ver todas las credenciales configuradas
SELECT c.name, ca.pin_code, ca.is_active 
FROM cantinas c
LEFT JOIN cantina_access ca ON ca.cantina_id = c.id;

-- Probar autenticación
SELECT * FROM validate_cantina_access(
  '<event_id>'::uuid,
  '<cantina_id>'::uuid,
  '1234'
);
```

### Para Administradores:
1. **Ir a `/admin`**
2. **Ver lista de eventos con selector de estado**
3. **Cambiar estado con un clic**: 📝 BORRADOR → 🟢 EN VIVO → 🔒 CERRADO
4. **Configurar**: Clic en "Configurar →" para gestionar cantinas, catálogo, etc.

Ver `AUTH_UPDATE_V2.md` para documentación completa de la actualización.

---

## 10) Roadmap sugerido

1. **Autenticación y roles** (Supabase Auth + RLS por claims).  
2. **Cierre de evento** (bloqueo de ventas/movimientos, snapshot final y reporte de diferencias).  
3. **Transferencias entre cantinas** (flujo solicitud/aceptación con `TRANSFER_OUT/IN`).  
4. **Devoluciones / anulación de ticket** (estado `VOID` y compensaciones de stock).  
5. **Reportes** (CSV/Excel, ingresos por hora, top productos, rotación).  
6. **UX/Atajos** (filtros “solo bajo stock”, teclado numérico, búsqueda).  
7. **Integración TPV** (métodos de pago y cuadre de caja).  
8. **Tests** (RPC, UI con fixtures de Supabase local).

---

## 10) Troubleshooting

- **Semáforo no cambia** → habilitar Realtime en `stock_movements`; `useLiveInventory` correctamente parametrizado; ejecutar `fetchInventory()` al evento.  
- **Historial de ventas vacío** → usar relación **`sale_line_items`** y verificar `event_id`/`cantina_id`.  
- **Variables NEXT_PUBLIC_* salen undefined** → definir en `.env.local` (sin comillas) y reiniciar dev server.  
- **RLS bloquea inserts** → revisar políticas y claims. En MVP, usar `anon` con filtros por `event_id`/`cantina_id` o desactivar temporalmente para pruebas.

---

## 11) Puntos de entrada para otra IA (continuar desarrollo)

- **Dominio**: stock derivado por **movimientos**; snapshots para **auditoría**.  
- **Frontend**: Next.js App Router; vistas por rol; **Realtime** en inventario.  
- **Backend**: Supabase RPC + vistas; **idempotencia** de ventas; **threshold** para semáforo.  
- **Extensiones**: cierre de evento, transferencias, auth/RLS, reporting avanzado.

---

## 12) Licencia / Créditos

- Tecnologías: Next.js, Supabase, Realtime.  
- Diseño: ver `DESIGN.md` (paleta Elche CF, tarjetas y sombras).  
- Licencia: definir según necesidades del proyecto.
