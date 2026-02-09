# Finding Firebase Authentication API in Google Cloud Console

## 🔍 The API Might Be Named Differently

Firebase Authentication API can appear under different names:

### Common Names:
1. **"Identity Toolkit API"** ← Most common!
2. **"Google Identity Toolkit API"**
3. **"Firebase Authentication API"**
4. **"Firebase APIs"** (grouped)

## 📋 Step-by-Step: Finding the Right API

### Option 1: Search for "Identity Toolkit"

1. In the API restrictions section, click **"Select APIs"** or **"Restrict key"**
2. You'll see a list/search box
3. **Type:** `Identity Toolkit`
4. Look for: **"Identity Toolkit API"**
5. Check that one ✅

### Option 2: Check Enabled APIs

1. Go to: https://console.cloud.google.com/apis/library?project=prompt-enhancer-ai
2. Search for: `Identity Toolkit`
3. If it shows "API enabled", that's the one you need
4. The exact name will be: **"Identity Toolkit API"**

### Option 3: Look at Current Restrictions

Since your key shows "25 APIs", you can:

1. Click on the "Browser key" to edit it
2. Scroll to **"API restrictions"** section
3. Click **"Select APIs"** or see the list
4. Look for APIs related to:
   - Identity
   - Authentication
   - Firebase
5. The one you need is likely: **"Identity Toolkit API"**

## ✅ What to Select

**For Firebase Authentication, select:**
- ✅ **Identity Toolkit API** (this is Firebase Authentication)

**You can also keep:**
- ✅ **Firebase Installations API** (if you use Firebase)
- ✅ **Firebase Cloud Messaging API** (if you use push notifications)

**Remove/uncheck:**
- ❌ Other unrelated APIs (like Maps, YouTube, etc.)

## 🎯 Quick Test

After restricting, test your extension:
1. The extension should still work for sign-in
2. If it doesn't work, you might need to add more Firebase APIs

## 📝 Alternative: Less Restrictive Approach

If you can't find "Identity Toolkit API", you can:

1. **Select "Restrict key"**
2. **Check all Firebase-related APIs:**
   - Identity Toolkit API
   - Firebase Installations API
   - Firebase Cloud Messaging API
   - Firebase Remote Config API
   - (Any other Firebase APIs you use)

This is still much better than allowing all 25 APIs!

## 🔍 Still Can't Find It?

1. **Check the API Library:**
   - Go to: https://console.cloud.google.com/apis/library?project=prompt-enhancer-ai
   - Search: `Identity Toolkit`
   - Enable it if it's not enabled
   - Then go back to credentials and it should appear

2. **Check Current API List:**
   - When editing the key, look at what the "25 APIs" currently includes
   - One of them should be related to authentication/identity
