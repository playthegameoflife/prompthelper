# Quick Setup - Your Stripe Keys Are Ready!

Your Stripe keys have been configured in the extension. Now you just need to set up the server `.env` file.

## Step 1: Create `.env` file in the `server` directory

Create a file called `.env` in the `server` folder with this content:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
GEMINI_API_KEY=AIzaSy_YOUR_GEMINI_KEY
PORT=3000
```

**Important:** The `GEMINI_API_KEY` is your Google Gemini API key. This will be used by the backend proxy to make API calls on behalf of users, keeping the key secure and hidden from the extension.

## Step 2: Get your webhook secret

1. Start your server: `cd server && npm start`
2. In another terminal, start ngrok: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Go to https://dashboard.stripe.com/test/webhooks
5. Click "Add endpoint"
6. URL: `https://your-ngrok-url.ngrok.io/api/webhook`
7. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
8. Copy the "Signing secret" (starts with `whsec_...`)
9. Update `.env` with the webhook secret
10. Restart your server

## Step 3: Create your Premium product in Stripe

1. Go to https://dashboard.stripe.com/test/products
2. Click "Add product"
3. Name: `Premium Plan`
4. Description: `Unlimited prompt enhancements`
5. Pricing: `Recurring`, `$19.99`, `Monthly`
6. Click "Save product"
7. Copy the Price ID (starts with `price_...`)
8. Update `popup.html` line ~1572:
   ```html
   data-price-id="price_YOUR_ACTUAL_PRICE_ID"
   ```

## Done! ✅

Your extension is now configured with your Stripe keys!
