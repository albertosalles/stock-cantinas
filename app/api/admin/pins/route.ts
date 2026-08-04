import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { esAdmin } from '@/lib/serverAuth';

// ─────────────────────────────────────────────────────────────────────────────
// FIJAR PIN · de cantina o de camarero
//
// El admin sigue eligiendo el código (decidido el 2026-08-03). Lo que cambia es
// que pasa por aquí: `set_cantina_pin` y `set_waiter_pin` están revocadas a
// `anon` y `authenticated` desde S2, porque tocan credenciales y no deben ser
// alcanzables desde el navegador de nadie.
//
// El PIN se guarda hasheado, así que esta ruta es de una sola dirección: se
// puede fijar, nunca leer. Si el admin lo olvida, lo vuelve a fijar.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!(await esAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let cuerpo: {
    tipo?: 'cantina' | 'camarero' | 'alta-camarero';
    id?: string; pin?: string; isActive?: boolean;
    nombre?: string; apellidos?: string;
  };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición mal formada' }, { status: 400 });
  }

  if (cuerpo.tipo !== 'cantina' && cuerpo.tipo !== 'camarero' && cuerpo.tipo !== 'alta-camarero') {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }
  if (cuerpo.tipo !== 'alta-camarero' && !cuerpo.id) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  const db = supabaseAdmin();

  try {
    if (cuerpo.tipo === 'alta-camarero') {
      // Alta y PIN en una sola transacción: si el PIN colisiona no debe quedar
      // un camarero a medias, que es lo que pasaba al hacerlo en dos pasos.
      const { data, error } = await db.rpc('create_waiter', {
        p_name: cuerpo.nombre ?? '',
        p_surname: cuerpo.apellidos ?? '',
        p_pin: cuerpo.pin ?? null,
      });
      if (error) throw error;
      return NextResponse.json({ success: true, id: data });
    }

    if (cuerpo.tipo === 'cantina') {
      const { error } = await db.rpc('set_cantina_pin', {
        p_cantina_id: cuerpo.id,
        p_pin_code: cuerpo.pin ?? '',
        p_is_active: cuerpo.isActive ?? true,
      });
      if (error) throw error;
    } else {
      // PIN vacío se lo quita al camarero: entonces sólo entra con su QR.
      const { error } = await db.rpc('set_waiter_pin', {
        p_waiter_id: cuerpo.id,
        p_pin: cuerpo.pin ?? null,
      });
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    // Los mensajes de las RPC son de operación y le sirven al admin: «el PIN
    // debe tener entre 4 y 8 dígitos», «ese PIN ya lo tiene otro camarero».
    const mensaje = e instanceof Error ? e.message : 'No se pudo guardar el PIN';
    console.error('admin/pins:', e);
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
