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
 * Dominio de la passkey. Tiene que ser el host sin puerto ni esquema, y una
 * credencial registrada en un dominio NO sirve en otro: si esto cambia entre
 * desarrollo y producción, las passkeys registradas dejan de funcionar.
 */
export function rpID(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return new URL(url).hostname;
}

/**
 * Origen esperado en la verificación. El navegador lo manda SIN barra final y
 * sin ruta, así que la comparación es exacta y un `https://dominio/` copiado
 * del navegador bastaría para que toda aserción fuera rechazada — con un error
 * que no dice nada sobre la barra. Se normaliza aquí en vez de confiar en cómo
 * se haya escrito la variable de entorno.
 */
export function origen(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return new URL(url).origin;
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
