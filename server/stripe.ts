import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

// Cache for the Stripe instance
let cachedStripe: Stripe | null = null;
let cachedKey: string | null = null;

/**
 * Get the current Stripe instance (cached singleton).
 * 
 * This function returns a cached Stripe instance for efficiency.
 * If the STRIPE_SECRET_KEY environment variable changes (e.g., during testing),
 * the cache is invalidated and a new instance is created.
 * 
 * CRITICAL: This must be a function (not a module-level constant) to support
 * test mode override where the environment variable is changed after module load.
 */
export function getStripe(): Stripe {
  const currentKey = process.env.STRIPE_SECRET_KEY;
  
  if (!currentKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  
  // Return cached instance if the key hasn't changed
  if (cachedStripe && cachedKey === currentKey) {
    return cachedStripe;
  }
  
  // Create new instance and cache it
  cachedStripe = new Stripe(currentKey);
  cachedKey = currentKey;
  
  return cachedStripe;
}

/**
 * Clear the Stripe instance cache.
 * Used by tests to ensure a fresh instance after environment variable changes.
 */
export function resetStripeCache() {
  cachedStripe = null;
  cachedKey = null;
}
