# Fix Firebase Functions Deploy Error

## Error You're Seeing

```
Compute Engine API has not been used in project 1097186279139 before or it is disabled.
Precondition failed. Cannot update a GCFv2 function without storage
```

## Fix

### Step 1: Enable Compute Engine API

1. Open this link (use your project):
   **https://console.developers.google.com/apis/api/compute.googleapis.com/overview?project=1097186279139**

2. Click **"Enable"** (or "ENABLE" button).

3. Wait 1–2 minutes for it to propagate.

### Step 2: Retry Deploy

```bash
cd functions
firebase deploy --only functions
```

### If It Still Fails

- Wait 5 minutes after enabling the API and try again.
- In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Enabled APIs**, confirm **Compute Engine API** is enabled for project `prompt-enhancer-ai`.

---

## Sign-in: `Cannot POST /verify-google-token` (404)

**Symptom:** Extension shows  
`Verification failed (404): … Cannot POST /verify-google-token`

**Cause:** The Cloud Run URL is running an **older** Functions build that never included `POST /verify-google-token`. Other routes (e.g. `/health`, `/create-checkout-session`) may still work.

**Fix:** Deploy the current `functions/` code:

```bash
cd "/path/to/prompt architect/functions"
firebase deploy --only functions
```

**Verify after deploy:**

```bash
curl -sS -X POST "https://api-clyep56cdq-uc.a.run.app/verify-google-token" \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"invalid"}'
```

You should get **401** JSON (`Invalid token`), **not** HTML `Cannot POST /verify-google-token`.
