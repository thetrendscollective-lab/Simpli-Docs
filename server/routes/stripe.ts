import express from 'express';
import Stripe from 'stripe';

const router = express.Router();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

    const origin = req.headers.origin || `http://localhost:5000`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: { app: 'simplidocs' },
    });

    // Return both; client will prefer `url`
    res.json({ id: session.id, url: session.url });
  } catch (e: any) {
    console.error('Stripe checkout error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
