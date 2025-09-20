// Pricing calculation utilities for document processing
// Referenced from javascript_stripe integration

export const PRICING = {
  BASE_PRICE: 0.99, // Base price in dollars
  PER_PAGE_PRICE: 0.10, // Price per page in dollars
} as const;

export interface PricingCalculation {
  basePrice: number;
  perPagePrice: number;
  pageCount: number;
  totalPrice: number;
  totalCents: number;
}

/**
 * Calculate the total price for document processing
 * @param pageCount Number of pages in the document
 * @returns Pricing breakdown and total cost
 */
export function calculateDocumentPrice(pageCount: number): PricingCalculation {
  const basePrice = PRICING.BASE_PRICE;
  const perPagePrice = PRICING.PER_PAGE_PRICE;
  const totalPrice = basePrice + (perPagePrice * pageCount);
  const totalCents = Math.round(totalPrice * 100); // Convert to cents for Stripe

  return {
    basePrice,
    perPagePrice,
    pageCount,
    totalPrice,
    totalCents,
  };
}

/**
 * Format price for display to users
 * @param amount Amount in dollars
 * @returns Formatted price string
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get pricing breakdown for display
 * @param pageCount Number of pages
 * @returns Human-readable pricing breakdown
 */
export function getPricingBreakdown(pageCount: number): string {
  const calculation = calculateDocumentPrice(pageCount);
  
  if (pageCount === 1) {
    return `${formatPrice(calculation.basePrice)} base fee`;
  }
  
  return `${formatPrice(calculation.basePrice)} base fee + ${formatPrice(calculation.perPagePrice)} × ${pageCount} pages`;
}