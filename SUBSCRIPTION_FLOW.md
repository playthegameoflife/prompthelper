# Subscription Flow - Step by Step

## How Users Become Premium (Current System)

### Step 1: User Clicks Subscribe
- User opens extension popup
- Clicks "Subscribe to Premium" button
- Extension generates/retrieves `userId` (stored in `chrome.storage.local`)
  - Example: `user_1734567890_abc123xyz`

### Step 2: Create Checkout Session
- Extension calls: `POST /api/create-checkout-session`
- Sends: `{ userId, priceId: "price_1SpzCb..." }`
- Server creates Stripe Checkout Session with:
  - `client_reference_id: userId` (links payment to user)
  - `priceId` for Premium plan

### Step 3: User Pays on Stripe
- Stripe checkout page opens in new tab
- User enters payment info
- Stripe processes payment
- User redirected back to extension

### Step 4: Webhook Activates Subscription ⭐
- Stripe sends webhook: `checkout.session.completed`
- Server receives webhook at: `POST /api/webhook`
- Server extracts:
  - `userId` from `session.client_reference_id`
  - `customerId` from `session.customer`
  - `subscriptionId` from `session.subscription`
- Server stores:
  ```javascript
  userIdToCustomerId.set(userId, customerId);
  userSubscriptions.set(userId, {
    status: {
      active: true,
      plan: "price_1SpzCb...",
      status: "active",
      expiresAt: 1234567890000
    }
  });
  ```

### Step 5: Extension Checks Status
- Extension calls: `GET /api/subscription-status/:userId`
- Server checks:
  1. In-memory cache (if recent)
  2. Stripe API (if customerId exists)
- Returns subscription status
- Extension enables premium features

---

## How We Track Premium Users

### Current System (In-Memory)

**Extension Side:**
- Each user has unique `userId` in `chrome.storage.local`
- Generated on first use: `user_${timestamp}_${random}`
- Persists across extension sessions
- **Lost if extension uninstalled**

**Server Side:**
- `userSubscriptions` Map: `userId → subscription status`
- `userIdToCustomerId` Map: `userId → Stripe customerId`
- Stored in server memory
- **Lost if server restarts** ⚠️

**Status Check:**
```javascript
// Extension
const userId = await getUserId(); // "user_123..."
const status = await fetch(`/api/subscription-status/${userId}`);
// Returns: { active: true, plan: "price_1SpzCb...", ... }
```

---

## Is There Login?

**No login system currently.**

### Current: Anonymous Users
- ✅ No email/password required
- ✅ No account creation
- ✅ Frictionless experience
- ❌ Can't access from multiple devices
- ❌ Lost if extension uninstalled
- ❌ No email notifications

### How It Works
1. Extension generates `userId` on first use
2. Stored locally in `chrome.storage.local`
3. Used for all subscription operations
4. No authentication required

### If You Want Login (Optional)

**Option 1: Email-Only (Simple)**
- Collect email during checkout
- Store: `email → userId → subscription`
- Users can "recover" subscription by entering email

**Option 2: Full Login (Complex)**
- Add login page in extension
- Store: `email + password → userId → subscription`
- Users can access from multiple devices
- More complex but better UX

---

## Current Limitations & Solutions

### ❌ Problem: Subscriptions Lost on Server Restart

**Current:** Stored in memory Map
**Solution:** Add database (MongoDB/PostgreSQL)

```javascript
// Instead of Map, use database
await db.collection('subscriptions').insertOne({
  userId: userId,
  customerId: customerId,
  subscription: { ... }
});
```

### ❌ Problem: Can't Access from Multiple Devices

**Current:** userId stored locally per device
**Solution:** Add email/login system

```javascript
// Store: email → userId → subscription
// User logs in with email on new device
// Gets same userId and subscription
```

### ❌ Problem: Lost if Extension Uninstalled

**Current:** userId in local storage (deleted on uninstall)
**Solution:** Link to email/account

```javascript
// Store subscription by email, not just userId
// User can recover by entering email
```

---

## Production Recommendations

### Minimum (Works Now)
- ✅ Current system works for testing
- ✅ Subscriptions activate via webhooks
- ✅ Feature gating works
- ⚠️ Add database for persistence

### Recommended (Better)
- ✅ Add database (MongoDB/PostgreSQL)
- ✅ Store: `userId → customerId → subscription`
- ✅ Query Stripe API for real-time status
- ✅ Add email collection (optional)

### Ideal (Best UX)
- ✅ Add database
- ✅ Add email/login system
- ✅ Multi-device access
- ✅ Email notifications
- ✅ Customer portal integration

---

## Quick Fix: Add Database

**Install MongoDB:**
```bash
npm install mongodb
```

**Update server:**
```javascript
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);

// Store subscription
await db.collection('users').updateOne(
  { userId },
  { $set: { customerId, subscription: {...} } },
  { upsert: true }
);

// Query subscription
const user = await db.collection('users').findOne({ userId });
```

**Free MongoDB:** https://www.mongodb.com/cloud/atlas (free tier)

---

## Summary

### How Users Become Premium
1. Click subscribe → Checkout → Pay → Webhook activates → Premium! ✅

### How We Track Premium
- `userId` (anonymous, local) → Server Map → Subscription status
- Extension checks status via API call

### Is There Login?
- **No** - Anonymous system
- Each device gets unique `userId`
- No email/password required

### For Production
- Add database for persistence
- Optional: Add email/login for multi-device
- Current system works for testing!
