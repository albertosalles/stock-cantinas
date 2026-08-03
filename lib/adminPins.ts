'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Fijar PIN desde el panel de admin.
//
// Desde S2 no se llama a `set_cantina_pin` / `set_waiter_pin` por PostgREST:
// están revocadas a `anon` y `authenticated` porque tocan credenciales. Se pasa
// por /api/admin/pins, que comprueba la cookie de admin y ejecuta la RPC con
// `service_role`.
//
// Es de una sola dirección: se puede fijar, nunca leer. Si el admin olvida un
// PIN, lo vuelve a fijar.
// ─────────────────────────────────────────────────────────────────────────────

async function llamar(cuerpo: Record<string, unknown>) {
  const res = await fetch('/api/admin/pins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar el PIN');
  return datos;
}

export function setCantinaPin(cantinaId: string, pin: string, isActive = true) {
  return llamar({ tipo: 'cantina', id: cantinaId, pin: pin.trim(), isActive });
}

/** PIN vacío se lo quita al camarero: entonces sólo podrá entrar con su QR. */
export function setWaiterPin(waiterId: string, pin: string) {
  return llamar({ tipo: 'camarero', id: waiterId, pin: pin.trim() });
}

/**
 * Alta de camarero con su PIN, en una sola operación.
 *
 * Va junta a propósito: separarlas dejaba un camarero creado y sin PIN cuando
 * el código colisionaba con el de otro, y el admin no se enteraba.
 */
export function createWaiter(nombre: string, apellidos: string, pin: string) {
  return llamar({ tipo: 'alta-camarero', nombre: nombre.trim(), apellidos: apellidos.trim(), pin: pin.trim() });
}
