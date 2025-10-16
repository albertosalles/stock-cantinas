-- =====================================================
-- MIGRACIÓN: Credenciales únicas por cantina
-- =====================================================
-- Las cantinas ahora tienen UN solo código PIN que funciona
-- para todos los eventos, no un PIN diferente por evento.
--
-- Cambios:
-- 1. Modificar tabla cantina_access para remover event_id
-- 2. Actualizar función validate_cantina_access
-- 3. Actualizar vista v_available_cantinas
-- =====================================================

-- Paso 1: Crear nueva tabla con estructura simplificada
CREATE TABLE IF NOT EXISTS cantina_access_v2 (
  cantina_id UUID NOT NULL REFERENCES cantinas(id) ON DELETE CASCADE,
  pin_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (cantina_id)
);

-- Paso 2: Migrar datos existentes (tomar el primer PIN de cada cantina)
INSERT INTO cantina_access_v2 (cantina_id, pin_code, is_active)
SELECT DISTINCT ON (cantina_id) 
  cantina_id, 
  pin_code, 
  is_active
FROM cantina_access
ON CONFLICT (cantina_id) DO NOTHING;

-- Paso 3: Eliminar tabla antigua y renombrar
DROP TABLE IF EXISTS cantina_access CASCADE;
ALTER TABLE cantina_access_v2 RENAME TO cantina_access;

-- Paso 4: Crear índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_cantina_access_active 
ON cantina_access(cantina_id) WHERE is_active = true;

-- Paso 5: Comentarios de la tabla
COMMENT ON TABLE cantina_access IS 'Credenciales de acceso para cada cantina (PIN único por cantina, válido para todos los eventos)';
COMMENT ON COLUMN cantina_access.cantina_id IS 'ID de la cantina';
COMMENT ON COLUMN cantina_access.pin_code IS 'Código PIN de acceso (en producción debería estar hasheado)';
COMMENT ON COLUMN cantina_access.is_active IS 'Si false, la cantina no puede acceder aunque tenga credenciales';

-- =====================================================
-- Función actualizada: validate_cantina_access
-- =====================================================
-- Ahora valida sin considerar el event_id en las credenciales
-- Solo verifica que la cantina tenga PIN y que esté asignada al evento

-- Eliminar la función antigua (tiene un tipo de retorno diferente)
DROP FUNCTION IF EXISTS validate_cantina_access(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION validate_cantina_access(
  p_event_id UUID,
  p_cantina_id UUID,
  p_pin_code TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  event_name TEXT,
  cantina_name TEXT,
  event_status TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_status TEXT;
  v_event_name TEXT;
  v_cantina_name TEXT;
  v_pin_code TEXT;
  v_is_active BOOLEAN;
  v_is_assigned BOOLEAN;
BEGIN
  -- 1. Verificar que el evento existe y obtener su estado
  SELECT e.status, e.name
  INTO v_event_status, v_event_name
  FROM events e
  WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'El evento no existe'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 2. Verificar que el evento está en estado "live"
  IF v_event_status != 'live' THEN
    RETURN QUERY SELECT 
      false, 
      CASE 
        WHEN v_event_status = 'draft' THEN 'El evento aún no ha comenzado'
        WHEN v_event_status = 'closed' THEN 'El evento ha finalizado'
        ELSE 'El evento no está disponible'
      END::TEXT,
      v_event_name,
      NULL::TEXT,
      v_event_status;
    RETURN;
  END IF;

  -- 3. Verificar que la cantina existe
  SELECT c.name
  INTO v_cantina_name
  FROM cantinas c
  WHERE c.id = p_cantina_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'La cantina no existe'::TEXT, v_event_name, NULL::TEXT, v_event_status;
    RETURN;
  END IF;

  -- 4. Verificar que la cantina está asignada a este evento
  SELECT EXISTS(
    SELECT 1 
    FROM event_cantinas ec
    WHERE ec.event_id = p_event_id 
    AND ec.cantina_id = p_cantina_id
  ) INTO v_is_assigned;

  IF NOT v_is_assigned THEN
    RETURN QUERY SELECT false, 'La cantina no está asignada a este evento'::TEXT, v_event_name, v_cantina_name, v_event_status;
    RETURN;
  END IF;

  -- 5. Obtener credenciales de la cantina (ahora sin event_id)
  SELECT ca.pin_code, ca.is_active
  INTO v_pin_code, v_is_active
  FROM cantina_access ca
  WHERE ca.cantina_id = p_cantina_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No hay credenciales configuradas para esta cantina'::TEXT, v_event_name, v_cantina_name, v_event_status;
    RETURN;
  END IF;

  -- 6. Verificar que el acceso está activo
  IF NOT v_is_active THEN
    RETURN QUERY SELECT false, 'El acceso para esta cantina está deshabilitado'::TEXT, v_event_name, v_cantina_name, v_event_status;
    RETURN;
  END IF;

  -- 7. Verificar el código PIN
  IF v_pin_code != p_pin_code THEN
    RETURN QUERY SELECT false, 'Código PIN incorrecto'::TEXT, v_event_name, v_cantina_name, v_event_status;
    RETURN;
  END IF;

  -- ✅ Acceso concedido
  RETURN QUERY SELECT true, 'Acceso concedido'::TEXT, v_event_name, v_cantina_name, v_event_status;
END;
$$;

COMMENT ON FUNCTION validate_cantina_access IS 'Valida credenciales de una cantina para acceder a un evento. El PIN es único por cantina y funciona en todos los eventos.';

-- =====================================================
-- Vista actualizada: v_available_cantinas
-- =====================================================
-- Muestra cantinas disponibles sin filtrar por credenciales de evento

DROP VIEW IF EXISTS v_available_cantinas;

CREATE VIEW v_available_cantinas AS
SELECT 
  e.id AS event_id,
  e.name AS event_name,
  e.status AS event_status,
  c.id AS cantina_id,
  c.name AS cantina_name,
  c.location AS cantina_location,
  ca.is_active AS access_enabled,
  CASE 
    WHEN ca.cantina_id IS NULL THEN false
    ELSE true
  END AS has_credentials
FROM events e
INNER JOIN event_cantinas ec ON ec.event_id = e.id
INNER JOIN cantinas c ON c.id = ec.cantina_id
LEFT JOIN cantina_access ca ON ca.cantina_id = c.id
WHERE e.status = 'live'
ORDER BY e.date DESC, c.name ASC;

COMMENT ON VIEW v_available_cantinas IS 'Lista de cantinas disponibles para eventos activos (live), con información de credenciales';

-- =====================================================
-- Función auxiliar: Configurar PIN de cantina
-- =====================================================
-- Facilita la configuración de credenciales desde SQL

CREATE OR REPLACE FUNCTION set_cantina_pin(
  p_cantina_id UUID,
  p_pin_code TEXT,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO cantina_access (cantina_id, pin_code, is_active)
  VALUES (p_cantina_id, p_pin_code, p_is_active)
  ON CONFLICT (cantina_id) 
  DO UPDATE SET 
    pin_code = EXCLUDED.pin_code,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION set_cantina_pin IS 'Configura o actualiza el PIN de una cantina';

-- =====================================================
-- Función auxiliar: Activar/Desactivar cantina
-- =====================================================

CREATE OR REPLACE FUNCTION toggle_cantina_access(
  p_cantina_id UUID,
  p_is_active BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE cantina_access
  SET is_active = p_is_active,
      updated_at = NOW()
  WHERE cantina_id = p_cantina_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION toggle_cantina_access IS 'Activa o desactiva el acceso de una cantina';

-- =====================================================
-- Datos de ejemplo (opcional)
-- =====================================================
-- Descomentar para crear cantinas de ejemplo con PINs

/*
-- Crear cantinas de ejemplo
INSERT INTO cantinas (name, location) 
VALUES 
  ('Cantina Norte', 'Tribuna Norte'),
  ('Cantina Sur', 'Tribuna Sur'),
  ('Cantina VIP', 'Palco VIP')
ON CONFLICT DO NOTHING;

-- Configurar PINs
SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina Norte'),
  '1234',
  true
);

SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina Sur'),
  '5678',
  true
);

SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina VIP'),
  '9999',
  true
);
*/

-- =====================================================
-- Verificación de migración
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migración completada exitosamente';
  RAISE NOTICE '📋 Cantinas configuradas: %', (SELECT COUNT(*) FROM cantina_access);
  RAISE NOTICE '🔑 Cantinas activas: %', (SELECT COUNT(*) FROM cantina_access WHERE is_active = true);
END;
$$;
