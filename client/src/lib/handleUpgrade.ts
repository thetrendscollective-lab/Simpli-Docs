import { stripePromise } from './stripe';
import { getPriceIds } from '@/constants/prices';
import { getAccessToken } from './supabase';

export async function handleUpgrade(plan: 'standard' | 'pro' | 'family' = 'standard') {
  console.log('upgrade clicked', plan);
  try {
    // Get Supabase access token
    const token = await getAccessToken();
    
    if (!token) {
      // User not logged in - redirect to auth page
      sessionStorage.setItem('pendingUpgrade', plan);
      window.location.href = '/auth?redirect=/upload';
      return;
    }
    
    // Fetch price IDs from API
    const priceIds = await getPriceIds();
    
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ priceId: priceIds[plan].priceId }),
    });

    // Handle unauthorized - user needs to log in
    if (res.status === 401) {
      // Store the intended plan in sessionStorage so we can resume after login
      sessionStorage.setItem('pendingUpgrade', plan);
      window.location.href = '/auth?redirect=/upload';
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
