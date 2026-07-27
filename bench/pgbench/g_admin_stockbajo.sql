-- Recuento de productos bajo mínimo en todo el evento.
select count(*) from v_cantina_inventory
 where event_id=(select id from events where status='live' limit 1)
   and current_qty <= low_stock_threshold;
