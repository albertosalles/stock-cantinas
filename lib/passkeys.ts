'use client';

import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { getAccessToken, setAccessToken } from '@/lib/session';

// ─────────────────────────────────────────────────────────────────────────────
// Acceso biométrico desde el navegador (S6)
//
// «FaceID» es el nombre que le pone iOS; por debajo es WebAuthn con el
// autenticador de plataforma, y en Android sale la huella. La parte
// criptográfica la hace el sistema operativo: aquí sólo se pasan mensajes.
// ─────────────────────────────────────────────────────────────────────────────

/** Si el dispositivo tiene autenticador de plataforma disponible. */
export async function hayBiometria(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function llamar(url: string, cuerpo: unknown, conToken = false) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // El registro desde el TPV se autentica con el token; el del admin, con su
  // cookie. Por eso el token va sólo cuando lo hay.
  if (conToken) {
    const t = getAccessToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(cuerpo) });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos.error ?? 'Error'), { status: res.status });
  return datos;
}

/** Registra este dispositivo. Requiere sesión iniciada. */
export async function registrarPasskey(etiqueta?: string): Promise<void> {
  const { opciones } = await llamar('/api/auth/passkey/registro', { paso: 'opciones' }, true);
  const respuesta = await startRegistration({ optionsJSON: opciones });
  await llamar('/api/auth/passkey/registro', { paso: 'verificar', respuesta, etiqueta }, true);
}

export type AccesoPasskey =
  | { rol: 'admin'; token: string }
  | { rol: 'pos'; token: string; sesion: Record<string, unknown> };

/**
 * Entra con la passkey de este dispositivo.
 *
 * Lanza un error con `status === 409` cuando el camarero no tiene turno
 * abierto: la passkey acredita quién eres, no en qué barra estás, así que ahí
 * hay que pasar por el QR o el PIN de la cantina.
 */
export async function entrarConPasskey(): Promise<AccesoPasskey> {
  const { opciones } = await llamar('/api/auth/passkey/login', { paso: 'opciones' });
  const respuesta = await startAuthentication({ optionsJSON: opciones });
  const datos = await llamar('/api/auth/passkey/login', { paso: 'verificar', respuesta });

  setAccessToken(datos.token);
  if (datos.rol === 'pos') {
    localStorage.setItem('cantina_session', JSON.stringify(datos.sesion));
    return { rol: 'pos', token: datos.token, sesion: datos.sesion };
  }
  return { rol: 'admin', token: datos.token };
}
