import { stripePromise } from './stripe';
import { getPriceIds } from '@/constants/prices';
import { getAccessToken } from './supabase';

export async function handleUpgrade(plan: 'standard' | 'pro' | 'family' = 'standard') {
  console.log('🚀 handleUpgrade called with plan:', plan);
  try {
    // Get Supabase access token
    console.log('🔑 Getting access token...');
    const token = await getAccessToken();
    console.log('🔑 Token retrieved:', token ? 'YES' : 'NO');
    
    if (!token) {
      console.log('❌ No token - redirecting to auth');
      // User not logged in - redirect to auth page
      sessionStorage.setItem('pendingUpgrade', plan);
      window.location.href = '/auth?redirect=/upload';
      return;
    }
    
    // Fetch price IDs from API
    console.log('💰 Fetching price IDs...');
    const priceIds = await getPriceIds();
    console.log('💰 Price IDs:', priceIds);
    
    console.log('📝 Creating checkout session...');
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ priceId: priceIds[plan].priceId }),
    });

    console.log('📝 Response status:', res.status);

    // Handle unauthorized - user needs to log in
    if (res.status === 401) {
      console.log('❌ Unauthorized - redirecting to auth');
      // Store the intended plan in sessionStorage so we can resume after login
      sessionStorage.setItem('pendingUpgrade', plan);
      window.location.href = '/auth?redirect=/upload';
      return;
    }

    const data = await res.json();
    console.log('📝 Response data:', data);
    
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create checkout session');
    }

    if (data?.url) {
      console.log('✅ Redirecting to Stripe checkout:', data.url);
      // Prefer direct redirect if available
      window.location.href = data.url;
      return;
    }

    console.log('✅ Using Stripe.js redirect with session ID:', data.id);
    const stripe = await stripePromise;
    const { error } = await stripe!.redirectToCheckout({ sessionId: data.id });
    if (error) {
      console.error('❌ Stripe redirect error:', error);
      alert(error.message);
    }
  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    alert(`Failed to start checkout. Please try again.\n\nError: ${error instanceof Error ? error.message : String(error)}`);
  }
}
