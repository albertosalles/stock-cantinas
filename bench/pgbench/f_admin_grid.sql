-- Consulta dominante del panel: el grid de cantinas.
select count(*) from get_event_cantinas_grid((select id from events where status='live' limit 1));
