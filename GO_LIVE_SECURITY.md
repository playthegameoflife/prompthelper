# Go-Live Security Checklist

## ✅ What’s safe (no change needed)

| Item | Where | Status |
|------|--------|--------|
| **Stripe Secret Key** | Firebase Functions Secrets only | ✅ Never in code |
| **Stripe Webhook Secret** | Firebase Functions Secrets only | ✅ Never in code |
| **Gemini API Key** | Firebase Functions Secrets only | ✅ Never in code |

The extension only talks to your backend (`https://api-clyep56cdq-uc.a.run.app`). Stripe and Gemini keys are used only on the server.

---

## ⚠️ Before you go live: restrict Firebase API key

Your **Firebase API key** is in `firebase-config.js` (and used in the extension). That’s normal for Firebase Auth, but it must be restricted so it can’t be abused.

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials?project=prompt-enhancer-ai).
2. Find the key that matches the one in `firebase-config.js` (starts with `AIzaSy...`).
3. Click it → **Edit**.
4. **Application restrictions**
   - Choose **HTTP referrers (web sites)**.
   - Add: `chrome-extension://YOUR_EXTENSION_ID/*`  
     (Get YOUR_EXTENSION_ID from `chrome://extensions` when the extension is loaded.)
5. **API restrictions**
   - Choose **Restrict key**.
   - Enable only: **Firebase Authentication API** (or the APIs you actually use).
6. Save.

After this, the key only works for your extension and only for the APIs you selected.

---

## 🔐 If you ever pushed real secrets to Git

- **Rotate them.** In Stripe: create new API keys and revoke the old ones. In Google: create a new Firebase/API key and restrict it, then remove the old one.
- Do not rely on “we’ll delete the file later”; assume the old keys are compromised.

---

## Summary

- **Stripe + Gemini:** Safe; they live only in Firebase Functions Secrets.
- **Firebase API key:** In the extension by design; **restrict it in Google Cloud** before going live.
- **Docs:** Real-looking keys in markdown/docs have been replaced with placeholders.

After restricting the Firebase key, you’re in good shape to go live from an API-key perspective.
