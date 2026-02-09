# Chrome Web Store — Detailed Description

Use this text in the **Detailed description** field when editing your store listing.

---

Transform Your AI Prompts Into Powerful Instructions — Instantly

Prompt Helper Gemini improves your prompts for ChatGPT, Google Gemini, Claude, Grok, and Perplexity. Sign in with Google, then enhance prompts from the extension or directly inside your AI chat. No API key required.

⸻

WHY PROMPT HELPER GEMINI?

Stop rewriting prompts. Turn rough ideas into clear, detailed instructions so you get better AI responses. Use it for text, code, image, or video prompts—one click from the popup or from inside the chat.

⸻

KEY FEATURES

SIGN IN & GO
• Sign in with Google to get started
• No API key or setup—enhancement is powered for you
• Your subscription (if you upgrade) works across devices

BUILD TAB
• Paste your idea and click "Improve prompt"
• Choose mode: Text, Code, Image, or Video
• Pick a style (default, concise, detailed, etc.) and copy the refined prompt

IN-CHAT IMPROVE BUTTON
• When you're signed in, an "Improve" button appears next to the send button
• Works on ChatGPT, Gemini, Claude, Grok, and Perplexity
• Improve your message before sending—no copy-paste

ASK TAB
• Ask questions directly in the extension
• Optional "Apply auto-improve before sending" for better answers
• Great for quick research

HISTORY
• View and reuse your recent enhanced prompts
• Copy again or refine further

KEYBOARD SHORTCUT
• Ctrl+Shift+E (Windows) or Cmd+Shift+E (Mac) to improve the current prompt in supported chats

PRO (UPGRADE)
• Free: 10 prompt enhancements and 5 Ask questions per week, plus limited history
• Pro: Unlimited enhancements, unlimited Ask, full history—subscribe in the Pro tab

⸻

HOW IT WORKS

1. Install the extension and click the icon.
2. Sign in with Google (no API key needed).
3. Use the Build tab to improve prompts, or open ChatGPT, Gemini, Claude, Grok, or Perplexity and use the Improve button next to the send field.
4. Optionally upgrade to Pro in the extension for unlimited use.

⸻

PERFECT FOR

• Content creators improving prompts
• Developers generating better code
• Designers crafting detailed image prompts
• Video creators writing cinematic descriptions
• Anyone who wants better AI results

⸻

SUPPORTED PLATFORMS

• ChatGPT (chat.openai.com, chatgpt.com)
• Google Gemini (gemini.google.com)
• Claude (claude.ai)
• Grok (x.com)
• Perplexity (perplexity.ai)

⸻

PRIVACY & DATA

• Sign in with Google; your subscription is tied to your account.
• Enhancement is processed via our secure backend to provide the service.
• Settings and preferences are stored locally in your browser where applicable.

⸻

GET STARTED

Install Prompt Helper Gemini, sign in with Google, and start improving your prompts in seconds. Free tier included; upgrade to Pro anytime for unlimited use.

Transform your prompts. Transform your results.

⸻

---

## Permission justifications (for Chrome Web Store)

Use the text below when the store asks why your extension needs each permission. Each must be under 950 characters.

### **tabs** (under 950 characters)

Used for: (1) Keyboard shortcut (Ctrl/Cmd+Shift+E)—we query the active tab and send a message to the content script so the shortcut enhances the prompt in the current chat (e.g. ChatGPT, Gemini). (2) Opening Stripe Checkout and the Stripe customer portal in a new tab when users upgrade to Pro or manage their subscription. (3) Closing the Google OAuth error tab after sign-in so users don't see a leftover 400 page. We do not read page content except on supported AI chat sites where our content script provides the in-chat Improve button.

### **identity** (under 950 characters)

Used only for Sign in with Google: we use getAuthToken (interactive and non-interactive) to sign the user in and restore their session with Firebase Auth, so subscription and usage are tied to their account and the in-chat Improve button works. We use removeCachedAuthToken to clear invalid tokens. We do not access any identity data beyond what is needed for authentication.

⸻
