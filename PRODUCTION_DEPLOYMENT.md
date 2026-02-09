# Production Deployment Guide

## 🚀 Quick Checklist

- [ ] Deploy backend server to hosting platform
- [ ] Set environment variables on hosting platform
- [ ] Update `BACKEND_API_URL` in extension
- [ ] Remove `config.local.js` from extension (no longer needed)
- [ ] Test production deployment
- [ ] Build and publish extension

---

## Step 1: Deploy Backend Server

Choose a hosting platform (all have free tiers):

### Option A: Railway (Recommended - Easiest)

1. **Sign up:** https://railway.app
2. **New Project** → **Deploy from GitHub repo** (or upload `server/` folder)
3. **Set environment variables:**
   - `STRIPE_SECRET_KEY` = `sk_test_...`
   - `STRIPE_PUBLISHABLE_KEY` = `pk_test_...`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
   - `GEMINI_API_KEY` = `AIzaSy_YOUR_KEY`
   - `PORT` = (auto-set, usually 3000)
4. **Deploy** - Railway will give you a URL like: `https://your-app.railway.app`

### Option B: Render

1. **Sign up:** https://render.com
2. **New** → **Web Service**
3. **Connect GitHub** (or upload `server/` folder)
4. **Settings:**
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
5. **Environment Variables:**
   - Add all variables from `server/.env`
6. **Deploy** - Render gives you: `https://your-app.onrender.com`

### Option C: Heroku

1. **Sign up:** https://heroku.com
2. **Create app:** `heroku create your-app-name`
3. **Set config vars:**
   ```bash
   heroku config:set STRIPE_SECRET_KEY=sk_test_...
   heroku config:set STRIPE_PUBLISHABLE_KEY=pk_test_...
   heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
   heroku config:set GEMINI_API_KEY=AIzaSy_YOUR_KEY
   ```
4. **Deploy:**
   ```bash
   cd server
   git init
   git add .
   git commit -m "Initial commit"
   heroku git:remote -a your-app-name
   git push heroku main
   ```

### Option D: DigitalOcean App Platform

1. **Sign up:** https://cloud.digitalocean.com
2. **Create App** → **GitHub** (or upload)
3. **Configure:**
   - Source: `server/` directory
   - Build Command: `npm install`
   - Run Command: `npm start`
4. **Environment Variables:** Add all from `server/.env`
5. **Deploy**

---

## Step 2: Get Your Production URL

After deployment, you'll get a URL like:
- Railway: `https://your-app.railway.app`
- Render: `https://your-app.onrender.com`
- Heroku: `https://your-app.herokuapp.com`
- DigitalOcean: `https://your-app.ondigitalocean.app`

**Test it:**
```bash
curl https://your-production-url.com/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "geminiConfigured": true
}
```

---

## Step 3: Update Extension for Production

### 3.1 Update Backend URL

Edit `background.js`:

**Find:**
```javascript
const BACKEND_API_URL = 'http://localhost:3000';
```

**Replace with:**
```javascript
const BACKEND_API_URL = 'https://your-production-url.com';
```

### 3.2 Update Subscription Manager (if needed)

Edit `utils/subscription-manager.js`:

**Find:**
```javascript
const PAYMENT_SERVER_URL = 'http://localhost:3000';
```

**Replace with:**
```javascript
const PAYMENT_SERVER_URL = 'https://your-production-url.com';
```

---

## Step 4: Remove config.local.js (No Longer Needed!)

Since the backend proxy handles the API key, you can remove `config.local.js`:

1. **Remove from popup.html:**
   - Find: `<script src="config.local.js" ...>`
   - Delete that line

2. **Remove from .gitignore** (optional, but clean):
   - Remove `config.local.js` line from `.gitignore`

3. **Delete the file:**
   ```bash
   rm config.local.js
   ```

4. **Update popup.js** (remove references to `window.LOCAL_GEMINI_API_KEY`):
   - The extension will now only use the backend proxy
   - Users can still enter their own key as fallback

---

## Step 5: Update Stripe Webhook URL

1. **Go to:** https://dashboard.stripe.com/test/webhooks
2. **Edit your webhook endpoint**
3. **Update URL to:** `https://your-production-url.com/api/webhook`
4. **Save** - Stripe will give you a new webhook secret
5. **Update environment variable** on your hosting platform:
   - `STRIPE_WEBHOOK_SECRET` = new secret from Stripe

---

## Step 6: Test Production Deployment

### Test Backend Endpoints

```bash
# Test health check
curl https://your-production-url.com/health

# Test enhance endpoint
curl -X POST https://your-production-url.com/api/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test prompt",
    "enhancementType": "text",
    "systemInstruction": "Enhance this prompt"
  }'

# Test ask endpoint
curl -X POST https://your-production-url.com/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is AI?",
    "systemInstruction": "Answer the question"
  }'
```

### Test Extension

1. **Load extension** in Chrome (unpacked)
2. **Try enhancing a prompt** - should work via backend
3. **Check browser console** - should see requests to your production URL
4. **Check server logs** - should see API requests

---

## Step 7: Build and Publish Extension

### Build for Production

```bash
npm run build
```

This creates a `dist/` folder with:
- Minified and obfuscated JavaScript
- All necessary files
- **No API keys exposed!** ✅

### Test the Build

1. Load `dist/` folder as unpacked extension
2. Test all features
3. Verify backend proxy works

### Publish to Chrome Web Store

1. **Zip the `dist/` folder contents** (not the folder itself)
2. **Go to:** https://chrome.google.com/webstore/devconsole
3. **Upload** the zip file
4. **Fill out store listing**
5. **Submit for review**

---

## Step 8: Monitor Production

### Check Server Logs

- Railway: Dashboard → Logs
- Render: Dashboard → Logs
- Heroku: `heroku logs --tail`

### Monitor API Usage

1. **Google Cloud Console:** https://console.cloud.google.com/apis/dashboard
2. **Select:** Generative Language API
3. **View metrics** for usage tracking

### Set Up Alerts

1. **Google Cloud:** Set billing alerts
2. **Hosting Platform:** Set up uptime monitoring
3. **Stripe:** Set up webhook failure alerts

---

## Environment Variables Summary

Make sure these are set on your hosting platform:

```env
# Stripe - use your keys from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Gemini API - keep secret! From Google AI Studio
GEMINI_API_KEY=AIzaSy_YOUR_GEMINI_KEY

# Server
PORT=3000
```

---

## Troubleshooting

### CORS Errors

If you see CORS errors, update `server/stripe-server.js`:

```javascript
app.use(cors({
  origin: [
    'chrome-extension://akopohbjblhdhbbndbledmajoipklcgc',
    'https://your-production-url.com'
  ],
  credentials: true
}));
```

### Extension Can't Connect

1. **Check backend URL** in `background.js`
2. **Verify server is running:** `curl https://your-url.com/health`
3. **Check browser console** for errors
4. **Verify CORS** allows extension origin

### API Key Errors

1. **Verify `GEMINI_API_KEY`** is set on hosting platform
2. **Check server logs** for API errors
3. **Test API key directly** with Gemini API

---

## Quick Reference

### Files to Update for Production

1. ✅ `background.js` - Update `BACKEND_API_URL`
2. ✅ `utils/subscription-manager.js` - Update `PAYMENT_SERVER_URL`
3. ✅ Remove `config.local.js` from extension
4. ✅ Update `popup.html` - Remove config.local.js script tag

### Production Checklist

- [ ] Backend server deployed and running
- [ ] Environment variables set on hosting platform
- [ ] Backend URL updated in extension
- [ ] Stripe webhook URL updated
- [ ] Extension tested with production backend
- [ ] Extension built (`npm run build`)
- [ ] Extension tested from `dist/` folder
- [ ] Extension published to Chrome Web Store

---

## Need Help?

- **Railway Docs:** https://docs.railway.app
- **Render Docs:** https://render.com/docs
- **Heroku Docs:** https://devcenter.heroku.com
- **Chrome Web Store:** https://developer.chrome.com/docs/webstore
