import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { signAccessToken, verifyCantinaGrant, TTL_POS_SEGUNDOS } from '@/lib/authToken';

// ─────────────────────────────────────────────────────────────────────────────
// PASO 2 DEL LOGIN · identificar a la persona y emitir el token
//
// Exige el vale del paso 1: la cantina y el evento salen de ahí, NO de lo que
// mande el navegador. Es el mismo principio que S3 aplicará a las RPC — la
// identidad se deriva de algo firmado, no se recibe por parámetro —, sólo que
// aquí lo firmado es el vale.
//
// Emite el token de acceso con `cantina_id` y `waiter_id` dentro, que es lo que
// las políticas de S4 y S5 leerán, y lo que hace que Realtime entregue sólo los
// movimientos de esta barra.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let cuerpo: { vale?: string; qrToken?: string; pin?: string; waiterId?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición mal formada' }, { status: 400 });
  }

  const vale = verifyCantinaGrant(cuerpo.vale);
  if (!vale) {
    return NextResponse.json(
      { error: 'El acceso a la cantina ha caducado. Vuelve a escanear el QR o introduce el PIN.' },
      { status: 401 },
    );
  }

  const db = supabaseAdmin();

  try {
    let waiterId: string | null = null;
    let waiterName: string | null = null;

    if (cuerpo.qrToken || cuerpo.pin) {
      const { data, error } = await db.rpc('identify_waiter', {
        p_qr_token: cuerpo.qrToken ?? null,
        p_pin: cuerpo.pin ?? null,
      });
      if (error) throw error;
      const fila = (data as Array<Record<string, string>> | null)?.[0];
      if (fila) { waiterId = fila.waiter_id; waiterName = fila.waiter_name; }
    } else if (cuerpo.waiterId && process.env.NODE_ENV !== 'production') {
      // Atajo del login simplificado de desarrollo: elegir al camarero de una
      // lista, sin QR ni PIN. Se comprueba el entorno AQUÍ, en el servidor, y no
      // sólo con la constante del cliente: un flag de navegador no es un
      // control de acceso, y este atajo entrega una sesión de TPV.
      const { data, error } = await db
        .from('waiters')
        .select('id, name, surname')
        .eq('id', cuerpo.waiterId)
        .eq('active', true)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        waiterId = data.id as string;
        waiterName = `${data.name} ${data.surname ?? ''}`.trim();
      }
    }

    if (!waiterId || !waiterName) {
      return NextResponse.json({ error: 'Camarero no encontrado o desactivado' }, { status: 401 });
    }

    // Abrir turno cierra el que tuviera abierto en otra barra e imputa horas.
    const { data: shiftId, error: errTurno } = await db.rpc('open_shift', {
      p_waiter_id: waiterId,
      p_event_id: vale.event_id,
      p_cantina_id: vale.cantina_id,
    });
    if (errTurno) throw errTurno;

    const { token, expiraEn } = signAccessToken({
      app_role: 'pos',
      sub: waiterId,
      event_id: vale.event_id,
      cantina_id: vale.cantina_id,
      waiter_id: waiterId,
    }, TTL_POS_SEGUNDOS);

    return NextResponse.json({
      token,
      expiraEn,
      sesion: {
        eventId: vale.event_id,
        eventName: vale.event_name,
        cantinaId: vale.cantina_id,
        cantinaName: vale.cantina_name,
        waiterId,
        waiterName,
        shiftId,
        loginTime: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('auth/waiter:', e);
    return NextResponse.json({ error: 'No se pudo iniciar la sesión' }, { status: 500 });
  }
}
