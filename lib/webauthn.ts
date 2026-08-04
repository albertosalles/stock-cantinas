import { createHmac, timingSafeEqual } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// WebAuthn · piezas de servidor (S6)
//
// La verificación criptográfica la hace @simplewebauthn/server. Aquí sólo vive
// lo que es propio de esta aplicación: de dónde salen el dominio y el origen, y
// cómo se guarda el reto entre las dos llamadas del flujo.
//
// EL RETO SE GUARDA EN UNA COOKIE FIRMADA, no en la base. WebAuthn necesita
// recordar entre «dame opciones» y «verifica esto» un valor de un solo uso y de
// vida muy corta; una tabla para eso obligaría a limpiarla y añadiría un viaje
// a la base en el camino del login. Firmada con el mismo secreto que los
// tokens, la cookie no se puede falsificar, y al ser httpOnly el JavaScript de
// la página no la lee.
// ─────────────────────────────────────────────────────────────────────────────

export const COOKIE_RETO = 'sc_webauthn_reto';
const TTL_RETO_SEGUNDOS = 5 * 60;

/**
 * Origen desde el que se ha servido la página.
 *
 * WebAuthn no admite discrepancias: el `rpID` tiene que corresponder al origen
 * real del navegador, y si no, el propio navegador rechaza la operación con
 * «The RP ID … is invalid for this domain». Por eso se deriva de la petición y
 * no de una variable de entorno, que era el diseño anterior: bastaba con que
 * `NEXT_PUBLIC_APP_URL` no estuviera puesta en un entorno —una preview, por
 * ejemplo— para que quedara el `localhost` de respaldo y la biometría fuera
 * inusable ahí, sin más pista que ese mensaje.
 *
 * Derivarlo de la cabecera `Host` es seguro: aunque alguien la falsifique, el
 * navegador sólo crea o usa una credencial cuyo `rpID` case con el origen que
 * él mismo tiene cargado, así que un valor inventado no abre nada.
 */
function origenDePeticion(request: Request): string | null {
  const cabeceras = request.headers;
  const origen = cabeceras.get('origin');
  if (origen) return origen;

  const host = cabeceras.get('x-forwarded-host') ?? cabeceras.get('host');
  if (!host) return null;
  const proto = cabeceras.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Origen esperado en la verificación. `NEXT_PUBLIC_APP_URL` sigue mandando
 * cuando coincide con el host real —permite fijar un dominio propio—, pero no
 * puede imponerse sobre él: si no casan, la operación fallaría igualmente.
 */
export function origen(request: Request): string {
  const real = origenDePeticion(request);
  const configurado = process.env.NEXT_PUBLIC_APP_URL;

  if (configurado) {
    const fijado = new URL(configurado).origin;
    if (!real || fijado === real) return fijado;
  }
  return real ?? 'http://localhost:3000';
}

/** Dominio de la passkey: el host, sin puerto ni esquema. */
export function rpID(request: Request): string {
  return new URL(origen(request)).hostname;
}

export const NOMBRE_APP = 'Stock Cantinas';

// ─── Reto firmado ────────────────────────────────────────────────────────────

function secreto(): string {
  const s = process.env.SUPABASE_JWT_SECRET;
  if (!s) throw new Error('Falta SUPABASE_JWT_SECRET');
  return s;
}

type Reto = { reto: string; proposito: 'registro' | 'login'; sujeto?: string; exp: number };

export function firmarReto(datos: Omit<Reto, 'exp'>): string {
  const payload: Reto = { ...datos, exp: Math.floor(Date.now() / 1000) + TTL_RETO_SEGUNDOS };
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = createHmac('sha256', secreto()).update(cuerpo).digest('base64url');
  return `${cuerpo}.${firma}`;
}

export function leerReto(cookie: string | undefined): Reto | null {
  if (!cookie) return null;
  const [cuerpo, firma] = cookie.split('.');
  if (!cuerpo || !firma) return null;

  const esperada = Buffer.from(createHmac('sha256', secreto()).update(cuerpo).digest('base64url'));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return null;
  if (!timingSafeEqual(esperada, recibida)) return null;

  try {
    const p: Reto = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
    if (p.exp <= Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}
