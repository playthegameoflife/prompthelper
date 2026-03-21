# How to Restrict Your Firebase API Key

## 🔍 Finding Your Firebase API Key

Your Firebase API key is: `YOUR_FIREBASE_API_KEY`

## 📍 Method 1: Firebase Console (Easier)

1. Go to: https://console.firebase.google.com/
2. Select your project: **prompt-enhancer-ai**
3. Click the **⚙️ gear icon** (top left) → **Project settings**
4. Scroll down to **Your apps** section
5. You'll see your web app with the API key listed

**Note:** Firebase API keys can't be restricted directly in Firebase Console. You need to use Google Cloud Console.

## 📍 Method 2: Google Cloud Console (Required for Restrictions)

### Step 1: Open Google Cloud Console

1. Go to: https://console.cloud.google.com/
2. Make sure you're in the correct project: **prompt-enhancer-ai**
   - If not, click the project dropdown at the top and select it

### Step 2: Navigate to Credentials

1. In the left sidebar, click **APIs & Services**
2. Click **Credentials**
3. You should see a list of API keys

### Step 3: Find Your Firebase API Key

Look for the key: `YOUR_FIREBASE_API_KEY`

**If you don't see it:**
- It might be listed under a different name
- Look for keys that start with `AIzaSy`
- Check if there are multiple keys (Firebase creates one per app)

### Step 4: Edit and Restrict

1. Click on the API key (or click **Edit** if there's an edit button)
2. Under **Application restrictions**, select **HTTP referrers (web sites)**
3. Click **Add an item**
4. Add: `chrome-extension://*` (allows all Chrome extensions)
   - Or be specific: `chrome-extension://YOUR_EXTENSION_ID/*`
5. Under **API restrictions**, select **Restrict key**
6. Check only: **Firebase Authentication API**
7. Click **Save**

## 🔍 Alternative: Find via Firebase Project Settings

1. Go to: https://console.firebase.google.com/project/prompt-enhancer-ai/settings/general
2. Scroll to **Your apps** section
3. Click on your web app
4. You'll see: **apiKey: "YOUR_FIREBASE_API_KEY"**
5. Click the link that says **"Restrict key"** or **"Manage in Google Cloud Console"**

## 🆘 Still Can't Find It?

### Option 1: Search in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Use the search box at the top
3. Search for: `YOUR_FIREBASE_API_KEY`

### Option 2: Check API Key Restrictions

1. Go to: https://console.cloud.google.com/apis/credentials
2. Look for any API keys that are **unrestricted**
3. Firebase API keys are usually named something like:
   - "Browser key (auto created by Firebase)"
   - "Web client (auto created by Firebase)"
   - Or just "API key"

### Option 3: Create a New Restricted Key

If you can't find the existing key:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **+ CREATE CREDENTIALS** → **API key**
3. Copy the new key
4. Restrict it immediately (before using it)
5. Update `firebase-config.js` with the new key
6. Redeploy your extension

## ✅ What Restrictions Should Look Like

**Application restrictions:**
- ✅ HTTP referrers (web sites)
- ✅ `chrome-extension://*` (or your specific extension ID)

**API restrictions:**
- ✅ Restrict key
- ✅ Only: Firebase Authentication API

**Quota:**
- ✅ Set daily/monthly limits
- ✅ Enable billing alerts

## 🎯 Quick Links

- **Firebase Console:** https://console.firebase.google.com/project/prompt-enhancer-ai
- **Google Cloud Console:** https://console.cloud.google.com/apis/credentials?project=prompt-enhancer-ai
- **Direct API Key Search:** https://console.cloud.google.com/apis/credentials?project=prompt-enhancer-ai&q=YOUR_FIREBASE_API_KEY
