# 🔄 Actualización: Credenciales Únicas y Panel Admin

## 📋 Cambios Implementados

### 1. 🔑 Sistema de PIN Único por Cantina

**Antes**: Cada cantina tenía un PIN diferente para cada evento.
**Ahora**: Cada cantina tiene UN SOLO PIN que funciona en todos los eventos.

#### Ventajas:
- ✅ Más fácil de recordar para el personal
- ✅ Menos gestión de credenciales
- ✅ Configuración más simple
- ✅ Mismo PIN para toda la temporada

#### Cambios en la Base de Datos:

**Tabla `cantina_access` simplificada:**
```sql
-- ANTES: (event_id, cantina_id, pin_code)
-- AHORA: (cantina_id, pin_code)

CREATE TABLE cantina_access (
  cantina_id UUID PRIMARY KEY REFERENCES cantinas(id),
  pin_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Nuevas Funciones SQL:**

1. **`set_cantina_pin(cantina_id, pin_code, is_active)`**
   - Configura o actualiza el PIN de una cantina
   - Uso: `SELECT set_cantina_pin('<cantina_id>', '1234', true);`

2. **`toggle_cantina_access(cantina_id, is_active)`**
   - Activa o desactiva el acceso de una cantina
   - Uso: `SELECT toggle_cantina_access('<cantina_id>', false);`

3. **`validate_cantina_access(event_id, cantina_id, pin_code)`** *(actualizada)*
   - Ahora no busca credenciales por evento
   - Valida que el PIN de la cantina sea correcto
   - Retorna: `{success, message, event_name, cantina_name, event_status}`

---

### 2. 👨‍💼 Panel de Administrador Mejorado

**Nueva funcionalidad**: El administrador puede cambiar el estado del evento directamente desde la lista.

#### Estados de Evento:

| Estado | Emoji | Descripción | Acceso POS |
|--------|-------|-------------|------------|
| `draft` | 📝 | Borrador - Evento en planificación | ❌ Bloqueado |
| `live` | 🟢 | En Vivo - Evento activo | ✅ Permitido |
| `closed` | 🔒 | Cerrado - Evento finalizado | ❌ Bloqueado |

#### Interfaz de Usuario:

```
┌─────────────────────────────────────────────────────┐
│ Evento: Elche CF vs Barcelona | [🟢 EN VIVO ▼] │ [Configurar →]
│ 📅 15 de octubre de 2025                           │
└─────────────────────────────────────────────────────┘
```

- **Selector de estado**: Dropdown con confirmación antes de cambiar
- **Colores dinámicos**: Verde para "live", gris para "closed", blanco para "draft"
- **Confirmación**: Pregunta antes de cambiar el estado

#### Flujo de Cambio de Estado:

```
1. Admin hace clic en el selector de estado
2. Selecciona el nuevo estado (draft/live/closed)
3. Aparece confirmación: "¿Cambiar estado a LIVE?"
4. Si confirma → Estado actualizado en BD
5. Alerta: "✅ Estado cambiado a LIVE"
6. Interfaz se actualiza automáticamente
```

---

## 🚀 Cómo Usar el Sistema Actualizado

### Para Administradores:

#### 1. Configurar Credenciales Iniciales

```sql
-- Ejecutar en Supabase SQL Editor:
-- database/migrations/update_cantina_auth_single_pin.sql
```

#### 2. Asignar PINs a las Cantinas

```sql
-- Método 1: Por ID
SELECT set_cantina_pin('<cantina_id>', '1234', true);

-- Método 2: Por nombre
SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina Norte'),
  '1234',
  true
);
```

#### 3. Gestionar Estados de Eventos

1. Ir a `/admin`
2. Ver la lista de eventos
3. Usar el selector de estado para cambiar:
   - **📝 BORRADOR**: Para eventos en planificación
   - **🟢 EN VIVO**: Para activar el evento (permite acceso POS)
   - **🔒 CERRADO**: Para finalizar el evento (bloquea acceso)

#### 4. Ver Credenciales Configuradas

```sql
SELECT 
  c.name AS cantina,
  c.location,
  ca.pin_code AS pin,
  ca.is_active AS activa
FROM cantinas c
LEFT JOIN cantina_access ca ON ca.cantina_id = c.id
ORDER BY c.name;
```

---

### Para Operadores de Cantina:

#### Proceso de Login (Sin cambios visibles):

1. **Seleccionar Evento** → Solo aparecen eventos "🟢 EN VIVO"
2. **Seleccionar Cantina** → Tu cantina asignada
3. **Ingresar PIN** → Tu código único (mismo para todos los eventos)
4. ✅ **Acceso concedido**

**Importante**: El PIN es el mismo siempre, no cambia entre eventos.

---

## 📝 Scripts de Migración

### Migración Principal
**Archivo**: `database/migrations/update_cantina_auth_single_pin.sql`

**Qué hace**:
- ✅ Crea nueva tabla `cantina_access` simplificada
- ✅ Migra datos existentes (toma primer PIN de cada cantina)
- ✅ Elimina tabla antigua
- ✅ Actualiza función `validate_cantina_access()`
- ✅ Actualiza vista `v_available_cantinas`
- ✅ Crea funciones auxiliares `set_cantina_pin()` y `toggle_cantina_access()`

### Configuración de Credenciales
**Archivo**: `database/migrations/setup_single_pin_credentials.sql`

**Qué hace**:
- Template para configurar PINs
- Ejemplos de uso
- Queries útiles para gestión

---

## 🔒 Validación de Acceso

### Nueva Lógica (7 pasos):

```
1. ¿Existe el evento? → Si no: "El evento no existe"
2. ¿Evento = "live"? → Si no: "El evento aún no ha comenzado" / "El evento ha finalizado"
3. ¿Existe la cantina? → Si no: "La cantina no existe"
4. ¿Cantina asignada al evento? → Si no: "La cantina no está asignada a este evento"
5. ¿Tiene credenciales? → Si no: "No hay credenciales configuradas"
6. ¿Acceso activo? → Si no: "El acceso está deshabilitado"
7. ¿PIN correcto? → Si no: "Código PIN incorrecto"

✅ Todos los pasos OK → Acceso concedido
```

---

## 🎯 Casos de Uso

### Caso 1: Inicio de Temporada
```sql
-- 1. Crear cantinas
INSERT INTO cantinas (name, location) VALUES 
  ('Cantina Norte', 'Tribuna Norte'),
  ('Cantina Sur', 'Tribuna Sur');

-- 2. Configurar PINs (una sola vez)
SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina Norte'),
  '1234', true
);
SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina Sur'),
  '5678', true
);

-- 3. Para cada evento:
-- - Crear evento en estado "draft"
-- - Asignar cantinas al evento
-- - Cuando empiece: cambiar a "live" desde /admin
-- - Cuando termine: cambiar a "closed"
```

### Caso 2: Durante un Evento
```sql
-- Admin cambia estado desde UI /admin
-- O manualmente desde SQL:

UPDATE events 
SET status = 'live' 
WHERE id = '<event_id>';
```

### Caso 3: Deshabilitar una Cantina
```sql
-- Temporalmente sin acceso
SELECT toggle_cantina_access('<cantina_id>', false);

-- Reactivar
SELECT toggle_cantina_access('<cantina_id>', true);
```

### Caso 4: Cambiar PIN de una Cantina
```sql
-- Cambiar PIN (afecta todos los eventos futuros)
SELECT set_cantina_pin('<cantina_id>', '9999', true);
```

---

## 🔄 Migración desde Sistema Anterior

Si ya tenías el sistema con PINs por evento:

1. **Ejecutar migración**:
   ```sql
   -- Copia y ejecuta: update_cantina_auth_single_pin.sql
   ```

2. **Verificar migración**:
   ```sql
   -- Ver qué PINs se mantuvieron
   SELECT c.name, ca.pin_code 
   FROM cantinas c
   JOIN cantina_access ca ON ca.cantina_id = c.id;
   ```

3. **Actualizar PINs si es necesario**:
   ```sql
   SELECT set_cantina_pin('<cantina_id>', '<nuevo_pin>', true);
   ```

4. **Probar autenticación**:
   ```sql
   SELECT * FROM validate_cantina_access(
     '<event_id>'::uuid,
     '<cantina_id>'::uuid,
     '<pin>'
   );
   ```

---

## 📊 Comparación: Antes vs Ahora

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Credenciales** | PIN diferente por evento | PIN único por cantina |
| **Gestión** | Configurar para cada evento | Configurar una sola vez |
| **Cambio de estado** | SQL manual | UI de administrador |
| **Complejidad** | Alta | Baja |
| **Mantenimiento** | Difícil | Fácil |

---

## 🛠️ Comandos Útiles

### Ver Configuración Actual
```sql
-- Ver todas las cantinas y sus credenciales
SELECT 
  c.name AS cantina,
  ca.pin_code AS pin,
  ca.is_active AS activa,
  ca.updated_at AS ultima_actualizacion
FROM cantinas c
LEFT JOIN cantina_access ca ON ca.cantina_id = c.id
ORDER BY c.name;
```

### Ver Eventos y Sus Estados
```sql
SELECT 
  name AS evento,
  status AS estado,
  date AS fecha,
  (SELECT COUNT(*) FROM event_cantinas WHERE event_id = events.id) AS cantinas_asignadas
FROM events
ORDER BY date DESC;
```

### Probar Acceso
```sql
-- Probar si una cantina puede acceder a un evento
SELECT * FROM validate_cantina_access(
  (SELECT id FROM events WHERE name = 'Elche vs Barcelona'),
  (SELECT id FROM cantinas WHERE name = 'Cantina Norte'),
  '1234'
);
```

---

## 🎉 Resumen de Mejoras

### ✅ Sistema de Credenciales Simplificado
- PIN único por cantina (no por evento)
- Configuración más rápida
- Menos errores de autenticación

### ✅ Panel de Admin Mejorado
- Cambio de estado del evento desde UI
- Selector visual con colores
- Confirmación antes de cambios críticos

### ✅ Mejor Experiencia
- Operadores recuerdan un solo PIN
- Admins gestionan eventos más fácilmente
- Menos pasos de configuración

---

## 📞 Soporte

Si tienes problemas:

1. **Verificar estado del evento**: ¿Está en "live"?
2. **Verificar credenciales**: ¿La cantina tiene PIN configurado?
3. **Verificar asignación**: ¿La cantina está asignada al evento?
4. **Probar autenticación**: Usar la función `validate_cantina_access()`

**Logs de errores**: Revisa la consola del navegador en `/login` para detalles.

---

**Fecha de actualización**: 9 de octubre de 2025  
**Versión**: 2.0.0  
**Estado**: ✅ Listo para producción
