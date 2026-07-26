# Handoff: Stock Cantinas — Elche CF (Admin + POS)

## Overview
Sistema de gestión de stock y venta en cantinas para eventos del Elche CF. Dos aplicaciones que comparten el mismo sistema de diseño:

- **Admin** (escritorio/tablet): panel de gestión por evento — dashboard, personal/camareros, cantinas (lista + detalle), catálogo de productos e inventario global.
- **POS** (móvil, camarero en barra): venta con grid de productos + ticket, stock (Actual / Inicial / Ajustes / Final) e historial de tickets del día.

## About the Design Files
Los ficheros de este paquete son **referencias de diseño hechas en HTML** — prototipos que muestran el aspecto y el comportamiento deseados, **no** código de producción para copiar tal cual. Están escritos como "Design Components" (un formato de prototipado con estilos inline y una pequeña capa de lógica); su valor está en la **fidelidad visual y de interacción**, no en su arquitectura.

La tarea es **recrear estos diseños en el entorno del proyecto destino** (React, Vue, Svelte, SwiftUI, etc.) usando sus patrones y librerías ya establecidos. Si aún no existe un entorno, elige el framework más adecuado (recomendación: **React + TypeScript**, dado que la lógica de estado ya está expresada en clases con `state`/`renderVals`) e impleméntalo allí. En producción, **declara los tokens una sola vez** (variables CSS o tema) y consúmelos por nombre — el prototipo los escribe inline por restricciones de la herramienta, no como recomendación.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado, radios, sombras e interacciones son definitivos. Recrea la UI de forma fiel al pixel usando las librerías/patrones del codebase. `design.md` (incluido) es el **contrato**: paleta, escala tipográfica, tokens canónicos (§6) y matriz de estados por componente (§7). Si un valor no aparece en `design.md`, no se inventa — se añade primero allí.

---

## Screens / Views

### ADMIN — shell
- **Layout**: `display:flex; height:100vh`. Izquierda `aside` sidebar (256px expandido / 76px colapsado, transición `.25s`, fondo `linear-gradient(180deg,#0d3a23,#082a1b)`). Derecha `main` en columna: header 66px blanco + zona scroll `padding:28px` con una vista por `<sc-if>`, cada una `max-width:1360–1440px; margin:0 auto; animation:sc-fade .3s`.
- **Nav sidebar**: marca (logo gradiente + título) → botón "volver" contextual → label de sección → items (icono+label; activo = fondo `rgba(32,179,104,.16)`, texto `#eafff3`, barra izquierda `inset 3px 0 0 #4be08f`, icono `#4be08f` con `FILL 1`) → footer (colapsar / cerrar sesión).
- **Navegación por estado** (no rutas): `state.view` (landing/event), `state.tab` (dashboard/personal/cantinas/catalogo/global), `state.cantinaView` (id o null).

Vistas Admin:
- **Landing** (`isLanding`): selección de evento.
- **Dashboard** (`showDashboard`): KPIs del evento + ranking de cantinas.
- **Personal / Camareros** (`showPersonal`): lista de camareros, alta inline (`showAdd`), asignación a cantina vía select, switch activo/inactivo.
- **Cantinas — lista** (`showCantinasList`): tarjetas-enlace de cantinas (asignadas / sin asignar).
- **Cantina — detalle** (`showCantinaDetail` + `cantinaView`): KPIs, personal y stock de la cantina.
- **Catálogo** (`showCatalogo`): productos con filtro por categoría, edición inline de precio/umbral, switches activo/destacado.
- **Global** (`showGlobal`): inventario agregado de todas las cantinas.

### POS — shell (móvil)
- **Layout**: maqueta dentro de bezel de teléfono; la app real es la pantalla interior `background:#f5f9f7; display:flex; flex-direction:column; overflow:hidden`. Bloques: status bar (52px) → header verde (identidad + acciones) → contenido por pestaña → barras fijas inferiores contextuales.
- **Header** (verde `linear-gradient(158deg,#0aa85a,#00854a)`): `h1` = cantina activa (20px/800, blanco); debajo avatar-inicial + nombre camarero; a la derecha botón Incidencias (icono `warning` ámbar + badge contador) y botón Menú (abre cajón lateral derecho). Bajo la fila, línea de evento (12.5px, blanco .82).
- **Pestañas** (vía cajón lateral, `state.tab`): `venta`, `stock`, `historial`.

Vistas POS:
- **Venta** (`showVenta`): chips de categoría scrollables (activo = verde relleno) + grid de productos (2/3 columnas, prop `columns`). Cada tarjeta: nombre (con emoji identificador), precio verde 17/800, punto de color + "Stock: N", badge de cantidad flotante `top:-7px;right:-7px` con `animation:pop` al añadir. Tap = añadir (feedback `cardtap`). Barra de cobro **colapsable** (solo con productos): botón Vaciar + botón "Ver carrito" con contador y total → abre sheet.
- **Ticket / Cobro** (bottom sheet, `sheetOpen`): líneas con stepper ±, selector de método (Efectivo/Tarjeta), total grande, "Confirmar cobro". Estado vacío incluido.
- **Stock** (`showStock`): segmented control de 4 sub-modos:
  - **Actual** (`showStockActual`): 2 KPIs (Productos / A reponer) + filas con barra de progreso, valor grande y pill de estado (OK/Reponer/Agotado).
  - **Inicial** (`showStockInicial`): fija unidades de partida; filas con stepper + input; **autosave** (edición en vivo sobre `initialDraft`, permite conteo simultáneo de varios camareros).
  - **Ajustes** (`showStockAjustes`): selector de tipo (Ajuste/Entrada/Salida/Merma/Devolución, con dirección ±), filas con preview de resultado `±N → total`, botón "Aplicar ajustes".
  - **Final** (`showStockFinal`): recuento de cierre; sugerido = stock actual; delta Δ por fila; "Cerrar inventario".
- **Historial** (`showHistorial`): tickets del día con icono por método, total, artículos y hora.
- **Cajón lateral** (`drawerOpen`, entra desde la derecha): cabecera con perfil, navegación de secciones (check en la activa), y footer con "Refrescar datos" + "Cerrar sesión".

---

## Interactions & Behavior
- **Navegación**: por estado, no rutas. Cambiar pestaña/vista conmuta flags `show*` calculadas en `renderVals()`.
- **Añadir producto (POS)**: `add(id)` incrementa `cart[id]`, dispara `pulse` 300ms (`cardtap` en la tarjeta, `pop` en el badge).
- **Carrito**: `inc`/`dec`/`clearCart`; sheet con steppers; "Confirmar cobro" vacía el carrito (en producción: registrar venta).
- **Stock drafts**: `initialDraft`/`adjustDraft`/`finalDraft` son mapas por `id`. `setDraft` (input) y `stepDraft` (±) editan en vivo. Inicial = autosave; Ajustes/Final tienen botón de commit.
- **Animaciones/keyframes**: `sc-fade` (entrada de vista, `.3s`), `sc-pulse` (punto "en vivo"), `cardtap` (scale .93), `pop` (badge), `sheetup` (bottom sheet, `.28s cubic-bezier(.22,1,.36,1)`), `drawerin` (cajón, `.26s` misma curva), `fadein` (overlays, `.2s`).
- **Estados**: reposo/hover/activo/deshabilitado según §7 de `design.md`. Transición estándar `.16s ease`; `transform` solo `translateY`/`scale`.
- **Táctil (POS)**: objetivo primario mín. 44×44; feedback inmediato al toque (no depende de hover). Steppers densos son excepción compacta (~36px).

## State Management
Cada app es un componente con estado local. Variables clave:

**Admin**: `view`, `tab`, `selectedEventId`, `cantinaView`, `catFilter`, `products[]`, `waiters[]`, `cantinas[]`, `showAdd`, `newName`, `newSurname`. Derivados: KPIs, ranking, cards de cantina, asignaciones de personal.

**POS**: `tab` ('venta'|'stock'|'historial'), `cat`, `cart{}`, `sheetOpen`, `pay`, `drawerOpen`, `pulse`, `stockMode` ('actual'|'inicial'|'ajustes'|'final'), `adjType`, `initialDraft{}`, `adjustDraft{}`, `finalDraft{}`.

**Data fetching (a conectar en producción)**: eventos, cantinas, camareros, catálogo de productos, stock por cantina, historial de ventas. Las ediciones de stock (inicial/ajustes/final) y las ventas deben persistir al backend; el prototipo solo muta estado local. Inicial usa autosave por campo para permitir conteo concurrente.

## Design Tokens
Fuente de verdad completa en `design.md` §6 (tokens) y §1 (fundamentos). Resumen:

**Color**: primario `#00964f`, hover `#007a3d`, tinte `rgba(0,150,79,.10)`, brillante `#20b368`, sidebar `linear-gradient(180deg,#0d3a23,#082a1b)`, acento sidebar `#4be08f`. Texto `#1a2e1f` / `#4a5f52` / `#8aa397` / `#b3c1b9`. Fondos: app `#f5f9f7`, superficie `#fff`, sutil `#f9fcfb`. Bordes: tarjeta `#e8f4ee`, input `#e0efe7`, divisor `#f0f6f2`.
**Semánticos** (fg/bg/border): OK `#2a6b45`/`#eef6f1`/`#dcefe4`; Bajo mínimo `#b0790a`/`#fff7e6`/`#f3d78f`; Agotado `#d63838`/`#fdecec`/`#f5b5b5`; Info `#6b7d72`/`#f0f4f2`/`#dde5e0`.
**Umbral de stock**: agotado (`0`) → rojo siempre; `<= umbral` definido por el administrador → ámbar; resto OK. Los umbrales fijos `≤5`/`≤15` del prototipo **no** se usan: sin umbral definido no hay banda ámbar ni notificación. Ver `design.md` §1 "Regla de umbral de stock".
**Radios**: tarjeta 16, media 13–15, botón/input 9–11, chip 8, pill 20. **Sombras**: tarjeta hover `0 10px 26px rgba(16,40,26,.1)`, botón `0 3px 10px rgba(0,150,79,.28)`. **Espaciado**: padding tarjeta 15–20, gap grid 12–18, padding main 28.
**Tipografía**: `Inter` 400–800; escala en `design.md` (h1 19/800, h2 21/800, h3 14.5/800, KPI 18–24/800, cuerpo 12.5–13.5, label 9.5–11 uppercase, micro 10).

## Assets
- **Fuente UI**: Inter (Google Fonts).
- **Iconos**: Material Symbols Rounded (Google Fonts), clase `.ms`. Relleno con `font-variation-settings:'FILL' 1`. En producción, sustituir por la librería de iconos del codebase mapeando por nombre (los nombres usados son de Material Symbols).
- **Emojis**: los nombres de producto del POS incluyen emoji como identificador visual (`Agua 💧`, `Cerveza 🍺`) — es intencional, mantener.
- No hay imágenes de bitmap; todo es tipografía + iconos de fuente + CSS.

## Files
- `POS Elche CF.dc.html` — app POS móvil (venta, stock 4 modos, historial, ticket, cajón).
- `Admin Elche CF.dc.html` — panel Admin (landing, dashboard, personal, cantinas lista/detalle, catálogo, global).
- `design.md` — sistema de diseño completo: fundamentos, componentes, layout, convenciones, contrato de tokens (§6) y matriz de estados (§7).

> Para abrir los `.dc.html` como referencia visual basta un navegador. La lógica está en el `<script data-dc-script>` al final de cada archivo (clase `Component` con `state` + `renderVals()`), legible como especificación de comportamiento.
