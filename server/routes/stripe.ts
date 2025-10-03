import express from 'express';
import Stripe from 'stripe';
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';

const router = express.Router();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', isAuthenticated, async (req: any, res) => {
  try {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

    const userId = req.user.claims.sub;
    const userEmail = req.user.claims.email;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const origin = req.headers.origin || `http://localhost:5000`;

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId,
          app: 'simplidocs'
        }
      });
      customerId = customer.id;
      
      // Save customer ID to user
      await storage.upsertUser({
        id: userId,
        stripeCustomerId: customerId
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: { 
        app: 'simplidocs',
        userId: userId 
      },
    });

    // Return both; client will prefer `url`
    res.json({ id: session.id, url: session.url });
  } catch (e: any) {
    console.error('Stripe checkout error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Stripe Customer Portal - for managing subscriptions
router.post('/create-portal-session', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);

    if (!user?.stripeCustomerId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const origin = req.headers.origin || `http://localhost:5000`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/account`,
    });

    res.json({ url: portalSession.url });
  } catch (e: any) {
    console.error('Error creating portal session:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Note: Webhook is handled in server/index.ts before express.json middleware
// to preserve raw body for Stripe signature verification

export default router;
