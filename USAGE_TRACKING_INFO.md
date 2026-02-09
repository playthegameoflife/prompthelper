# Usage Tracking - Free Tier

## ✅ Yes, Usage IS Being Tracked!

Your extension tracks free tier usage:

### Free Tier Limits:
- **10 prompt enhancements per week**
- **5 AI questions per week**
- **1 history item** (only latest enhancement/question saved)

### How It Works:

1. **Before Enhancement:**
   - Checks if you have an active subscription
   - If free tier: Checks if you've used less than 10 enhancements this week
   - If limit reached: Shows message and blocks enhancement

2. **After Successful Enhancement:**
   - Increments your weekly usage counter
   - Saves to Chrome storage (`weeklyUsage`)
   - Resets every Monday (start of new week)

3. **Premium Users:**
   - Unlimited enhancements
   - Unlimited questions
   - Unlimited history

### Where Usage is Stored:

- **Chrome Storage Local:**
  - `weeklyUsage` - { weekStart: "Mon Jan 27 2025", enhancements: 3, questions: 1 }
  - `dailyUsage` - { date: "Wed Jan 29 2025", enhancements: 0, questions: 0 }
  - `freeHistory` - Array of recent enhancements/questions (max 1 item)

### Check Your Usage:

Open browser console (F12) and run:
```javascript
chrome.storage.local.get(['weeklyUsage', 'dailyUsage'], (result) => {
  console.log('Weekly Usage:', result.weeklyUsage);
  console.log('Daily Usage:', result.dailyUsage);
});
```

### Code Location:

- **Usage Tracker:** `background.js` lines 9-230
- **Limit Check:** `background.js` line 1318 (`canUseFeature`)
- **Usage Tracking:** `background.js` line 1412 (`trackUsage`)
- **Free Tier Limits:** `background.js` line 16 (`FREE_TIER_LIMITS`)
