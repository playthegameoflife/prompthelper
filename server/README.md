# Stripe Payment Server

Backend server for handling Stripe payments for the Prompt Architect extension.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Stripe keys
   ```

3. **Get Stripe API keys:**
   - Go to https://dashboard.stripe.com/apikeys
   - Copy your test keys (use live keys in production)
   - Add them to `.env`

4. **Set up Stripe webhook:**
   - Go to https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - URL: `https://your-domain.com/api/webhook` (use ngrok for local testing)
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the webhook signing secret to `.env`

5. **Run the server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

## Local Testing with ngrok

1. Install ngrok: https://ngrok.com/
2. Start your server: `npm start`
3. In another terminal: `ngrok http 3000`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Add this URL as your webhook endpoint in Stripe dashboard
6. Update the webhook URL in your extension code

## Production Deployment

Deploy to:
- Heroku
- Railway
- Render
- AWS Lambda
- Google Cloud Functions
- Any Node.js hosting service

Make sure to:
- Set environment variables in your hosting platform
- Use production Stripe keys
- Update webhook URL in Stripe dashboard
- Use HTTPS (required for webhooks)
