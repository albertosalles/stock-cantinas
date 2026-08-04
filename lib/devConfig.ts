// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN TEMPORAL DE DESARROLLO
//
// DEV_EASY_LOGIN simplifica el acceso al POS para agilizar las pruebas,
// saltándose la fricción de producción:
//   - Arranca en el flujo manual (Evento → Cantina), sin escáner QR de cantina.
//   - Omite el PIN de cantina.
//   - Identifica al camarero eligiéndolo de un listado, sin QR ni PIN personal.
//
// Desde S2 va ATADO AL ENTORNO y no a una constante que se pueda quedar en
// `true` por olvido: en producción es siempre `false`, se edite lo que se edite
// este fichero. Era lo que bloqueaba el despliegue — con el flag puesto,
// cualquiera con la URL entra en cualquier barra.
//
// Y no basta con apagarlo aquí: un flag de navegador no es un control de
// acceso. La ruta /api/auth/waiter comprueba el entorno POR SU CUENTA antes de
// aceptar el atajo del listado, porque lo que entrega es una sesión de TPV.
// Esto es sólo la mitad de interfaz.
//
// El login de producción (QR de cantina + QR/PIN de camarero) se conserva
// intacto tras el flag.
// ─────────────────────────────────────────────────────────────
export const DEV_EASY_LOGIN = process.env.NODE_ENV !== 'production';
