'use client';

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN DE ACCESO EN EL CLIENTE (S2)
//
// Guarda el token que emitió la ruta de login y se lo da al cliente de Supabase
// en cada petición. Vive en `localStorage` porque el TPV tiene que sobrevivir a
// recargas y a quedarse sin red en medio del partido; es el mismo sitio donde
// ya vivía `cantina_session`.
//
// El token es un secreto de sesión, no de sistema: sólo abre lo que su propio
// rol permite, y caduca. El secreto de FIRMA no sale nunca del servidor.
//
// OJO al cambiar el token: hay que avisar también a Realtime. La opción
// `accessToken` del cliente de Supabase NO llega al canal — la suscripción se
// establece pero no entrega nada, que fue exactamente el falso verde que costó
// una vuelta en la matriz de S1. Por eso `setAccessToken` toca las dos cosas.
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE = 'sc_access_token';

let enMemoria: string | null = null;
const oyentes = new Set<(token: string | null) => void>();

/** Token actual, o null si no hay sesión. */
export function getAccessToken(): string | null {
  if (enMemoria) return enMemoria;
  if (typeof window === 'undefined') return null;
  enMemoria = window.localStorage.getItem(CLAVE);
  return enMemoria;
}

/** Guarda el token (o lo borra con null) y avisa a quien escuche. */
export function setAccessToken(token: string | null) {
  enMemoria = token;
  if (typeof window !== 'undefined') {
    if (token) window.localStorage.setItem(CLAVE, token);
    else window.localStorage.removeItem(CLAVE);
  }
  oyentes.forEach((f) => f(token));
}

export function onAccessTokenChange(f: (token: string | null) => void): () => void {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}

/** Claims del token sin verificar firma: sólo para pintar la interfaz. */
export function readClaims(): Record<string, unknown> | null {
  const t = getAccessToken();
  if (!t) return null;
  try {
    return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/**
 * Lo que dice el token sobre quién es el usuario. NO es un control de acceso:
 * cualquiera puede editar su localStorage. El control real está en las
 * políticas y en la firma, que el navegador no puede falsificar.
 */
export function sessionRole(): 'pos' | 'admin' | 'client' | null {
  const c = readClaims();
  const r = c?.app_role;
  return r === 'pos' || r === 'admin' || r === 'client' ? r : null;
}

export function sessionExpired(): boolean {
  const c = readClaims();
  const exp = typeof c?.exp === 'number' ? c.exp : 0;
  return !exp || exp <= Math.floor(Date.now() / 1000);
}
