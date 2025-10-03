import { stripePromise } from './stripe';
import { PRICE_ID } from '@/constants/prices';

export async function handleUpgrade(plan: keyof typeof PRICE_ID = 'standard') {
  console.log('upgrade clicked', plan);
  try {
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId: PRICE_ID[plan] }),
    });

    // Handle unauthorized - user needs to log in
    if (res.status === 401) {
      // Store the intended plan in sessionStorage so we can resume after login
      sessionStorage.setItem('pendingUpgrade', plan);
      window.location.href = '/api/login';
      return;
    }

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create checkout session');
    }

    if (data?.url) {
      // Prefer direct redirect if available
      window.location.href = data.url;
      return;
    }

    const stripe = await stripePromise;
    const { error } = await stripe!.redirectToCheckout({ sessionId: data.id });
    if (error) alert(error.message);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    alert('Failed to start checkout. Please try again.');
  }
}
