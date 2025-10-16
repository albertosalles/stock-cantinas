# Guía de Diseño - Stock Cantinas Elche CF

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
- **Posición**: Sticky (fija al hacer scroll)
- **Contenido**: 
  - Nombre del evento (grande y destacado)
  - Nombre de la cantina con icono de ubicación 📍
  - Navegación por pestañas (Venta, Inventario, Ventas)
- **Efectos**: Sombra suave, backdrop blur en las pestañas

### Página Principal (`/`)
- **Layout**: Centrado con max-width de 1400px
- **Tarjeta principal**: Fondo blanco con sombra suave y bordes redondeados (24px)
- **Botón de cantina**: Gradiente verde con efecto hover (elevación)
- **Panel informativo**: Fondo gris claro con borde verde izquierdo

### Página POS (`/pos`)

#### Pestaña de Venta
- **Layout**: Grid de 2 columnas (productos + carrito)
- **Tarjetas de productos**:
  - Fondo blanco con sombra suave
  - Bordes redondeados (16px)
  - Hover: Borde verde con elevación
  - Indicadores de stock con puntos de color
- **Carrito lateral**:
  - Sticky positioning
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

### Padding
- **Pequeño**: 8-10px
- **Mediano**: 12-16px
- **Grande**: 20-24px
- **Extra grande**: 32-48px

### Gap (espaciado entre elementos)
- **Pequeño**: 8px
- **Mediano**: 12px
- **Grande**: 16px
- **Extra grande**: 20px

## 🔤 Tipografía

- **Fuente**: Inter (Google Fonts)
- **Títulos principales**: 24-28px, peso 800
- **Títulos secundarios**: 18-20px, peso 700
- **Texto normal**: 14-16px, peso 400-600
- **Texto pequeño**: 13-14px, peso 400-600

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

## 📱 Responsive

El diseño está optimizado para pantallas grandes (desktop), con:
- Max-width: 1600px en POS
- Max-width: 1400px en página principal
- Grid adaptativo con `auto-fill` y `minmax()`

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
