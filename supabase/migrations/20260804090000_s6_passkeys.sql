-- ─────────────────────────────────────────────────────────────────────────────
-- S6 · Credenciales biométricas (WebAuthn)
--
-- Reingreso rápido para admin y camareros. Técnicamente no es «FaceID»: es
-- WebAuthn con autenticador de plataforma, que en iOS resuelve por debajo con
-- FaceID y en Android con la huella. Funciona en PWA instalada.
--
-- Se apoya en la costura que abrió S2 —el login es «verificar credencial →
-- emitir token»—, así que añadir un tipo de credencial no toca ni políticas ni
-- RPC. Era el argumento a favor del JWT propio y aquí se cobra.
--
-- QUÉ ACREDITA CADA COSA, que es la decisión de fondo:
--   · El PIN o el QR de la cantina acreditan que estás EN ESA BARRA.
--   · Una passkey acredita QUIÉN ERES.
-- No son intercambiables. Si la passkey sola diera sesión de TPV, se perdería
-- el factor de la barra: cualquiera con el móvil del camarero abriría caja
-- desde su casa. Por eso la passkey sirve para VOLVER A ENTRAR mientras el
-- turno sigue abierto —que es el caso real: pantalla bloqueada, app cerrada,
-- recarga— y abrir turno nuevo sigue pidiendo la cantina.
--
-- El administrador no tiene ese matiz: su factor es la contraseña, y la passkey
-- la sustituye por completo.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),

  -- A quién pertenece. 'admin' no tiene fila propia en ninguna tabla, así que
  -- se distingue por tipo y `waiter_id` queda a null.
  subject_type text not null check (subject_type in ('waiter', 'admin')),
  waiter_id uuid references public.waiters(id) on delete cascade,

  credential_id text not null unique,
  public_key text not null,
  -- Contador anti-clonado del autenticador. Muchos autenticadores de
  -- plataforma lo dejan a 0 y nunca lo suben; se guarda igualmente porque
  -- cuando sí lo mueven, un retroceso delata una credencial duplicada.
  counter bigint not null default 0,
  transports text[],

  -- Para que el usuario reconozca sus dispositivos al revocarlos.
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,

  constraint webauthn_waiter_coherente check (
    (subject_type = 'waiter' and waiter_id is not null) or
    (subject_type = 'admin'  and waiter_id is null)
  )
);

comment on table public.webauthn_credentials is
  'Passkeys registradas. Sólo las toca service_role desde las rutas de /api/auth/passkey: la clave pública no es secreta, pero el mapa de qué credencial es de quién sí es información útil para un atacante.';

create index if not exists idx_webauthn_waiter on public.webauthn_credentials (waiter_id)
  where waiter_id is not null;

-- Ningún cliente la alcanza: RLS activado y sin política. Las rutas van con
-- service_role, que se salta el RLS.
alter table public.webauthn_credentials enable row level security;

-- Coherente con S5b: la tabla nace sin escrituras para nadie, y aquí además
-- sin lectura. Se deja explícito en vez de confiar en los default privileges,
-- que es justo el defecto que esta fase ha ido corrigiendo.
revoke all on public.webauthn_credentials from anon, authenticated;
