# Production Readiness Checklist

**Short answer:** The **code and architecture are production-ready**. You still need to complete a few **one-time setup steps** (API key restrictions, store assets, optional hardening) before publishing.

---

## ✅ What’s Already Production-Ready

| Area | Status |
|------|--------|
| **Secrets** | Stripe secret, webhook secret, and Gemini API key live in Firebase Functions secrets only (never in the extension). |
| **Backend** | Cloud Functions at `api-clyep56cdq-uc.a.run.app`; enhance, checkout, portal, subscription-status, webhook, health. |
| **Auth** | Firebase Auth + Chrome identity; sign-in required for upgrade; subscription tied to Firebase UID. |
| **Extension** | Manifest V3, strict CSP, host permissions scoped, XSS mitigations (e.g. `escapeHtml` for user content). |
| **Post-upgrade** | Cache clear + retry when returning from Stripe success; Premium tab shows correct status. |
| **Build** | `node build.js` minifies and obfuscates JS, strips debug logs, copies `config.js` and `stripe-config.js` to `dist/`. |
| **Firestore** | Rules: users can read only their own doc; only backend (admin) can write. |

---

## ⚠️ Required Before Going Live

### 1. Restrict Firebase API key (required)

- **Where:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your Firebase API key.
- **Do:**
  - **Application restrictions:** HTTP referrers → add `chrome-extension://YOUR_EXTENSION_ID/*` (use the ID from the Chrome Web Store after first upload, or a temporary one from Developer Dashboard).
  - **API restrictions:** Restrict key → enable only **Firebase Authentication API**.
- **Why:** The key is in the extension bundle; restricting it limits abuse. See `SECURITY_ANALYSIS.md`.

### 2. Stripe production

- **Live mode:** In Stripe Dashboard, switch to **Live** and use live keys in Firebase secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- **Webhook:** Add/update endpoint URL to **`https://api-clyep56cdq-uc.a.run.app/webhook`** (not `cloudfunctions.net`). Events: `checkout.session.completed`, `customer.subscription.updated`.
- **Price ID:** Ensure `stripe-config.js` (and any fallback in popup) uses your **live** Price ID (e.g. `price_...` from the live product).

### 3. Chrome Web Store

- **Privacy policy:** Required; host at a stable URL and add it in the Developer Dashboard.
- **Assets:** Screenshots (e.g. 1280×800 or 640×400), promo tile (440×280, 920×680). See `PUBLISHING_CHECKLIST.md`.
- **Package:** Zip the **contents** of `dist/` (after `node build.js`). Exclude `debug-firebase.html`, `test-popup.html`, `*.zip`, `functions/`, `server/`, internal `.md` files, and `node_modules` from the store zip if not already excluded by your build.

### 4. OAuth (Google Sign-In)

- After publishing, the extension gets a **Chrome Web Store ID**. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth 2.0 Client (Chrome app / extension), add that ID so sign-in works for the published extension.

---

## 🔧 Optional Hardening

- **CORS:** Backend uses `cors({ origin: true })`. You can restrict to `chrome-extension://*` and your backend URL if you want to lock down origins.
- **Rate limiting:** Consider rate limits on `/enhance`, `/enhance-stream`, and `/create-checkout-session` (e.g. per user or IP) to avoid abuse.
- **Billing alerts:** Set Google Cloud and Stripe billing alerts so you notice unexpected usage or costs.
- **Quotas:** Set quotas on the Firebase API key in Google Cloud to cap Auth usage.

---

## 📦 Build and Ship

```bash
node build.js
# Test from dist/ in Chrome (Load unpacked → select dist/)
# Zip contents of dist/ (not the dist folder itself)
# Upload zip in Chrome Web Store Developer Dashboard
```

---

## Summary

| Question | Answer |
|----------|--------|
| Is the **code** production-ready? | **Yes.** Architecture, security, and flows are solid. |
| Can you **ship** as-is? | **Almost.** You must: restrict Firebase API key, fix Stripe webhook URL and live config, add store assets and privacy policy, then package from `dist/` and complete OAuth client ID. |
| Biggest risk if you skip steps? | Firebase API key abuse (mitigated by restrictions) or Stripe webhook not firing (wrong URL/secret). |

Once the required steps above are done, the project is **production-ready** to publish and run in production.
