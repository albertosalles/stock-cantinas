import Stripe from 'stripe';

let stripe: Stripe | null = null;

/**
 * Devuelve el cliente de Stripe, instanciándolo de forma perezosa en la primera
 * petición. Nunca se crea al cargar el módulo, de modo que el `next build`
 * (que recolecta los datos de las rutas sin variables de entorno de runtime)
 * no falle con "Neither apiKey nor config.authenticator provided".
 */
export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY no está configurada en el entorno');
    }
    stripe = new Stripe(key, { typescript: true });
  }
  return stripe;
}
