const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const { Readable } = require("stream");

// Define secrets for Gen 2 (These are stored securely in Firebase)
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Set global options for all functions
setGlobalOptions({ region: "us-central1" });

admin.initializeApp();
const db = admin.firestore();

const app = express();

// Enable CORS
app.use(cors({ origin: true }));

// Webhook must get raw body for Stripe signature verification (register before express.json())
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = stripeWebhookSecret.value();
  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[Webhook] Signature Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated') {
    const obj = event.data.object;
    let userId = obj.client_reference_id || obj.metadata?.userId;
    let customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
    let subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id || obj.id;

    // customer.subscription.updated sends a Subscription object (no client_reference_id); look up userId from Stripe customer metadata or Firestore
    if (!userId && customerId) {
      try {
        const stripe = getStripe();
        const customer = await stripe.customers.retrieve(customerId);
        userId = customer.metadata?.userId || null;
        if (!userId) {
          const snap = await db.collection('users').where('customerId', '==', customerId).limit(1).get();
          if (!snap.empty) userId = snap.docs[0].id;
        }
      } catch (e) {
        console.error('[Webhook] Lookup userId:', e.message);
      }
    }

    try {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const paid = subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due';
      if (userId && paid) {
        const payload = {
          customerId,
          subscriptionId,
          isPremium: true,
          plan: subscription.items.data[0].price.id,
          expiresAt: subscription.current_period_end * 1000,
          status: subscription.status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(userId).set(payload, { merge: true });
        if (customerId) {
          await stripe.customers.update(customerId, { metadata: { userId } }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[Webhook] Processing Error:', err);
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// Lazy-load Stripe to avoid initialization issues
let stripeInstance = null;
const getStripe = () => {
    if (!stripeInstance) {
        stripeInstance = require("stripe")(stripeSecretKey.value());
    }
    return stripeInstance;
};

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-flash';
// Streaming: same model as default but with thinking disabled for fast TTFB (~1–3s instead of 8–13s).
// Set to 'gemini-2.0-flash' if you prefer a separate fast model; 2.5-flash + thinkingBudget: 0 is "non-thinking" 2.5.
const GEMINI_STREAM_MODEL = 'gemini-2.5-flash';

function buildEnhancePromptText(systemInstruction, prompt) {
  return `${systemInstruction}\n\nUser text: "${prompt}"\n\nImproved:`;
}

// ============================================================================
// HEALTH CHECK (for extension "server reachable" check)
// ============================================================================

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'prompt-architect-api' });
});

// ============================================================================
// VERIFY GOOGLE TOKEN (Chrome extension auth without Firebase SDK in extension)
// ============================================================================

app.post('/verify-google-token', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Missing accessToken' });
    }
    const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const user = await resp.json();
    const uid = user.id;
    const email = user.email || null;
    const displayName = user.name || user.email || 'User';
    res.json({ uid, email, displayName });
  } catch (e) {
    console.error('[verify-google-token]', e.message);
    res.status(500).json({ error: e.message || 'Verification failed' });
  }
});

// ============================================================================
// STRIPE CHECKOUT
// ============================================================================

// Stripe redirects only support http/https; chrome-extension:// gets mangled to https://chrome-extension// (broken).
const STRIPE_SUCCESS_URL = 'https://prompt-enhancer-ai.firebaseapp.com/success.html';
const STRIPE_CANCEL_URL = 'https://prompt-enhancer-ai.firebaseapp.com/cancel.html';

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { userId, priceId, successUrl, cancelUrl, email } = req.body;
    console.log(`[Checkout] User: ${userId}`);

    if (!userId || !priceId) {
      return res.status(400).json({ error: 'Missing userId or priceId' });
    }

    // Use HTTPS URLs only; extension URLs break after Stripe redirect
    const finalSuccessUrl = (successUrl && !successUrl.startsWith('chrome-extension:'))
      ? successUrl
      : STRIPE_SUCCESS_URL;
    const finalCancelUrl = (cancelUrl && !cancelUrl.startsWith('chrome-extension:'))
      ? cancelUrl
      : STRIPE_CANCEL_URL;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      success_url: finalSuccessUrl + (finalSuccessUrl.includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}',
      cancel_url: finalCancelUrl,
      metadata: { userId: userId },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('[Checkout] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STRIPE CUSTOMER PORTAL (manage subscription / billing)
// ============================================================================

app.post('/create-portal-session', async (req, res) => {
  try {
    let { customerId, userId, returnUrl } = req.body;
    if (!customerId && userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) customerId = userDoc.data().customerId;
      if (!customerId) {
        const stripe = getStripe();
        const search = await stripe.customers.search({
          query: `metadata['userId']:'${userId}'`,
          limit: 1,
        });
        if (search.data.length > 0) customerId = search.data[0].id;
      }
    }
    if (!customerId) {
      return res.status(400).json({ error: 'No billing account found. Subscribe first to manage your subscription.' });
    }
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || 'https://prompt-enhancer-ai.firebaseapp.com',
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('[Portal] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to create portal session' });
  }
});

// ============================================================================
// SYNC SUBSCRIPTION (for users who paid but webhook didn't run — e.g. success page link)
// ============================================================================

const SUCCESS_PAGE_URL = 'https://prompt-enhancer-ai.firebaseapp.com/success.html';

app.get('/sync-subscription', async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.redirect(SUCCESS_PAGE_URL + '?error=missing_session');
  }
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
    const userId = session.client_reference_id || session.metadata?.userId;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = session.subscription && (typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
    if (!userId || !subscriptionId) {
      return res.redirect(SUCCESS_PAGE_URL + '?error=invalid_session');
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const paid = subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due';
    const payload = {
      customerId: customerId || null,
      subscriptionId,
      isPremium: paid,
      plan: subscription.items.data[0].price.id,
      expiresAt: subscription.current_period_end * 1000,
      status: subscription.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('users').doc(userId).set(payload, { merge: true });
    if (customerId) {
      await stripe.customers.update(customerId, { metadata: { userId } }).catch(() => {});
    }
    return res.redirect(SUCCESS_PAGE_URL + '?synced=1');
  } catch (err) {
    console.error('[Sync] Error:', err.message);
    return res.redirect(SUCCESS_PAGE_URL + '?error=sync_failed');
  }
});

// Sync subscription by userId (and optional email fallback for "paid while signed out")
app.post('/sync-subscription-by-user', async (req, res) => {
  const userId = req.body?.userId;
  const email = req.body?.email && String(req.body.email).trim();
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  try {
    const stripe = getStripe();
    let customerId = null;
    let subscriptionId = null;
    let subscription = null;

    // 1) Try to find by checkout session (client_reference_id = userId)
    const list = await stripe.checkout.sessions.list({ limit: 100, status: 'complete' });
    const session = list.data.find(s => s.client_reference_id === userId);
    if (session) {
      customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subId = session.subscription && (typeof session.subscription === 'string' ? session.subscription : session.subscription?.id);
      if (subId) {
        subscription = await stripe.subscriptions.retrieve(subId);
        subscriptionId = subId;
      }
    }

    // 2) Fallback: find by customer email (e.g. paid while signed out, different userId at checkout)
    if (!subscription && email) {
      const customers = await stripe.customers.list({ email, limit: 10 });
      for (const c of customers.data) {
        const subs = await stripe.subscriptions.list({ customer: c.id, limit: 5 });
        const paidSub = subs.data.find(s => ['active', 'trialing', 'past_due'].includes(s.status));
        if (paidSub) {
          customerId = c.id;
          subscription = paidSub;
          subscriptionId = paidSub.id;
          break;
        }
      }
    }

    if (!subscription || !subscriptionId) {
      const msg = email
        ? 'No active subscription found for this account or email.'
        : 'No completed checkout found for this account. Sign in with the same Google account you used to pay, then try Sync again.';
      return res.status(404).json({ error: msg });
    }

    const paid = ['active', 'trialing', 'past_due'].includes(subscription.status);
    const payload = {
      customerId: customerId || null,
      subscriptionId,
      isPremium: paid,
      plan: subscription.items.data[0].price.id,
      expiresAt: subscription.current_period_end * 1000,
      status: subscription.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('users').doc(userId).set(payload, { merge: true });
    if (customerId) {
      await stripe.customers.update(customerId, { metadata: { userId } }).catch(() => {});
    }
    return res.json({ ok: true, active: paid });
  } catch (err) {
    console.error('[SyncByUser] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// ============================================================================
// SUBSCRIPTION STATUS
// ============================================================================

// Treat these Stripe subscription statuses as "paid" — user gets premium experience
const PAID_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'];

function isPaidSubscriptionStatus(stripeStatus) {
  return PAID_SUBSCRIPTION_STATUSES.includes(stripeStatus);
}

app.get('/subscription-status/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      const hasPaid = userData.isPremium && (userData.expiresAt > Date.now() || (userData.status && ['trialing', 'past_due'].includes(userData.status)));
      if (hasPaid) {
        return res.json({
          active: true,
          plan: userData.plan,
          status: 'active',
          expiresAt: userData.expiresAt,
          customerId: userData.customerId
        });
      }
    }

    const stripe = getStripe();
    const search = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
      limit: 1,
    });

    if (search.data.length > 0) {
      const customerId = search.data[0].id;
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 10
      });

      const paidSub = subscriptions.data.find(s => isPaidSubscriptionStatus(s.status));
      if (paidSub) {
        const sub = paidSub;
        const status = {
          active: true,
          plan: sub.items.data[0].price.id,
          status: 'active',
          expiresAt: sub.current_period_end * 1000,
          customerId: customerId
        };

        await db.collection('users').doc(userId).set({
          ...status,
          isPremium: true,
          status: sub.status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return res.json(status);
      }
    }

    res.json({ active: false, plan: null, status: 'inactive' });
  } catch (error) {
    console.error(`[Status] Error for ${userId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GEMINI PROXY
// ============================================================================

app.post('/enhance', async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    console.log('[Enhance] Request received:', { prompt: prompt?.substring(0, 50), model: GEMINI_MODEL });
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const key = geminiApiKey.value();
    if (!key) {
      console.error('[Enhance] Gemini API key not found');
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    const apiUrl = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${key}`;
    console.log('[Enhance] Calling Gemini API:', apiUrl.substring(0, 100) + '...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildEnhancePromptText(systemInstruction, prompt) }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Enhance] API error:', response.status, errorText);
      return res.status(response.status).json({ error: `API error: ${response.status} - ${errorText.substring(0, 200)}` });
    }

    const data = await response.json();
    console.log('[Enhance] API response received');
    
    let result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (!result && data.error) {
      console.error('[Enhance] API returned error:', data.error);
      return res.status(500).json({ error: data.error.message || 'API returned an error' });
    }
    
    result = result.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();
    
    if (!result) {
      console.warn('[Enhance] Empty result from API:', JSON.stringify(data).substring(0, 200));
      return res.status(500).json({ error: 'Empty response from API' });
    }

    console.log('[Enhance] Success, result length:', result.length);
    res.json({ result });
  } catch (error) {
    console.error('[Enhance] Error:', error);
    console.error('[Enhance] Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Streaming enhance: forwards Gemini SSE stream to client (uses faster-TTFB model)
app.post('/enhance-stream', async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    console.log('[EnhanceStream] Request received:', { prompt: prompt?.substring(0, 50), model: GEMINI_STREAM_MODEL });

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const key = geminiApiKey.value();
    if (!key) {
      console.error('[EnhanceStream] Gemini API key not found');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const apiUrl = `${GEMINI_BASE_URL}/${GEMINI_STREAM_MODEL}:streamGenerateContent?key=${key}&alt=sse`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildEnhancePromptText(systemInstruction, prompt) }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 8192,
          // Non-thinking mode: no internal reasoning tokens → much faster time-to-first-token (1–3s vs 8–13s).
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EnhanceStream] API error:', response.status, errorText);
      return res.status(response.status).json({ error: `API error: ${response.status}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders && res.flushHeaders();
    // Send immediate event so client knows stream is connected (reduces perceived wait)
    res.write('data: {"started":true}\n\n');

    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);
    nodeStream.on('error', (err) => {
      console.error('[EnhanceStream] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        try { res.end(); } catch (e) { /* already closed */ }
      }
    });
  } catch (error) {
    console.error('[EnhanceStream] Error:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Ask (question-answering) – same backend, different prompt shape
app.post('/ask', async (req, res) => {
  try {
    const { question, systemInstruction } = req.body;
    console.log('[Ask] Request received:', { question: question?.substring(0, 60) });

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const key = geminiApiKey.value();
    if (!key) {
      console.error('[Ask] Gemini API key not found');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const apiUrl = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${key}`;
    const promptText = systemInstruction
      ? `${systemInstruction}\n\nQuestion: ${question}\n\nAnswer:`
      : `Answer the following question clearly and concisely.\n\nQuestion: ${question}\n\nAnswer:`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          topP: 0.9,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Ask] API error:', response.status, errorText);
      return res.status(response.status).json({ error: `API error: ${response.status} - ${errorText.substring(0, 200)}` });
    }

    const data = await response.json();
    let result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!result && data.error) {
      console.error('[Ask] API returned error:', data.error);
      return res.status(500).json({ error: data.error.message || 'API returned an error' });
    }
    if (!result) {
      return res.status(500).json({ error: 'Empty response from API' });
    }

    console.log('[Ask] Success, result length:', result.length);
    res.json({ result });
  } catch (error) {
    console.error('[Ask] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

exports.api = onRequest({ 
  cors: true,
  maxInstances: 10,
  timeoutSeconds: 60,
  secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'GEMINI_API_KEY']
}, app);
