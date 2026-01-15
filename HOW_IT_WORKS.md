# How the Stripe Integration Works

## Architecture Overview

The integration uses a **3-part architecture**:

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Chrome         │         │  Your Backend    │         │   Stripe    │
│  Extension      │◄───────►│  Server          │◄───────►│   API       │
│  (Client)       │         │  (Node.js)        │         │             │
└─────────────────┘         └──────────────────┘         └──────────────┘
```

## Payment Flow (Step-by-Step)

### 1. User Clicks "Subscribe" Button

```
User clicks "Subscribe to Pro" in Premium tab
    ↓
popup.js calls openCheckout('price_pro_monthly')
    ↓
subscription-manager.js creates checkout session
```

**Code Flow:**
```javascript
// In popup.js
subscribeProButton.addEventListener('click', async () => {
  await handleSubscribe('price_pro_monthly');
});

// In subscription-manager.js
async function openCheckout(priceId) {
  const userId = await getUserId(); // Get or create user ID
  const session = await createCheckoutSession(priceId, ...);
  chrome.tabs.create({ url: session.url }); // Open Stripe Checkout
}
```

### 2. Backend Creates Stripe Checkout Session

```
Extension sends POST request to your server
    ↓
POST /api/create-checkout-session
{
  userId: "user_123456",
  priceId: "price_pro_monthly",
  successUrl: "chrome-extension://.../popup.html?payment=success",
  cancelUrl: "chrome-extension://.../popup.html?payment=canceled"
}
    ↓
Server creates Stripe Checkout Session
    ↓
Returns checkout URL to extension
```

**Backend Code:**
```javascript
// In stripe-server.js
app.post('/api/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId, // Links payment to user
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  
  res.json({ url: session.url }); // Stripe-hosted checkout page
});
```

### 3. User Completes Payment on Stripe

```
Extension opens Stripe Checkout page in new tab
    ↓
User enters credit card details
    ↓
Stripe processes payment
    ↓
On success: Redirects to successUrl
On cancel: Redirects to cancelUrl
```

### 4. Stripe Sends Webhook to Your Server

```
Payment successful
    ↓
Stripe sends webhook event to your server
    ↓
POST /api/webhook
Event: checkout.session.completed
    ↓
Server processes webhook:
  - Verifies webhook signature
  - Extracts userId from session
  - Updates subscription status
  - Stores in database/cache
```

**Webhook Handler:**
```javascript
// In stripe-server.js
app.post('/api/webhook', async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    STRIPE_WEBHOOK_SECRET
  );
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    
    // Update subscription status
    userSubscriptions.set(userId, {
      active: true,
      plan: subscription.items.data[0].price.id,
      status: 'active',
    });
  }
});
```

### 5. Extension Checks Subscription Status

```
User returns to extension
    ↓
Extension checks subscription status
    ↓
GET /api/subscription-status/:userId
    ↓
Server returns current status
    ↓
Extension updates UI (shows "Active" status)
```

**Status Check:**
```javascript
// In subscription-manager.js
async function getSubscriptionStatus() {
  const userId = await getUserId();
  const response = await fetch(
    `${PAYMENT_SERVER_URL}/api/subscription-status/${userId}`
  );
  const status = await response.json();
  // Returns: { active: true, plan: 'price_pro_monthly', status: 'active' }
  return status;
}
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION FLOW                            │
└─────────────────────────────────────────────────────────────────┘

1. USER ACTION
   ┌─────────────┐
   │ Click       │
   │ "Subscribe" │
   └──────┬──────┘
          │
          ▼
2. EXTENSION
   ┌─────────────────────────┐
   │ getUserId()            │ → Generates: "user_123456"
   │ createCheckoutSession() │ → POST /api/create-checkout-session
   └──────┬──────────────────┘
          │
          ▼
3. BACKEND SERVER
   ┌──────────────────────────────┐
   │ stripe.checkout.sessions.    │
   │   create({                   │
   │     price: "price_pro_...", │
   │     client_reference_id:    │
   │       "user_123456"         │
   │   })                         │
   └──────┬───────────────────────┘
          │
          ▼
4. STRIPE
   ┌──────────────────┐
   │ Checkout Page    │ → User enters card
   │ Payment Process  │ → Stripe charges card
   └──────┬───────────┘
          │
          ▼
5. WEBHOOK (Async)
   ┌──────────────────────────────┐
   │ Stripe → POST /api/webhook   │
   │ Event: checkout.session.     │
   │   completed                   │
   │                               │
   │ Server updates:               │
   │   userSubscriptions.set(     │
   │     "user_123456",            │
   │     { active: true, ... }     │
   │   )                           │
   └──────┬────────────────────────┘
          │
          ▼
6. EXTENSION POLLS
   ┌──────────────────────────────┐
   │ GET /api/subscription-status │
   │   /user_123456               │
   │                               │
   │ Returns:                      │
   │   { active: true,             │
   │     plan: "price_pro_...",    │
   │     status: "active" }       │
   └───────────────────────────────┘
```

## Key Components

### 1. **User Identification**
- Each extension user gets a unique ID stored in `chrome.storage.local`
- Format: `user_1234567890_abc123`
- This ID links the user to their Stripe subscription

### 2. **Subscription Status Caching**
- Status is cached for 5 minutes to reduce API calls
- Cache stored in `chrome.storage.local`
- Can be force-refreshed when needed

### 3. **Webhook Processing**
- Stripe sends events to your server when:
  - Payment succeeds
  - Subscription is updated
  - Subscription is canceled
  - Payment fails
- Server verifies webhook signature for security

### 4. **Feature Gating**
- Premium features check subscription status before allowing access
- Example:
  ```javascript
  await gateFeature('unlimited_enhancements', () => {
    // User has access - proceed
    doUnlimitedEnhancements();
  });
  ```

## Security Features

1. **Secret Keys Never Exposed**
   - Stripe secret key only on backend server
   - Extension only uses publishable key (safe to expose)

2. **Webhook Signature Verification**
   - Server verifies webhook requests are from Stripe
   - Prevents fake subscription activations

3. **User ID Validation**
   - Server validates user IDs
   - Prevents unauthorized access

## Real-World Example

**Scenario:** User wants to subscribe to Pro plan

1. **User clicks "Subscribe to Pro"**
   - Extension: `openCheckout('price_pro_monthly')`

2. **Extension requests checkout session**
   - Extension → Server: `POST /api/create-checkout-session`
   - Server → Stripe: Create session
   - Stripe → Server: Returns session URL
   - Server → Extension: Returns `{ url: "https://checkout.stripe.com/..." }`

3. **Extension opens Stripe Checkout**
   - `chrome.tabs.create({ url: session.url })`
   - User sees Stripe's secure payment page

4. **User enters card and pays**
   - Card: `4242 4242 4242 4242` (test)
   - Stripe processes payment

5. **Stripe sends webhook**
   - Stripe → Server: `POST /api/webhook` (event: `checkout.session.completed`)
   - Server updates: `userSubscriptions.set('user_123', { active: true })`

6. **Extension checks status**
   - Extension → Server: `GET /api/subscription-status/user_123`
   - Server → Extension: `{ active: true, plan: 'price_pro_monthly' }`
   - Extension updates UI: Shows "Premium Active"

7. **User can now use premium features**
   - Feature checks: `hasActiveSubscription()` → `true`
   - Premium features unlocked!

## Why This Architecture?

1. **Security**: Secret keys stay on server, never in extension
2. **Reliability**: Webhooks ensure status updates even if user closes extension
3. **User Experience**: Stripe handles all payment UI/security
4. **Scalability**: Server can handle many users
5. **Compliance**: Stripe handles PCI compliance for card data

## Testing the Flow

1. Start server: `cd server && npm start`
2. Start ngrok: `ngrok http 3000`
3. Update webhook URL in Stripe dashboard
4. Load extension
5. Click Premium tab → Subscribe
6. Use test card: `4242 4242 4242 4242`
7. Check subscription status updates

That's how it works! 🎉
