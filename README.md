# Stock Cantinas — Elche CF

Sistema **PWA offline-first** para la **gestión de inventario y ventas en tiempo real** de cantinas en un estadio de fútbol, construido con **Next.js 16**, **React 19**, **Supabase** y **TanStack Query**.

---

## Índice

1. [Arquitectura general](#1-arquitectura-general)
2. [Funcionalidades por rol](#2-funcionalidades-por-rol)
3. [Sistema de autenticación](#3-sistema-de-autenticación)
4. [PWA y modo offline](#4-pwa-y-modo-offline)
5. [Esquema de base de datos (Supabase)](#5-esquema-de-base-de-datos-supabase)
6. [Estructura del proyecto](#6-estructura-del-proyecto)
7. [Stack tecnológico](#7-stack-tecnológico)
8. [Arranque local](#8-arranque-local)
9. [Variables de entorno](#9-variables-de-entorno)
10. [Guía de diseño](#10-guía-de-diseño)
11. [Troubleshooting](#11-troubleshooting)

---

## 1) Arquitectura general

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  PWA Client │◄───►│  Supabase    │◄───►│  PostgreSQL          │
│  (Next.js)  │ WS  │  Realtime    │     │  (RPC + Vistas)      │
│             │     │              │     │                       │
│  IndexedDB  │     │  PostgREST   │     │  stock_movements      │
│  (cache +   │     │  (API REST)  │     │  inventory_snapshots  │
│   offline   │     │              │     │  sales / sale_items   │
│   queue)    │     │              │     │  cantina_access       │
└─────────────┘     └──────────────┘     └─────────────────────┘
```

**Decisiones clave:**

- **Stock derivado**: el stock actual se **calcula** como la suma de `stock_movements`; nunca se almacena un contador materializado.
- **Idempotencia**: cada venta lleva un `client_request_id` (UUID) para evitar tickets duplicados.
- **Offline-first**: las ventas se encolan en **IndexedDB** cuando no hay conexión y se sincronizan automáticamente al recuperarla.
- **Realtime**: suscripciones WebSocket a `stock_movements` para refrescar inventario y notificaciones al instante.
- **Persistencia de caché**: TanStack Query persiste la caché en IndexedDB (24 h) para arranque instantáneo y resiliencia offline.

---

## 2) Funcionalidades por rol

### 🏪 Rol: Cantina (POS)

Acceso vía `/login` → selección de evento → cantina → PIN.

| Pestaña | Funcionalidad |
|---------|---------------|
| **💰 Venta** | Grid de productos activos · carrito con `+/−/Vaciar` · botón **Cobrar** con UI optimista · carrito móvil deslizable (drawer) · ordenación por SKU |
| **📦 Stock** | Stock actual con semáforo (🟢 OK / 🟡 Bajo / 🔴 Agotado) · **Inventario Inicial** (fijación en lote) · **Ajustes** de stock (tipo: `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `WASTE`, `RETURN`) · **Inventario Final** (sugerido automático con opción de edición manual) |
| **📝 Historial** | Últimas 15 ventas como tarjetas expandibles con detalle de líneas y subtotales |

**Características extra del POS:**
- ☁️ **Modo offline**: ventas se guardan localmente y se sincronizan al volver online.
- 🔔 Indicador de **ventas pendientes** en el header con botón de sincronización manual.
- 🔄 **Realtime**: el inventario se refresca automáticamente vía WebSocket.
- 🚪 **Cerrar sesión** desde el header.

---

### 🔧 Rol: Administrador

Acceso directo vía `/admin`.

| Pestaña | Funcionalidad |
|---------|---------------|
| **⚙️ General** | Editar nombre y fecha del evento |
| **🏪 Cantinas** | Listar cantinas · toggle de asignación al evento · **crear nuevas cantinas** con PIN y asignación inmediata |
| **🛍️ Catálogo** | Gestionar productos del evento: **precio**, **umbral de stock bajo**, **activar/desactivar** · crear productos globales y asignarlos · ordenación por SKU |
| **📦 Inventario** | Selector de cantina · mismas acciones que POS (inicial, ajustes, final) |
| **📈 Panel** | Selector de cantina · **métricas**: tickets, artículos vendidos, facturación (€) · stock por artículo con semáforo y columnas **Inv. Inicial**, **Stock**, **Vendidos** (Inicial − Actual) · ordenación por **SKU** · **historial de ventas** (últimas 15) como tarjetas expandibles · Realtime |
| **🌍 Global** | Vista consolidada del inventario de **todas las cantinas** · **exportación a Excel** desde plantilla personalizada (`plantilla_inventario.xlsx`) |

**Características extra del Admin:**
- 🔔 **Campana de notificaciones** en el header con alertas en tiempo real cuando el stock de un producto cae por debajo del umbral definido. Las alertas son descartables individualmente o en bloque.
- 📊 **Gestión de estados del evento**: cambiar entre `draft` → `live` → `closed` desde la lista de eventos.
- 📱 **Responsive**: navegación por tabs con scroll horizontal en móvil.

---

## 3) Sistema de autenticación

### Flujo de acceso cantina (3 pasos)

```
/login
  ├─ 1. Seleccionar evento (solo los que estén en estado "live")
  ├─ 2. Seleccionar cantina (asignada al evento)
  └─ 3. Introducir PIN de la cantina
        └─ ✅ Redirige a /pos con sesión persistente
```

### Acceso administrador

```
/login → 🔧 Acceso Administración
  └─ Introducir contraseña de administrador
        └─ ✅ Redirige a /admin con sesión (sessionStorage)
```

La contraseña de admin se configura en la variable de entorno **`ADMIN_PASSWORD`** (server-side only, nunca se expone al navegador). La validación se realiza mediante la API route `/api/admin-login`. Las rutas `/admin` y `/admin/[eventId]` están protegidas con `useAdminGuard`.

### PIN por cantina

- Cada cantina tiene **un solo PIN** que funciona en **todos los eventos** (no cambia entre eventos).
- La configuración del PIN se hace **una sola vez** por temporada o al crear la cantina.
- El admin puede activar/desactivar el acceso de una cantina con `toggle_cantina_access`.

### Estados de evento

| Estado | Emoji | Acceso POS | Descripción |
|--------|-------|------------|-------------|
| `draft` | 📝 | ❌ | Planificación |
| `live` | 🟢 | ✅ | Evento activo |
| `closed` | 🔒 | ❌ | Evento finalizado |

### Funciones SQL de autenticación

```sql
-- Configurar/actualizar PIN
SELECT set_cantina_pin('<cantina_id>', '1234', true);

-- Activar/desactivar acceso
SELECT toggle_cantina_access('<cantina_id>', false);

-- Validar acceso
SELECT * FROM validate_cantina_access('<event_id>', '<cantina_id>', '1234');
```

---

## 4) PWA y modo offline

### Progressive Web App

- **Manifest** (`public/manifest.json`): nombre `Cantina POS`, orientación portrait, iconos 192×512.
- **Service Worker**: configurado con `@ducanh2912/next-pwa` + Workbox.
  - Cache agresivo en navegación front-end.
  - Recarga automática al recuperar conexión.
- **Prompt de instalación** (`components/InstallPrompt.tsx`):
  - **Android**: botón directo "Instalar Aplicación".
  - **iOS**: instrucciones visuales paso a paso (Compartir → Añadir a inicio).

### Offline-first (ventas)

```
Venta → ¿Online?
  ├─ SÍ → createSale (RPC) → toast "Venta registrada" ✅
  └─ NO → queueSale (IndexedDB) → toast "Guardado en el dispositivo" ☁️
              └─ Al recuperar conexión → syncQueue automático
```

- Cola de ventas offline almacenada en **IndexedDB** via `idb-keyval`.
- Sincronización automática al detectar evento `online`.
- Botón manual de sync en el header del POS (con contador de pendientes).
- UUID seguro con fallback manual para navegadores antiguos.

### Persistencia de caché

- **TanStack Query** con `PersistQueryClientProvider` respaldado por IndexedDB.
- `staleTime`: 5 min (datos se consideran frescos).
- `gcTime`: 24 h (datos disponibles offline durante un día completo).
- Los productos del catálogo se cachean 30 min; el inventario se refresca en cada consulta.

---

## 5) Esquema de base de datos (Supabase)

### Tablas principales

| Tabla | Columnas clave |
|-------|---------------|
| `events` | `id`, `name`, `date`, `status` (`draft`/`live`/`closed`) |
| `cantinas` | `id`, `name`, `location` |
| `cantina_access` | `cantina_id`, `pin_code`, `is_active` |
| `event_cantinas` | `event_id`, `cantina_id` (PK compuesta) |
| `products` | `id`, `name`, `sku` |
| `event_products` | `event_id`, `product_id` (PK compuesta), `price_cents`, `low_stock_threshold`, `active`, `sort_order` |
| `inventory_snapshots` | `event_id`, `cantina_id`, `product_id`, `kind` (`INITIAL`/`FINAL`), `qty`, `created_at`, `created_by` |
| `stock_movements` | `event_id`, `cantina_id`, `product_id`, `qty`, `type`, `reason`, `created_by`, `created_at` |
| `sales` | `id`, `event_id`, `cantina_id`, `user_id`, `total_items`, `total_cents`, `status` (`OK`/`VOID`), `client_request_id` |
| `sale_line_items` | `sale_id`, `product_id`, `qty`, `unit_price_cents`, `line_total_cents` |

> **Tipos de movimiento** (`stock_movements.type`):
> `INIT` · `SALE` · `ADJUSTMENT` · `TRANSFER_IN` · `TRANSFER_OUT` · `WASTE` · `RETURN`

### Vistas

| Vista | Descripción |
|-------|-------------|
| `v_cantina_inventory` | Stock actual por producto/cantina (derivado de movimientos) |
| `v_sales_by_cantina` | Métricas agregadas de ventas por cantina |

### Funciones RPC (PL/pgSQL)

| Función | Descripción |
|---------|-------------|
| `create_sale` | Crea ticket + líneas + movimientos negativos (`SALE`). Idempotente por `client_request_id` |
| `set_initial_inventory_bulk` | Fija snapshot `INITIAL` + ajuste por diferencia |
| `adjust_stock_bulk` | Entradas/salidas manuales (validación de stock no negativo) |
| `set_final_inventory_bulk` | Fija snapshot `FINAL` editable para cierre |
| `set_cantina_pin` | Configura PIN de acceso de una cantina |
| `toggle_cantina_access` | Activa/desactiva acceso de una cantina |
| `validate_cantina_access` | Valida credenciales de una cantina para un evento |

---

## 6) Estructura del proyecto

```
stock-cantinas/
├── app/
│   ├── layout.tsx                     # Root layout (PWA meta, Inter font, Providers)
│   ├── providers.tsx                  # TanStack Query + IndexedDB persister
│   ├── page.tsx                       # Redirect → /login
│   ├── globals.css                    # CSS base
│   │
│   ├── login/
│   │   ├── page.tsx                   # Flujo 3 pasos (evento → cantina → PIN)
│   │   ├── hooks/useLogin.ts          # Lógica de autenticación
│   │   └── components/
│   │       ├── EventSelector.tsx      # Paso 1: seleccionar evento
│   │       ├── CantinaSelector.tsx    # Paso 2: seleccionar cantina
│   │       └── PinInput.tsx           # Paso 3: introducir PIN
│   │
│   ├── api/
│   │   └── admin-login/route.ts       # API validación contraseña admin
│   │
│   ├── pos/
│   │   ├── page.tsx                   # POS principal (3 pestañas)
│   │   ├── hooks/
│   │   │   ├── usePosSession.ts       # Sesión activa + validación
│   │   │   ├── usePosData.ts          # Productos, inventario, totales (TanStack Query)
│   │   │   ├── useCart.ts             # Estado del carrito
│   │   │   ├── useOfflineSales.ts     # Cola offline (IndexedDB)
│   │   │   └── usePosHistory.ts       # Historial de ventas
│   │   └── components/
│   │       ├── PosHeader.tsx          # Header con sync + logout
│   │       ├── PosSalesTab.tsx        # Grid productos + carrito desktop
│   │       ├── ProductCard.tsx        # Tarjeta de producto individual
│   │       ├── CartSidebar.tsx        # Carrito lateral (desktop)
│   │       ├── MobileCartDrawer.tsx   # Carrito deslizable (móvil)
│   │       ├── PosInventoryTab.tsx    # Gestión de inventario completa
│   │       └── PosHistoryTab.tsx      # Historial de ventas expandible
│   │
│   └── admin/
│       ├── page.tsx                   # Lista de eventos + crear evento + gestión de estado
│       ├── [eventId]/page.tsx         # Detalle evento (6 pestañas)
│       ├── hooks/
│       │   ├── useAdminEvents.ts      # CRUD eventos + cambio de estado
│       │   ├── useAdminEvent.ts       # Datos de un evento
│       │   ├── useAdminCantinas.ts    # Gestión cantinas + asignación
│       │   ├── useAdminCatalog.ts     # Gestión catálogo productos
│       │   ├── useAdminInventory.ts   # Inventario desde admin
│       │   ├── useAdminMetrics.ts     # Métricas panel + historial ventas + vendidos
│       │   ├── useStockNotifications.ts # Alertas de stock bajo (Realtime)
│       │   └── useAdminGuard.ts       # Protección de rutas admin (sesión)
│       └── components/
│           ├── AdminHeader.tsx        # Header con navegación + NotificationBell
│           ├── CreateEventForm.tsx    # Formulario nuevo evento
│           ├── EventsList.tsx         # Lista eventos con selector de estado
│           ├── EventGeneralTab.tsx    # Tab: editar evento
│           ├── EventCantinasTab.tsx   # Tab: gestión cantinas
│           ├── EventCatalogTab.tsx    # Tab: catálogo productos
│           ├── EventInventoryTab.tsx  # Tab: inventario por cantina
│           ├── EventPanelTab.tsx      # Tab: métricas + historial ventas
│           ├── EventGlobalTab.tsx     # Tab: inventario global + exportar Excel
│           └── NotificationBell.tsx   # Campana de notificaciones in-app
│
├── components/
│   └── InstallPrompt.tsx              # Prompt de instalación PWA (iOS/Android)
│
├── hooks/
│   └── useLiveInventory.ts            # Suscripción Realtime a stock_movements
│
├── lib/
│   ├── supabaseClient.ts             # Cliente Supabase (createClient)
│   ├── sales.ts                       # RPC create_sale con UUID seguro
│   └── exportUtils.ts                 # Exportación Excel desde plantilla
│
├── database/
│   └── migrations/
│       ├── update_cantina_auth_single_pin.sql  # Migración PIN único
│       └── setup_single_pin_credentials.sql    # Script configuración PINs
│
├── public/
│   ├── manifest.json                  # Manifest PWA
│   ├── sw.js                          # Service Worker
│   ├── plantilla_inventario.xlsx      # Plantilla Excel para exportación
│   ├── android-chrome-*.png           # Iconos PWA
│   └── apple-touch-icon.png           # Icono iOS
│
├── DESIGN.md                          # Guía de diseño (paleta Elche CF)
├── tailwind.config.ts                 # Configuración Tailwind (tokens Elche CF)
├── next.config.ts                     # Configuración Next.js + PWA
└── package.json
```

---

## 7) Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Framework** | Next.js (App Router) | 16.x |
| **UI** | React | 19.x |
| **Estilos** | Tailwind CSS | 4.x |
| **Tipografía** | Inter (Google Fonts) | — |
| **Backend** | Supabase (PostgREST + RPC + Realtime) | — |
| **State management** | TanStack React Query | 5.x |
| **Persistencia offline** | `idb-keyval` + TanStack Persist | — |
| **PWA** | `@ducanh2912/next-pwa` + Workbox | — |
| **Exportación** | ExcelJS + FileSaver | — |
| **Notificaciones UI** | react-hot-toast | — |
| **Lenguaje** | TypeScript | 5.x |

---

## 8) Arranque local

### Requisitos previos

- **Node.js** 18+
- Proyecto **Supabase** operativo con tablas, vistas y funciones RPC creadas
- **Realtime** activado en la tabla `stock_movements` (Database → Replication → Realtime)

### Instalación

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd stock-cantinas

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Ejecutar en desarrollo
npm run dev
```

### Configurar base de datos

```bash
# 1. Ejecutar las migraciones en Supabase SQL Editor:
#    - database/migrations/update_cantina_auth_single_pin.sql
#    - database/migrations/setup_single_pin_credentials.sql

# 2. Configurar un PIN para la cantina (ejemplo)
SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina Norte'),
  '1234',
  true
);

# 3. Cambiar estado del evento a "live"
UPDATE events SET status = 'live' WHERE name = 'Jornada 1';
```

### Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/login` | Login cantina (3 pasos) |
| `/pos` | Punto de Venta (requiere sesión) |
| `/admin` | Panel de administración |
| `/admin/[eventId]` | Detalle de un evento (6 pestañas) |

---

## 9) Variables de entorno

Crear **`.env.local`** en la raíz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>

# Contraseña para acceso admin (server-side only)
ADMIN_PASSWORD=tu-contraseña-admin
```

> ⚠️ Requiere reiniciar `npm run dev` tras cambios en `.env.local`.

---

## 10) Guía de diseño

El diseño está basado en los colores oficiales del **Elche CF**, definidos como tokens en Tailwind:

| Token | Color | Uso |
|-------|-------|-----|
| `elche-primary` | `#00964f` | Verde principal |
| `elche-secondary` | `#007a3d` | Verde oscuro (hover, gradientes) |
| `elche-accent` | `#20b368` | Verde claro/brillante |
| `elche-bg` | `#f5f9f7` | Fondo general |
| `elche-surface` | `#ffffff` | Fondo tarjetas |
| `elche-text` | `#1a2e1f` | Texto principal |
| `elche-text-muted` | `#4a5f52` | Texto secundario |
| `elche-border` | `#e8f4ee` | Bordes |
| `elche-warning` | `#fbbf24` | Stock bajo (ámbar) |
| `elche-danger` | `#ef4444` | Agotado / Error |

**Convenciones**:
- Bordes redondeados: 8px → 24px según nivel de componente.
- Headers con gradiente `from-elche-primary to-elche-secondary`.
- Semáforo de stock: 🟢 OK (`≥ umbral`) · 🟡 Bajo (`< umbral`) · 🔴 Agotado (`= 0`).
- Emojis como iconografía funcional.

Ver [`DESIGN.md`](DESIGN.md) para la guía completa.

---

## 11) Troubleshooting

| Problema | Solución |
|----------|----------|
| Semáforo no cambia | Activar Realtime en `stock_movements`; verificar `useLiveInventory` |
| Historial de ventas vacío | Verificar relación `sale_line_items` y filtros `event_id`/`cantina_id` |
| Variables `NEXT_PUBLIC_*` undefined | Definir en `.env.local` (sin comillas) y reiniciar dev server |
| RLS bloquea inserts | Revisar políticas y claims; en desarrollo desactivar temporalmente |
| Ventas offline no sincronizan | Verificar IndexedDB en DevTools; usar botón de sync manual en header |
| PWA no muestra prompt de instalación | Verificar HTTPS (o localhost); revisar `manifest.json` |
| Exportación Excel no funciona | Verificar que `public/plantilla_inventario.xlsx` existe |

---

## Licencia / Créditos

- **Tecnologías**: Next.js, React, Supabase, TanStack Query, Tailwind CSS.
- **Diseño**: inspirado en los colores del Elche CF (ver [`DESIGN.md`](DESIGN.md)).
- **Licencia**: definir según necesidades del proyecto.
