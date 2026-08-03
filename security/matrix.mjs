#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MATRIZ DE EXPECTATIVAS DE SEGURIDAD · rol × tabla × operación
//
// Comprueba el contrato de contract.mjs contra el stack LOCAL, atacando
// PostgREST con un token por rol. Por la ruta real y no por SQL directo: la
// lección cara de F1 es que cada capa devuelve «correcto» por separado mientras
// falta el paso que une las piezas. Un SELECT en psql no pasa por PostgREST ni
// por RLS, así que no demuestra nada sobre lo que ve un cliente.
//
//   node security/matrix.mjs            ejecuta la matriz
//   node security/matrix.mjs --reset    resiembra antes (recomendado: las
//                                       escrituras que HOY pasan contaminan)
//   node security/matrix.mjs --verbose  detalla cada comprobación
//
// Requiere el stack local levantado (`colima start && supabase start`).
// Firma sus propios tokens con el secreto local, así que funciona ANTES de que
// exista la emisión de tokens de S2: el contrato se puede verificar desde el
// primer día.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac } from 'node:crypto';
import { execSync } from 'node:child_process';
import { FIXTURE, ROLES, TABLES, RPC, RPC_SOLO_SERVIDOR, RPC_ABIERTAS_A_ANON } from './contract.mjs';

const API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET
  ?? 'super-secret-jwt-token-with-at-least-32-characters-long';
const ANON_KEY = process.env.SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const VERBOSE = process.argv.includes('--verbose');
const ROLE_NAMES = Object.keys(ROLES);

// ─── Firma HS256 sin dependencias ────────────────────────────────────────────
// A propósito a mano: deja a la vista qué claims lleva el token, que es
// justo la decisión que toma el ADR de F2.
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function mintToken(name) {
  const r = ROLES[name];
  if (name === 'anon') return ANON_KEY;
  const payload = {
    iss: 'stock-cantinas',
    sub: r.waiterId ?? r.clientId ?? 'admin',
    role: r.pgRole,          // el rol de Postgres al que conmuta PostgREST
    app_role: r.appRole,     // el rol de la aplicación, que leen las políticas
    ...(r.eventId   ? { event_id: r.eventId }     : {}),
    ...(r.cantinaId ? { cantina_id: r.cantinaId } : {}),
    ...(r.waiterId  ? { waiter_id: r.waiterId }   : {}),
    ...(r.clientId  ? { client_id: r.clientId }   : {}),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

const TOKENS = Object.fromEntries(ROLE_NAMES.map((r) => [r, mintToken(r)]));

// ─── Cliente PostgREST ───────────────────────────────────────────────────────
async function rest(token, path, init = {}) {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  let body = null;
  const text = await res.text();
  if (text) { try { body = JSON.parse(text); } catch { body = text; } }
  return { status: res.status, body };
}

// 401/403 y el 42501 de Postgres son «sin privilegio». Un 400 significa que la
// petición llegó y fue rechazada por inválida: el rol SÍ tenía acceso.
const isDenied = (r) =>
  r.status === 401 || r.status === 403 || r?.body?.code === '42501';

// ─── Comprobaciones de lectura ───────────────────────────────────────────────
async function checkRead(table, role, scope, totals) {
  const exento = (table.forbiddenSalvo ?? []).includes(role);
  // Un `select=*` sobre una tabla con columnas restringidas se deniega entero,
  // y eso no distingue «columna protegida» de «tabla cerrada». Se pide la lista
  // legítima y la columna prohibida se sondea aparte.
  const cols = (!exento && table.columnas) ? table.columnas.join(',') : '*';
  const r = await rest(TOKENS[role], `${table.name}?select=${cols}`);
  const rows = Array.isArray(r.body) ? r.body : null;
  const total = totals[table.name];
  const eventKey = table.eventKey ?? 'event_id';

  const fail = (msg) => ({ ok: false, detail: msg });
  const pass = (msg) => ({ ok: true, detail: msg });

  if (scope === 'none') {
    if (isDenied(r)) return pass('denegado');
    if (rows && rows.length === 0) return pass('0 filas');
    return fail(`ve ${rows ? rows.length : '?'} filas (debería no ver ninguna)`);
  }

  if (isDenied(r)) return fail(`denegado, pero debería poder leer (${scope})`);
  if (!rows) return fail(`respuesta inesperada ${r.status}`);

  // Columnas que no deben viajar, aunque la fila sea visible.
  if (!exento) {
    const leaked = (table.forbidden ?? []).filter((c) => rows.some((row) => c in row));
    if (leaked.length) return fail(`expone ${leaked.join(', ')}`);

    // Y pedirlas explícitamente tiene que fallar: si no, basta con nombrarlas.
    for (const c of table.forbidden ?? []) {
      const sonda = await rest(TOKENS[role], `${table.name}?select=${c}`);
      if (!isDenied(sonda)) return fail(`puede pedir ${c} si lo nombra`);
    }
  }

  if (scope === 'all') {
    return rows.length === total ? pass(`${rows.length} filas`)
      : fail(`ve ${rows.length} de ${total}`);
  }
  if (scope === 'subset') {
    return rows.length > 0 && rows.length < total ? pass(`${rows.length} de ${total}`)
      : fail(`ve ${rows.length} de ${total} (debería ver un subconjunto)`);
  }
  if (scope === 'live_event') {
    const intrusas = rows.filter((row) => row[eventKey] !== FIXTURE.EVENT_LIVE);
    if (intrusas.length) return fail(`${intrusas.length} filas de otro evento`);
    return rows.length > 0 ? pass(`${rows.length} filas, sólo del evento en curso`)
      : fail('no ve nada del evento en curso');
  }
  if (scope === 'own_cantina') {
    const ajenas = rows.filter((row) => row.cantina_id !== FIXTURE.CANTINA_A);
    if (ajenas.length) return fail(`${ajenas.length} filas de otra cantina`);
    // Su barra pero de OTRO partido tampoco: el histórico no es suyo.
    const otroEvento = rows.filter((row) => 'event_id' in row && row[eventKey] !== FIXTURE.EVENT_LIVE);
    if (otroEvento.length) return fail(`${otroEvento.length} filas de otro evento en su misma barra`);
    if (rows.length === 0) return fail('no ve ni su propia cantina');
    if (rows.length === total) return fail(`ve las ${total} filas: el filtro por cantina no actúa`);
    return pass(`${rows.length} de ${total}, sólo su cantina`);
  }
  return fail(`ámbito desconocido: ${scope}`);
}

// ─── Comprobaciones de escritura ─────────────────────────────────────────────
// UPDATE y DELETE se sondean con un id inexistente: si el rol tiene privilegio
// devuelve 2xx sin tocar nada, y si no, 4xx. Así el sondeo no altera el fixture.
// El INSERT no admite ese truco — si pasa, pasa —, por eso las lecturas se
// ejecutan todas antes que las escrituras.
//
// EL PATCH TIENE QUE LLEVAR UN CAMPO REAL. Con el cuerpo vacío, PostgREST
// devuelve 204 sin llegar a tocar la base, así que la sonda daba SIEMPRE
// «permitido» y no medía nada: 75 rojos que no eran hallazgos. Con una columna
// de verdad, un privilegio retirado responde 42501 como debe.
const NADIE = '00000000-0000-4000-8000-999999999999';

// Clave por la que se filtra el sondeo. Por defecto un id inexistente, para no
// tocar el fixture. Las tablas que CONSERVAN el privilegio de escritura —las
// incidencias— necesitan apuntar a una fila real: con el privilegio puesto, un
// UPDATE que no encuentra nada devuelve 2xx igual que uno permitido, y no se
// distinguiría «lo filtró la política» de «no había fila».
const filtro = (table) => {
  if (table.sondaReal) return table.sondaReal;
  const clave = table.name === 'cantina_stock' || table.name === 'cantina_access' ? 'cantina_id' : 'id';
  return `${clave}=eq.${NADIE}`;
};

const PATCH_PAYLOAD = {
  events: { name: 'sonda' },
  cantinas: { name: 'sonda' },
  event_cantinas: { cantina_id: FIXTURE.CANTINA_B },
  products: { name: 'sonda' },
  event_products: { price_cents: 1 },
  seasons: { name: 'sonda' },
  opponents: { name: 'sonda' },
  waiters: { name: 'sonda' },
  cantina_access: { is_active: false },
  users: { name: 'sonda' },
  shifts: { hours: 1 },
  incidents: { description: 'sonda' },
  sales: { total_cents: 1 },
  sale_line_items: { qty: 1 },
  stock_movements: { reason: 'sonda' },
  cantina_stock: { qty: 1 },
  inventory_snapshots: { qty: 1 },
};

const INSERT_PAYLOAD = {
  events: { name: 'INTRUSO', date: '2026-09-01T00:00:00Z', status: 'draft' },
  cantinas: { name: 'INTRUSA' },
  event_cantinas: { event_id: FIXTURE.EVENT_LIVE, cantina_id: FIXTURE.CANTINA_B },
  products: { name: 'INTRUSO' },
  event_products: { event_id: FIXTURE.EVENT_CLOSED, product_id: FIXTURE.PRODUCT_1, price_cents: 1 },
  seasons: { name: 'INTRUSA' },
  opponents: { name: 'INTRUSO' },
  waiters: { name: 'INTRUSO' },
  cantina_access: { cantina_id: FIXTURE.CANTINA_B, pin_hash: 'x' },
  users: { email: 'intruso@local.test' },
  shifts: { waiter_id: FIXTURE.WAITER_A, cantina_id: FIXTURE.CANTINA_B, event_id: FIXTURE.EVENT_LIVE },
  incidents: { event_id: FIXTURE.EVENT_LIVE, cantina_id: FIXTURE.CANTINA_A, type: 'OTHER', description: 'sonda' },
  sales: { event_id: FIXTURE.EVENT_LIVE, cantina_id: FIXTURE.CANTINA_B, total_cents: 1, total_items: 1 },
  sale_line_items: { product_id: FIXTURE.PRODUCT_1, qty: 1, unit_price_cents: 1 },
  stock_movements: { event_id: FIXTURE.EVENT_LIVE, cantina_id: FIXTURE.CANTINA_B, product_id: FIXTURE.PRODUCT_1, qty: 999, type: 'ADJUSTMENT' },
  cantina_stock: { event_id: FIXTURE.EVENT_LIVE, cantina_id: FIXTURE.CANTINA_B, product_id: FIXTURE.PRODUCT_1, qty: 999 },
  inventory_snapshots: { event_id: FIXTURE.EVENT_CLOSED, cantina_id: FIXTURE.CANTINA_A, product_id: FIXTURE.PRODUCT_1, kind: 'FINAL', qty: 1 },
};

async function checkWrite(table, role, op, rule) {
  const permitido = rule === 'allow'
    || (rule === 'allow_pos' && role === 'pos')
    || (rule === 'allow_admin' && role === 'admin');

  let r;
  if (op === 'insert') {
    const payload = INSERT_PAYLOAD[table.name];
    if (!payload) return null;
    r = await rest(TOKENS[role], table.name, { method: 'POST', body: JSON.stringify(payload) });
  } else if (op === 'update') {
    const parche = PATCH_PAYLOAD[table.name];
    if (!parche) return null;
    r = await rest(TOKENS[role], `${table.name}?${filtro(table)}`,
      { method: 'PATCH', body: JSON.stringify(parche), headers: { Prefer: 'return=representation' } });
  } else {
    r = await rest(TOKENS[role], `${table.name}?${filtro(table)}`,
      { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  }

  // Cuando el sondeo va contra una fila REAL, un 2xx que no devuelve nada
  // significa que la política lo filtró: hay privilegio pero no alcance.
  const vacio = Array.isArray(r.body) && r.body.length === 0;

  const denegado = isDenied(r) || (op !== 'insert' && table.sondaReal && vacio);
  if (permitido) {
    return denegado ? { ok: false, detail: `denegado, debería poder ${op}` }
                    : { ok: true, detail: `permitido (${r.status})` };
  }
  return denegado ? { ok: true, detail: 'denegado' }
                  : { ok: false, detail: `PERMITIDO (${r.status})` };
}

// ─── Privilegios EXECUTE sobre las RPC ───────────────────────────────────────
function checkRpcGrants() {
  // Se enumeran TODAS las funciones y se pregunta por cada una. La primera
  // versión sacaba el universo de la propia lista de concedidas, así que una
  // función bien revocada desaparecía del recuento en vez de contar como
  // verde: el marcador decía «0 de 22 cerradas» justo después de cerrar siete.
  const salida = execSync(
    `psql "${DB_URL}" -At -c "select p.proname || '|' ` +
    `|| has_function_privilege('anon', p.oid, 'EXECUTE') || '|' ` +
    `|| has_function_privilege('authenticated', p.oid, 'EXECUTE') ` +
    `from pg_proc p join pg_namespace n on n.oid = p.pronamespace ` +
    `where n.nspname = 'public' order by 1;"`,
    { encoding: 'utf8' },
  );

  // `anon` no debe poder ejecutar NADA: ni siquiera el login, que pasa a rutas
  // de servidor con service_role en S2.
  // psql imprime los booleanos como `true`/`false`, no como `t`/`f`. Compararlos
  // con `t` daba siempre falso y la sección entera salía verde: 29 de 29
  // funciones «cerradas» cuando sólo se habían cerrado siete. Se normaliza y se
  // aborta ante cualquier valor inesperado, antes que volver a inventarse un
  // verde.
  const aBooleano = (v, fn) => {
    if (v === 'true' || v === 't') return true;
    if (v === 'false' || v === 'f') return false;
    throw new Error(`Privilegio ilegible para ${fn}: "${v}"`);
  };

  return salida.trim().split('\n').filter(Boolean).map((linea) => {
    const [fn, anonPuede] = linea.split('|');
    const abierto = aBooleano(anonPuede, fn);
    const soloServidor = RPC_SOLO_SERVIDOR.includes(fn);
    const excepcion = RPC_ABIERTAS_A_ANON.includes(fn);
    return {
      fn, role: 'anon',
      // Las excepciones tienen que estar abiertas de verdad: si una se cerrara
      // por accidente, el login dejaría de funcionar y conviene enterarse aquí.
      ok: excepcion ? abierto : !abierto,
      detail: excepcion ? (abierto ? 'abierta (excepción razonada)' : 'CERRADA, y el login la necesita')
            : abierto ? (soloServidor ? 'PERMITIDO (debe ser sólo de servidor)' : 'PERMITIDO')
            : 'denegado',
    };
  });
}

// ─── Suplantación: lo que el RLS NO puede arreglar ───────────────────────────
// 12 funciones son SECURITY DEFINER y reciben la identidad por parámetro. Se
// comprueba de verdad: el camarero de la Cantina Norte intenta vender en la Sur
// y atribuirlo a un camarero que no es él. Debe fallar. Hoy no falla, y ningún
// RLS lo impediría — lo arregla S3 quitando esos parámetros de la firma.
async function checkSuplantacion() {
  const r = await rest(TOKENS.pos, 'rpc/create_sale', {
    method: 'POST',
    body: JSON.stringify({
      p_event_id: FIXTURE.EVENT_LIVE,
      p_cantina_id: FIXTURE.CANTINA_B,          // no es la suya
      p_user_id: null,
      p_lines: [{ productId: FIXTURE.PRODUCT_1, qty: 1 }],
      p_client_request_id: crypto.randomUUID(),
      p_allow_oversell: false,
      p_waiter_id: '3a17e000-0000-4000-8000-00000000000b', // no es él
    }),
  });
  const bloqueado = isDenied(r) || r.status >= 400;
  return {
    ok: bloqueado,
    detail: bloqueado ? `bloqueado (${r.status})`
                      : 'VENTA CREADA en otra cantina y atribuida a otro camarero',
  };
}

// ─── Escalada de rol ─────────────────────────────────────────────────────────
// El TPV y el admin comparten el rol de Postgres `authenticated`: la diferencia
// vive en `app_role`, así que un GRANT no puede separarlos. Sin una guarda
// dentro de la función, un token de TPV llama a get_event_dashboard y lee la
// facturación del evento entero, saltándose el acotado por cantina.
//
// Y como son SECURITY DEFINER, esto NO lo arreglaría el RLS de S5. Por eso va
// junto a la suplantación y no en la tabla de lecturas.
const RPC_DE_ADMIN = [
  ['get_event_dashboard', { p_event_id: FIXTURE.EVENT_LIVE }],
  ['get_event_cantinas_grid', { p_event_id: FIXTURE.EVENT_LIVE }],
  ['get_event_waiter_performance', { p_event_id: FIXTURE.EVENT_LIVE }],
  ['get_sales_by_hour', { p_event_id: FIXTURE.EVENT_LIVE }],
  ['get_stock_alerts', { p_event_id: FIXTURE.EVENT_LIVE }],
  ['rebuild_cantina_stock', {}],
];

async function checkEscalada() {
  const resultados = [];
  for (const [fn, args] of RPC_DE_ADMIN) {
    const rPos = await rest(TOKENS.pos, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
    const bloqueado = rPos.status >= 400;

    // La otra mitad: el admin SÍ tiene que poder. Sin comprobarlo, una función
    // rota para todo el mundo pasaría por «bien protegida».
    const rAdmin = await rest(TOKENS.admin, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
    const adminOk = rAdmin.status < 400;

    resultados.push({
      fn,
      ok: bloqueado && adminOk,
      detail: !bloqueado ? `el TPV la ejecuta (${rPos.status})`
            : !adminOk  ? `bloqueada también para el admin (${rAdmin.status})`
            : 'sólo admin',
    });
  }
  return resultados;
}

// ─── Realtime ────────────────────────────────────────────────────────────────
// La razón por la que el ADR eligió el JWT propio: postgres_changes aplica RLS
// con el token de la conexión, así que esto sólo puede quedar en verde si la
// identidad viaja en el token. Un TPV no debe recibir los movimientos de otra
// barra aunque no filtre en cliente.
//
// SE COMPRUEBAN LAS DOS MITADES, y no sólo la fuga: se inserta un movimiento en
// la cantina propia y otro en la ajena, y hay que recibir el primero y no el
// segundo. Con la mitad de arriba sola, un canal que no llega a suscribirse
// «no recibe nada de otra cantina» y la comprobación saldría verde sin haber
// medido nada. La primera versión de esta función cayó justo en eso.
// Tras `supabase db reset` el contenedor de Realtime rehace su slot de
// replicación y tarda unos segundos en entregar nada. Sin reintento, la
// comprobación sale «muda» por infraestructura y no por seguridad.
async function checkRealtime(intentos = 2) {
  for (let i = 1; i <= intentos; i++) {
    const res = await intentarRealtime(i * 2000);
    if (res.ok || !res.mudo) return res;
    if (i < intentos) await new Promise((r) => setTimeout(r, 5000));
  }
  return { ok: false, detail: 'el canal no entrega nada ni tras reintentar: revisar Realtime' };
}

async function intentarRealtime(settleMs) {
  const { createClient } = await import('@supabase/supabase-js');
  const cliente = createClient(API, ANON_KEY);
  // El token va por realtime.setAuth. La opción `accessToken` del cliente NO
  // llega al canal: con ella la suscripción se establece pero no entrega nada,
  // y la comprobación parecería «aislamiento correcto» sin haber medido.
  cliente.realtime.setAuth(TOKENS.pos);

  const recibidos = [];
  const canal = cliente.channel('matriz-pos')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_movements' },
        (msg) => recibidos.push(msg.new));

  const suscrito = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 10000);
    canal.subscribe((estado) => {
      if (estado === 'SUBSCRIBED') { clearTimeout(t); resolve(true); }
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') { clearTimeout(t); resolve(false); }
    });
  });
  if (!suscrito) {
    await cliente.removeAllChannels();
    return { ok: false, mudo: true, detail: 'no se pudo suscribir' };
  }

  // `SUBSCRIBED` llega antes de que el servidor tenga enganchado el listener:
  // sin esta espera, los primeros INSERT se pierden y el canal parece mudo.
  await new Promise((r) => setTimeout(r, settleMs));

  // Uno en su cantina (debe llegar) y otro en la ajena (no debe llegar).
  for (const cantina of [FIXTURE.CANTINA_A, FIXTURE.CANTINA_B]) {
    const ins = await rest(SERVICE_KEY, 'stock_movements', {
      method: 'POST',
      body: JSON.stringify({
        event_id: FIXTURE.EVENT_LIVE, cantina_id: cantina,
        product_id: FIXTURE.PRODUCT_1, qty: -1, type: 'SALE', reason: 'sonda realtime',
      }),
    });
    // Si la sonda no llega a insertarse, «no recibe nada» no significaría nada.
    if (ins.status >= 300) {
      await cliente.removeAllChannels();
      return { ok: false, detail: `la sonda no se pudo insertar (${ins.status}): ${JSON.stringify(ins.body)}` };
    }
  }
  await new Promise((r) => setTimeout(r, 4000));
  await cliente.removeAllChannels();

  const propios = recibidos.filter((m) => m.cantina_id === FIXTURE.CANTINA_A);
  const ajenos  = recibidos.filter((m) => m.cantina_id === FIXTURE.CANTINA_B);

  // Sin la primera comprobación, un canal mudo daría un falso verde.
  if (propios.length === 0) {
    return { ok: false, mudo: true, detail: 'no recibe ni sus propios movimientos: el canal no mide nada' };
  }
  return ajenos.length === 0
    ? { ok: true, detail: 'recibe los suyos y ninguno de la otra cantina' }
    : { ok: false, detail: `recibe ${ajenos.length} movimiento(s) de la otra cantina` };
}

// ─── Ejecución ───────────────────────────────────────────────────────────────
const ICONO = (ok) => (ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m');

// Las secuencias de color cuentan como caracteres para padEnd/slice y
// descuadran las columnas: hay que medir sólo lo que se ve.
const ancho = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;
const rellenar = (s, n) => s + ' '.repeat(Math.max(0, n - ancho(s)));

async function main() {
  if (process.argv.includes('--reset')) {
    console.log('Resembrando la base local…');
    execSync('supabase db reset --local', { stdio: 'ignore' });
  }

  console.log('\n\x1b[1mMATRIZ DE EXPECTATIVAS · F2 · Seguridad\x1b[0m');
  console.log(`Contra ${API} · pos = Cantina Norte, camarero Ana\n`);

  // Totales reales con service_role: sin ellos no se puede distinguir «ve lo
  // suyo» de «lo ve todo».
  const totals = {};
  for (const t of TABLES) {
    const r = await rest(SERVICE_KEY, `${t.name}?select=*`);
    totals[t.name] = Array.isArray(r.body) ? r.body.length : 0;
  }

  const fallos = [];
  let total = 0, verdes = 0;
  const registrar = (grupo, etiqueta, res) => {
    total++; if (res.ok) verdes++; else fallos.push(`${grupo} · ${etiqueta}: ${res.detail}`);
    return res;
  };

  // LECTURAS primero: los INSERT que hoy pasan contaminarían los recuentos.
  console.log('\x1b[1mLECTURA\x1b[0m  (tabla → qué ve cada rol)');
  console.log(`  ${'tabla'.padEnd(28)}${ROLE_NAMES.map((r) => r.padEnd(9)).join('')}`);
  for (const t of TABLES) {
    const celdas = [];
    for (const role of ROLE_NAMES) {
      const res = registrar('lectura', `${t.name}/${role}`, await checkRead(t, role, t.read[role], totals));
      celdas.push(rellenar(`${ICONO(res.ok)} ${t.read[role].slice(0, 6)}`, 9));
      if (VERBOSE) console.log(`      ${t.name}/${role}: ${res.detail}`);
    }
    console.log(`  ${t.name.padEnd(28)}${celdas.join('')}`);
  }

  console.log('\n\x1b[1mESCRITURA\x1b[0m  (insert · update · delete)');
  for (const t of TABLES) {
    if (t.view) continue;
    const celdas = [];
    for (const role of ROLE_NAMES) {
      const ops = [];
      for (const op of ['insert', 'update', 'delete']) {
        const res = await checkWrite(t, role, op, t[op]);
        if (!res) continue;
        registrar('escritura', `${t.name}/${role}/${op}`, res);
        ops.push(ICONO(res.ok));
        if (VERBOSE) console.log(`      ${t.name}/${role}/${op}: ${res.detail}`);
      }
      celdas.push(rellenar(ops.join(' '), 9));
    }
    console.log(`  ${t.name.padEnd(28)}${celdas.join('')}`);
  }

  console.log('\n\x1b[1mRPC\x1b[0m  (privilegio EXECUTE de `anon`)');
  const rpc = checkRpcGrants();
  for (const r of rpc) registrar('rpc', `${r.fn}/${r.role}`, r);
  const rpcMal = rpc.filter((r) => !r.ok);
  console.log(`  ${ICONO(rpcMal.length === 0)} ${rpc.length - rpcMal.length}/${rpc.length} funciones cerradas a anon`);
  if (rpcMal.length && VERBOSE) rpcMal.forEach((r) => console.log(`      ${r.fn}: ${r.detail}`));

  console.log('\n\x1b[1mSUPLANTACIÓN\x1b[0m  (lo que el RLS no puede arreglar)');
  const sup = registrar('suplantación', 'create_sale en cantina ajena', await checkSuplantacion());
  console.log(`  ${ICONO(sup.ok)} venta en otra cantina y a nombre de otro camarero: ${sup.detail}`);

  console.log('\n\x1b[1mESCALADA DE ROL\x1b[0m  (el TPV no puede hacer de admin)');
  const esc = await checkEscalada();
  for (const e of esc) registrar('escalada', e.fn, e);
  const escMal = esc.filter((e) => !e.ok);
  console.log(`  ${ICONO(escMal.length === 0)} ${esc.length - escMal.length}/${esc.length} RPC de administración fuera del alcance del TPV`);
  if (escMal.length && VERBOSE) escMal.forEach((e) => console.log(`      ${e.fn}: ${e.detail}`));

  console.log('\n\x1b[1mREALTIME\x1b[0m  (el motivo del JWT propio)');
  const rt = registrar('realtime', 'fuga entre cantinas', await checkRealtime());
  console.log(`  ${ICONO(rt.ok)} el TPV de la Norte: ${rt.detail}`);

  const pct = ((verdes / total) * 100).toFixed(1);
  console.log(`\n\x1b[1mRESULTADO: ${verdes}/${total} en verde (${pct} %)\x1b[0m`);
  if (fallos.length && VERBOSE) {
    console.log('\nFallos:');
    fallos.forEach((f) => console.log(`  · ${f}`));
  } else if (fallos.length) {
    console.log(`${fallos.length} comprobaciones en rojo. Con --verbose se detallan.`);
  }
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
