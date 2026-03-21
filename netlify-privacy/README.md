# Privacy policy site (Netlify)

Deploy this folder to Netlify to host the Prompt Helper Gemini privacy policy.

## Deploy steps

1. **Set the date**  
   In `index.html`, replace `[DATE]` with the real last-updated date (e.g. `February 19, 2026`).

2. **Deploy to Netlify**
   - Go to [app.netlify.com](https://app.netlify.com) and sign in.
   - **Option A – Drag & drop:** Drag the `netlify-privacy` folder onto the Netlify “Deploy” area. Netlify will give you a URL like `https://random-name-123.netlify.app`.
   - **Option B – From Git:** Push this folder (or a repo that contains it) to GitHub, then in Netlify: Add new site → Import from Git → choose the repo. Set **Publish directory** to `netlify-privacy` (or the folder that contains `index.html`).

3. **Optional – Custom subdomain**  
   In Netlify: Site settings → Domain management → Add custom domain, or use the default `*.netlify.app` name.

4. **Chrome Web Store**  
   Use your live URL (e.g. `https://your-site.netlify.app`) in the extension’s Privacy policy field.
