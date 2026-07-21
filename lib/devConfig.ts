// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN TEMPORAL DE DESARROLLO
//
// DEV_EASY_LOGIN: cuando es `true`, simplifica el acceso al POS para agilizar
// las pruebas, saltándose la fricción de producción:
//   - Arranca en el flujo manual (Evento → Cantina), sin escáner QR de cantina.
//   - Omite el PIN de cantina (todas configuradas a 1234).
//   - Identifica al camarero eligiéndolo de un listado, sin QR ni PIN personal.
//
// Poner a `false` para restaurar el login de producción (QR de cantina + QR/PIN
// de camarero). Todo el código de ese flujo se conserva intacto tras el flag.
// ─────────────────────────────────────────────────────────────
export const DEV_EASY_LOGIN = true;
