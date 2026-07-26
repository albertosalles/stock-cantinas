-- Bajo mínimo sólo con umbral definido por el administrador
-- ==========================================================
--
-- `event_products.low_stock_threshold` vale 0 por defecto. La versión anterior
-- de `get_event_cantinas_grid` contaba como "bajo mínimo" cualquier fila con
-- `current_qty <= low_stock_threshold`, de modo que TODO producto agotado (0)
-- sin umbral configurado se marcaba como bajo mínimo y llegaba al administrador.
--
-- Regla correcta: 0 significa "sin umbral definido" → no se avisa.
-- Sólo se cuenta cuando el administrador ha fijado un umbral (> 0).
--
-- Cambio único respecto a la definición anterior:
--   AND v.low_stock_threshold > 0
--
-- Reversible: basta con volver a crear la función sin esa condición.

CREATE OR REPLACE FUNCTION public.get_event_cantinas_grid(p_event_id uuid)
 RETURNS TABLE(cantina_id uuid, cantina_name text, qr_token uuid, assigned boolean, total_cents integer, num_sales integer, active_waiters integer, pending_incidents integer, low_stock_count integer, featured jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT
    c.id,
    c.name,
    c.qr_token,
    EXISTS(SELECT 1 FROM event_cantinas ec WHERE ec.event_id = p_event_id AND ec.cantina_id = c.id) AS assigned,
    COALESCE((SELECT SUM(s.total_cents) FROM sales s WHERE s.event_id = p_event_id AND s.cantina_id = c.id AND s.status = 'OK'), 0)::int,
    COALESCE((SELECT COUNT(*) FROM sales s WHERE s.event_id = p_event_id AND s.cantina_id = c.id AND s.status = 'OK'), 0)::int,
    COALESCE((SELECT COUNT(*) FROM shifts sh WHERE sh.event_id = p_event_id AND sh.cantina_id = c.id AND sh.ended_at IS NULL), 0)::int,
    COALESCE((SELECT COUNT(*) FROM incidents i WHERE i.event_id = p_event_id AND i.cantina_id = c.id AND i.status = 'pending'), 0)::int,
    COALESCE((
      SELECT COUNT(*)
      FROM v_cantina_inventory v
      WHERE v.event_id = p_event_id
        AND v.cantina_id = c.id
        AND v.low_stock_threshold > 0          -- sin umbral definido, no hay aviso
        AND v.current_qty <= v.low_stock_threshold
    ), 0)::int,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', p.name, 'qty', COALESCE(v.current_qty, 0)) ORDER BY p.sku)
      FROM event_products ep
      JOIN products p ON p.id = ep.product_id
      LEFT JOIN v_cantina_inventory v ON v.event_id = p_event_id AND v.cantina_id = c.id AND v.product_id = ep.product_id
      WHERE ep.event_id = p_event_id AND ep.featured = true AND ep.active = true
        AND EXISTS(SELECT 1 FROM event_cantinas ec2 WHERE ec2.event_id = p_event_id AND ec2.cantina_id = c.id)
    ), '[]'::jsonb)
  FROM cantinas c
  ORDER BY 4 DESC, 5 DESC, c.name;
$function$;
