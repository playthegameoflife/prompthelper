# Backend Proxy Setup Guide

## ✅ Implementation Complete

Your extension now uses a **backend proxy** to keep your Gemini API key secure. The API key is stored on your server and never exposed to users.

## How It Works

1. **Extension** → Sends prompt/question to your backend server
2. **Backend Server** → Calls Gemini API with your secure API key
3. **Backend Server** → Returns result to extension
4. **Extension** → Displays result to user

**Result:** Users never see your API key! 🔒

## Configuration

### Backend Server (`server/stripe-server.js`)

✅ **Added endpoints:**
- `POST /api/enhance` - For prompt enhancement
- `POST /api/ask` - For question answering

✅ **API Key:** Stored in `server/.env` as `GEMINI_API_KEY`

### Extension (`background.js`)

✅ **Backend URL:** `http://localhost:3000` (update for production)
✅ **Fallback:** If backend fails, extension can use user's own API key (if they set one)

## Setup Instructions

### 1. Add API Key to Server

Your API key has been added to `server/.env`:
```env
GEMINI_API_KEY=AIzaSy_YOUR_GEMINI_KEY
```

### 2. Start the Server

```bash
cd server
npm start
```

The server should start on `http://localhost:3000`

### 3. Test the Backend

Check if the server is running:
```bash
curl http://localhost:3000/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "...",
  "geminiConfigured": true
}
```

### 4. Test the Extension

1. Load the extension in Chrome
2. Try enhancing a prompt
3. Check the server logs - you should see API requests

## Production Deployment

### Update Backend URL

In `background.js`, change:
```javascript
const BACKEND_API_URL = 'http://localhost:3000';
```

To your production server:
```javascript
const BACKEND_API_URL = 'https://your-domain.com';
```

### Deploy Server

Deploy `server/stripe-server.js` to:
- **Heroku** (free tier available)
- **Railway** (free tier available)
- **Render** (free tier available)
- **DigitalOcean** (paid)
- **AWS/GCP/Azure** (paid)

### Environment Variables

Set these in your hosting platform:
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GEMINI_API_KEY` ⭐ **Keep this secret!**
- `PORT` (usually auto-set by hosting)

## Security Benefits

✅ **API Key Hidden:** Users can't extract your key from the extension
✅ **Rate Limiting:** You can add rate limiting per user on the backend
✅ **Usage Monitoring:** Track all API calls on your server
✅ **Cost Control:** Set quotas and limits server-side
✅ **User Authentication:** Can require Stripe subscription before API access

## Fallback Behavior

If the backend is unavailable:
- Extension will try to use user's own API key (if they set one)
- Shows error message if no backend and no user key

## Testing

1. **Start server:** `cd server && npm start`
2. **Test enhancement:**
   ```bash
   curl -X POST http://localhost:3000/api/enhance \
     -H "Content-Type: application/json" \
     -d '{"prompt":"test prompt","enhancementType":"text","systemInstruction":"Enhance this prompt"}'
   ```

3. **Test ask:**
   ```bash
   curl -X POST http://localhost:3000/api/ask \
     -H "Content-Type: application/json" \
     -d '{"question":"What is AI?","systemInstruction":"Answer the question"}'
   ```

## Troubleshooting

### Server not running
- Check: `cd server && npm start`
- Verify port 3000 is available
- Check `.env` file exists with `GEMINI_API_KEY`

### Extension can't connect
- Verify `BACKEND_API_URL` in `background.js` matches server URL
- Check CORS settings (should allow extension origin)
- Check browser console for errors

### API key errors
- Verify `GEMINI_API_KEY` in `server/.env`
- Check server logs for API errors
- Test API key directly with Gemini API

## Next Steps

1. ✅ Backend proxy implemented
2. ✅ API key secured on server
3. ⏭️ Deploy server to production
4. ⏭️ Update `BACKEND_API_URL` in extension
5. ⏭️ Test end-to-end
6. ⏭️ Remove `config.local.js` from extension (no longer needed!)

## Notes

- The extension still supports users entering their own API key as a fallback
- Backend proxy is enabled by default (`USE_BACKEND_PROXY = true`)
- Set `USE_BACKEND_PROXY = false` in `background.js` to disable and require user keys
