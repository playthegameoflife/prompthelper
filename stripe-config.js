/**
 * Stripe subscription config.
 *
 * "No such price" means this ID doesn't exist in YOUR Stripe account.
 * Replace with your real Price ID:
 *
 * 1. Go to https://dashboard.stripe.com/products
 * 2. Create a Product (e.g. "Prompt Architect Pro") → Add another price
 * 3. Set amount (e.g. $1) and billing (Monthly)
 * 4. Copy the Price ID (starts with price_xxxxx) and set it below.
 */
window.STRIPE_PRO_PRICE_ID = 'price_1SuFV7GdisCqoeFIRmlo7yb2';

/**
 * Stripe Customer Portal URL for "Manage subscription".
 * Used when the backend portal session is unavailable (fallback).
 * Get this from: Stripe Dashboard → Settings → Billing → Customer portal → Share link.
 */
window.STRIPE_CUSTOMER_PORTAL_URL = 'https://billing.stripe.com/p/login/bJe28racM6RSgzC1cT7AI00';
