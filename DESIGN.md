# Guía de Diseño - Stock Cantinas Elche CF

> ⚠️ **Documento histórico — no es el contrato vigente.**
> Describe la interfaz anterior al rediseño (POS con pestañas
> "Venta / Inventario / Ventas", cabecera verde con gradiente horizontal).
> El sistema de diseño en vigor es **[`docs/design.md`](docs/design.md)**
> (tokens §6 y matriz de estados §7); el recorrido de pantallas está en
> [`docs/design-handoff.md`](docs/design-handoff.md).
> Se conserva sólo como referencia de la paleta original.

## 🎨 Paleta de Colores

El diseño está inspirado en los colores oficiales del Elche CF:

### Colores Principales
- **Verde Elche**: `#00964f` - Color principal del equipo
- **Verde Elche Oscuro**: `#007a3d` - Para gradientes y énfasis
- **Verde Elche Claro**: `#20b368` - Para highlights y hover states
- **Blanco**: `#ffffff` - Color secundario del equipo

### Colores de Apoyo
- **Fondo**: `#f5f9f7` - Fondo suave verde muy claro
- **Gris Claro**: `#e8f4ee` - Para elementos de apoyo
- **Texto Principal**: `#1a2e1f` - Verde oscuro para texto
- **Texto Secundario**: `#4a5f52` - Verde grisáceo para texto secundario

## 🎯 Características del Diseño

### Barra Superior
- **Fondo**: Gradiente verde (`#00964f` → `#007a3d`)
- **Contenido**: 
  - Nombre del evento (grande y destacado)
  - Nombre de la cantina con icono de ubicación 📍
  - Navegación por pestañas (Venta, Inventario, Ventas)
- **Efectos**: Sombra suave, backdrop blur en las pestañas

### Página POS (`/pos`)

#### Pestaña de Venta
- **Tarjetas de productos**:
  - Fondo blanco con sombra suave
  - Bordes redondeados (16px)
  - Hover: Borde verde con elevación
  - Indicadores de stock con puntos de color
- **Carrito**:
  - Fondo blanco
  - Items con fondo gris claro
  - Botón de venta con gradiente verde

#### Pestaña de Inventario
- **Tres secciones**: Inventario inicial, Ajustes, Inventario final
- **Tarjetas**: Fondo blanco con sombra suave
- **Formularios**: Items con fondo gris claro
- **Botones principales**: Verde con sombra
- **Botones secundarios**: Gris claro

#### Pestaña de Ventas
- **Métricas**: Cards con gradientes verdes diferentes
- **Números grandes**: Tipografía destacada (32px, peso 800)
- **Botón refrescar**: Verde con icono 🔄

## 📐 Espaciado y Dimensiones

### Bordes Redondeados
- **Pequeño**: 8px (inputs, botones pequeños)
- **Mediano**: 12px (tabs, botones medianos, items)
- **Grande**: 16px (cards, botones principales)
- **Extra grande**: 24px (contenedores principales)



## ✨ Efectos y Animaciones

### Hover States
- **Transform**: `translateY(-2px)` para elevación
- **Box-shadow**: Aumenta opacidad y blur
- **Transition**: `all 0.2s ease`

### Botones
- **Hover**: Elevación con sombra verde
- **Active**: Vuelve a posición original
- **Disabled**: Opacidad 0.5, cursor not-allowed

### Gradientes
```css
/* Botón principal */
linear-gradient(135deg, var(--elche-green) 0%, var(--elche-green-light) 100%)

/* Barra superior */
linear-gradient(135deg, var(--elche-green) 0%, var(--elche-green-dark) 100%)
```

## 🎭 Iconos y Emojis

Se utilizan emojis para mejorar la experiencia visual:
- 🏪 Cantina
- 💰 Venta
- 📦 Inventario
- 📊 Ventas/Estadísticas
- 🛒 Carrito
- 💳 Pagar
- 🗑️ Eliminar
- 💾 Guardar
- ↩️ Deshacer
- ⚙️ Ajustes
- 📋 Inventario final
- ✅ Aplicar
- 🧹 Limpiar
- 🔄 Refrescar
- 💡 Información
- 📍 Ubicación

## 🎨 Paleta de Estado

### Stock
- **OK**: `#00964f` (verde)
- **Bajo**: `#f59e0b` (ámbar)
- **Agotado**: `#dc2626` (rojo)

Los indicadores de stock utilizan puntos de color de 10px de diámetro.
