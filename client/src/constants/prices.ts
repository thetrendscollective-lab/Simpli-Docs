// Cache for price IDs fetched from API
let priceCache: { standard: string; pro: string; family: string } | null = null;

export async function getPriceIds() {
  if (priceCache) return priceCache;
  
  try {
    const res = await fetch('/api/stripe/prices');
    const prices = await res.json();
    priceCache = prices;
    return prices;
  } catch (error) {
    console.error('Failed to fetch price IDs:', error);
    throw new Error('Unable to load pricing information');
  }
}

// Legacy export for backwards compatibility - will be removed
export const PRICE_ID = {
  standard: '',
  pro: '',
  family: '',
};
