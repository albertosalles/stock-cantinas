# Design System — Stock Cantinas · Elche CF

Guía para replicar el diseño del panel Admin en las siguientes partes del proyecto (**POS** y **Usuario**). Todo el trabajo vive en Design Components (`.dc.html`) con estilos **inline** (nada de clases CSS ni hojas de estilo).

---

## 1. Fundamentos

### Tipografía
- **Fuente UI:** `Inter` (pesos 400/500/600/700/800). `font-family:'Inter',system-ui,sans-serif`.
- **Iconos:** `Material Symbols Rounded` vía clase `.ms`. Se usan con `<span class="ms" style="font-size:..;color:..">nombre_icono</span>`.
  - Para icono relleno: `font-variation-settings:'FILL' 1`.
- Enlaces (`<head>` global): `a{color:#00964f}` · `a:hover{color:#007a3d}`.

Cargar en `<helmet>` de cada DC:
```
Inter:wght@400;500;600;700;800
Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,0
```

### Escala de texto (px)
| Uso | Tamaño / peso |
|---|---|
| Título de página (`h1`) | 19 / 800, `letter-spacing:-.02em` |
| Título de sección (`h2`) | 21 / 800, `-.02em` |
| Título de tarjeta/bloque (`h3`) | 14.5–15 / 800, `-.01em` |
| Valor KPI grande | 18–24 / 800, `-.02em` |
| Texto cuerpo | 12.5–13.5 / 500–700 |
| Etiqueta / eyebrow | 9.5–11 / 700, `letter-spacing:.06–.1em`, `text-transform:uppercase` |
| Micro (timestamps) | 10 / 700 |

### Paleta
| Token | Hex | Uso |
|---|---|---|
| Verde primario | `#00964f` | acciones, acentos, activo |
| Verde hover | `#007a3d` | hover de primario |
| Verde claro (tinte) | `rgba(0,150,79,.09–.12)` | fondos de acento, pills |
| Verde brillante | `#20b368` | gradientes de logo/avatar |
| Verde oscuro sidebar | `linear-gradient(180deg,#0d3a23,#082a1b)` | fondo del sidebar |
| Texto principal | `#1a2e1f` | titulares, valores |
| Texto secundario | `#4a5f52` | cuerpo |
| Texto atenuado | `#8aa397` | etiquetas, metadatos |
| Texto muy atenuado | `#94a39a` / `#b3c1b9` | placeholders, estados vacíos |
| Fondo app | `#f5f9f7` | lienzo general |
| Fondo sutil (filas/inputs) | `#f7fbf9` / `#f9fcfb` | cabeceras de tabla, inputs |
| Superficie | `#fff` | tarjetas |
| Borde | `#e8f4ee` | bordes de tarjeta |
| Borde input | `#e0efe7` | inputs, botones secundarios |
| Divisor interno | `#f0f6f2` / `#f6faf8` | separadores dentro de tarjeta |

### Colores semánticos (estados de stock / incidencias)
| Estado | fg | bg | borde | icono |
|---|---|---|---|---|
| OK / correcto | `#2a6b45` | `#eef6f1` | `#dcefe4` | `check_circle` |
| Aviso / bajo mínimo | `#b0790a` | `#fff7e6` | `#f3d78f` | `warning` |
| Agotado | `#d63838` | `#fdecec` | `#f5b5b5` | `error` |
| Info / neutro | `#6b7d72` | `#f0f4f2` | `#dde5e0` | `info` |
| Naranja alerta (header) | `#f59e0b` | `#fff7ed` | — | `report` |

### Regla de umbral de stock

> **Revisada (2026-07-26).** La versión original de este documento definía
> `bajo = actual <= threshold`; `aviso = actual <= threshold*2`; resto OK.
> Se sustituye por la regla de abajo por decisión de producto: el rojo se
> reserva a "agotado" y el ámbar pasa a significar "ha llegado al mínimo
> fijado por el administrador".

```
actual <= 0                          → AGOTADO      (rojo)
threshold > 0 && actual <= threshold → BAJO MÍNIMO  (ámbar)
resto                                → OK           (verde)
```

Dos conceptos deliberadamente separados:

- **Agotado es un hecho.** No depende de configuración: si no quedan unidades
  se marca en rojo, tenga umbral definido o no.
- **Bajo mínimo es una decisión del administrador.** Requiere un umbral
  explícito por producto (`event_products.low_stock_threshold`).

**`threshold = 0` significa "sin umbral definido"**, no "avisar al agotarse":
es el valor por defecto en la base de datos. Sin umbral no hay banda ámbar
ni notificación — pero el agotado se sigue viendo en rojo.

**Notificaciones al administrador:** sólo las disparan los productos con
umbral definido (`> 0`) que caen a ese umbral o por debajo. Un producto
agotado sin umbral se ve en rojo pero **no** notifica.

Implementación única en `lib/adminUi.ts` → `stockLevel(qty, threshold)`
(`'out' | 'warn' | 'ok'`); el POS lo traduce en `lib/posUi.ts` →
`posStockState()`. La condición de notificación es `hasThreshold()`.

### Forma y elevación
- **Radios:** tarjeta grande `16px`; tarjeta media `13–15px`; botón/input `9–11px`; chip/pill `8px` o `20px` (pastilla); avatar/icono cuadro `10–14px`; switch `20px`.
- **Iconos-cuadro:** 32–52px, `border-radius:9–14px`, fondo tinte o gradiente, icono blanco/color centrado.
- **Sombras:** tarjeta hover `0 10px 26px rgba(16,40,26,.1)`; botón primario `0 3px 10px rgba(0,150,79,.28)`; logo `0 4px 12px rgba(0,150,79,.35)`.
- **Espaciado:** padding de tarjeta 15–20px; gap de grid 12–18px; padding de main `28px`.

### Animaciones (keyframes en `<helmet>`)
```css
@keyframes sc-pulse{0%,100%{opacity:1}50%{opacity:.35}}   /* punto "en vivo" */
@keyframes sc-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}  /* entrada de vista */
```
Cada vista raíz usa `animation:sc-fade .3s ease` y `max-width:1440px;margin:0 auto`.

---

## 2. Componentes clave (patrones inline reutilizables)

### Botón primario
```
display:flex;align-items:center;gap:7px;padding:9px 15px;background:#00964f;border:none;
border-radius:11px;font-size:13px;font-weight:600;color:#fff;cursor:pointer;
box-shadow:0 3px 10px rgba(0,150,79,.28)   /* hover: background:#007a3d */
```
### Botón secundario
```
padding:9px 14px;background:#f5f9f7;border:1px solid #e8f4ee;border-radius:11px;
font-size:13px;font-weight:700;color:#4a5f52;cursor:pointer   /* hover: background:#eef6f1 */
```
### Botón-icono (header/toolbar)
```
width:40px;height:40px;border-radius:11px;background:#f5f9f7;border:1px solid #e8f4ee;
display:flex;align-items:center;justify-content:center;color:#4a5f52   /* hover: color:#00964f */
```
Badge de contador: absoluto, `top:-4px;right:-4px`, fondo semántico, `border:2px solid #fff`.

### Pill / badge de estado
```
display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;
padding:4px 10px;border-radius:20px;color:<fg>;background:<bg>
```
Con punto: `<span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span>`. Añadir `animation:sc-pulse` al punto para "en vivo".

### Chip de dato (stock por producto)
```
display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;
padding:4px 9px;border-radius:8px;color:<sem.fg>;background:<sem.bg>;border:1px solid <sem.bd>
```
Contenido: `<span class="ms" style="font-size:14px">{{icon}}</span>{{nombre}} · {{cantidad}}`.

### Switch (toggle) — helper de lógica
```js
switchStyles(on){
  return {
    track:'width:46px;height:27px;border-radius:20px;border:none;cursor:pointer;position:relative;flex:none;transition:background .18s;padding:0;background:'+(on?'#00964f':'#d3ddd7')+';',
    knob:'position:absolute;top:3px;left:'+(on?'22px':'3px')+';width:21px;height:21px;border-radius:50%;background:#fff;transition:left .18s;box-shadow:0 1px 3px rgba(0,0,0,.22);',
  };
}
```
Markup: `<button onClick="{{ onToggle }}" style="{{ switchTrack }}"><span style="{{ switchKnob }}"></span></button>`.
Si el switch va dentro de una tarjeta clicable, el handler debe hacer `e.stopPropagation()`.

### Tarjeta KPI
```
background:#fff;border:1px solid #e8f4ee;border-radius:15px;padding:16px 17px
```
Estructura: icono-cuadro (tinte) arriba → valor 18–24/800 → etiqueta uppercase atenuada. El color del valor puede heredar el semántico (verde recaudación, rojo incidencias).

### Tarjeta enlace (patrón "tarjeta = enlace", preferido sobre botón)
La tarjeta entera es clicable (`onClick="{{ onOpen }}";cursor:pointer`, hover `transform:translateY(-2px)` + sombra). El acceso se indica con **texto**, no botón:
```
<span style="display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:700;color:#00964f">
  Ver detalle<span class="ms" style="font-size:17px">arrow_forward</span>
</span>
```
Acciones secundarias dentro de la tarjeta (p. ej. QR) son botones-icono planos (`background:none;border:none`) que hacen `stopPropagation`.

### Tabla
- Contenedor: tarjeta `border-radius:16px;overflow:hidden`, con `<div style="overflow-x:auto">` y `min-width` en la tabla.
- `thead tr`: `background:#f7fbf9`; `th` etiqueta uppercase 10–10.5/700 atenuada.
- `tr`: `border-top:1px solid #f0f6f2`, hover `background:#fafcfb`.
- Celda de producto: icono-cuadro 32–34px + nombre 13/700 + subtexto atenuado.
- Inputs numéricos en celda: ver más abajo.
- Leyenda al pie con cuadros de color semánticos.

### Input / select
```
padding:7–8px 10–11px;border:1px solid #e0efe7;border-radius:8–9px;font-size:12.5–13px;
font-weight:600–700;font-family:inherit;color:#1a2e1f;background:#f9fcfb;outline:none
/* focus: border-color:#00964f;background:#fff */
```
Numéricos suelen ir `text-align:center` con ancho fijo (58–82px).

### Estado vacío
Centrado, icono grande atenuado (`#bfe3cf`) + título 12.5/700 + descripción 11/600 atenuada. Ej.: incidencias resueltas → `verified` "Sin incidencias".

---

## 3. Estructura de layout (shell)

```
div flex height:100vh
├─ aside  (sidebar verde oscuro, ancho 256px / 76px colapsado, transición .25s)
│   ├─ marca (logo gradiente + título)
│   ├─ botón "volver" contextual
│   ├─ label de sección uppercase
│   ├─ nav (items con icono + label; activo: fondo tinte + barra izq #4be08f)
│   └─ footer (colapsar / cerrar sesión)
└─ main  (flex column, overflow hidden)
    ├─ header (66px, blanco, título + estado + acciones + perfil)
    └─ div scroll (padding 28px)  → una vista por <sc-if>, max-width:1440px centrado
```

### Item de nav — helpers
- Base: `display:flex;gap:13px;padding:10px 13px;border-radius:11px;font-size:13.5px;font-weight:600`.
- Activo: `background:rgba(32,179,104,.16);color:#eafff3;box-shadow:inset 3px 0 0 #4be08f`.
- Inactivo: `color:rgba(233,255,240,.62)`.
- Icono activo: color `#4be08f` + `FILL 1`; inactivo `rgba(233,255,240,.5)`.
- Colapsado: `gap:0;justify-content:center` y sin labels (envueltos en `<sc-if notCollapsed>`).

---

## 4. Convenciones de arquitectura (DC)

- **Un solo DC** por pantalla-shell; las vistas se conmutan con flags `show*` calculadas en `renderVals()` y envueltas en `<sc-if>`.
- **Navegación por estado**, no por rutas: `state.view` (landing/event…), `state.tab`, y sub-vistas como `state.cantinaView` (id o `null`). Patrón:
  - `showXList: enContexto && tab==='x' && !state.detailId`
  - `showXDetail: enContexto && tab==='x' && !!state.detailId`
- **Estilos calculados en la lógica** cuando dependen de estado (variantes, semántico); los estilos estáticos van inline en el template para que pinte durante el streaming. Nunca meter tokens de tema en `{{ holes }}`.
- **Datos derivados y handlers** se exponen por nombre desde `renderVals()` (objetos por fila con `onX` incluidos). Listas con `<sc-for list as hint-placeholder-count>`; condicionales con `<sc-if hint-placeholder-val>`.
- **Ediciones en vivo** sobre `state` (p. ej. mapa `invOverrides` con clave `cid|pid|campo`; sets como `resolvedIncidents`). La persistencia real se conecta luego al backend.
- **Helpers de formato** en la clase: `eur(cents)` → "1.234,56 €"; `eurShort(cents)` → "1.234 €" ó "—". Números con `toLocaleString('es-ES')`.
- Idioma: **español**. Moneda **EUR** formato es-ES. Emojis: no en UI (labels, botones, estados) — **excepción**: los nombres de producto del POS sí llevan emoji (`Agua 💧`, `Cerveza 🍺`) como identificador visual rápido en barra.

---

## 5. Receta específica para POS y Usuario

Reutiliza el mismo shell, paleta y componentes. Sugerencias de aplicación:

- **POS (operación en barra):** priorizar objetivos táctiles grandes (mín. 44px), grid de productos como tarjetas-enlace, ticket/carrito lateral, botones primarios verdes prominentes. Estados de stock con los colores semánticos ya definidos. Cabecera con cantina activa + camarero en turno (pill "en vivo" con `sc-pulse`).
- **Usuario (cliente):** misma tipografía y verde de marca; tono más ligero y espacioso. Tarjetas-enlace para categorías/productos, chips de precio, pill de disponibilidad. Reaprovechar KPI/estado-vacío para "pedido vacío", confirmaciones, etc.
- Mantén: `max-width` centrado por vista, `sc-fade` al entrar, radios y sombras de esta guía, y el patrón **tarjeta = enlace con texto "→"** en lugar de botón cuando la tarjeta entera navega.

> Referencia viva de todos estos patrones: `Admin Elche CF.dc.html` (secciones Landing, Dashboard, Cantinas lista/detalle, Catálogo, Global).

---

## 6. Contrato de tokens (nombres canónicos)

Esta es la **fuente de verdad** para la adaptación final. En producción, decláralos una vez (variables CSS) y consúmelos por nombre; en el mockup se escriben inline pero SIEMPRE con estos valores exactos. Si un valor no está aquí, no se inventa: se añade aquí primero.

### Color
```
--c-primary:        #00964f
--c-primary-hover:  #007a3d
--c-primary-tint:   rgba(0,150,79,.10)   /* rango permitido .09–.12 */
--c-primary-bright: #20b368              /* gradientes logo/avatar */
--c-sidebar:        linear-gradient(180deg,#0d3a23,#082a1b)
--c-sidebar-accent: #4be08f              /* barra activa + icono activo nav */

--c-text:           #1a2e1f
--c-text-2:         #4a5f52
--c-text-muted:     #8aa397
--c-text-faint:     #b3c1b9
--c-placeholder:    #94a39a

--c-bg:             #f5f9f7
--c-surface:        #ffffff
--c-surface-sub:    #f9fcfb              /* inputs; filas alt #f7fbf9 */
--c-border:         #e8f4ee              /* borde tarjeta */
--c-border-input:   #e0efe7
--c-divider:        #f0f6f2

/* Semánticos (fg / bg / border) */
--c-ok:      #2a6b45 / #eef6f1 / #dcefe4     icon check_circle
--c-warn:    #b0790a / #fff7e6 / #f3d78f     icon warning
--c-crit:    #d63838 / #fdecec / #f5b5b5     icon error
--c-info:    #6b7d72 / #f0f4f2 / #dde5e0     icon info
--c-alert:   #f59e0b / #fff7ed             icon report (header)
```

### Espaciado / forma / elevación
```
--sp-1:6  --sp-2:8  --sp-3:12  --sp-4:15  --sp-5:18  --sp-6:20  --sp-main:28

--r-card:16  --r-card-md:14  --r-input:9  --r-btn:11  --r-chip:8  --r-pill:20

--sh-card-hover:  0 10px 26px rgba(16,40,26,.10)
--sh-btn:         0 3px 10px rgba(0,150,79,.28)
--sh-logo:        0 4px 12px rgba(0,150,79,.35)

--font-ui: 'Inter',system-ui,sans-serif
```

### Escala tipográfica (nombre → px/peso)
```
--t-h1:19/800   --t-h2:21/800   --t-h3:14.5/800
--t-kpi:22/800  --t-body:13/600 --t-body-strong:13/700
--t-label:10.5/700(up,.08em)    --t-micro:10/700
```

## 7. Matriz de estados por componente

Contrato de interacción — todo componente adaptado debe reproducir estas transiciones. Transición estándar: `transition:.16s ease` (color/fondo/sombra); `transform` solo en `translateY`/`scale`.

| Componente | Reposo | Hover | Activo/Pressed | Deshab./Otro |
|---|---|---|---|---|
| Botón primario | bg `--c-primary`, sombra `--sh-btn` | bg `--c-primary-hover` | `translateY(1px)`, sombra reducida | opacity .5, `cursor:not-allowed` |
| Botón secundario | bg `--c-bg`, borde `--c-border` | bg `#eef6f1` | `translateY(1px)` | opacity .5 |
| Botón-icono | fg `--c-text-2` | fg `--c-primary` | bg `#eef6f1` | badge contador top/right |
| Tarjeta-enlace | sombra 0, `translateY(0)` | `translateY(-2px)` + `--sh-card-hover` | `translateY(-1px)` | texto "→" siempre visible |
| Tarjeta producto (POS) | borde `--c-border` | `translateY(-2px)`+sombra | `scale(.97)` táctil | agotado: opacity .55, sin tap |
| Item nav | fg `.62` | fg `.85` + bg `.06` | bg `.16`+barra `--c-sidebar-accent` | colapsado: sin label |
| Chip stock | según semántico | — | — | 3 niveles: ok / warn (bajo mínimo) / out (agotado) |
| Pill "en vivo" | punto + `sc-pulse` | — | — | — |
| Switch | track `#d3ddd7` | — | track `--c-primary`, knob →22px | `stopPropagation` en tarjeta |
| Input/select | borde `--c-border-input`, bg `--c-surface-sub` | — | focus: borde `--c-primary`, bg `#fff` | error: borde `--c-crit` |
| Stepper (±) | botón cuadro borde input | fg `--c-primary` | `scale(.9)` | min: −deshab. |

### Reglas táctiles (POS, obligatorio)
- Objetivo mínimo **44×44px** en cualquier control operable en barra.
- Feedback inmediato al toque: `scale(.97)` con `transition:.1s` (no depende de hover en táctil).
- Grid de productos: `contain:content` por tarjeta; sin blur/sombras pesadas repetidas en listas largas.
