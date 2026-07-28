-- ============================================================================
-- Hora de inicio del partido y reparto de ventas por tramos
--
-- Épica «Mapa de calor horario de ventas» (F1).
--
-- El gráfico anterior repartía por hora natural del día. Para un partido eso
-- dice poco: lo interesante no es "las 20 h", sino "veinte minutos antes del
-- pitido inicial" o "el descanso". Dos cambios, por tanto:
--
--   1. Los eventos pasan a tener HORA DE INICIO. Hasta ahora `events.date`
--      guardaba 00:00:00 en todos, así que la hora no existía en el sistema.
--   2. El reparto es por TRAMOS relativos al inicio (15 min por defecto), y
--      acotado a la ventana del partido: desde la apertura de puertas hasta un
--      margen después del pitido final. Las ventas fuera de esa ventana no
--      cuentan; son ruido para este análisis.
--
-- Ejecutar dentro de una transacción (apply_migration ya lo hace).
-- ============================================================================

-- ─────────────────── 1. Hora de inicio ───────────────────
-- Se añade columna propia en vez de aprovechar la hora de `events.date`, porque
-- `date` se usa como fecha en listados y ordenaciones, y todos los registros
-- existentes tienen 00:00: darle de pronto significado horario reescribiría el
-- pasado en silencio.

alter table public.events
  add column if not exists kickoff_at timestamptz;

comment on column public.events.kickoff_at is
  'Hora del pitido inicial. NULL = sin definir; el mapa de calor no se puede '
  'calcular sin ella. La apertura de puertas se deriva restando 90 minutos.';

-- ─────────────────── 2. Ventas por tramo ───────────────────
--
-- Devuelve SIEMPRE la rejilla completa de tramos, incluidos los vacíos: en un
-- análisis de afluencia los huecos son información (nadie compra durante la
-- primera parte), y si sólo se devolvieran los tramos con ventas el gráfico
-- mentiría comprimiendo el tiempo.
--
-- Ventana por defecto, con los tiempos habituales de un partido:
--   · puertas   → 90 min antes del inicio
--   · 1ª parte  → 0 a 45
--   · descanso  → 45 a 60
--   · 2ª parte  → 60 a 105
--   · final     → 105 a 135 (margen de 30 min tras el pitido)
-- Los tres márgenes son parámetros para poder ajustarlos sin migrar.

create or replace function public.get_sales_by_slot(
  p_event_id uuid,
  p_slot_minutes int default 15,
  p_puertas_min int default 90,
  p_cola_min int default 30
)
returns table(
  slot_start timestamptz,
  etiqueta text,
  minuto_relativo int,
  fase text,
  total_cents integer,
  num_sales integer
)
language sql
stable
as $function$
  with ev as (
    select e.kickoff_at as ko
    from public.events e
    where e.id = p_event_id and e.kickoff_at is not null
  ),
  rejilla as (
    select
      ev.ko + (g * p_slot_minutes) * interval '1 minute' as inicio,
      g * p_slot_minutes as minuto
    from ev,
    generate_series(
      -ceil(p_puertas_min::numeric / p_slot_minutes)::int,
      ceil((105 + p_cola_min)::numeric / p_slot_minutes)::int - 1
    ) as g
  ),
  ventas as (
    select r.minuto, sum(s.total_cents)::int as cents, count(*)::int as n
    from rejilla r
    join public.sales s
      on s.event_id = p_event_id
     and s.status = 'OK'
     and s.created_at >= r.inicio
     and s.created_at <  r.inicio + (p_slot_minutes * interval '1 minute')
    group by r.minuto
  )
  select
    r.inicio,
    to_char(r.inicio at time zone 'Europe/Madrid', 'HH24:MI'),
    r.minuto,
    case
      when r.minuto < 0   then 'Previa'
      when r.minuto < 45  then '1ª parte'
      when r.minuto < 60  then 'Descanso'
      when r.minuto < 105 then '2ª parte'
      else 'Final'
    end,
    coalesce(v.cents, 0),
    coalesce(v.n, 0)
  from rejilla r
  left join ventas v on v.minuto = r.minuto
  order by r.minuto;
$function$;

comment on function public.get_sales_by_slot is
  'Reparte las ventas del evento en tramos relativos al pitido inicial, acotado '
  'a la ventana del partido (puertas → final + margen). Devuelve la rejilla '
  'completa, con los tramos vacíos a cero. Sin kickoff_at devuelve 0 filas.';
