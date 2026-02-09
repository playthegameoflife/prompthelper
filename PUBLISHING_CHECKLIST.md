# 🚀 Final Publishing Checklist

Your Chrome Extension is code-complete and ready for production! Before you upload it to the Chrome Web Store, follow this checklist to ensure a smooth launch.

## 0. Pre-Publish Security & Store Readiness (Done / Verify)

*   [x] **XSS:** Custom style names and history content are escaped (`escapeHtml`) before being inserted into the DOM.
*   [x] **CSP:** Extension CSP is strict (`script-src 'self'; object-src 'self'`) — no localhost or eval in production.
*   [x] **Manifest:** `homepage_url` removed to avoid placeholder; add it back in Developer Dashboard or manifest when you have a real URL.
*   [ ] **Firebase API key:** Restrict in [Google Cloud Console](https://console.cloud.google.com/apis/credentials): Application restriction = Chrome extension (your ID); API restriction = Firebase Auth only. (See `SECURITY_ANALYSIS.md`.)
*   [ ] **Package for store:** Zip **only the contents of the `dist/` folder** (after `node build.js`). Never zip the project root—that could include `.env` or `server/` and expose secrets. Use: `cd dist && zip -r ../extension-for-store.zip .` or the npm script below.
*   [ ] **Stripe Price ID:** Ensure `stripe-config.js` (or popup) has the **live** Price ID for the store listing; keep Stripe keys server-side only.

## 1. Deploying to Firebase
Your backend now lives in the `functions/` folder. This is more secure and integrates with your users automatically.

*   [ ] Go to the **Firebase Console** and upgrade to the **Blaze Plan** (it's free for 2M requests/month).
*   [ ] In your terminal, run:
    ```bash
    firebase login
    firebase use prompt-enhancer-ai
    ```
*   [ ] Set your secret keys in Firebase Config:
    ```bash
    firebase functions:config:set stripe.secret_key="sk_live_..." stripe.webhook_secret="whsec_..." gemini.api_key="AIza..."
    ```
*   [ ] Deploy the backend:
    ```bash
    firebase deploy --only functions,firestore
    ```
*   [ ] Update the `PAYMENT_SERVER_URL` in `popup.js` if your region is different than `us-central1`.

## 2. API Keys & Stripe Production
*   [ ] In the Stripe Dashboard, toggle to **Live Mode**.
*   [ ] Create a Webhook pointing to: `https://us-central1-prompt-enhancer-ai.cloudfunctions.net/api/webhook`
*   [ ] Add the events: `checkout.session.completed`, `customer.subscription.updated`.

## 3. Stripe Production Setup
*   [ ] In the Stripe Dashboard, toggle from **Test Mode** to **Live Mode**.
*   [ ] Create a Product and a recurring Price.
*   [ ] Copy the **Live Price ID** and update it in:
    *   `popup-extension.html` (button data-price-id)
    *   `popup.js` (fallback ID)
    *   `utils/feature-gating.js`

## 4. Firebase Restrictions
*   [ ] In the **Google Cloud Console**, go to your API Key settings.
*   [ ] Restrict the API key to only work with your final **Chrome Extension ID**.
*   [ ] Ensure **Authorized Domains** in Firebase Auth includes your backend server's URL.

## 5. Chrome Web Store Assets
*   [ ] **Privacy Policy**: Required. You can host a simple one on GitHub Pages or a free site.
*   [ ] **Screenshots**: At least one 1280x800 or 640x400 image.
*   [ ] **Promo Tile**: Small (440x280) and Large (920x680).
*   [ ] **Description**: The one in `manifest.json` is a good start, but expand it for the store listing.

## 6. Final Build & Packaging
Run the build script to generate minified and obfuscated code for production:

```bash
node build.js
```

*   [ ] Test the extension using the files in the `dist/` folder.
*   [ ] Zip the **contents** of the `dist/` folder (not the folder itself).
*   [ ] Upload the zip to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

### Current Status: **Ready for Hosting**
The code logic is 100% complete. Once you move the server from `localhost` to a live URL, you are ready to go live!
