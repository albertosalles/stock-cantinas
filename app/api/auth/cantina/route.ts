import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { signCantinaGrant } from '@/lib/authToken';

// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 DEL LOGIN · acreditar la cantina
//
// Acepta el QR del cartel de la barra o el par cantina + PIN. La validación se
// hace aquí, con `service_role`, porque desde S2 `resolve_cantina_qr` y
// `validate_cantina_access` están revocadas a `anon` y `authenticated`: el
// navegador ya no puede preguntarle a la base si un PIN es correcto.
//
// No devuelve un token de acceso, sino un VALE de diez minutos que sólo sirve
// para el paso 2. Sin esta separación, quien supiera el PIN de un camarero
// podría pedir un token para la barra que quisiera.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let cuerpo: { qrToken?: string; eventId?: string; cantinaId?: string; pin?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición mal formada' }, { status: 400 });
  }

  const db = supabaseAdmin();

  try {
    // ─── Camino del QR ───
    if (cuerpo.qrToken) {
      const { data, error } = await db.rpc('resolve_cantina_qr', { p_qr_token: cuerpo.qrToken });
      if (error) throw error;

      const fila = (data as Array<Record<string, string>> | null)?.[0];
      if (!fila) {
        return NextResponse.json(
          { error: 'QR no válido o la cantina no tiene ningún evento en vivo' },
          { status: 401 },
        );
      }

      const acceso = {
        eventId: fila.event_id,
        eventName: fila.event_name,
        cantinaId: fila.cantina_id,
        cantinaName: fila.cantina_name,
      };
      return NextResponse.json({
        acceso,
        vale: signCantinaGrant({
          event_id: acceso.eventId, cantina_id: acceso.cantinaId,
          event_name: acceso.eventName, cantina_name: acceso.cantinaName,
        }),
      });
    }

    if (!cuerpo.eventId || !cuerpo.cantinaId) {
      return NextResponse.json({ error: 'Faltan datos de acceso' }, { status: 400 });
    }

    // ─── Atajo de desarrollo: sin PIN ───
    // Es la otra mitad de DEV_EASY_LOGIN. Igual que en la ruta del camarero, el
    // entorno se comprueba AQUÍ y no sólo con la constante del cliente: un flag
    // de navegador no es un control de acceso.
    if (!cuerpo.pin) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Falta el PIN de la cantina' }, { status: 400 });
      }
      const { data, error } = await db
        .from('v_available_cantinas')
        .select('event_id, event_name, cantina_id, cantina_name')
        .eq('event_id', cuerpo.eventId)
        .eq('cantina_id', cuerpo.cantinaId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return NextResponse.json({ error: 'La cantina no está disponible en ese evento' }, { status: 401 });
      }
      const acceso = {
        eventId: data.event_id as string,
        eventName: data.event_name as string,
        cantinaId: data.cantina_id as string,
        cantinaName: data.cantina_name as string,
      };
      return NextResponse.json({
        acceso,
        vale: signCantinaGrant({
          event_id: acceso.eventId, cantina_id: acceso.cantinaId,
          event_name: acceso.eventName, cantina_name: acceso.cantinaName,
        }),
      });
    }

    // ─── Camino manual: evento + cantina + PIN ───

    const { data, error } = await db.rpc('validate_cantina_access', {
      p_event_id: cuerpo.eventId,
      p_cantina_id: cuerpo.cantinaId,
      p_pin_code: cuerpo.pin,
    });
    if (error) throw error;

    const r = (data as Array<Record<string, unknown>> | null)?.[0];
    if (!r?.success) {
      // El mensaje de la RPC distingue evento cerrado, cantina no asignada y
      // PIN incorrecto. Se conserva: son errores de operación que el camarero
      // necesita entender, no pistas útiles para nadie de fuera.
      return NextResponse.json({ error: (r?.message as string) ?? 'Acceso denegado' }, { status: 401 });
    }

    const acceso = {
      eventId: cuerpo.eventId,
      eventName: r.event_name as string,
      cantinaId: cuerpo.cantinaId,
      cantinaName: r.cantina_name as string,
    };
    return NextResponse.json({
      acceso,
      vale: signCantinaGrant({
        event_id: acceso.eventId, cantina_id: acceso.cantinaId,
        event_name: acceso.eventName, cantina_name: acceso.cantinaName,
      }),
    });
  } catch (e) {
    console.error('auth/cantina:', e);
    return NextResponse.json({ error: 'No se pudo validar el acceso' }, { status: 500 });
  }
}
