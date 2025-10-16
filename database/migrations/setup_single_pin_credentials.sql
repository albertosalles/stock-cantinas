-- =====================================================
-- CONFIGURACIÓN: PINs únicos por cantina
-- =====================================================
-- Este script configura los códigos PIN para cada cantina.
-- Cada cantina tiene UN solo PIN que funciona en todos los eventos.
--
-- IMPORTANTE: Reemplaza los UUIDs con los IDs reales de tus cantinas
-- =====================================================

-- Ejemplo de configuración usando IDs de cantinas

-- Opción 1: Configurar PIN usando el ID de la cantina
SELECT set_cantina_pin(
  '<cantina_id>'::uuid,  -- Reemplazar con el ID real
  '1234',                 -- PIN de 4 dígitos
  true                    -- Activo
);

-- Opción 2: Configurar PINs para todas las cantinas de una vez
-- (usando los nombres de las cantinas)

-- Ejemplo: Cantina Norte
SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina Norte' LIMIT 1),
  '1234',
  true
);

-- Ejemplo: Cantina Sur
SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina Sur' LIMIT 1),
  '5678',
  true
);

-- Ejemplo: Cantina VIP
SELECT set_cantina_pin(
  (SELECT id FROM cantinas WHERE name = 'Cantina VIP' LIMIT 1),
  '9999',
  true
);

-- =====================================================
-- Ver todas las credenciales configuradas
-- =====================================================

SELECT 
  c.name AS cantina_name,
  c.location AS ubicacion,
  ca.pin_code AS pin,
  ca.is_active AS activo,
  ca.created_at AS creado,
  ca.updated_at AS actualizado
FROM cantinas c
LEFT JOIN cantina_access ca ON ca.cantina_id = c.id
ORDER BY c.name;

-- =====================================================
-- Funciones útiles
-- =====================================================

-- Desactivar una cantina temporalmente
-- SELECT toggle_cantina_access('<cantina_id>'::uuid, false);

-- Reactivar una cantina
-- SELECT toggle_cantina_access('<cantina_id>'::uuid, true);

-- Cambiar el PIN de una cantina
-- SELECT set_cantina_pin('<cantina_id>'::uuid, '9876', true);

-- =====================================================
-- Verificar que todo funciona
-- =====================================================

-- Probar autenticación
SELECT * FROM validate_cantina_access(
  '<event_id>'::uuid,    -- ID del evento
  '<cantina_id>'::uuid,  -- ID de la cantina
  '1234'                  -- PIN de la cantina
);

-- Ver cantinas disponibles para eventos activos
SELECT * FROM v_available_cantinas;
