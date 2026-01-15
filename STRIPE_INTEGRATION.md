# Stripe Payment Integration Guide

This guide explains how to integrate Stripe payments into the Prompt Architect extension.

## Overview

The integration consists of:
1. **Backend Server** (`server/stripe-server.js`) - Handles Stripe API calls securely
2. **Subscription Manager** (`utils/subscription-manager.js`) - Manages subscription status in the extension
3. **Payment UI** - Premium tab in the popup
4. **Feature Gating** (`utils/feature-gating.js`) - Controls access to premium features

## Setup Instructions

### 1. Stripe Account Setup

1. Create a Stripe account at https://stripe.com
2. Get your API keys from https://dashboard.stripe.com/apikeys
   - Test keys for development: `sk_test_...` and `pk_test_...`
   - Live keys for production: `sk_live_...` and `pk_live_...`

### 2. Create Products and Prices in Stripe

1. Go to https://dashboard.stripe.com/products
2. Create two products:
   - **Pro Plan**: $9.99/month
   - **Premium Plan**: $19.99/month
3. For each product, create a recurring price (monthly subscription)
4. Copy the Price IDs (e.g., `price_1234567890`)
5. Update the Price IDs in `popup.html`:
   ```html
   <button data-price-id="price_pro_monthly">Subscribe to Pro</button>
   <button data-price-id="price_premium_monthly">Subscribe to Premium</button>
   ```

### 3. Backend Server Setup

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Add your Stripe keys to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_your_key_here
   STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   PORT=3000
   ```

5. Start the server:
   ```bash
   npm start
   ```

### 4. Webhook Setup

1. For local testing, use ngrok:
   ```bash
   ngrok http 3000
   ```

2. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

3. In Stripe Dashboard → Webhooks:
   - Add endpoint: `https://your-ngrok-url.ngrok.io/api/webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the webhook signing secret to `.env`

### 5. Extension Configuration

1. Update `utils/subscription-manager.js`:
   ```javascript
   const PAYMENT_SERVER_URL = 'http://localhost:3000'; // Your server URL
   const STRIPE_PUBLISHABLE_KEY = 'pk_test_your_key_here';
   ```

2. For production, use your deployed server URL:
   ```javascript
   const PAYMENT_SERVER_URL = 'https://your-domain.com';
   ```

### 6. Production Deployment

#### Backend Server

Deploy to:
- **Heroku**: `git push heroku main`
- **Railway**: Connect GitHub repo
- **Render**: Create new web service
- **AWS Lambda**: Use Serverless Framework
- **Google Cloud Functions**: Deploy via CLI

Set environment variables in your hosting platform:
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PORT`

#### Extension

1. Update `PAYMENT_SERVER_URL` to your production server
2. Update `STRIPE_PUBLISHABLE_KEY` to your live publishable key
3. Build and publish your extension

## Usage

### Checking Subscription Status

```javascript
// Check if user has active subscription
const hasActive = await hasActiveSubscription();

// Check if user has specific plan
const hasPro = await hasPlan('price_pro_monthly');
```

### Gating Features

```javascript
// Gate a feature
await gateFeature('unlimited_enhancements', () => {
  // Feature is available - proceed
  console.log('User has access');
}, () => {
  // Feature not available - show upgrade prompt
  showUpgradePrompt('unlimited_enhancements');
});
```

### Opening Checkout

```javascript
// Open Stripe Checkout for a price
await openCheckout('price_pro_monthly');
```

## Testing

### Test Cards

Use Stripe test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Use any future expiry date, any CVC, and any ZIP code.

### Testing Flow

1. Start backend server: `npm start`
2. Start ngrok: `ngrok http 3000`
3. Update webhook URL in Stripe dashboard
4. Load extension in Chrome
5. Click Premium tab
6. Click "Subscribe to Pro"
7. Complete checkout with test card
8. Verify subscription status updates

## Security Considerations

1. **Never expose secret keys** in client-side code
2. **Always verify webhook signatures** using `STRIPE_WEBHOOK_SECRET`
3. **Use HTTPS** in production (required for webhooks)
4. **Validate user IDs** on the server side
5. **Store customer IDs** in your database for user lookup

## Database Integration (Production)

For production, you'll need to:

1. Store user → customer ID mapping
2. Store subscription status in database
3. Query Stripe Customer API for subscription status
4. Handle subscription lifecycle events

Example database schema:
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY,
  stripe_customer_id VARCHAR UNIQUE,
  subscription_status VARCHAR,
  subscription_plan VARCHAR,
  subscription_expires_at TIMESTAMP
);
```

## Troubleshooting

### Webhook not receiving events
- Verify webhook URL is HTTPS
- Check webhook secret matches
- Ensure server is accessible
- Check Stripe dashboard for delivery logs

### Subscription status not updating
- Clear subscription cache: `clearSubscriptionCache()`
- Check webhook events are being received
- Verify user ID mapping is correct

### Checkout not opening
- Verify `PAYMENT_SERVER_URL` is correct
- Check server is running
- Verify Price IDs exist in Stripe
- Check browser console for errors

## Support

For issues:
1. Check Stripe Dashboard logs
2. Check server logs
3. Check browser console
4. Verify all environment variables are set

## Next Steps

1. Add more premium features
2. Implement usage limits for free tier
3. Add annual billing options
4. Implement coupon codes
5. Add analytics tracking
