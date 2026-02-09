/**
 * Usage Tracker
 * Tracks free tier usage and enforces limits
 */

// Storage keys
const STORAGE_DAILY_USAGE = 'dailyUsage';
const STORAGE_WEEKLY_USAGE = 'weeklyUsage';
const STORAGE_FREE_HISTORY = 'freeHistory';

// Free tier limits
const FREE_TIER_LIMITS = {
  enhancements_per_week: 10,
  ask_questions_per_week: 5,
  history_items: 1
};

/**
 * Get current daily usage
 */
async function getDailyUsage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_DAILY_USAGE], (result) => {
      const usage = result[STORAGE_DAILY_USAGE] || {
        date: new Date().toDateString(),
        enhancements: 0,
        questions: 0
      };

      // Reset if it's a new day
      const today = new Date().toDateString();
      if (usage.date !== today) {
        usage = {
          date: today,
          enhancements: 0,
          questions: 0
        };
      }

      resolve(usage);
    });
  });
}

/**
 * Get current weekly usage
 */
async function getWeeklyUsage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_WEEKLY_USAGE], (result) => {
      const usage = result[STORAGE_WEEKLY_USAGE] || {
        weekStart: getWeekStart(),
        enhancements: 0,
        questions: 0
      };

      // Reset if it's a new week
      const currentWeekStart = getWeekStart();
      if (usage.weekStart !== currentWeekStart) {
        usage = {
          weekStart: currentWeekStart,
          enhancements: 0,
          questions: 0
        };
      }

      resolve(usage);
    });
  });
}

/**
 * Get the start of the current week (Monday)
 */
function getWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toDateString();
}

/**
 * Track usage for a feature
 */
async function trackUsage(feature) {
  const isWeekly = feature === 'enhancements' || feature === 'questions';

  if (isWeekly) {
    const usage = await getWeeklyUsage();
    usage[feature]++;
    await new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_WEEKLY_USAGE]: usage }, resolve);
    });
    return usage;
  } else {
    const usage = await getDailyUsage();
    usage[feature]++;
    await new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_DAILY_USAGE]: usage }, resolve);
    });
    return usage;
  }
}

/**
 * Check if user can use a feature (within free limits)
 */
async function canUseFeature(feature) {
  // Check if user has premium subscription first
  const hasPremium = await hasActiveSubscription();
  if (hasPremium) {
    return { allowed: true, isPremium: true };
  }

  const isWeekly = feature === 'enhancements' || feature === 'questions';
  const usage = isWeekly ? await getWeeklyUsage() : await getDailyUsage();
  const limit = FREE_TIER_LIMITS[feature];

  const withinLimit = usage[feature] < limit;
  const remaining = Math.max(0, limit - usage[feature]);

  return {
    allowed: withinLimit,
    isPremium: false,
    current: usage[feature],
    limit: limit,
    remaining: remaining
  };
}

/**
 * Get usage summary for UI display
 */
async function getUsageSummary() {
  const hasPremium = await hasActiveSubscription();

  if (hasPremium) {
    return {
      isPremium: true,
      enhancements: { current: 0, limit: 'unlimited', remaining: 'unlimited' },
      questions: { current: 0, limit: 'unlimited', remaining: 'unlimited' },
      history: { current: 0, limit: 'unlimited', remaining: 'unlimited' }
    };
  }

  const weeklyUsage = await getWeeklyUsage();
  const dailyUsage = await getDailyUsage();

  return {
    isPremium: false,
    enhancements: {
      current: weeklyUsage.enhancements,
      limit: FREE_TIER_LIMITS.enhancements_per_week,
      remaining: Math.max(0, FREE_TIER_LIMITS.enhancements_per_week - weeklyUsage.enhancements)
    },
    questions: {
      current: weeklyUsage.questions,
      limit: FREE_TIER_LIMITS.ask_questions_per_week,
      remaining: Math.max(0, FREE_TIER_LIMITS.ask_questions_per_week - weeklyUsage.questions)
    },
    history: {
      current: 0, // We'll calculate this from actual history
      limit: FREE_TIER_LIMITS.history_items,
      remaining: FREE_TIER_LIMITS.history_items
    }
  };
}

/**
 * Manage free tier history (limit to 1 item)
 */
async function manageFreeHistory(newItem) {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_FREE_HISTORY], (result) => {
      let history = result[STORAGE_FREE_HISTORY] || [];

      // Add new item at the beginning
      history.unshift(newItem);

      // Keep only the most recent item for free users
      const hasPremium = await hasActiveSubscription();
      if (!hasPremium) {
        history = history.slice(0, FREE_TIER_LIMITS.history_items);
      } else {
        // Premium users can keep more (we'll limit this elsewhere if needed)
        history = history.slice(0, 50); // Keep last 50 for premium
      }

      chrome.storage.local.set({ [STORAGE_FREE_HISTORY]: history }, () => {
        resolve(history);
      });
    });
  });
}

/**
 * Get history items (respecting free tier limits)
 * Merges freeHistory (enhancements from Build/Enhance tab and in-chat) with promptHistory (Ask answers, legacy).
 */
async function getLimitedHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_FREE_HISTORY, 'promptHistory'], async (result) => {
      const hasPremium = await hasActiveSubscription();
      const freeHistory = result[STORAGE_FREE_HISTORY] || [];
      const promptHistory = result.promptHistory || [];
      const merged = [...freeHistory, ...promptHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const limit = hasPremium ? 50 : FREE_TIER_LIMITS.history_items;
      resolve(merged.slice(0, limit));
    });
  });
}

// Import subscription checker (this will be available when loaded)
let hasActiveSubscription = () => Promise.resolve(false);

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    trackUsage,
    canUseFeature,
    getUsageSummary,
    manageFreeHistory,
    getLimitedHistory,
    setSubscriptionChecker: (fn) => { hasActiveSubscription = fn; }
  };
}