# How to Restrict Your Firebase API Key (Step-by-Step)

Restricting your key limits who can use it. Even if someone sees the key in your extension, they can't use it for other apps or APIs.

---

## 1. Open Google Cloud Console

1. Go to **https://console.cloud.google.com/**
2. Sign in with the Google account that owns your Firebase project.
3. At the top, open the **project dropdown** and select **prompt-enhancer-ai** (or your Firebase project name).

---

## 2. Go to Credentials

1. In the left menu, click **APIs & Services** → **Credentials**.
2. Or open directly: **https://console.cloud.google.com/apis/credentials?project=prompt-enhancer-ai**

You’ll see a list of API keys. Your Firebase key usually has a name like “Browser key” or “Web client (auto created by Firebase)” and starts with `AIzaSy...`.

---

## 3. Get Your Extension ID (for strict restriction)

To allow only your extension to use the key:

1. Open Chrome and go to **chrome://extensions**
2. Turn on **Developer mode** (top right).
3. If you’re testing an **unpacked** extension: its **ID** is under the extension name (e.g. `abcdefghijklmnopqrstuvwxyzabcdef`).
4. If the extension is **published**: open your extension’s store listing; the ID is in the URL:  
   `https://chrome.google.com/webstore/detail/**EXTENSION_ID**/...`

You’ll use this as: `chrome-extension://EXTENSION_ID/*`

---

## 4. Edit the API Key and Add Restrictions

1. On the Credentials page, find the **API key** that matches your Firebase app (the one in `firebase-config.js`).
2. Click the **pencil (Edit)** icon on that key.

### Application restrictions

1. Under **Application restrictions**, select **HTTP referrers (web sites)**.
2. Click **Add an item**.
3. Add **one** of these:
   - **Only your extension (recommended):**  
     `chrome-extension://YOUR_EXTENSION_ID/*`  
     Replace `YOUR_EXTENSION_ID` with the ID from step 3.
   - **Any Chrome extension (less secure):**  
     `chrome-extension://*`
4. Remove any other referrers you don’t need (e.g. `localhost` or random sites).

### API restrictions

1. Under **API restrictions**, select **Restrict key**.
2. In the list, **check only**:
   - **Firebase Authentication API**
3. Uncheck everything else (e.g. Gemini, Cloud AI, etc.) unless this key is meant for other APIs too.
4. Click **Save**.

---

## 5. Optional: Set a Quota

1. In the left menu go to **APIs & Services** → **Credentials**.
2. Click your API key again → **Quota** (or use the “Quota” tab if shown).
3. Set a daily limit (e.g. 10,000 or 50,000) and turn on **billing alerts** so you get notified if usage spikes.

---

## Summary

| Setting              | What to choose                                      |
|----------------------|-----------------------------------------------------|
| Application restrict | HTTP referrers (web sites)                          |
| Referrer             | `chrome-extension://YOUR_EXTENSION_ID/*`           |
| API restrict         | Restrict key → only **Firebase Authentication API** |

After saving, it can take a few minutes for restrictions to apply. Your extension will keep working; other origins or APIs will get “forbidden” when using this key.

---

## If You Created a New Key (After a Leak)

1. **Revoke/delete** the old key in the same Credentials page (three dots → Delete or Disable).
2. **Create** a new key: **+ CREATE CREDENTIALS** → **API key**.
3. **Restrict** the new key using steps 4–5 above.
4. Put the **new** key in `firebase-config.js` and `popup.html` (locally only; don’t commit it).
5. Rebuild, re-zip, and upload a new version to the Chrome Web Store.

---

## Quick links

- **Credentials:** https://console.cloud.google.com/apis/credentials?project=prompt-enhancer-ai  
- **Firebase project settings:** https://console.firebase.google.com/project/prompt-enhancer-ai/settings/general  
