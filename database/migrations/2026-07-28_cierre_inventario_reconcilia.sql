-- ============================================================================
-- El recuento de cierre debe reconciliar el stock, no sólo anotarse
--
-- SÍNTOMA: guardar el inventario final "no hacía nada". Se introducía el
-- recuento, se guardaba sin error, y el stock de la cantina seguía mostrando el
-- valor anterior.
--
-- CAUSA: `set_final_inventory_bulk` escribía el snapshot FINAL y ahí terminaba.
-- Nunca generaba el movimiento que lleva el stock al valor contado, así que el
-- ledger y el recuento quedaban divergiendo en silencio. En producción se
-- llegaron a acumular 60 snapshots FINAL sin un solo movimiento asociado: en una
-- barra se contaron 304 aguas al cierre mientras la aplicación seguía diciendo 0.
--
-- Su hermana `set_initial_inventory_bulk` sí lo hacía desde el principio —
-- calcula el delta contra el stock actual y mete un ADJUSTMENT. Esta función se
-- quedó a medias.
--
-- QUÉ HACE AHORA: además del snapshot, inserta el movimiento de ajuste que deja
-- el stock EXACTAMENTE en lo contado. El propósito del recuento de cierre es
-- justamente ese: cuando el conteo físico no cuadra con lo calculado, manda el
-- conteo físico.
--
-- El movimiento es de tipo ADJUSTMENT, no SALE, para que el descuadre no
-- contamine las métricas de venta: lo que faltó no se vendió, se perdió.
-- Y queda en el ledger con motivo propio, que es el rastro de auditoría que
-- permite explicar después por qué faltaban cuatro cervezas.
-- ============================================================================

create or replace function public.set_final_inventory_bulk(
  p_event_id uuid, p_cantina_id uuid, p_user_id uuid, p_lines jsonb)
 returns void
 language plpgsql
 security definer
as $function$
declare
  v_line record;
  v_actual int;
  v_delta int;
begin
  -- Asegurar la fila de proyección para poder bloquearla, igual que el resto de
  -- operaciones de stock desde la materialización.
  insert into cantina_stock (event_id, cantina_id, product_id, qty)
  select p_event_id, p_cantina_id, (l->>'productId')::uuid, 0
  from jsonb_array_elements(p_lines) l
  order by 1
  on conflict (event_id, cantina_id, product_id) do nothing;

  -- Orden determinista por product_id: sin él, dos cierres simultáneos con los
  -- mismos productos en distinto orden se interbloquearían.
  for v_line in
    select (l->>'productId')::uuid as pid,
           max(greatest(0, (l->>'qty')::int)) as qty
    from jsonb_array_elements(p_lines) l
    group by 1
    order by 1
  loop
    -- Cerrojo de fila sobre el producto de esta barra.
    select qty into v_actual
    from cantina_stock
    where event_id = p_event_id and cantina_id = p_cantina_id and product_id = v_line.pid
    for update;

    -- Snapshot del recuento físico: es el dato de auditoría y se conserva
    -- aunque después haya más movimientos.
    insert into inventory_snapshots (event_id, cantina_id, product_id, kind, qty, created_by, created_at)
    values (p_event_id, p_cantina_id, v_line.pid, 'FINAL', v_line.qty, p_user_id, now())
    on conflict (event_id, cantina_id, product_id, kind)
    do update set qty = excluded.qty, created_by = excluded.created_by, created_at = excluded.created_at;

    -- Movimiento que lleva el stock a lo contado.
    v_delta := v_line.qty - coalesce(v_actual, 0);

    if v_delta <> 0 then
      insert into stock_movements (event_id, cantina_id, product_id, qty, type, reason, created_by)
      values (p_event_id, p_cantina_id, v_line.pid, v_delta, 'ADJUSTMENT',
              'Ajuste por recuento de cierre', p_user_id);
    end if;
  end loop;
end $function$;

comment on function public.set_final_inventory_bulk is
  'Registra el recuento físico de cierre y ajusta el stock para que coincida con '
  'él. Idempotente: repetir el guardado con el mismo recuento no genera un '
  'segundo ajuste, porque el delta pasa a ser cero.';
