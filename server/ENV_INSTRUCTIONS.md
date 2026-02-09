# Payment Server Configuration

To make payments fully functional, you need to set up your environment variables and Stripe account.

## 1. Create a `.env` file in the `server` folder:

```env
# Stripe API Keys
# Get these from: https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook Secret
# To get this, download the Stripe CLI and run:
# stripe listen --forward-to localhost:3000/api/webhook
STRIPE_WEBHOOK_SECRET=whsec_...

# Gemini API Key (Required for the backend to enhance prompts)
GEMINI_API_KEY=AIzaSy...

# Server Configuration
PORT=3000
```

## 2. Set up Stripe Products:

1.  Go to **Stripe Dashboard** > **Products**.
2.  Create a new product named **"Prompt Helper Premium"**.
3.  Set it as a **"Recurring"** payment (e.g., $19.99/month).
4.  Copy the **Price ID** (starts with `price_...`).
5.  Open `popup.js` and ensure the `priceId` in the subscription handler matches this ID.

## 3. Run the Server:

```bash
cd server
npm install
node stripe-server.js
```

## 4. Test Webhooks:

If you want to test the checkout flow locally, you MUST use the Stripe CLI to forward webhooks:

1.  [Install Stripe CLI](https://stripe.com/docs/stripe-cli).
2.  Run `stripe login`.
3.  Run `stripe listen --forward-to localhost:3000/api/webhook`.
4.  Copy the webhook secret (`whsec_...`) into your `.env` file.

## 5. Reload Extension:

1.  Go to `chrome://extensions/`.
2.  Reload the extension.
3.  Now, when you click "Upgrade to Premium", it will open a real Stripe Checkout page!
