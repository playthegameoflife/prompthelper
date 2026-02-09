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
