'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Mutaciones de administración desde el panel.
//
// Desde S5b el navegador no escribe en la base: los GRANT de INSERT, UPDATE y
// DELETE están retirados, así que estas llamadas pasan por /api/admin/data, que
// comprueba la cookie de admin.
//
// Si una de estas funciones devuelve «No autorizado», no es un fallo de red: es
// que la sesión de admin caducó o no existe.
// ─────────────────────────────────────────────────────────────────────────────

export async function adminOp<T = unknown>(op: string, datos: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/api/admin/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, datos }),
  });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(cuerpo.error ?? 'No se pudo guardar');
  return cuerpo.data as T;
}
