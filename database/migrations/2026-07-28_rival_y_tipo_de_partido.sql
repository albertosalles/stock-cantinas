-- ============================================================================
-- Rival estructurado y tipo de partido
--
-- Captura de datos, no funcionalidad. Se adelanta a la fase en que se explotará
-- (comparativa histórica por rival, F4) porque es lo único con coste real de
-- demora: cada partido jugado sin estos campos queda permanentemente degradado
-- para el análisis posterior, mientras que el resto de métricas se pueden
-- recalcular del ledger cuando haga falta.
--
-- POR QUÉ UN CATÁLOGO Y NO TEXTO LIBRE
-- El nombre del evento es texto libre y ya ha producido ambigüedad real: entre
-- los eventos existentes conviven "Elche - Atlético" (Bilbao) y "Elche - Atleti"
-- (Madrid). Son rivales DISTINTOS y la grafía no lo deja claro — de hecho, al
-- revisar los datos se interpretaron como el mismo equipo. Una comparativa por
-- rival construida sobre ese texto agruparía mal, y el error sería silencioso.
--
-- Los eventos ya existentes se dejan sin rival a propósito: son pruebas, no
-- partidos reales expuestos a operación con todas las cantinas.
-- ============================================================================

-- ─────────────────── 1. Catálogo de rivales ───────────────────

create table if not exists public.opponents (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.opponents is
  'Catálogo de equipos rivales. Existe para que la comparativa histórica agrupe '
  'por una referencia estable y no por el nombre libre del evento.';

-- ─────────────────── 2. Campos del evento ───────────────────

alter table public.events
  add column if not exists opponent_id uuid references public.opponents(id),
  add column if not exists match_type  text;

-- El tipo condiciona la afluencia esperada: un amistoso de pretemporada y una
-- eliminatoria de Copa no llenan igual, así que comparar sin distinguirlos
-- mezclaría escenarios que no son comparables.
alter table public.events
  drop constraint if exists events_match_type_check;
alter table public.events
  add constraint events_match_type_check
  check (match_type is null or match_type in ('Liga', 'Copa del Rey', 'Amistoso', 'Otro'));

comment on column public.events.opponent_id is
  'Rival, referenciado al catálogo. NULL en eventos que no son partido.';
comment on column public.events.match_type is
  'Competición. Afecta a la afluencia esperada, así que la comparativa histórica '
  'debe distinguirla en lugar de mezclar escenarios distintos.';

create index if not exists idx_events_opponent on public.events(opponent_id);
create index if not exists idx_events_match_type on public.events(match_type);
