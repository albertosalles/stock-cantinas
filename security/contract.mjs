// ─────────────────────────────────────────────────────────────────────────────
// CONTRATO DE ACCESO · el objetivo de F2, escrito antes de implementarlo
//
// Esto NO describe lo que el sistema hace hoy: describe lo que debe hacer al
// cerrar la fase. Ejecutado ahora sale casi todo en rojo, y ese rojo es el
// inventario de agujeros. Se va poniendo verde con S2-S5 y cierra en INF-7.
//
// Mismo principio que en F1.5, donde el banco de pruebas fue antes de
// optimizar: primero el criterio medible, después el cambio.
//
// ÁMBITOS DE LECTURA
//   none        No debe ver NADA: se espera 4xx, o 2xx con cero filas.
//   all         Ve todas las filas que existen.
//   live_event  Sólo el evento en curso (nunca el histórico cerrado).
//   own_cantina Sólo su barra Y su evento. Una barra trabaja en varios
//               partidos, así que filtrar sólo por cantina dejaría al camarero
//               de hoy leyendo el histórico de jornadas anteriores. Se comprueba
//               además que vea MENOS que el total: con una sola cantina, «ve lo
//               suyo» y «lo ve todo» darían el mismo resultado.
//   subset      Ve algunas filas pero no todas (tablas sin cantina_id propia,
//               como sale_line_items, que se acota a través de su venta).
//
// COLUMNAS. `forbidden` lista columnas que no deben viajar aunque la fila sea
// visible; `forbiddenSalvo` exceptúa a los roles que sí las necesitan, y
// `columnas` dice qué pedir en su lugar. Se comprueban las DOS cosas: que la
// consulta legítima funcione y que pedir la columna prohibida se deniegue. RLS
// filtra FILAS, así que esto se resuelve con privilegios de columna, y como el
// TPV y el admin comparten el rol `authenticated`, lo que un GRANT no puede
// separar acaba pasando por una RPC con guarda.
//
// ESCRITURAS
//   deny        Sin privilegio. El ledger no se escribe directo NUNCA: se
//               retira el GRANT, no se escribe una política. Sin privilegio no
//               hay política que discutir, y toda escritura pasa por RPC, que
//               es donde ya viven la idempotencia y el bloqueo ordenado de F1.5.
//   allow       Excepción justificada, anotada caso por caso.
// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURE = {
  EVENT_LIVE:   'e7e70000-0000-4000-8000-000000000001',
  EVENT_CLOSED: 'e7e70000-0000-4000-8000-000000000002',
  CANTINA_A:    'ca00a000-0000-4000-8000-00000000000a',
  CANTINA_B:    'ca00b000-0000-4000-8000-00000000000b',
  WAITER_A:     '3a17e000-0000-4000-8000-00000000000a',
  PRODUCT_1:    '9c0d0000-0000-4000-8000-000000000001',
  USER:         '55e50000-0000-4000-8000-000000000001',
};

// Los cuatro roles y las claims que lleva su token. `pos` es siempre el
// camarero de la Cantina Norte: todo lo de la Sur debe quedarle invisible.
export const ROLES = {
  anon:   { pgRole: 'anon' },
  client: { pgRole: 'authenticated', appRole: 'client', clientId: 'c11e0000-0000-4000-8000-000000000001' },
  pos:    { pgRole: 'authenticated', appRole: 'pos', eventId: FIXTURE.EVENT_LIVE,
            cantinaId: FIXTURE.CANTINA_A, waiterId: FIXTURE.WAITER_A },
  admin:  { pgRole: 'authenticated', appRole: 'admin', eventId: FIXTURE.EVENT_LIVE },
};

const deny = { insert: 'deny', update: 'deny', delete: 'deny' };

export const TABLES = [
  // ─── Catálogo público (S4) ────────────────────────────────────────────────
  { name: 'events', eventKey: 'id', ...deny,
    read: { anon: 'live_event', client: 'live_event', pos: 'live_event', admin: 'all' },
    why: 'El evento cerrado es histórico comercial: el público sólo ve el que está en curso.' },

  { name: 'cantinas', ...deny,
    read: { anon: 'all', client: 'all', pos: 'all', admin: 'all' },
    why: 'Nombre y ubicación son información de cartel. qr_token NO: es la credencial que abre el '
       + 'paso 1 del login, así que un camarero que leyera el de otra barra podría pedir sesión '
       + 'allí. NADIE lo lee de la tabla, tampoco el admin: lo recibe por get_event_cantinas_grid, '
       + 'que exige admin por dentro. Un GRANT no habría podido separarlos, porque el TPV y el '
       + 'admin comparten el rol de Postgres `authenticated`.',
    forbidden: ['qr_token'], columnas: ['id', 'name', 'location'] },

  { name: 'event_cantinas', ...deny,
    read: { anon: 'live_event', client: 'live_event', pos: 'live_event', admin: 'all' } },

  { name: 'products', ...deny,
    read: { anon: 'all', client: 'all', pos: 'all', admin: 'all' } },

  { name: 'event_products', ...deny,
    read: { anon: 'live_event', client: 'live_event', pos: 'live_event', admin: 'all' } },

  { name: 'seasons', ...deny,
    read: { anon: 'none', client: 'none', pos: 'none', admin: 'all' },
    why: 'Estructura interna del negocio; ningún cliente la necesita.' },

  { name: 'opponents', ...deny,
    read: { anon: 'none', client: 'none', pos: 'none', admin: 'all' },
    why: 'El público ve el rival en el nombre del evento, no necesita el catálogo.' },

  // ─── Personal y credenciales (S5) ─────────────────────────────────────────
  { name: 'waiters', ...deny,
    read: { anon: 'none', client: 'none', pos: 'all', admin: 'all' },
    why: 'El TPV necesita nombres para atribuir la venta, nunca los secretos.',
    forbidden: ['pin_hash', 'qr_token'],
    columnas: ['id', 'name', 'surname', 'active', 'created_at'] },

  { name: 'cantina_access', ...deny,
    read: { anon: 'none', client: 'none', pos: 'none', admin: 'all' },
    why: 'El admin gestiona el acceso de las barras, así que ve la ficha: si hay PIN configurado, '
       + 'si está activo y cuándo se cambió. Lo que NO viaja nunca es el PIN. Se guarda hasheado, '
       + 'y hashear y consultar son excluyentes — un hash no se deshace. El admin SIGUE ELIGIENDO '
       + 'el código, tanto el de cantina como el de camarero (2026-08-03); lo único que pierde es '
       + 'consultarlo después, y si se le olvida vuelve a fijarlo. A cambio, una fuga de la base '
       + 'ya no entrega los PIN de todas las cantinas.',
    forbidden: ['pin_hash'],
    columnas: ['cantina_id', 'is_active', 'created_at', 'updated_at'] },

  { name: 'users', ...deny,
    read: { anon: 'none', client: 'none', pos: 'none', admin: 'none' } },

  // ─── Operativa y ledger (S5) ──────────────────────────────────────────────
  { name: 'shifts', ...deny,
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' },
    why: 'Los turnos son datos laborales; el TPV sólo ve los de su barra.' },

  { name: 'incidents', insert: 'allow_pos', update: 'allow_admin', delete: 'deny',
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' },
    why: 'Única escritura directa que se conserva: reportar una incidencia es un aviso, no una '
       + 'transacción de stock, y la política WITH CHECK basta para atarla a su cantina. '
       + 'Resolverla es del admin.' },

  { name: 'sales', ...deny,
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' },
    why: 'Facturación. Un TPV no ve el agregado del evento ni lo de otras barras. El cliente '
       + 'verá SUS pedidos cuando exista el rol en F2.5; hoy, nada.' },

  { name: 'sale_line_items', ...deny,
    read: { anon: 'none', client: 'none', pos: 'subset', admin: 'all' },
    why: 'No tiene cantina_id: se acota a través de su venta.' },

  { name: 'stock_movements', ...deny,
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' },
    why: 'El ledger es la fuente de verdad. Además es la tabla publicada en Realtime, así que '
       + 'esta política es la que convierte el filtro por cantina de F1.5 en frontera de seguridad.' },

  { name: 'cantina_stock', ...deny,
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' },
    why: 'El cliente NO debe ver qty: necesita saber si hay cerveza, no cuántas quedan. La '
       + 'disponibilidad se expone como booleano por vista o RPC (S4).' },

  { name: 'inventory_snapshots', ...deny,
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' } },

  // ─── Vistas: la puerta trasera del RLS (S3) ───────────────────────────────
  // Ninguna tiene security_invoker, así que hoy se ejecutan como su propietario
  // y devolverían todo aunque las tablas de debajo estuvieran protegidas.
  { name: 'v_available_cantinas', view: true, ...deny,
    read: { anon: 'none', client: 'none', pos: 'none', admin: 'none' },
    why: 'Expone si una cantina tiene credenciales y si están activas. Desde S3 sólo la usa la '
       + 'ruta de login, que va con service_role, así que NINGÚN cliente necesita alcanzarla — '
       + 'tampoco el admin. Es de servidor y punto.' },

  { name: 'v_event_products_eur', view: true, ...deny,
    read: { anon: 'live_event', client: 'live_event', pos: 'live_event', admin: 'all' } },

  { name: 'v_cantina_inventory', view: true, ...deny,
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' } },

  { name: 'v_inventory_current', view: true, ...deny,
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' } },

  { name: 'v_sales_by_cantina', view: true, ...deny,
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' } },

  { name: 'v_sold_by_cantina_product', view: true, ...deny,
    read: { anon: 'none', client: 'none', pos: 'own_cantina', admin: 'all' } },
];

// ─── Privilegio EXECUTE sobre las RPC ────────────────────────────────────────
// Se comprueba contra el catálogo (has_function_privilege) y no por PostgREST:
// para un GRANT el catálogo ES la verdad, y llamar a las funciones de verdad
// tendría efectos sobre los datos.
//
// OJO: que el GRANT sea correcto no basta. 12 funciones son SECURITY DEFINER y
// se fían de sus argumentos de identidad, así que un token de la Cantina Norte
// puede vender en la Sur aunque el privilegio esté bien puesto. Eso lo arregla
// S3 quitando p_cantina_id/p_user_id/p_waiter_id de las firmas, y se comprueba
// aparte en la sección de suplantación.
export const RPC = {
  anon: [],
  client: [],
  pos: ['create_sale', 'create_sales_batch', 'void_sale', 'adjust_stock_bulk',
        'set_initial_inventory_bulk', 'set_final_inventory_bulk', 'open_shift', 'close_shift'],
  admin: ['get_active_events', 'get_event_dashboard', 'get_event_cantinas_grid',
          'get_event_cantinas_overview', 'get_event_waiter_performance', 'get_sales_by_hour',
          'get_sales_by_slot', 'get_stock_alerts', 'set_event_product_price_eur',
          'set_cantina_pin', 'toggle_cantina_access', 'rebuild_cantina_stock',
          'verify_cantina_stock', 'adjust_stock_bulk', 'set_initial_inventory_bulk',
          'set_final_inventory_bulk', 'void_sale'],
};

// `set_cantina_pin` deja de recibir el código y pasa a GENERARLO y devolverlo
// una sola vez, ya hasheado en la tabla (S2). Es la única vía por la que el
// admin conoce un PIN.
//
// El login deja de ser accesible desde el navegador: pasa a rutas de servidor
// con service_role, que es quien valida el PIN y firma el token (S2).
export const RPC_SOLO_SERVIDOR = ['validate_cantina_access', 'resolve_cantina_qr', 'identify_waiter'];

// Excepciones razonadas al «anon no ejecuta nada». Se listan aquí para que sean
// una decisión visible y no un olvido que la matriz deja pasar.
//
//   get_active_events   La pantalla de login la necesita ANTES de que exista
//                       sesión, y sólo devuelve los eventos en curso con su
//                       número de barras: lo que el contrato ya permite leer a
//                       cualquiera.
//   sc_*                Los helpers que invocan las propias políticas. Una
//                       política se evalúa CON EL ROL QUE CONSULTA, así que si
//                       anon no puede ejecutarlos, su consulta falla entera.
//                       No abren nada: leen el token de quien pregunta, o
//                       responden si un evento está en curso.
export const RPC_ABIERTAS_A_ANON = [
  'get_active_events',
  'sc_claims', 'sc_app_role', 'sc_es_servicio', 'sc_claim_uuid', 'sc_evento_visible',
  'sc_alcance_cantina', 'sc_venta_visible',
];
