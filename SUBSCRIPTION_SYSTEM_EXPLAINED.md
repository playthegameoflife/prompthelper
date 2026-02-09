# Subscription System - How It Works

## Current System (Anonymous Users - No Login)

### How Users Become Premium

1. **User clicks "Subscribe"** in extension
2. **Extension generates/gets userId** (stored locally in `chrome.storage.local`)
   - Format: `user_1234567890_abc123` (anonymous, no login)
3. **Extension creates Stripe Checkout** with userId as `client_reference_id`
4. **User pays on Stripe** checkout page
5. **Stripe sends webhook** → `checkout.session.completed`
6. **Server stores subscription** in memory (Map) with userId as key
7. **Extension checks status** by calling `/api/subscription-status/:userId`

### How We Track Premium Users

**Current Implementation:**
- **Extension side:** Each user gets a unique `userId` stored in `chrome.storage.local`
- **Server side:** Subscriptions stored in `userSubscriptions` Map (in-memory)
  ```javascript
  userSubscriptions.set(userId, {
    status: { active: true, plan: 'price_1SpzCb...', ... }
  })
  ```
- **Extension checks:** Calls `/api/subscription-status/:userId` to see if premium

**Problem:** ⚠️ Subscriptions are lost when server restarts (no database)

### Is There Login?

**No login system currently.** Users are anonymous:
- Each extension installation gets a unique `userId`
- Stored locally in `chrome.storage.local`
- No email, password, or authentication
- If user uninstalls/reinstalls extension, they get a new userId (loses subscription)

---

## How It Works Step-by-Step

### 1. User Subscribes

```javascript
// Extension: popup.js
const userId = await getUserId(); // "user_1234567890_abc123"
const session = await createCheckoutSession(priceId, ...);
// Opens Stripe checkout with userId as client_reference_id
```

### 2. Stripe Checkout

- User enters payment info on Stripe's secure page
- Stripe processes payment
- Stripe redirects back to extension

### 3. Webhook Activates Subscription

```javascript
// Server: stripe-server.js
case 'checkout.session.completed':
  const userId = session.client_reference_id; // "user_1234567890_abc123"
  userSubscriptions.set(userId, {
    status: { active: true, plan: 'price_1SpzCb...' }
  });
```

### 4. Extension Checks Status

```javascript
// Extension checks if user is premium
const status = await getSubscriptionStatus();
if (status.active && status.plan === 'price_1SpzCb...') {
  // User is premium!
}
```

---

## Current Limitations

### ❌ Problems

1. **No Database:** Subscriptions lost on server restart
2. **No Login:** Users can't access subscription from different devices
3. **No Email Tracking:** Can't email users about subscriptions
4. **Lost on Reinstall:** If user uninstalls extension, they lose subscription
5. **No Customer Portal:** Can't manage subscription easily

### ✅ What Works

1. **Anonymous subscriptions** work for single-device users
2. **Stripe webhooks** properly activate subscriptions
3. **Feature gating** checks subscription status
4. **No login required** - frictionless for users

---

## Production Improvements Needed

### Option 1: Add Database (Recommended)

**Store subscriptions in database:**

```javascript
// Use MongoDB, PostgreSQL, or SQLite
// Store: userId → Stripe customerId → subscription status
```

**Benefits:**
- ✅ Persists across server restarts
- ✅ Can track subscription history
- ✅ Can add email notifications

### Option 2: Add Email Login (Better UX)

**Require email during checkout:**

```javascript
// Stripe checkout with email
customer_email: userEmail, // From user input
```

**Store mapping:**
```javascript
// Database: email → userId → subscription
```

**Benefits:**
- ✅ Users can access from multiple devices
- ✅ Can send subscription emails
- ✅ Can recover subscription if extension reinstalled

### Option 3: Stripe Customer Portal (Easier Management)

**Link Stripe Customer ID to userId:**

```javascript
// When subscription created, store:
userId → Stripe Customer ID
```

**Benefits:**
- ✅ Users can manage subscription via Stripe portal
- ✅ Cancel, update payment method, view invoices
- ✅ No need to build custom UI

---

## Recommended Production Setup

### 1. Add Database

**Use MongoDB (free tier available):**

```javascript
// Install: npm install mongodb
const { MongoClient } = require('mongodb');

// Store:
{
  userId: "user_123...",
  stripeCustomerId: "cus_abc123",
  email: "user@example.com", // Optional
  subscription: {
    active: true,
    plan: "price_1SpzCb...",
    status: "active",
    expiresAt: 1234567890
  }
}
```

### 2. Update Webhook Handler

```javascript
case 'checkout.session.completed':
  const userId = session.client_reference_id;
  const customerId = session.customer;
  
  // Store in database
  await db.collection('users').updateOne(
    { userId },
    { 
      $set: {
        stripeCustomerId: customerId,
        subscription: { active: true, ... }
      }
    },
    { upsert: true }
  );
```

### 3. Update Subscription Status Endpoint

```javascript
app.get('/api/subscription-status/:userId', async (req, res) => {
  const { userId } = req.params;
  
  // Query database instead of memory
  const user = await db.collection('users').findOne({ userId });
  
  if (user?.subscription?.active) {
    res.json(user.subscription);
  } else {
    res.json({ active: false, plan: null, status: 'inactive' });
  }
});
```

### 4. Optional: Add Email Collection

**In extension, before checkout:**

```javascript
// Ask for email (optional but recommended)
const email = prompt('Enter your email (optional, for subscription management):');
// Pass to checkout session
```

---

## Quick Fix: Persist to File (Temporary)

**If you don't want to set up a database yet:**

```javascript
// server/stripe-server.js
const fs = require('fs');
const SUBSCRIPTIONS_FILE = './subscriptions.json';

// Load on startup
let userSubscriptions = new Map();
try {
  const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
  const subscriptions = JSON.parse(data);
  userSubscriptions = new Map(Object.entries(subscriptions));
} catch (e) {
  // File doesn't exist yet
}

// Save on webhook
case 'checkout.session.completed':
  userSubscriptions.set(userId, { ... });
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(Object.fromEntries(userSubscriptions)));
```

**⚠️ Warning:** File-based storage is not recommended for production (race conditions, not scalable)

---

## Summary

### Current State
- ✅ Anonymous subscriptions work
- ✅ Webhooks activate subscriptions
- ✅ Feature gating works
- ❌ No persistence (lost on restart)
- ❌ No multi-device access
- ❌ No email tracking

### Recommended Next Steps
1. **Add database** (MongoDB/PostgreSQL)
2. **Store userId → customerId mapping**
3. **Optional:** Add email collection
4. **Optional:** Add login system (if multi-device needed)

### For Now (Testing)
- Current system works for single-device users
- Subscriptions persist until server restarts
- Good enough for initial testing

---

## Questions?

- **Q: Do users need to login?**  
  A: Not currently. Each extension gets a unique userId. For multi-device, add email/login.

- **Q: What happens if server restarts?**  
  A: Subscriptions are lost (stored in memory). Add database to fix.

- **Q: Can users access from multiple devices?**  
  A: Not currently. Each device has different userId. Add email/login to fix.

- **Q: How do users cancel?**  
  A: Currently need to contact you or use Stripe dashboard. Add customer portal for self-service.
