# Firebase Authentication Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "prompt-helper-gemini")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project, go to **Authentication** in the left sidebar
2. Click **Get started**
3. Go to the **Sign-in method** tab
4. Find **Google** in the provider list and click on it
5. Click **Enable**
6. Enter your project name and support email
7. Click **Save**

## Step 3: Firebase Config Already Set Up ✅

Your Firebase configuration is already configured in `firebase-config.js` with your project settings:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy_YOUR_FIREBASE_API_KEY",
  authDomain: "prompt-enhancer-ai.firebaseapp.com",
  projectId: "prompt-enhancer-ai",
  storageBucket: "prompt-enhancer-ai.firebasestorage.app",
  messagingSenderId: "1097186279139",
  appId: "1:1097186279139:web:4578ddc11ca5c5283f4fd6"
};
```

## Step 4: Add Chrome Extension to Authorized Domains

1. **Get your extension ID:**
   - Load your extension in Chrome developer mode
   - Go to `chrome://extensions/`
   - Find your extension and copy the ID (looks like: `abcdefghijklmnopabcdefghijklmnop`)

2. **Add to Firebase authorized domains:**
   - Go to Firebase Console → Authentication → Settings
   - Scroll to "Authorized domains"
   - Add: `chrome-extension://akopohbjblhdhbbndbledmajoipklcgc`
   - Click "Add"

## Step 5: Chrome Extension Manifest

Your `manifest.json` already has the `"identity"` permission and now includes an `"oauth2"` section. You **MUST** update the `client_id` in `manifest.json` with your own Google OAuth Client ID.

### How to get your Google OAuth Client ID and stabilize your Extension ID:

When developing a Chrome extension, your **Extension ID** can change unless you "lock" it. Since your Google OAuth Client ID is tied to your Extension ID, you must do the following:

#### 1. Get your public key to "lock" your Extension ID:
1. Go to `chrome://extensions/` in Chrome.
2. If you have already loaded the extension, click **Pack extension**.
3. For "Extension root directory", select your project folder.
4. Click **Pack extension**. (Ignore the warning about private key if it's the first time).
5. This creates a `.crx` file and a `.pem` file *outside* your project folder. **DO NOT share the .pem file.**
6. Open the `.pem` file in a text editor.
7. To get the `key` string for `manifest.json`, you can follow [this guide](https://developer.chrome.com/docs/extensions/mv3/manifest/key/) or use a tool to convert the PEM to the manifest key string.
8. Alternatively, simpler method: In `chrome://extensions`, the ID is shown. To keep this ID, you need to add a `"key": "..."` field to your `manifest.json`. You can get this key by following [these instructions](https://stackoverflow.com/questions/21490301/how-to-find-the-public-key-for-my-google-chrome-extension).

#### 2. Create the OAuth Client ID:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Select **Chrome extension** as the Application type
6. Enter a name (e.g., "Prompt Helper Extension")
7. **Extension ID:** Enter your Chrome extension ID (copy it from `chrome://extensions/`)
8. Click **Create**
9. Copy the **Client ID** (it looks like `12345-abcde.apps.googleusercontent.com`).
10. Open `manifest.json` and replace the placeholder in `"client_id": "..."`.

#### 3. Reload:
1. Go to `chrome://extensions/` and click the **Refresh** icon on your extension.

## Step 6: Test Authentication

1. Load the extension in Chrome developer mode
2. Click the extension icon
3. You should see the login screen with "Sign in with Google"
4. Click the button and complete Google OAuth
5. You should be logged in and see the main interface

## Step 7: Handle User Data (Optional)

Firebase Auth provides user information you can use for:

- User ID: `user.uid`
- Display name: `user.displayName`
- Email: `user.email`
- Profile photo: `user.photoURL`

You can store this in your backend for user-specific features like premium subscriptions tied to specific users.

## Troubleshooting

### "Auth domain not authorized"
- Add your Chrome extension ID to authorized domains in Firebase Console
- Go to Authentication → Settings → Authorized domains
- Add: `chrome-extension://YOUR_EXTENSION_ID`

### "Invalid OAuth client"
- Make sure you've enabled Google sign-in in Firebase Authentication
- Check that your Firebase config is correct

### Extension doesn't load Firebase
- Check the browser console for Firebase loading errors
- Make sure the Firebase CDN URLs are accessible

## Security Notes

- Firebase handles token refresh automatically
- User sessions persist across browser restarts
- You can access the current user with `auth.currentUser`
- Sign out users with `auth.signOut()`

## Next Steps

Once authentication is working, you can:

1. **Tie usage limits to specific users** instead of local storage
2. **Store user preferences in Firebase** (or your backend)
3. **Implement user-specific features** like saved prompts
4. **Track analytics per user**
5. **Link premium subscriptions to Firebase user IDs**

The foundation is now set up for proper user authentication! 🎉</contents>
</xai:function_call">Firebase setup guide created