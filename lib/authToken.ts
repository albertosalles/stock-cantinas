import { createHmac, timingSafeEqual } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// EMISIÓN Y VERIFICACIÓN DEL TOKEN DE ACCESO (S2)
//
// Firmamos nosotros el JWT con el secreto del proyecto Supabase, en vez de usar
// Supabase Auth. Las dos razones están en el ADR y son propias de este sistema:
//
//   · REALTIME. postgres_changes aplica RLS con el token de la conexión. Si el
//     TPV siguiera conectado como `anon`, o dejábamos stock_movements abierto a
//     todo el mundo o perdíamos el tiempo real. Las rutas de servidor no pueden
//     rescatar eso: la identidad tiene que viajar en el token.
//   · OFFLINE-FIRST. Firmando nosotros decidimos el `exp` y no dependemos de
//     refrescos. Un TPV puede pasar dos horas sin red en pleno partido; con un
//     token que caduca a la hora, al volver la cola de IndexedDB no podría
//     sincronizar.
//
// Este módulo es SÓLO DE SERVIDOR. El secreto de firma no puede llegar al
// navegador: quien lo tenga puede fabricarse el rol que quiera.
// ─────────────────────────────────────────────────────────────────────────────

export type AppRole = 'pos' | 'admin' | 'client';

export type AccessClaims = {
  /** Rol de la aplicación, el que leerán las políticas RLS. */
  app_role: AppRole;
  /** Sujeto: camarero, cliente o 'admin'. */
  sub: string;
  event_id?: string;
  cantina_id?: string;
  waiter_id?: string;
};

type Payload = AccessClaims & {
  iss: string;
  /** Rol de Postgres al que conmuta PostgREST. NO es el rol de la aplicación. */
  role: 'authenticated';
  iat: number;
  exp: number;
};

// Cubre una jornada entera con margen de sobra para que la cola offline
// sincronice después del partido. Es un `exp` largo a propósito: sin
// revocación, es el riesgo que el ADR acepta a cambio del offline-first.
export const TTL_POS_SEGUNDOS = 16 * 60 * 60;
export const TTL_ADMIN_SEGUNDOS = 12 * 60 * 60;

const EMISOR = 'stock-cantinas';

function secreto(): string {
  const s = process.env.SUPABASE_JWT_SECRET;
  if (!s) {
    throw new Error(
      'Falta SUPABASE_JWT_SECRET. Es el secreto JWT del proyecto Supabase y ' +
      'debe coincidir con el del NEXT_PUBLIC_SUPABASE_URL configurado, o los ' +
      'tokens que firmemos no los aceptará PostgREST.',
    );
  }
  return s;
}

const b64url = (buf: Buffer | string) =>
  (typeof buf === 'string' ? Buffer.from(buf) : buf).toString('base64url');

function firmar(datos: string): string {
  return createHmac('sha256', secreto()).update(datos).digest('base64url');
}

/** Firma un token de acceso. Devuelve el JWT y cuándo caduca. */
export function signAccessToken(
  claims: AccessClaims,
  ttlSegundos: number,
): { token: string; expiraEn: number } {
  const ahora = Math.floor(Date.now() / 1000);
  const payload: Payload = {
    ...claims,
    iss: EMISOR,
    // Siempre `authenticated`: es el rol de Postgres. La distinción entre TPV,
    // admin y cliente vive en `app_role`, no aquí. Confundirlos daría a un
    // camarero los privilegios de tabla del administrador.
    role: 'authenticated',
    iat: ahora,
    exp: ahora + ttlSegundos,
  };

  const cabecera = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify(payload));
  const firma = firmar(`${cabecera}.${cuerpo}`);

  return { token: `${cabecera}.${cuerpo}.${firma}`, expiraEn: payload.exp };
}

// ─── Vale de cantina ─────────────────────────────────────────────────────────
// El login son dos pasos: primero se acredita la cantina (QR o PIN) y después
// la persona. Entre uno y otro hay que poder demostrar que el primero se pasó,
// o cualquiera podría pedir un token para la barra que quisiera con sólo saber
// el PIN de su camarero.
//
// El vale NO lleva la claim `role`, así que PostgREST lo trata como anónimo: no
// abre absolutamente nada por sí mismo. Sólo vale para la ruta del paso dos.

const TTL_VALE_SEGUNDOS = 10 * 60;

type Vale = {
  iss: string;
  purpose: 'cantina-grant';
  event_id: string;
  cantina_id: string;
  event_name: string;
  cantina_name: string;
  iat: number;
  exp: number;
};

export function signCantinaGrant(datos: {
  event_id: string; cantina_id: string; event_name: string; cantina_name: string;
}): string {
  const ahora = Math.floor(Date.now() / 1000);
  const payload: Vale = {
    ...datos,
    iss: EMISOR,
    purpose: 'cantina-grant',
    iat: ahora,
    exp: ahora + TTL_VALE_SEGUNDOS,
  };
  const cabecera = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify(payload));
  return `${cabecera}.${cuerpo}.${firmar(`${cabecera}.${cuerpo}`)}`;
}

export function verifyCantinaGrant(token: string | undefined | null): Vale | null {
  const p = verificarFirma(token) as Vale | null;
  if (!p || p.purpose !== 'cantina-grant') return null;
  return p;
}

/** Verifica firma y caducidad. Devuelve null si el token no es de fiar. */
export function verifyAccessToken(token: string | undefined | null): Payload | null {
  const p = verificarFirma(token) as Payload | null;
  // Un vale de cantina no es un token de acceso, aunque lo firme la misma clave.
  if (!p || (p as unknown as Vale).purpose === 'cantina-grant') return null;
  if (p.role !== 'authenticated') return null;
  return p;
}

function verificarFirma(token: string | undefined | null): Record<string, unknown> | null {
  if (!token) return null;

  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabecera, cuerpo, firma] = partes;

  const esperada = Buffer.from(firmar(`${cabecera}.${cuerpo}`));
  const recibida = Buffer.from(firma);
  // Comparación en tiempo constante: comparar firmas con === filtra información
  // por el tiempo de respuesta.
  if (esperada.length !== recibida.length) return null;
  if (!timingSafeEqual(esperada, recibida)) return null;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
  } catch {
    return null;
  }

  if (payload.iss !== EMISOR) return null;
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload;
}
