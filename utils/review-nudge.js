/**
 * review-nudge.js
 * Shared review nudge logic — increments enhancement count and fires a one-time
 * nudge after REVIEW_THRESHOLD successful enhancements.
 *
 * Architecture:
 * - popup.js calls chrome.runtime.sendMessage({ action: 'enhancementSuccess' })
 * - content.js listens for that message and calls showReviewNudge()
 * - Both paths converge on the same showReviewNudge() in content.js
 * - Count and nudge state stored in chrome.storage.local
 */

export const REVIEW_THRESHOLD = 4;
export const REVIEW_NUDGE_KEY = 'reviewNudged';
const COUNT_KEY = 'paEnhancementCount';
