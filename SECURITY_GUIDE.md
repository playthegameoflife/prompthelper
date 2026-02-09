# Security Setup Guide

Follow these steps in order. Each section is independent so you can do them over time.

---

## 1. Restrict your Firebase API key (high priority)

Your Firebase API key lives in `firebase-config.js` and is bundled with the extension. It’s meant to be public, but it **must** be restricted so it can’t be used from other apps or for other APIs.

### Steps

1. **Open Google Cloud Console**
   - Go to: https://console.cloud.google.com/apis/credentials  
   - Select the project that backs your Firebase app (e.g. **prompt-enhancer-ai**).

2. **Find the Firebase key**
   - Under **API keys**, find the key that matches the value in `firebase-config.js`:  
     `AIzaSyDHlUcbwTNzApvbTkxNEw4brkE3CJ6rBoM`
   - Click the key name (or the pencil icon) to edit.

3. **Application restrictions**
   - Under **Application restrictions**, choose **HTTP referrers (web sites)**.
   - Click **Add an item** and add:
     - `chrome-extension://YOUR_EXTENSION_ID/`
   - To get **YOUR_EXTENSION_ID**:
     - Open `chrome://extensions`, enable **Developer mode**, find your extension, copy the ID under the name.
     - Or after publishing: use the ID from the Chrome Web Store dashboard.
   - If you need to test with an unpacked extension (different ID), add a second referrer for that ID, e.g. `chrome-extension://abcdefghijklmnop/`.
   - Save (don’t close the page yet).

4. **API restrictions**
   - Under **API restrictions**, choose **Restrict key**.
   - Click **Select APIs** and enable **only**:
     - **Firebase Authentication API** (or “Token Service API” if that’s what you see for Auth).
   - Leave all other APIs (e.g. Firestore, Gemini, etc.) **unchecked** so this key can’t be used for them.
   - Save.

5. **Optional: quota**
   - In the same key settings, you can set **Quotas** (e.g. requests per day) to cap abuse.  
   - In **Quotas & System** (or the quotas section for this key), set a daily limit you’re comfortable with and save.

After this, the Firebase API key in your extension can only be used from your extension ID(s) and only for Firebase Auth. Your Stripe and Gemini keys remain server-side only.

---

## 2. Restrict your OAuth 2.0 Client ID (high priority)

Your manifest uses a Google OAuth client for sign-in. Restrict it so only your extension can use it.

### Steps

1. **Same credentials page**
   - In Google Cloud Console go to: https://console.cloud.google.com/apis/credentials  
   - Under **OAuth 2.0 Client IDs**, find the client whose **Client ID** matches your manifest:  
     `1097186279139-00aqbna3di7fch3m5mbvov2824lri3bq.apps.googleusercontent.com`
   - Click it to edit.

2. **Restrict to your extension**
   - **Application type** should be **Chrome extension** (or **Chrome app** if that’s what you use).
   - In **Application ID** (or **Chrome app/extension ID**), enter your extension ID:  
     the same **YOUR_EXTENSION_ID** you used for the Firebase API key.
   - Save.

If the client is currently “Web application”, create a **new** OAuth client of type **Chrome extension**, set the Application ID to your extension ID, then update `manifest.json` to use the new Client ID and keep the old one only if you still need it for something else.

---

## 3. Billing alerts (recommended)

Avoid surprise bills from Firebase/Google Cloud or Gemini.

### Steps

1. **Google Cloud billing**
   - Go to: https://console.cloud.google.com/billing  
   - Select your project’s billing account → **Budgets & alerts**.
   - Create a **Budget** (e.g. $50 or $100/month).
   - Add an **Alert** at 50% and 90% (and optionally 100%) of the budget, and set your email (and optionally other contacts).

2. **Firebase usage**
   - In Firebase Console: https://console.firebase.google.com/  
   - Project **Usage and billing** → set budget alerts there too if offered.

3. **Gemini / AI Studio**
   - If you use Google AI Studio for the same project, check: https://aistudio.google.com/ (or the Gemini API quota page in Cloud Console) and set quotas/alerts for the APIs you use.

---

## 4. Backend (Cloud Run / Firebase) security

Your backend is at `https://api-clyep56cdq-uc.a.run.app`. Sensitive keys are in Firebase secrets (good). A few extra steps:

### 4.1 Optional: tighten CORS

Right now your functions use `cors({ origin: true })`, which allows any origin. To allow only your extension and your own pages:

- In `functions/index.js`, you could replace with something like:
  - `origin: ['https://api-clyep56cdq-uc.a.run.app', /^chrome-extension:\/\//]`  
  or a list of allowed origins including your extension origin `chrome-extension://YOUR_EXTENSION_ID`.
- Redeploy: `firebase deploy --only functions`.

Only do this when you know all clients (extension, any admin page, etc.) so you don’t block legitimate traffic.

### 4.2 Input limits (recommended)

To avoid huge payloads and possible abuse:

- In `/enhance` and `/enhance-stream`, reject if `prompt` (or total body) is too long, e.g.:
  - If `prompt.length > 100000` (or another limit), return `400` with a message like “Prompt too long.”
- Optionally do the same for `systemInstruction` and `/ask`’s `question`.

This doesn’t replace rate limiting or quotas but reduces risk of one-off oversized requests.

### 4.3 Keep secrets in Firebase only

- Never put Stripe secret key, Stripe webhook secret, or Gemini API key in extension code or in repo files.
- Keep using Firebase Functions **secrets** (or similar) and reference them only in server code. Your current setup (secrets in Firebase, keys only in `functions/index.js` via `defineSecret`) is correct.

---

## 5. Firestore (if you use it)

If your extension or backend writes to Firestore:

- Open **Firestore** in Firebase Console → **Rules**.
- Ensure rules are **not** `allow read, write: if true` for production.
- Typical pattern: allow read/write only if `request.auth != null` and (if needed) the document’s owner matches `request.auth.uid`. Restrict by collection and field as needed.

Your `firestore.rules` in the repo should match this; deploy with `firebase deploy --only firestore:rules` after editing.

---

## 6. What to avoid

- **Don’t** put Stripe secret key, webhook secret, or Gemini API key in the extension, in `config.js`, or in any front-end or public repo.
- **Don’t** use `cors({ origin: true })` long-term in production if you can restrict to your extension and backend.
- **Don’t** leave the Firebase API key unrestricted (no application + no API restrictions).
- **Don’t** commit real secrets to git. Use `.env` (and add `.env` to `.gitignore`) for local dev, and use Firebase/Cloud secrets for deployed functions.

---

## 7. Quick checklist

Use this to confirm you’ve done the basics:

| Step | What to do | Done |
|------|------------|------|
| 1 | Restrict Firebase API key: Application = HTTP referrers, only your extension ID(s) | ☐ |
| 2 | Restrict Firebase API key: API = only Firebase Authentication API | ☐ |
| 3 | Restrict OAuth client: Chrome extension, your extension ID | ☐ |
| 4 | Set a Google Cloud (and optionally Firebase) budget + email alerts | ☐ |
| 5 | (Optional) Tighten CORS in `functions/index.js` and redeploy | ☐ |
| 6 | (Optional) Add max length check for prompt/body in `/enhance` and `/enhance-stream` | ☐ |
| 7 | Review Firestore rules; deploy with `firebase deploy --only firestore:rules` | ☐ |

---

## 8. Where things live (recap)

| Item | Where it lives | Restrict how? |
|------|----------------|---------------|
| Firebase API key | `firebase-config.js` (in extension) | Google Cloud Console → API key → Application + API restrictions |
| OAuth Client ID | `manifest.json` (in extension) | Google Cloud Console → OAuth 2.0 Client ID → Chrome extension + App ID |
| Stripe secret key | Firebase Functions secrets | Never in extension; keep in secrets only |
| Stripe webhook secret | Firebase Functions secrets | Never in extension; keep in secrets only |
| Gemini API key | Firebase Functions secrets | Never in extension; keep in secrets only |
| Backend URL | `config.js` + `background.js` | No secret; optional CORS + rate/quote limits on backend |

Once 1–4 (and optionally 5–7) are done, your security setup is in good shape for production. Revisit the checklist when you add new APIs or change how sign-in or the backend work.
