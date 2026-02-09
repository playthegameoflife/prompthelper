# Production Deployment - Quick Start

## 🎯 3 Main Steps

### 1. Deploy Backend Server (5 minutes)

**Easiest option: Railway**

1. Go to https://railway.app and sign up
2. Click "New Project" → "Deploy from GitHub" (or upload `server/` folder)
3. Add these environment variables:
   ```
   STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY
   STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY
   GEMINI_API_KEY=AIzaSy_YOUR_GEMINI_KEY
   PORT=3000
   ```
4. Deploy - Railway gives you a URL like `https://your-app.railway.app`

**Test it:**
```bash
curl https://your-app.railway.app/health
```

---

### 2. Update Extension Code (2 minutes)

**File: `background.js`** (line ~29)

**Change:**
```javascript
const BACKEND_API_URL = 'http://localhost:3000';
```

**To:**
```javascript
const BACKEND_API_URL = 'https://your-app.railway.app';
```

**File: `utils/subscription-manager.js`** (line ~8)

**Change:**
```javascript
const PAYMENT_SERVER_URL = 'http://localhost:3000';
```

**To:**
```javascript
const PAYMENT_SERVER_URL = 'https://your-app.railway.app';
```

---

### 3. Remove config.local.js (Optional but Recommended)

Since backend proxy handles the API key, you can remove it:

**File: `popup.html`** (line ~1747)

**Remove this line:**
```html
<script src="config.local.js" onerror="console.log('No local config file found - using user-entered API key')"></script>
```

**File: `popup.js`** (lines ~2052-2082)

**Remove or comment out** the block that sets default API key from `config.local.js`:
```javascript
// Set default API key for all users (from config.local.js)
// Everyone uses the provided API key by default - no setup required!
const defaultKey = (typeof window !== 'undefined' && window.LOCAL_GEMINI_API_KEY) 
  ? window.LOCAL_GEMINI_API_KEY 
  : null;
  
if (defaultKey) {
  // ... rest of the block
}
```

**Delete the file:**
```bash
rm config.local.js
```

---

## ✅ That's It!

1. **Test locally:**
   ```bash
   npm run build
   ```
   Load `dist/` folder as unpacked extension and test

2. **Publish:**
   - Zip the `dist/` folder contents
   - Upload to Chrome Web Store

---

## Need More Details?

See `PRODUCTION_DEPLOYMENT.md` for:
- Detailed deployment steps for all platforms
- Troubleshooting
- Testing procedures
- Monitoring setup
