-- ─────────────────────────────────────────────────────────────────────────────
-- S5b · Se retiran los GRANT de escritura
--
-- Segunda mitad de S5. Hasta ahora las escrituras estaban bloqueadas por
-- AUSENCIA DE POLÍTICA, que es suficiente pero implícito: cualquiera que
-- añadiera mañana una política permisiva por comodidad reabriría la puerta sin
-- darse cuenta. Retirar el privilegio lo hace explícito.
--
-- EL LEDGER NO SE ESCRIBE DIRECTO NUNCA. Sin privilegio no hay política que
-- discutir, y toda escritura pasa por RPC, que es donde ya viven la idempotencia
-- por client_request_id y el bloqueo ordenado por product_id de F1.5. Dos
-- mecanismos independientes: privilegios como capa gruesa, RLS como capa fina.
--
-- ÚNICA EXCEPCIÓN: las incidencias. Reportar una es un aviso, no una
-- transacción de stock, y su WITH CHECK ya la ata a la barra y al camarero de
-- quien la reporta. Conservan INSERT (TPV) y UPDATE (admin, para resolverlas).
--
-- Las mutaciones que el admin hacía desde el navegador pasan a /api/admin/data,
-- que comprueba la cookie de admin y las ejecuta con service_role.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'events', 'cantinas', 'event_cantinas', 'products', 'event_products',
    'seasons', 'opponents', 'waiters', 'cantina_access', 'users',
    'shifts', 'sales', 'sale_line_items', 'stock_movements',
    'cantina_stock', 'inventory_snapshots'
  ] loop
    -- Se retiran sólo las operaciones de escritura: el SELECT se mantiene tal
    -- como quedó, incluidos los permisos por columna de cantinas, waiters y
    -- cantina_access. Un `revoke all` los habría borrado y habría dejado el
    -- catálogo inaccesible.
    execute format(
      'revoke insert, update, delete, truncate on public.%I from anon, authenticated',
      v_tabla);
  end loop;
end $$;

-- Incidencias: el alta la hace el TPV y la resolución el admin, ambas acotadas
-- por su política. Se les retira sólo lo que nadie debe poder hacer.
revoke delete, truncate on public.incidents from anon, authenticated;

-- ─── Que las tablas nuevas no nazcan expuestas ───────────────────────────────
-- La línea base dejó constancia de que los DEFAULT PRIVILEGES del esquema
-- conceden todo a anon y authenticated, así que cualquier tabla creada de aquí
-- en adelante nacería con las escrituras abiertas y habría que acordarse de
-- cerrarlas. Se invierte el defecto: nacen con SELECT y nada más.
--
-- Es el mismo principio que ha gobernado la fase: el sistema concede por
-- omisión, y lo que hay que hacer es quitar.

alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
