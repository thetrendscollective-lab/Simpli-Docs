import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticateSupabase, AuthUser } from '../middleware/supabaseAuth';
import { storage } from '../storage';
import { getStripe } from '../stripe';

const router = express.Router();

// Get price IDs endpoint
router.get('/prices', async (req, res) => {
  // Detect test mode by checking if the current Stripe key is a test key
  const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
  
  res.json({
    standard: {
      priceId: isTestMode ? process.env.TESTING_PRICE_STANDARD : process.env.PRICE_STANDARD,
      displayPrice: '$4.99'
    },
    pro: {
      priceId: isTestMode ? process.env.TESTING_PRICE_PRO : process.env.PRICE_PRO,
      displayPrice: '$9.99'
    },
    family: {
      priceId: isTestMode ? process.env.TESTING_PRICE_FAMILY : process.env.PRICE_FAMILY,
      displayPrice: '$14.99'
    },
  });
});

router.post('/create-checkout-session', authenticateSupabase, async (req: Request, res: Response) => {
  try {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: 'Missing priceId' });
    
    // Debug logging
    const keyPrefix = process.env.STRIPE_SECRET_KEY?.substring(0, 7);
    console.log(`Creating checkout with key type: ${keyPrefix}, priceId: ${priceId}`);

    const authUser = (req as any).user as AuthUser;
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = authUser.id;
    const userEmail = authUser.email;
    const dbUser = await storage.getUser(userId);

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const origin = req.headers.origin || `http://localhost:5000`;

    // Create or retrieve Stripe customer
    let customerId = dbUser.stripeCustomerId;
    
    if (!customerId) {
      const stripe = getStripe();
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

    const stripe = getStripe();
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
router.post('/create-portal-session', authenticateSupabase, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as AuthUser;
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = authUser.id;
    const dbUser = await storage.getUser(userId);

    if (!dbUser?.stripeCustomerId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const origin = req.headers.origin || `http://localhost:5000`;

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
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
