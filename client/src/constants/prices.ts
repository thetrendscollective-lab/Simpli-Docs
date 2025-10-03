// Type for structured price data from API
export interface PriceData {
  priceId: string;
  displayPrice: string;
}

export interface PriceMap {
  standard: PriceData;
  pro: PriceData;
  family: PriceData;
}

// Cache for price IDs fetched from API
let priceCache: PriceMap | null = null;

export async function getPriceIds(): Promise<PriceMap> {
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
