# Quick Start: Stripe Setup (5 Minutes)

## 1. Get Stripe Keys (2 min)

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy:
   - Publishable key: `pk_test_...`
   - Secret key: `sk_test_...`

## 2. Create Products (1 min)

1. Go to https://dashboard.stripe.com/test/products
2. Create one product:
   - **Premium**: $19.99/month → Copy Price ID (`price_...`)

## 3. Update Extension (1 min)

1. **Update `popup.html`** (line ~1572):
   ```html
   data-price-id="price_YOUR_ACTUAL_PREMIUM_PRICE_ID"
   ```

2. **Update `utils/subscription-manager.js`** (line 7-8):
   ```javascript
   const PAYMENT_SERVER_URL = 'http://localhost:3000';
   const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_KEY_HERE';
   ```

## 4. Start Server (1 min)

```bash
cd server
npm install
```

Create `.env` file:
```env
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_placeholder
PORT=3000
```

Start server:
```bash
npm start
```

## 5. Set Up Webhook (for local testing)

1. Install ngrok: `brew install ngrok` (or download from ngrok.com)
2. In new terminal: `ngrok http 3000`
3. Copy HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Go to https://dashboard.stripe.com/test/webhooks
5. Add endpoint: `https://abc123.ngrok.io/api/webhook`
6. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Copy webhook secret → Update `.env` → Restart server

## 6. Test!

1. Load extension in Chrome
2. Open Premium tab
3. Click "Subscribe to Pro"
4. Use test card: `4242 4242 4242 4242`
5. Complete checkout
6. Check subscription status updates!

---

**Full guide**: See `STRIPE_SETUP_GUIDE.md` for detailed instructions.
