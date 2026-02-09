# API Key Security Guide

## ✅ Backend Proxy Implemented!

**Your API key is now secure!** The extension uses a backend proxy - your API key stays on the server and is never exposed to users.

See `BACKEND_PROXY_SETUP.md` for details.

---

## ⚠️ Previous Warning (Now Resolved)

**Previously:** Users COULD see your API key if it was included in the extension bundle. Chrome extensions are not encrypted, and all files can be inspected by users.

**Now:** ✅ Backend proxy implemented - API key is secure on the server!

## Current Setup

- Your API key is in `config.local.js` (gitignored)
- It's loaded via `<script src="config.local.js">` in `popup.html`
- If this file exists when you build, it will be included in the extension bundle
- **Anyone who installs the extension can see the key**

## Security Solutions

### Option 1: Google Cloud API Key Restrictions (Recommended for Quick Setup)

**Best for:** Limiting damage if key is exposed

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your API key (e.g. `AIzaSy...` from Firebase/Google Cloud Console)
4. Click **Edit** and set restrictions:

   **Application restrictions:**
   - Select **HTTP referrers (web sites)**
   - Add: `chrome-extension://*` (allows all Chrome extensions)
   - Or be more specific: `chrome-extension://YOUR_EXTENSION_ID/*`

   **API restrictions:**
   - Select **Restrict key**
   - Only enable: **Generative Language API** (Gemini API)
   - This prevents the key from being used for other Google services

   **Quota limits:**
   - Set daily/monthly quotas to limit usage
   - Monitor usage in Cloud Console

**Pros:**
- Quick to set up
- Limits what the key can be used for
- Can monitor usage
- Can revoke if abused

**Cons:**
- Key is still visible
- Users can still use it (within your quota limits)
- Quota limits affect all users

### Option 2: Backend Proxy (Most Secure)

**Best for:** Production apps with many users

Create a backend server that:
- Holds your API key securely (server-side only)
- Receives requests from the extension
- Makes API calls to Gemini on behalf of users
- Returns results to the extension

**Implementation:**
1. Add API endpoint to your existing Stripe server (`server/stripe-server.js`)
2. Extension sends prompts to your server
3. Server calls Gemini API with your key
4. Server returns results to extension

**Pros:**
- API key never exposed to users
- Full control over usage
- Can implement rate limiting per user
- Can add authentication/authorization

**Cons:**
- Requires server infrastructure
- Additional costs (hosting)
- More complex setup

### Option 3: Embed in Obfuscated Code (Partial Protection)

**Best for:** Making key harder to find (not truly secure)

Modify `build.js` to:
- Read `config.local.js` during build
- Embed the key directly into the obfuscated JavaScript
- The key will be obfuscated but still extractable

**Pros:**
- Key is harder to find
- No server needed

**Cons:**
- Still visible with enough effort
- Not truly secure
- Key is in the codebase (even if obfuscated)

### Option 4: Accept Risk + Monitor (Current Approach)

**Best for:** Small user base, testing phase

- Keep current setup
- Monitor API usage in Google Cloud Console
- Set up billing alerts
- Revoke and rotate key if abused

**Pros:**
- Simplest setup
- No infrastructure needed

**Cons:**
- Key is fully exposed
- Users can extract and use it
- You pay for all usage

## Recommended Approach

**For now (testing/small scale):**
1. ✅ Use **Option 1** (API Key Restrictions)
2. ✅ Set quotas and billing alerts
3. ✅ Monitor usage regularly

**For production (many users):**
1. ✅ Implement **Option 2** (Backend Proxy)
2. ✅ Keep API key on server only
3. ✅ Add rate limiting per user
4. ✅ Use Stripe subscription to authenticate users

## Setting Up API Key Restrictions (Quick Start)

1. Visit: https://console.cloud.google.com/apis/credentials
2. Find your key (starts with `AIzaSy...`)
3. Click **Edit**
4. Under **Application restrictions**:
   - Select **HTTP referrers (web sites)**
   - Add: `chrome-extension://*`
5. Under **API restrictions**:
   - Select **Restrict key**
   - Enable only: **Generative Language API**
6. Under **Quotas**:
   - Set daily quota (e.g., 1,000,000 requests/day)
   - Set up billing alerts
7. Click **Save**

## Monitoring Usage

1. Go to: https://console.cloud.google.com/apis/dashboard
2. Select **Generative Language API**
3. View **Metrics** tab for usage graphs
4. Set up **Alerts** for unusual spikes

## If Key is Compromised

1. **Immediately revoke** the key in Google Cloud Console
2. Generate a new key
3. Update `config.local.js` with new key
4. Rebuild and republish extension
5. Review usage logs to see what happened

## Next Steps

Choose your approach based on:
- **Testing phase**: Use Option 1 (restrictions) + monitoring
- **Production**: Use Option 2 (backend proxy)

Would you like me to:
1. Help set up API key restrictions?
2. Implement a backend proxy?
3. Modify the build process to embed the key?
