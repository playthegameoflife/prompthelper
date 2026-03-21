# API Keys Setup Checklist

## 🔍 Current Status

Your extension uses **Firebase Cloud Functions** at `https://api-clyep56cdq-uc.a.run.app`

## ✅ Required API Keys

### 1. **Firebase API Key** ✅ CONFIGURED
- **Location:** `firebase-config.js`
- **Status:** ✅ Configured
- **Key:** Set in `firebase-config.js` (get from Firebase Console; never commit real key)
- **Purpose:** Firebase Authentication

### 2. **Stripe Secret Key** ✅ CONFIGURED
- **Location:** Firebase Functions Secrets
- **Status:** ✅ Set (LIVE mode key)
- **Required:** `STRIPE_SECRET_KEY`
- **Purpose:** Process payments and subscriptions
- **Note:** Using LIVE mode key (`rk_live_...`) - production ready!

### 3. **Stripe Webhook Secret** ✅ CONFIGURED
- **Location:** Firebase Functions Secrets
- **Status:** ✅ Set
- **Required:** `STRIPE_WEBHOOK_SECRET`
- **Purpose:** Verify Stripe webhook signatures

### 4. **Gemini API Key** ✅ CONFIGURED
- **Location:** Firebase Functions Secrets
- **Status:** ✅ Set
- **Required:** `GEMINI_API_KEY`
- **Purpose:** Backend proxy for prompt enhancement

## 🔧 How to Check & Fix

### Step 1: Check Current Firebase Functions Config

Run this command:
```bash
cd functions
firebase functions:config:get
```

You should see:
```json
{
  "stripe": {
    "secret_key": "sk_test_...",
    "webhook_secret": "whsec_..."
  },
  "gemini": {
    "api_key": "AIzaSy..."
  }
}
```

### Step 2: Set Missing Keys (Firebase Functions Gen 2)

**Important:** Your functions use Gen 2 which requires **secrets**, not config!

Set secrets using Firebase CLI:

```bash
# Set Stripe Secret Key (as a secret)
echo -n "sk_test_YOUR_ACTUAL_KEY" | firebase functions:secrets:set STRIPE_SECRET_KEY

# Set Stripe Webhook Secret (as a secret)
echo -n "whsec_YOUR_ACTUAL_SECRET" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# Set Gemini API Key (as a secret)
echo -n "AIzaSy_YOUR_ACTUAL_KEY" | firebase functions:secrets:set GEMINI_API_KEY
```

**Or use the Firebase Console:**
1. Go to https://console.firebase.google.com/
2. Select your project: `prompt-enhancer-ai`
3. Go to **Functions** → **Secrets** tab
4. Click **Add secret**
5. Add each secret:
   - Name: `STRIPE_SECRET_KEY`, Value: `sk_test_...`
   - Name: `STRIPE_WEBHOOK_SECRET`, Value: `whsec_...`
   - Name: `GEMINI_API_KEY`, Value: `AIzaSy...`

### Step 3: Update Functions to Use Secrets

Your `functions/index.js` already uses `defineString()` which is correct for Gen 2. Make sure the function has access to secrets:

```javascript
// In functions/index.js - already correct!
const stripeSecretKey = defineString('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineString('STRIPE_WEBHOOK_SECRET');
const geminiApiKey = defineString('GEMINI_API_KEY');
```

### Step 4: Redeploy Functions

After setting secrets, redeploy:
```bash
cd functions
firebase deploy --only functions
```

### Step 4: Verify

Check the health endpoint:
```bash
curl https://api-clyep56cdq-uc.a.run.app/health
```

Should return:
```json
{
  "status": "ok",
  "geminiConfigured": true
}
```

## 🚨 Common Issues

### Issue: 500 Errors on `/subscription-status`
**Cause:** Missing `STRIPE_SECRET_KEY` in Firebase Functions
**Fix:** Set `stripe.secret_key` using `firebase functions:config:set`

### Issue: Checkout doesn't work
**Cause:** Missing `STRIPE_SECRET_KEY` or invalid key
**Fix:** Verify Stripe key is correct and set in Firebase Functions

### Issue: API enhancement doesn't work
**Cause:** Missing `GEMINI_API_KEY` in Firebase Functions
**Fix:** Set `gemini.api_key` using `firebase functions:config:set`

## 📝 Quick Check Script

Run this to check your setup:

```bash
# Check Firebase Functions secrets (Gen 2)
firebase functions:secrets:access STRIPE_SECRET_KEY
firebase functions:secrets:access GEMINI_API_KEY

# Test health endpoint
curl https://api-clyep56cdq-uc.a.run.app/health

# Test subscription status (will fail if Stripe key missing)
curl https://api-clyep56cdq-uc.a.run.app/subscription-status/test_user
```

## 🔍 How to Check if Secrets Are Set

### Method 1: Firebase Console
1. Go to https://console.firebase.google.com/
2. Select project: `prompt-enhancer-ai`
3. Go to **Functions** → **Secrets** tab
4. You should see:
   - `STRIPE_SECRET_KEY` ✅
   - `STRIPE_WEBHOOK_SECRET` ✅
   - `GEMINI_API_KEY` ✅

### Method 2: Check Function Logs
```bash
firebase functions:log
```

Look for errors like:
- `STRIPE_SECRET_KEY is not defined`
- `Secret not found`

## 🎯 Summary

**What's Working:**
- ✅ Firebase Auth (configured in firebase-config.js)
- ✅ Extension code (points to correct server URL: `https://api-clyep56cdq-uc.a.run.app`)
- ✅ Function code updated to require secrets

**What Needs Setup:**
- ⚠️ **STRIPE_SECRET_KEY** - Set as Firebase Function secret
- ⚠️ **STRIPE_WEBHOOK_SECRET** - Set as Firebase Function secret  
- ⚠️ **GEMINI_API_KEY** - Set as Firebase Function secret

**The 500 errors are because these secrets are not set in Firebase Functions!**

## 🚀 Quick Fix Steps

1. **Set secrets in Firebase Console:**
   - Go to: https://console.firebase.google.com/project/prompt-enhancer-ai/functions/secrets
   - Add each secret:
     - `STRIPE_SECRET_KEY` = `sk_test_YOUR_KEY`
     - `STRIPE_WEBHOOK_SECRET` = `whsec_YOUR_SECRET`
     - `GEMINI_API_KEY` = `AIzaSy_YOUR_KEY`

2. **Redeploy functions:**
   ```bash
   cd functions
   firebase deploy --only functions
   ```

3. **Test:**
   ```bash
   curl https://api-clyep56cdq-uc.a.run.app/health
   ```

## 📋 API Keys Required Summary

| Key | Location | Purpose | Status |
|-----|----------|---------|--------|
| Firebase API Key | `firebase-config.js` | Authentication | ✅ Set |
| Stripe Secret Key | Firebase Functions Secrets | Payments | ✅ **SET** (LIVE mode) |
| Stripe Webhook Secret | Firebase Functions Secrets | Webhook verification | ✅ **SET** |
| Gemini API Key | Firebase Functions Secrets | AI enhancement | ✅ **SET** |

**Note:** Subscription does NOT require an API key from the user. The backend uses the Gemini API key stored in Firebase Functions.

## ✅ All Secrets Configured!

All required API keys and secrets are now set:
- ✅ Stripe Secret Key
- ✅ Stripe Webhook Secret  
- ✅ Gemini API Key

## 🚀 Final Step: Redeploy Functions

Now you need to redeploy your Firebase Functions so they can use the secrets:

```bash
cd functions
firebase deploy --only functions
```

After deployment, your subscription system should be fully functional!
