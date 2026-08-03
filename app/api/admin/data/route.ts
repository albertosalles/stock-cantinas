import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { esAdmin } from '@/lib/serverAuth';

// ─────────────────────────────────────────────────────────────────────────────
// MUTACIONES DE ADMINISTRACIÓN
//
// Desde S5b el navegador no escribe en la base: los GRANT de INSERT, UPDATE y
// DELETE están retirados. Lo que el panel hacía directamente pasa por aquí, tras
// comprobar la cookie de admin, y se ejecuta con `service_role`.
//
// OPERACIONES CON NOMBRE, no una pasarela genérica. Se podría haber hecho una
// ruta que aceptara tabla, operación y payload y ahorrarse este fichero, pero
// entonces la superficie de escritura volvería a ser «cualquier cosa» y bastaría
// un fallo de validación para reabrirlo todo. Cada operación de aquí dice
// exactamente qué toca y con qué campos; lo que no está listado, no se puede
// hacer.
//
// Fuera de aquí quedan a propósito:
//   · Las incidencias, que conservan escritura directa acotada por su política.
//   · El stock y las ventas, que van por RPC porque ahí viven la idempotencia y
//     el bloqueo ordenado de F1.5.
//   · Los PIN, que están en /api/admin/pins porque tocan credenciales.
// ─────────────────────────────────────────────────────────────────────────────

type Ctx = { db: ReturnType<typeof supabaseAdmin>; datos: Record<string, any> };

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const OPERACIONES: Record<string, (c: Ctx) => Promise<unknown>> = {
  // ─── Eventos ───
  'evento.crear': async ({ db, datos }) => {
    if (!texto(datos.name)) throw new Error('Debe introducir un nombre');
    const { data, error } = await db.from('events').insert({
      name: texto(datos.name),
      date: datos.date || null,
      season_id: datos.seasonId || null,
      kickoff_at: datos.kickoffAt ?? null,
      opponent_id: datos.opponentId ?? null,
      match_type: datos.matchType ?? null,
    }).select('id, name, date, status, season_id').single();
    if (error) throw error;
    return data;
  },

  'evento.actualizar': async ({ db, datos }) => {
    const { error } = await db.from('events').update({
      name: texto(datos.name),
      date: datos.date,
      kickoff_at: datos.kickoffAt,
      opponent_id: datos.opponentId,
      match_type: datos.matchType,
    }).eq('id', datos.id);
    if (error) throw error;
    return null;
  },

  'evento.estado': async ({ db, datos }) => {
    if (!['draft', 'live', 'closed'].includes(datos.status)) throw new Error('Estado no válido');
    const { error } = await db.from('events').update({ status: datos.status }).eq('id', datos.id);
    if (error) throw error;
    return null;
  },

  // ─── Temporadas ───
  'temporada.crear': async ({ db, datos }) => {
    if (!texto(datos.name)) throw new Error('El nombre es obligatorio');
    const { error } = await db.from('seasons').insert({
      name: texto(datos.name),
      starts_on: datos.startsOn || null,
      ends_on: datos.endsOn || null,
    });
    if (error) throw error;
    return null;
  },

  'temporada.activar': async ({ db, datos }) => {
    // Una sola temporada activa: lo garantiza el índice único parcial, así que
    // hay que desactivar la anterior antes de activar ésta.
    const { error: e1 } = await db.from('seasons').update({ active: false }).eq('active', true);
    if (e1) throw e1;
    const { error: e2 } = await db.from('seasons').update({ active: true, status: 'open' }).eq('id', datos.id);
    if (e2) throw e2;
    return null;
  },

  'temporada.cerrar': async ({ db, datos }) => {
    const { error } = await db.from('seasons')
      .update({ active: false, status: 'closed' }).eq('id', datos.id);
    if (error) throw error;
    return null;
  },

  // ─── Catálogo ───
  'producto.crear': async ({ db, datos }) => {
    if (!texto(datos.name)) throw new Error('Nombre requerido');
    const { error } = await db.from('products').insert({
      name: texto(datos.name),
      category: datos.category || null,
    });
    if (error) throw error;
    return null;
  },

  'producto.categoria': async ({ db, datos }) => {
    const { error } = await db.from('products')
      .update({ category: datos.category || null }).eq('id', datos.id);
    if (error) throw error;
    return null;
  },

  'catalogo.anadir': async ({ db, datos }) => {
    const { error } = await db.from('event_products').insert({
      event_id: datos.eventId,
      product_id: datos.productId,
      price_cents: datos.priceCents,
      low_stock_threshold: datos.threshold,
      active: datos.active,
    });
    if (error) throw error;
    return null;
  },

  'catalogo.guardar': async ({ db, datos }) => {
    const { error } = await db.from('event_products').update({
      price_cents: datos.priceCents,
      low_stock_threshold: datos.threshold,
      active: datos.active,
      featured: datos.featured,
    }).eq('id', datos.id);
    if (error) throw error;
    return null;
  },

  'catalogo.quitar': async ({ db, datos }) => {
    const { error } = await db.from('event_products').delete().eq('id', datos.id);
    if (error) throw error;
    return null;
  },

  // ─── Cantinas ───
  'cantina.crear': async ({ db, datos }) => {
    if (!texto(datos.name)) throw new Error('Nombre requerido');
    const { data, error } = await db.from('cantinas')
      .insert({ name: texto(datos.name) }).select('id').single();
    if (error) throw error;
    return data;
  },

  'cantina.asignar': async ({ db, datos }) => {
    if (datos.asignar) {
      const { error } = await db.from('event_cantinas')
        .insert({ event_id: datos.eventId, cantina_id: datos.cantinaId });
      if (error) throw error;
    } else {
      const { error } = await db.from('event_cantinas')
        .delete().match({ event_id: datos.eventId, cantina_id: datos.cantinaId });
      if (error) throw error;
    }
    return null;
  },

  // ─── Rivales y personal ───
  'rival.crear': async ({ db, datos }) => {
    if (!texto(datos.name)) throw new Error('Nombre requerido');
    const { data, error } = await db.from('opponents')
      .insert({ name: texto(datos.name) }).select('id, name').single();
    if (error) throw error;
    return data;
  },

  'camarero.activo': async ({ db, datos }) => {
    const { error } = await db.from('waiters')
      .update({ active: Boolean(datos.active) }).eq('id', datos.id);
    if (error) throw error;
    return null;
  },
};

export async function POST(request: Request) {
  if (!(await esAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let cuerpo: { op?: string; datos?: Record<string, any> };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición mal formada' }, { status: 400 });
  }

  const handler = cuerpo.op ? OPERACIONES[cuerpo.op] : undefined;
  if (!handler) {
    return NextResponse.json({ error: `Operación desconocida: ${cuerpo.op}` }, { status: 400 });
  }

  try {
    const data = await handler({ db: supabaseAdmin(), datos: cuerpo.datos ?? {} });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    // Los mensajes de Postgres son útiles para el admin: nombre duplicado,
    // temporada sin activar, precio inválido.
    const mensaje = e instanceof Error ? e.message : 'No se pudo guardar';
    console.error('admin/data:', cuerpo.op, e);
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
