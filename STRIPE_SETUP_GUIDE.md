# Stripe Setup Guide - Step by Step

This guide will walk you through setting up Stripe payments for your Prompt Helper Gemini extension.

## Prerequisites

- A Stripe account (free to create at https://stripe.com)
- Node.js installed on your computer
- ngrok installed (for local webhook testing)

---

## Step 1: Create Stripe Account & Get API Keys

1. **Sign up for Stripe**: Go to https://stripe.com and create an account
2. **Get your API keys**:
   - Go to https://dashboard.stripe.com/test/apikeys
   - Copy your **Publishable key** (starts with `pk_test_...`)
   - Copy your **Secret key** (starts with `sk_test_...`)
   - ⚠️ Keep your secret key safe - never share it publicly!

---

## Step 2: Create Products and Prices in Stripe

1. **Go to Products page**: https://dashboard.stripe.com/test/products
2. **Create Premium Plan**:
   - Click "Add product"
   - Name: `Premium Plan`
   - Description: `Unlimited prompt enhancements and all premium features`
   - Pricing: `Recurring`, `$19.99`, `Monthly`
   - Click "Save product"
   - **Copy the Price ID** (starts with `price_...`) - you'll need this!

---

## Step 3: Update Price IDs in Extension

1. **Open `popup.html`**
2. **Find the subscription buttons** (around line 1552 and 1573)
3. **Update the `data-price-id` attributes** with your actual Price IDs:

```html
<!-- Pro Plan Button -->
<button id="subscribe-pro-button" class="premium-button" data-price-id="price_YOUR_PRO_PRICE_ID">
    Subscribe to Pro
</button>

<!-- Premium Plan Button -->
<button id="subscribe-premium-button" class="premium-button" data-price-id="price_YOUR_PREMIUM_PRICE_ID">
    Subscribe to Premium
</button>
```

Replace `price_YOUR_PRO_PRICE_ID` and `price_YOUR_PREMIUM_PRICE_ID` with the actual Price IDs from Step 2.

---

## Step 4: Set Up Backend Server

1. **Navigate to server directory**:
   ```bash
   cd server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file**:
   ```bash
   # Create the file
   touch .env
   ```

4. **Add your Stripe keys to `.env`**:
   ```env
   STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
   STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
   PORT=3000
   ```

   ⚠️ **Note**: You'll get the webhook secret in Step 6. For now, leave it as `whsec_...` or empty.

5. **Update `utils/subscription-manager.js`**:
   - Open `utils/subscription-manager.js`
   - Update line 7 with your server URL:
   ```javascript
   const PAYMENT_SERVER_URL = 'http://localhost:3000'; // For local testing
   // For production: 'https://your-domain.com'
   ```
   - Update line 8 with your publishable key:
   ```javascript
   const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_PUBLISHABLE_KEY_HERE';
   ```

---

## Step 5: Start the Backend Server

1. **In the `server` directory, run**:
   ```bash
   npm start
   ```

   You should see:
   ```
   Stripe server running on port 3000
   Webhook endpoint: http://localhost:3000/api/webhook
   ```

2. **Keep this terminal open** - the server needs to keep running!

---

## Step 6: Set Up Webhooks (Local Testing with ngrok)

### Install ngrok

1. **Download ngrok**: https://ngrok.com/download
2. **Install it** (follow instructions for your OS)
3. **Or use Homebrew** (Mac):
   ```bash
   brew install ngrok
   ```

### Start ngrok

1. **In a NEW terminal window**, run:
   ```bash
   ngrok http 3000
   ```

2. **Copy the HTTPS URL** (looks like `https://abc123.ngrok.io`)
   - You'll see something like:
     ```
     Forwarding   https://abc123.ngrok.io -> http://localhost:3000
     ```

### Configure Webhook in Stripe

1. **Go to Stripe Webhooks**: https://dashboard.stripe.com/test/webhooks
2. **Click "Add endpoint"**
3. **Enter your ngrok URL**:
   ```
   https://abc123.ngrok.io/api/webhook
   ```
   (Replace `abc123.ngrok.io` with your actual ngrok URL)
4. **Select events to listen to**:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
5. **Click "Add endpoint"**
6. **Copy the "Signing secret"** (starts with `whsec_...`)
7. **Update your `.env` file** with the webhook secret:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
   ```
8. **Restart your server** (Ctrl+C, then `npm start` again)

---

## Step 7: Test the Integration

1. **Load your extension in Chrome**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select your extension folder

2. **Open the extension popup**

3. **Click the "Premium" tab**

4. **Click "Subscribe to Pro"**

5. **You should see Stripe Checkout open in a new tab**

6. **Use Stripe test card**:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

7. **Complete the checkout**

8. **Return to the extension** - the subscription status should update!

---

## Step 8: Production Deployment

When you're ready to go live:

### Backend Server Deployment

**Option 1: Railway (Recommended - Easy)**
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Add environment variables:
   - `STRIPE_SECRET_KEY` (use live key: `sk_live_...`)
   - `STRIPE_PUBLISHABLE_KEY` (use live key: `pk_live_...`)
   - `STRIPE_WEBHOOK_SECRET` (from production webhook)
   - `PORT` (usually auto-set)
6. Deploy!

**Option 2: Render**
1. Go to https://render.com
2. Create new "Web Service"
3. Connect your GitHub repo
4. Set environment variables (same as above)
5. Deploy!

**Option 3: Heroku**
```bash
heroku create your-app-name
heroku config:set STRIPE_SECRET_KEY=sk_live_...
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_...
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
git push heroku main
```

### Update Extension for Production

1. **Update `utils/subscription-manager.js`**:
   ```javascript
   const PAYMENT_SERVER_URL = 'https://your-deployed-server.com';
   const STRIPE_PUBLISHABLE_KEY = 'pk_live_YOUR_LIVE_KEY';
   ```

2. **Update webhook URL in Stripe Dashboard**:
   - Go to https://dashboard.stripe.com/webhooks
   - Edit your webhook endpoint
   - Change URL to: `https://your-deployed-server.com/api/webhook`
   - Copy the new signing secret
   - Update it in your hosting platform's environment variables

3. **Switch to live mode in Stripe**:
   - Toggle "Test mode" to "Live mode" in Stripe dashboard
   - Get your live API keys
   - Update them in your server environment variables

---

## Troubleshooting

### Webhook not receiving events
- ✅ Make sure ngrok is running (`ngrok http 3000`)
- ✅ Check webhook URL in Stripe dashboard matches your ngrok URL
- ✅ Verify webhook secret in `.env` matches Stripe dashboard
- ✅ Check server logs for errors

### Checkout not opening
- ✅ Verify server is running (`npm start` in server directory)
- ✅ Check `PAYMENT_SERVER_URL` in `utils/subscription-manager.js`
- ✅ Open browser console (F12) and check for errors
- ✅ Verify Price IDs in `popup.html` match your Stripe products

### Subscription status not updating
- ✅ Check webhook events in Stripe dashboard (https://dashboard.stripe.com/test/webhooks)
- ✅ Verify webhook is receiving events (click on webhook → "Events" tab)
- ✅ Check server console for webhook processing logs
- ✅ Try clearing cache: In extension, Premium tab should refresh automatically

### Server errors
- ✅ Check all environment variables are set in `.env`
- ✅ Verify Stripe keys are correct (test keys start with `sk_test_` and `pk_test_`)
- ✅ Check server logs for specific error messages

---

## Test Cards

Use these Stripe test cards for testing:

| Card Number | Result |
|------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Card declined |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |

Use any future expiry date, any CVC, and any ZIP code.

---

## Next Steps

1. ✅ Test the full payment flow
2. ✅ Implement feature gating (use `utils/feature-gating.js`)
3. ✅ Add usage limits for free users
4. ✅ Set up analytics tracking
5. ✅ Add email notifications
6. ✅ Create customer support workflow

---

## Support

If you run into issues:
1. Check Stripe Dashboard → Webhooks → Events (see what events are being sent)
2. Check server console logs
3. Check browser console (F12) for errors
4. Verify all environment variables are set correctly

For Stripe-specific help: https://support.stripe.com
