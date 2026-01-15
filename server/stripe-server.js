/**
 * Stripe Payment Server
 * Handles Stripe Checkout sessions, webhooks, and subscription management
 * 
 * Setup:
 * 1. Install dependencies: npm install express stripe cors dotenv
 * 2. Set environment variables:
 *    - STRIPE_SECRET_KEY=sk_test_...
 *    - STRIPE_PUBLISHABLE_KEY=pk_test_...
 *    - STRIPE_WEBHOOK_SECRET=whsec_...
 *    - PORT=3000
 * 3. Run: node stripe-server.js
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const app = express();

// Middleware
app.use(cors({
  origin: '*', // In production, restrict to your extension's origin
  credentials: true
}));
app.use(express.json());
app.use(express.raw({ type: 'application/json' })); // For webhook signature verification

// Store user subscriptions in memory (use a database in production)
const userSubscriptions = new Map();

// ============================================================================
// STRIPE CHECKOUT
// ============================================================================

/**
 * Create a Stripe Checkout Session
 * POST /api/create-checkout-session
 */
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId, priceId, successUrl, cancelUrl } = req.body;

    if (!userId || !priceId) {
      return res.status(400).json({ error: 'Missing userId or priceId' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: req.body.email, // Optional: pre-fill email
      client_reference_id: userId, // Link session to user
      success_url: successUrl || `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin}/cancel`,
      metadata: {
        userId: userId,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Get subscription status for a user
 * GET /api/subscription-status/:userId
 */
app.get('/api/subscription-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check in-memory cache first
    const cached = userSubscriptions.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.status);
    }

    // In production, query Stripe Customer API
    // For now, return a mock response
    // You should store Stripe customer IDs in your database
    
    res.json({
      active: false,
      plan: null,
      status: 'inactive',
      expiresAt: null
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create or retrieve Stripe Customer
 * POST /api/create-customer
 */
app.post('/api/create-customer', async (req, res) => {
  try {
    const { userId, email } = req.body;

    // Check if customer already exists (in production, check your database)
    // For now, create a new customer
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        userId: userId,
      },
    });

    res.json({ customerId: customer.id });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create Customer Portal Session (for managing subscriptions)
 * POST /api/create-portal-session
 */
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { userId, returnUrl } = req.body;

    // In production, retrieve customer ID from your database
    // For now, you'll need to pass customerId
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ error: 'Missing customerId' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${req.headers.origin}/account`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STRIPE WEBHOOKS
// ============================================================================

/**
 * Handle Stripe webhooks
 * POST /api/webhook
 */
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.userId;
      
      if (session.mode === 'subscription') {
        const subscriptionId = session.subscription;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Store subscription status
        userSubscriptions.set(userId, {
          status: {
            active: true,
            plan: subscription.items.data[0]?.price?.id,
            status: subscription.status,
            expiresAt: subscription.current_period_end * 1000,
            subscriptionId: subscriptionId,
          },
          expiresAt: Date.now() + 3600000, // Cache for 1 hour
        });
        
        console.log(`Subscription activated for user: ${userId}`);
      }
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      // Find user by customer ID (in production, query your database)
      // For now, you'll need to track customerId -> userId mapping
      console.log(`Subscription ${event.type} for subscription: ${subscription.id}`);
      break;

    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      console.log(`Payment succeeded for invoice: ${invoice.id}`);
      break;

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      console.log(`Payment failed for invoice: ${failedInvoice.id}`);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Stripe server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook`);
});
