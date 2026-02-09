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

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemma-3-4b-it';

// Middleware
app.use(cors({
  origin: '*', // In production, restrict to your extension's origin
  credentials: true
}));
app.use(express.json());
app.use(express.raw({ type: 'application/json' })); // For webhook signature verification

// Store user subscriptions in memory (use a database in production)
// Format: { userId: { status: {...}, expiresAt: timestamp } }
const userSubscriptions = new Map();

// Store userId -> Stripe Customer ID mapping (use a database in production)
// Format: { userId: customerId }
const userIdToCustomerId = new Map();

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

    // Try to get customer ID from mapping
    let customerId = userIdToCustomerId.get(userId);
    
    // If not in memory, try searching Stripe for a customer with this userId in metadata
    if (!customerId) {
      try {
        const search = await stripe.customers.search({
          query: `metadata['userId']:'${userId}'`,
          limit: 1,
        });
        if (search.data.length > 0) {
          customerId = search.data[0].id;
          userIdToCustomerId.set(userId, customerId);
          console.log(`Found customer ${customerId} for user ${userId} via Stripe Search`);
        }
      } catch (searchError) {
        console.error('Error searching for customer in Stripe:', searchError);
      }
    }
    
    if (customerId) {
      // Query Stripe for current subscription status
      try {
        const customers = await stripe.customers.list({
          email: undefined, // We're searching by customer ID
          limit: 1
        });
        
        // Get customer's subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 1
        });
        
        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          const status = {
            active: subscription.status === 'active',
            plan: subscription.items.data[0]?.price?.id,
            status: subscription.status,
            expiresAt: subscription.current_period_end * 1000,
            subscriptionId: subscription.id
          };
          
          // Update cache
          userSubscriptions.set(userId, {
            status: status,
            expiresAt: Date.now() + 3600000 // Cache for 1 hour
          });
          
          return res.json(status);
        }
      } catch (stripeError) {
        console.error('Error querying Stripe:', stripeError);
        // Fall through to return inactive status
      }
    }
    
    // No active subscription found
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
  let userId;
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      userId = session.client_reference_id || session.metadata?.userId;
      
      if (session.mode === 'subscription') {
        const subscriptionId = session.subscription;
        const customerId = session.customer;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Store userId -> customerId mapping
        if (userId && customerId) {
          userIdToCustomerId.set(userId, customerId);
        }
        
        // Store subscription status
        userSubscriptions.set(userId, {
          status: {
            active: subscription.status === 'active',
            plan: subscription.items.data[0]?.price?.id,
            status: subscription.status,
            expiresAt: subscription.current_period_end * 1000,
            subscriptionId: subscriptionId,
          },
          expiresAt: Date.now() + 3600000, // Cache for 1 hour
        });
        
        console.log(`Subscription activated for user: ${userId}, customer: ${customerId}`);
      }
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      const customerId = subscription.customer;
      
      // Find userId from customerId (reverse lookup)
      userId = null;
      for (const [uid, cid] of userIdToCustomerId.entries()) {
        if (cid === customerId) {
          userId = uid;
          break;
        }
      }
      
      if (userId) {
        if (event.type === 'customer.subscription.deleted') {
          // Remove subscription
          userSubscriptions.delete(userId);
          console.log(`Subscription deleted for user: ${userId}`);
        } else {
          // Update subscription status
          const updatedSubscription = await stripe.subscriptions.retrieve(subscription.id);
          userSubscriptions.set(userId, {
            status: {
              active: updatedSubscription.status === 'active',
              plan: updatedSubscription.items.data[0]?.price?.id,
              status: updatedSubscription.status,
              expiresAt: updatedSubscription.current_period_end * 1000,
              subscriptionId: updatedSubscription.id,
            },
            expiresAt: Date.now() + 3600000,
          });
          console.log(`Subscription updated for user: ${userId}, status: ${updatedSubscription.status}`);
        }
      } else {
        console.log(`Subscription ${event.type} for customer: ${customerId} (userId not found)`);
      }
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
// GEMINI API PROXY (Backend Proxy for API Key Security)
// ============================================================================

/**
 * Enhance a prompt using Gemini API
 * POST /api/enhance
 * Body: { prompt: string, enhancementType: string, systemInstruction: string }
 */
app.post('/api/enhance', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Gemini API key not configured on server' 
      });
    }

    const { prompt, enhancementType, systemInstruction } = req.body;

    if (!prompt || !systemInstruction) {
      return res.status(400).json({ 
        error: 'Missing required fields: prompt and systemInstruction' 
      });
    }

    // Construct the full instruction
    const fullInstruction = `${systemInstruction}\n\nUser's raw text:\n"${prompt}"\n\nImproved Output:`;

    // Build Gemini API request
    const requestBody = {
      contents: [{
        parts: [{
          text: fullInstruction
        }]
      }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 8000,
        topP: 0.9,
      }
    };

    const apiUrl = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Make request to Gemini API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `API request failed (${response.status})`;
      console.error('Gemini API error:', errorMessage);
      return res.status(response.status).json({ 
        error: errorMessage 
      });
    }

    const data = await response.json();

    // Extract the improved prompt from Gemini response
    let improvedPrompt = '';
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      improvedPrompt = data.candidates[0].content.parts[0].text.trim();
    }

    if (!improvedPrompt) {
      console.error('Unexpected Gemini response structure:', data);
      return res.status(500).json({ 
        error: 'No response generated from API' 
      });
    }

    // Strip markdown code blocks if present
    improvedPrompt = improvedPrompt.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

    res.json({ 
      result: improvedPrompt,
      enhancementType: enhancementType || 'text'
    });

  } catch (error) {
    console.error('Error in /api/enhance:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
});

/**
 * Ask a question using Gemini API
 * POST /api/ask
 * Body: { question: string, systemInstruction: string }
 */
app.post('/api/ask', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Gemini API key not configured on server' 
      });
    }

    const { question, systemInstruction } = req.body;

    if (!question || !systemInstruction) {
      return res.status(400).json({ 
        error: 'Missing required fields: question and systemInstruction' 
      });
    }

    // Construct the full instruction
    const fullInstruction = `${systemInstruction}\n\nUser's question:\n"${question}"\n\nAnswer:`;

    // Build Gemini API request
    const requestBody = {
      contents: [{
        parts: [{
          text: fullInstruction
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8000,
        topP: 0.9,
      }
    };

    const apiUrl = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Make request to Gemini API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `API request failed (${response.status})`;
      console.error('Gemini API error:', errorMessage);
      return res.status(response.status).json({ 
        error: errorMessage 
      });
    }

    const data = await response.json();

    // Extract the answer from Gemini response
    let answer = '';
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      answer = data.candidates[0].content.parts[0].text.trim();
    }

    if (!answer) {
      console.error('Unexpected Gemini response structure:', data);
      return res.status(500).json({ 
        error: 'No answer generated from API' 
      });
    }

    // Strip markdown code blocks if present
    answer = answer.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

    res.json({ 
      result: answer
    });

  } catch (error) {
    console.error('Error in /api/ask:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    geminiConfigured: !!GEMINI_API_KEY
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Stripe server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook`);
});
