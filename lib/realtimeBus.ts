import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Bus de Realtime: UN canal por ámbito, compartido por todos los consumidores.
 *
 * Antes cada hook abría su propio canal. Un administrador con el evento abierto
 * mantenía CINCO suscripciones a la misma tabla con el mismo filtro (dashboard,
 * grid, notificaciones, rendimiento e incidencias), de modo que cada movimiento
 * de stock le llegaba cinco veces (INF-1, apartado 3.4). Aquí se abre un único
 * canal por ámbito y se reparte a los interesados en memoria.
 *
 * El ámbito determina también el FILTRO DEL SERVIDOR, que es lo que de verdad
 * recorta el tráfico:
 *   · TPV   → filtra por `cantina_id`. Antes filtraba por evento y descartaba en
 *             JavaScript el ~95 % de lo que recibía.
 *   · Admin → filtra por `event_id`, porque necesita ver todas las barras.
 */

export type RealtimeTable = 'stock_movements' | 'incidents';
export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

export interface RealtimeListener {
  tables: RealtimeTable[];
  onChange: () => void;
}

interface Scope {
  channel: RealtimeChannel;
  listeners: Set<RealtimeListener>;
  statusListeners: Set<(s: RealtimeStatus) => void>;
  status: RealtimeStatus;
  teardown: ReturnType<typeof setTimeout> | null;
  /** Mensajes recibidos del servidor; sólo para diagnóstico. */
  messageCount: number;
  /** Reparto interno, expuesto en desarrollo para poder probar la agrupación. */
  notify: (table: RealtimeTable) => void;
}

const scopes = new Map<string, Scope>();

/**
 * Invalidaciones emitidas, para poder comprobar la agrupación: la métrica del
 * problema era «27 mensajes por segundo producen 27 refetches por segundo».
 * Sólo se usa en desarrollo.
 */
let invalidationCount = 0;
export function countInvalidation() { invalidationCount++; }

/** El TPV se acota a su barra; el admin, al evento completo. */
function scopeKey(eventId: string, cantinaId?: string) {
  return cantinaId ? `cantina:${cantinaId}` : `evento:${eventId}`;
}

function createScope(key: string, eventId: string, cantinaId?: string): Scope {
  const filter = cantinaId ? `cantina_id=eq.${cantinaId}` : `event_id=eq.${eventId}`;

  const scope: Scope = {
    channel: null as unknown as RealtimeChannel,
    listeners: new Set(),
    statusListeners: new Set(),
    status: 'connecting',
    teardown: null,
    messageCount: 0,
    notify: () => {},
  };

  const notify = (table: RealtimeTable) => {
    scope.messageCount++;
    scope.listeners.forEach(l => {
      if (l.tables.includes(table)) l.onChange();
    });
  };

  scope.notify = notify;

  const setStatus = (s: RealtimeStatus) => {
    if (scope.status === s) return;
    scope.status = s;
    scope.statusListeners.forEach(fn => fn(s));
  };

  scope.channel = supabase
    .channel(key)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'stock_movements', filter },
      () => notify('stock_movements'))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'incidents', filter },
      () => notify('incidents'))
    .subscribe(status => {
      // La caída del WebSocket dejaba de notificarse en silencio: la app seguía
      // mostrando datos viejos sin señal alguna. Ahora el estado se propaga para
      // que la interfaz pueda avisar.
      if (status === 'SUBSCRIBED') setStatus('connected');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setStatus('disconnected');
      else setStatus('connecting');
    });

  return scope;
}

function getScope(eventId: string, cantinaId?: string): { key: string; scope: Scope } {
  const key = scopeKey(eventId, cantinaId);
  let scope = scopes.get(key);
  if (!scope) {
    scope = createScope(key, eventId, cantinaId);
    scopes.set(key, scope);
  }
  // Un cierre programado se cancela si alguien vuelve a engancharse (StrictMode
  // monta y desmonta los efectos dos veces en desarrollo).
  if (scope.teardown) {
    clearTimeout(scope.teardown);
    scope.teardown = null;
  }
  return { key, scope };
}

function releaseScope(key: string, scope: Scope) {
  if (scope.listeners.size > 0 || scope.statusListeners.size > 0) return;
  if (scope.teardown) return;
  scope.teardown = setTimeout(() => {
    if (scope.listeners.size > 0 || scope.statusListeners.size > 0) return;
    supabase.removeChannel(scope.channel);
    scopes.delete(key);
  }, 1000);
}

/** Engancha un consumidor al canal del ámbito. Devuelve la función de baja. */
export function joinRealtime(
  eventId: string,
  cantinaId: string | undefined,
  listener: RealtimeListener,
): () => void {
  const { key, scope } = getScope(eventId, cantinaId);
  scope.listeners.add(listener);
  return () => {
    scope.listeners.delete(listener);
    releaseScope(key, scope);
  };
}

/** Observa el estado de la conexión del ámbito. */
export function watchRealtimeStatus(
  eventId: string,
  cantinaId: string | undefined,
  onStatus: (s: RealtimeStatus) => void,
): () => void {
  const { key, scope } = getScope(eventId, cantinaId);
  scope.statusListeners.add(onStatus);
  onStatus(scope.status);
  return () => {
    scope.statusListeners.delete(onStatus);
    releaseScope(key, scope);
  };
}

/** Sólo para pruebas y diagnóstico: canales abiertos ahora mismo. */
export function debugOpenChannels(): string[] {
  return [...scopes.keys()];
}

/**
 * Diagnóstico en desarrollo: `window.__realtime` expone los canales abiertos, el
 * número de consumidores de cada uno y los mensajes recibidos.
 *
 * Existe porque el fan-out no se puede medir desde el banco de pruebas: su
 * límite está en el WebSocket y en los refetches del navegador, no en Postgres
 * (INF-4, apartado 6). Sin esto, «un canal por cliente» no sería comprobable.
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__realtime = {
    canales: () => [...scopes.entries()].map(([key, s]) => ({
      canal: key,
      consumidores: s.listeners.size,
      observadores_estado: s.statusListeners.size,
      estado: s.status,
      mensajes: s.messageCount,
    })),
    total: () => scopes.size,
    invalidaciones: () => invalidationCount,
    reiniciarContadores: () => { invalidationCount = 0; scopes.forEach(s => { s.messageCount = 0; }); },
    /**
     * Fuerza el estado de conexión para poder probar el aviso de caída, que de
     * otro modo sólo se vería tirando la red en medio de un partido.
     */
    forzarEstado: (estado: RealtimeStatus) => {
      scopes.forEach(s => {
        s.status = estado;
        s.statusListeners.forEach(fn => fn(estado));
      });
    },
    /**
     * Inyecta N avisos por el MISMO camino que un mensaje real del servidor.
     * Sirve para comprobar la agrupación sin escribir en la base de datos.
     */
    simular: (table: RealtimeTable, veces: number) => {
      scopes.forEach(s => { for (let i = 0; i < veces; i++) s.notify(table); });
    },
  };
}
