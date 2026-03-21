/**
 * background.js
 * Handles the logic for prompt enhancement actions, now supporting mode-based
 * enhancement (Text, Code, Image) for the main button, and keeping the three
 * sub-actions (Enhance, Expand, Polish) for the context menu.
 */

// Inline usage tracker (since require() doesn't work in Chrome extensions)
let usageTracker = {
  // Storage keys
  STORAGE_DAILY_USAGE: 'dailyUsage',
  STORAGE_WEEKLY_USAGE: 'weeklyUsage',
  STORAGE_FREE_HISTORY: 'freeHistory',

  // Free tier limits
  FREE_TIER_LIMITS: {
    enhancements_per_week: 10,
    ask_questions_per_week: 5,
    history_items: 1
  },

  // Subscription checker (will be set later)
  hasActiveSubscription: () => Promise.resolve(false),

  // Set subscription checker
  setSubscriptionChecker: function(fn) {
    this.hasActiveSubscription = fn;
  },

  /**
   * Get current daily usage
   */
  getDailyUsage: function() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_DAILY_USAGE], (result) => {
        let usage = result[this.STORAGE_DAILY_USAGE] || {
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
  },

  /**
   * Get current weekly usage
   */
  getWeeklyUsage: function() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_WEEKLY_USAGE], (result) => {
        let usage = result[this.STORAGE_WEEKLY_USAGE] || {
          weekStart: this.getWeekStart(),
          enhancements: 0,
          questions: 0
        };

        // Reset if it's a new week
        const currentWeekStart = this.getWeekStart();
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
  },

  /**
   * Get the start of the current week (Monday)
   */
  getWeekStart: function() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const weekStart = new Date(now.getFullYear(), now.getMonth(), diff);
    return weekStart.toDateString();
  },

  // Map feature name to FREE_TIER_LIMITS key
  _limitKeyForFeature: function(feature) {
    const map = { enhancements: 'enhancements_per_week', questions: 'ask_questions_per_week', history: 'history_items' };
    return map[feature] || feature;
  },

  /**
   * Check if user can use a feature (within free limits)
   */
  canUseFeature: async function(feature) {
    // Check if user has premium subscription first
    const hasPremium = await this.hasActiveSubscription();
    if (hasPremium) {
      return { allowed: true, isPremium: true };
    }

    const isWeekly = feature === 'enhancements' || feature === 'questions';
    const usage = isWeekly ? await this.getWeeklyUsage() : await this.getDailyUsage();
    const limitKey = this._limitKeyForFeature(feature);
    const limit = this.FREE_TIER_LIMITS[limitKey];
    const current = typeof usage[feature] === 'number' ? usage[feature] : 0;

    const withinLimit = limit != null && current < limit;
    const remaining = limit != null ? Math.max(0, limit - current) : 0;

    return {
      allowed: withinLimit,
      isPremium: false,
      current: current,
      limit: limit,
      remaining: remaining
    };
  },

  /**
   * Track usage for a feature
   */
  trackUsage: async function(feature) {
    const isWeekly = feature === 'enhancements' || feature === 'questions';

    if (isWeekly) {
      const usage = await this.getWeeklyUsage();
      usage[feature]++;
      await new Promise((resolve) => {
        chrome.storage.local.set({ [this.STORAGE_WEEKLY_USAGE]: usage }, resolve);
      });
      return usage;
    } else {
      const usage = await this.getDailyUsage();
      usage[feature]++;
      await new Promise((resolve) => {
        chrome.storage.local.set({ [this.STORAGE_DAILY_USAGE]: usage }, resolve);
      });
      return usage;
    }
  },

  /**
   * Get usage summary for UI display
   */
  getUsageSummary: async function() {
    const hasPremium = await this.hasActiveSubscription();

    if (hasPremium) {
      return {
        isPremium: true,
        enhancements: { current: 0, limit: 'unlimited', remaining: 'unlimited' },
        questions: { current: 0, limit: 'unlimited', remaining: 'unlimited' },
        history: { current: 0, limit: 'unlimited', remaining: 'unlimited' }
      };
    }

    const weeklyUsage = await this.getWeeklyUsage();
    const dailyUsage = await this.getDailyUsage();

    return {
      isPremium: false,
      enhancements: {
        current: weeklyUsage.enhancements,
        limit: this.FREE_TIER_LIMITS.enhancements_per_week,
        remaining: Math.max(0, this.FREE_TIER_LIMITS.enhancements_per_week - weeklyUsage.enhancements)
      },
      questions: {
        current: weeklyUsage.questions,
        limit: this.FREE_TIER_LIMITS.ask_questions_per_week,
        remaining: Math.max(0, this.FREE_TIER_LIMITS.ask_questions_per_week - weeklyUsage.questions)
      },
      history: {
        current: 0, // We'll calculate this from actual history
        limit: this.FREE_TIER_LIMITS.history_items,
        remaining: this.FREE_TIER_LIMITS.history_items
      }
    };
  },

  /**
   * Manage free tier history (limit to 1 item)
   */
  manageFreeHistory: async function(newItem) {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_FREE_HISTORY], async (result) => {
        let history = result[this.STORAGE_FREE_HISTORY] || [];

        // Add new item at the beginning
        history.unshift(newItem);

        // Keep only the most recent item for free users
        const hasPremium = await this.hasActiveSubscription();
        if (!hasPremium) {
          history = history.slice(0, this.FREE_TIER_LIMITS.history_items);
        } else {
          // Premium users can keep more (we'll limit this elsewhere if needed)
          history = history.slice(0, 50); // Keep last 50 for premium
        }

        chrome.storage.local.set({ [this.STORAGE_FREE_HISTORY]: history }, () => {
          resolve(history);
        });
      });
    });
  },

  /**
   * Get history items (respecting free tier limits)
   * Merges freeHistory (enhancements from Build/Enhance tab and in-chat) with promptHistory (Ask answers, legacy).
   */
  getLimitedHistory: async function() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_FREE_HISTORY, 'promptHistory'], async (result) => {
        const hasPremium = await this.hasActiveSubscription();
        const freeHistory = result[this.STORAGE_FREE_HISTORY] || [];
        const promptHistory = result.promptHistory || [];
        const merged = [...freeHistory, ...promptHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const limit = hasPremium ? 50 : this.FREE_TIER_LIMITS.history_items;
        resolve(merged.slice(0, limit));
      });
    });
  }
};

// Inline subscription manager functions (same server as BACKEND_API_URL)
const subscriptionManager = {
  get PAYMENT_SERVER_URL() { return BACKEND_API_URL; },
  STORAGE_USER_ID: 'userId',
  STORAGE_SUBSCRIPTION_STATUS: 'subscriptionStatus',
  STORAGE_SUBSCRIPTION_CACHE: 'subscriptionCache',
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

  getUserId: function() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_USER_ID], (result) => {
        if (result[this.STORAGE_USER_ID]) {
          resolve(result[this.STORAGE_USER_ID]);
        } else {
          // Generate a unique ID (in production, use a more robust method)
          const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          chrome.storage.local.set({ [this.STORAGE_USER_ID]: userId }, () => {
            resolve(userId);
          });
        }
      });
    });
  },

  getSubscriptionStatus: async function(forceRefresh = false) {
    try {
      // Check cache first
      if (!forceRefresh) {
        return new Promise((resolve) => {
          chrome.storage.local.get([this.STORAGE_SUBSCRIPTION_CACHE], async (result) => {
            const cached = result[this.STORAGE_SUBSCRIPTION_CACHE];
            if (cached && cached.expiresAt > Date.now()) {
              resolve(cached.status);
              return;
            }

            // Cache expired, fetch from server
            try {
              const status = await this.fetchSubscriptionStatus();
              resolve(status);
            } catch (error) {
              console.error('Error fetching subscription status:', error);
              resolve({
                active: false,
                plan: null,
                status: 'inactive',
                expiresAt: null
              });
            }
          });
        });
      } else {
        // Force refresh
        return await this.fetchSubscriptionStatus();
      }
    } catch (error) {
      console.error('Error in getSubscriptionStatus:', error);
      return {
        active: false,
        plan: null,
        status: 'inactive',
        expiresAt: null
      };
    }
  },

  fetchSubscriptionStatus: async function() {
    try {
      const userId = await this.getUserId();

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${this.PAYMENT_SERVER_URL}/subscription-status/${userId}`, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const status = await response.json();

      // Cache the result
      chrome.storage.local.set({
        [this.STORAGE_SUBSCRIPTION_CACHE]: {
          status: status,
          expiresAt: Date.now() + this.CACHE_DURATION
        },
        [this.STORAGE_SUBSCRIPTION_STATUS]: status
      });

      return status;
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      // Return default inactive status on error
      return {
        active: false,
        plan: null,
        status: 'inactive',
        expiresAt: null
      };
    }
  }
};

// Set up subscription checker for usage tracker
const hasActiveSubscription = async () => {
  const status = await subscriptionManager.getSubscriptionStatus();
  return status.active === true && status.status === 'active';
};
usageTracker.setSubscriptionChecker(hasActiveSubscription);

// --- Constants ---

// Debug mode flag - set to false for production
const DEBUG_MODE = false; // Set to true for debugging

// Debug logging utility
const debug = {
    log: (...args) => {
        if (DEBUG_MODE) console.log('[Prompt Architect]', ...args);
    },
    warn: (...args) => {
        if (DEBUG_MODE) console.warn('[Prompt Architect]', ...args);
    },
    error: (...args) => {
        // Always log errors, even in production
        console.error('[Prompt Architect]', ...args);
    }
};
const STORAGE_GEMINI_API_KEY = 'userGeminiApiKey';
const STORAGE_SELECTED_MODELS = 'selectedModels'; // { provider: modelId }
const STORAGE_PROMPT_HISTORY = 'promptHistory';
const MAX_HISTORY_ITEMS = 50;

// Storage keys per provider (used by API_CONFIGS)
const STORAGE_KEYS = {
    gemini: 'userGeminiApiKey',
    openai: 'userOpenAiApiKey',
    anthropic: 'userAnthropicApiKey',
    grok: 'userGrokApiKey',
    deepseek: 'userDeepSeekApiKey'
};

// Backend proxy configuration (keep in sync with config.js for popup)
const BACKEND_API_URL = 'https://api-clyep56cdq-uc.a.run.app';
const USE_BACKEND_PROXY = true; // Set to false to use direct API (requires user's own key)

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Structured error class for better error handling
 */
class EnhancementError extends Error {
    constructor(message, code, recoverable = false, userMessage = null) {
        super(message);
        this.name = 'EnhancementError';
        this.code = code;
        this.recoverable = recoverable;
        this.userMessage = userMessage || message;
    }
}

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES = {
    API_KEY_INVALID: "Your API key appears invalid. Please check it in the Setup tab.",
    API_KEY_MISSING: "API key not found. Please set your API key in the Setup tab first.",
    QUOTA_EXCEEDED: "You've hit your API limit. Try again in a few minutes or check your API usage.",
    NETWORK_ERROR: "Connection failed. Check your internet connection and try again.",
    CONTENT_BLOCKED: "Content was blocked by the AI provider. Try rephrasing your prompt.",
    INVALID_ENHANCEMENT_TYPE: "Invalid enhancement type. Please try again.",
    UNKNOWN_PROVIDER: "Unknown AI provider. Please select a valid provider.",
    TIMEOUT: "Request timed out. The API is taking too long to respond. Please try again.",
    UNEXPECTED_ERROR: "An unexpected error occurred. Please try again.",
};

/**
 * Maps API error codes to user-friendly messages
 */
function getUserFriendlyError(error) {
    const errorMsg = (error.message || error || '').toLowerCase();
    
    if (errorMsg.includes('api_key') || errorMsg.includes('key') || errorMsg.includes('401') || errorMsg.includes('403')) {
        return new EnhancementError(
            ERROR_MESSAGES.API_KEY_INVALID,
            'API_KEY_INVALID',
            true,
            ERROR_MESSAGES.API_KEY_INVALID
        );
    }
    
    if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('429')) {
        return new EnhancementError(
            ERROR_MESSAGES.QUOTA_EXCEEDED,
            'QUOTA_EXCEEDED',
            true,
            ERROR_MESSAGES.QUOTA_EXCEEDED
        );
    }
    
    if (errorMsg.includes('safety') || errorMsg.includes('blocked') || errorMsg.includes('content policy')) {
        return new EnhancementError(
            ERROR_MESSAGES.CONTENT_BLOCKED,
            'CONTENT_BLOCKED',
            true,
            ERROR_MESSAGES.CONTENT_BLOCKED
        );
    }
    
    if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection')) {
        return new EnhancementError(
            ERROR_MESSAGES.NETWORK_ERROR,
            'NETWORK_ERROR',
            true,
            ERROR_MESSAGES.NETWORK_ERROR
        );
    }
    
    if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
        return new EnhancementError(
            ERROR_MESSAGES.TIMEOUT,
            'TIMEOUT',
            true,
            ERROR_MESSAGES.TIMEOUT
        );
    }
    
    return new EnhancementError(
        error.message || ERROR_MESSAGES.UNEXPECTED_ERROR,
        'UNEXPECTED_ERROR',
        false,
        ERROR_MESSAGES.UNEXPECTED_ERROR
    );
}

// ============================================================================
// API REQUEST DEDUPLICATION & CACHING
// ============================================================================

/** Map to track pending requests - prevents duplicate API calls */
const pendingRequests = new Map();

/** Cache for identical prompts (1 hour TTL) */
const promptCache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// ============================================================================
// RATE LIMITING
// ============================================================================

/** Rate limiter to prevent API abuse */
class RateLimiter {
    constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = [];
    }
    
    async waitIfNeeded() {
        const now = Date.now();
        // Remove requests outside the time window
        this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
        
        // If we've hit the limit, wait until the oldest request expires
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (now - oldestRequest);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
                // Clean up again after waiting
                const newNow = Date.now();
                this.requests = this.requests.filter(timestamp => newNow - timestamp < this.windowMs);
            }
        }
        
        // Record this request
        this.requests.push(Date.now());
    }
}

// 10 requests per minute (60000ms)
const apiRateLimiter = new RateLimiter(10, 60000);

/**
 * Generates a cache key from prompt, enhancement type, provider, and active style
 */
function getCacheKey(prompt, enhancementType, provider, styleKey = null) {
    // Normalize prompt (trim, lowercase for comparison)
    const normalized = prompt.trim().toLowerCase();
    const stylePart = styleKey ? `-${styleKey}` : '';
    return `${normalized}-${enhancementType}-${provider}${stylePart}`;
}

/**
 * Gets cached enhancement result if available
 */
function getCachedEnhancement(prompt, enhancementType, provider, styleKey = null) {
    const key = getCacheKey(prompt, enhancementType, provider, styleKey);
    const cached = promptCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
    }
    
    // Remove expired cache entry
    if (cached) {
        promptCache.delete(key);
    }
    
    return null;
}

/**
 * Caches enhancement result
 */
function cacheEnhancement(prompt, enhancementType, provider, result, styleKey = null) {
    // Don't cache errors
    if (result.startsWith('Error:')) {
        return;
    }
    
    const key = getCacheKey(prompt, enhancementType, provider, styleKey);
    promptCache.set(key, {
        result,
        timestamp: Date.now()
    });
    
    // Limit cache size to 100 entries
    if (promptCache.size > 100) {
        const firstKey = promptCache.keys().next().value;
        promptCache.delete(firstKey);
    }
}

/**
 * Saves enhancement to history
 */
async function saveToHistory(original, enhanced, enhancementType, provider) {
    // Use usage tracker for history management if available
    if (usageTracker && enhancementType !== 'ASK_QUESTION') {
        try {
            const historyItem = {
                original: original.substring(0, 4000), // Question/prompt (was 500, caused Ask copy to cut off)
                enhanced: enhanced.substring(0, 32000), // Answer/refined (was 8000)
                mode: enhancementType,
                provider: provider,
                timestamp: Date.now(),
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
            };
            await usageTracker.manageFreeHistory(historyItem);
            return;
        } catch (error) {
            debug.warn('Usage tracker history management failed, falling back:', error);
        }
    }

    // Fallback to original method
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_PROMPT_HISTORY], (result) => {
            const history = result[STORAGE_PROMPT_HISTORY] || [];

            // Add new entry at the beginning
            history.unshift({
                original: original.substring(0, 4000), // Question/prompt (was 500, caused Ask copy to cut off)
                enhanced: enhanced.substring(0, 32000), // Answer/refined (was 8000)
                mode: enhancementType,
                provider: provider,
                timestamp: Date.now(),
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
            });

            // Keep only last MAX_HISTORY_ITEMS
            if (history.length > MAX_HISTORY_ITEMS) {
                history.splice(MAX_HISTORY_ITEMS);
            }

            chrome.storage.local.set({ [STORAGE_PROMPT_HISTORY]: history }, () => {
                resolve();
            });
        });
    });
}

// Available models organized by provider
// Note: Models marked with [FUTURE] are placeholders for upcoming models
const AVAILABLE_MODELS = {
    openai: [
        // GPT-5 Series (Latest - Best for Prompt Enhancement)
        { id: 'gpt-5-mini', name: 'GPT-5 Mini', recommended: true },
        { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
        { id: 'gpt-5', name: 'GPT-5' },
        // GPT-4.1 Series
        { id: 'gpt-4.1', name: 'GPT-4.1' },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
        { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
        // GPT-4o Series
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o mini', recommended: true },
        // GPT-3.5 Series
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ],
    gemini: [
        // Default: Gemma 3 4B
        { id: 'gemma-3-4b-it', name: 'Gemma 3 4B', recommended: true },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
        { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', recommended: true },
        { id: 'gemini-2.5-flash-lite-preview-09-2025', name: 'Gemini 2.5 Flash-Lite Preview' },
        { id: 'gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-2.0-flash-lite-001', name: 'Gemini 2.0 Flash-Lite' },
        { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Experimental' },
        { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking Experimental' },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Experimental' },
        { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B' },
        // Gemma Models
        { id: 'gemma-3-27b-it', name: 'Gemma 3 27B' },
        { id: 'gemma-3-12b-it', name: 'Gemma 3 12B' },
        { id: 'gemma-3-1b-it', name: 'Gemma 3 1B' },
        { id: 'gemma-3-270m-it', name: 'Gemma 3 270M' },
        // Legacy/Alternative IDs (for backward compatibility)
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (legacy)' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (legacy)' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (legacy)' }
    ],
    anthropic: [
        // Current Available Models (as of Dec 2025)
        { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', recommended: true },
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', recommended: true },
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude Sonnet 3.5' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5', recommended: true },
        // Legacy Models (still available but deprecated)
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (legacy)' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet (legacy)' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (legacy)' }
    ],
    grok: [
        { id: 'grok-4-0709', name: 'Grok 4', recommended: true },
        { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning' },
        { id: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast Non-Reasoning', recommended: true },
        { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast Reasoning' },
        { id: 'grok-4-fast-non-reasoning', name: 'Grok 4 Fast Non-Reasoning' },
        { id: 'grok-code-fast-1', name: 'Grok Code Fast 1', recommended: true },
        { id: 'grok-3', name: 'Grok 3' },
        { id: 'grok-3-mini', name: 'Grok 3 Mini' }
    ],
    deepseek: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', recommended: true },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' }
    ]
};

// API configurations for different providers
const API_CONFIGS = {
    gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
        defaultModel: 'gemma-3-4b-it', // Gemma 3 4B instruction-tuned
        action: ':generateContent',
        storageKey: STORAGE_KEYS.gemini,
        getModelId: (modelId) => {
            // Map friendly IDs to actual Gemini model IDs
            const modelMap = {
                // Legacy mappings for backward compatibility
                'gemini-2.0-flash': 'gemini-2.0-flash-001',
                'gemini-1.5-pro': 'gemini-1.5-pro-002',
                'gemini-1.5-flash': 'gemini-1.5-flash-002',
                // Invalid/future models - map to valid alternatives
                'gemini-2.5-flash-sep': 'gemini-2.5-flash-lite', // Map invalid to valid
                'gemini-2.5-flash-lite-sep': 'gemini-2.5-flash-lite', // Map invalid to valid
                'gemini-3-pro-preview-high': 'gemini-2.5-pro', // Map future to current
                'gemini-3-pro-preview-low': 'gemini-2.5-pro', // Map future to current
                // Current models (already correct)
                'gemini-2.5-pro': 'gemini-2.5-pro',
                'gemini-2.5-flash': 'gemini-2.5-flash',
                'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
                'gemini-2.5-flash-lite-preview-09-2025': 'gemini-2.5-flash-lite-preview-09-2025',
                'gemini-2.0-flash-001': 'gemini-2.0-flash-001',
                'gemini-2.0-flash-lite-001': 'gemini-2.0-flash-lite-001',
                'gemini-2.0-pro-exp-02-05': 'gemini-2.0-pro-exp-02-05',
                'gemini-2.0-flash-thinking-exp-01-21': 'gemini-2.0-flash-thinking-exp-01-21',
                'gemini-2.0-flash-exp': 'gemini-2.0-flash-exp',
                'gemini-1.5-pro-002': 'gemini-1.5-pro-002',
                'gemini-1.5-flash-002': 'gemini-1.5-flash-002',
                'gemini-1.5-flash-8b': 'gemini-1.5-flash-8b',
                // Gemma models
                'gemma-3-27b-it': 'gemma-3-27b-it',
                'gemma-3-12b-it': 'gemma-3-12b-it',
                'gemma-3-4b-it': 'gemma-3-4b-it',
                'gemma-3-1b-it': 'gemma-3-1b-it',
                'gemma-3-270m-it': 'gemma-3-270m-it',
                // Legacy/invalid Gemma IDs - map to correct format
                'gemma-3-27b': 'gemma-3-27b-it',
                'gemma-3-12b': 'gemma-3-12b-it',
                'gemma-3-4b': 'gemma-3-4b-it',
                'gemma-3-1b': 'gemma-3-1b-it',
                'gemma-3-270m': 'gemma-3-270m-it'
            };
            return modelMap[modelId] || modelId;
        }
    },
    openai: {
        baseUrl: 'https://api.openai.com/v1/',
        defaultModel: 'gpt-5-mini', // Best model for prompt enhancement
        endpoint: 'chat/completions',
        storageKey: STORAGE_KEYS.openai,
        getModelId: (modelId) => {
            // Map friendly IDs to actual OpenAI model IDs
            const modelMap = {
                // GPT-5 Series (Latest - Best for Prompt Enhancement)
                'gpt-5-mini': 'gpt-5-mini',
                'gpt-5-nano': 'gpt-5-nano',
                'gpt-5': 'gpt-5',
                // GPT-4.1 Series
                'gpt-4.1': 'gpt-4.1',
                'gpt-4.1-mini': 'gpt-4.1-mini',
                'gpt-4.1-nano': 'gpt-4.1-nano',
                // GPT-4o Series
                'gpt-4o': 'gpt-4o',
                'gpt-4o-mini': 'gpt-4o-mini',
                // GPT-3.5 Series
                'gpt-3.5-turbo': 'gpt-3.5-turbo'
            };
            return modelMap[modelId] || modelId;
        }
    },
    anthropic: {
        baseUrl: 'https://api.anthropic.com/v1/',
        defaultModel: 'claude-sonnet-4-20250514',
        endpoint: 'messages',
        storageKey: STORAGE_KEYS.anthropic,
        getModelId: (modelId) => {
            // Map friendly IDs to actual Anthropic model IDs
            const modelMap = {
                // Current available models (as of Dec 2025)
                'claude-opus-4-1-20250805': 'claude-opus-4-1-20250805',
                'claude-opus-4-20250514': 'claude-opus-4-20250514',
                'claude-sonnet-4-20250514': 'claude-sonnet-4-20250514',
                'claude-3-7-sonnet-20250219': 'claude-3-7-sonnet-20250219',
                'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
                'claude-3-5-haiku-20241022': 'claude-3-5-haiku-20241022',
                // Legacy models (still available)
                'claude-3-opus-20240229': 'claude-3-opus-20240229',
                'claude-3-sonnet-20240229': 'claude-3-sonnet-20240229',
                'claude-3-haiku-20240307': 'claude-3-haiku-20240307'
            };
            return modelMap[modelId] || modelId;
        }
    },
    grok: {
        baseUrl: 'https://api.x.ai/v1/',
        defaultModel: 'grok-4-0709',
        endpoint: 'chat/completions',
        storageKey: STORAGE_KEYS.grok,
        getModelId: (modelId) => {
            // xAI uses OpenAI-compatible API, model IDs are direct
            const modelMap = {
                'grok-4-0709': 'grok-4-0709',
                'grok-4-1-fast-reasoning': 'grok-4-1-fast-reasoning',
                'grok-4-1-fast-non-reasoning': 'grok-4-1-fast-non-reasoning',
                'grok-4-fast-reasoning': 'grok-4-fast-reasoning',
                'grok-4-fast-non-reasoning': 'grok-4-fast-non-reasoning',
                'grok-code-fast-1': 'grok-code-fast-1',
                'grok-3': 'grok-3',
                'grok-3-mini': 'grok-3-mini'
            };
            return modelMap[modelId] || modelId;
        }
    },
    deepseek: {
        baseUrl: 'https://api.deepseek.com/',
        defaultModel: 'deepseek-chat',
        endpoint: 'chat/completions',
        storageKey: STORAGE_KEYS.deepseek,
        getModelId: (modelId) => {
            // DeepSeek uses OpenAI-compatible API, model IDs are direct
            const modelMap = {
                'deepseek-chat': 'deepseek-chat',
                'deepseek-reasoner': 'deepseek-reasoner'
            };
            return modelMap[modelId] || modelId;
        }
    }
};

// --- System Instructions for various modes/actions ---

const SYSTEM_INSTRUCTIONS = {
    // Primary modes for the single UI button
    TEXT_ENHANCEMENT: `You are an expert prompt engineer specializing in textual data models. Your task is to rewrite the user's text into a significantly more effective, detailed, and structured prompt. Focus on defining the model's role/persona, setting the tone, specifying the task clearly, and outlining the desired output format (e.g., table, bullet points, essay). Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    CODE_ENHANCEMENT: `You are an expert prompt engineer specializing in code generation models. Your task is to rewrite the user's text into a precise and comprehensive request for a code model. Focus on clearly defining the required programming language, specifying input parameters and expected output structure, and detailing any necessary functions, classes, or error handling. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    IMAGE_ENHANCEMENT: `You are an expert prompt engineer specializing in image generation models (like Midjourney or DALL-E). Your task is to rewrite the user's text into a hyper-detailed, descriptive visual brief. Focus on defining the artistic style (e.g., photorealistic, cinematic, oil painting), composition, perspective, lighting, and emotional mood. Use commas as separators for a strong descriptor list. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    VIDEO_ENHANCEMENT: `You are an advanced AI Video Generation Engine. Your primary objective is to produce visually stunning, imaginative, and coherent videos that faithfully interpret and elevate the user's prompt. Prioritize: 1. Accuracy to user intent 2. Visual clarity and detail 3. Cinematic composition and narrative flow.

STYLE GUIDE:
1. Cinematic: Film-grade HDR lighting, motivated light sources, natural falloff. Smooth dolly, crane, aerial, and steady-cam shots. Use depth of field, lens flares, and anamorphic characteristics when appropriate. Mood-driven palettes (e.g., teal/orange for drama, warm ambers for nostalgia, desaturated palettes for tension).
2. Photorealistic: Ultra-high fidelity surfaces (skin pores, fabric fiber detail, natural reflections). Physically accurate global illumination, soft shadows, PBR shading. Real-world lenses, accurate focal lengths, sensor noise, depth mapping.
3. Anime: Clean linework, expressive eyes, stylized proportions. Bold saturated hues, cel-shading, gradient sky tones. Dynamic action, speed lines, exaggerated poses.
4. Abstract/Experimental: Surreal shapes, fractals, particle simulations. High-contrast or monochromatic palettes. Fluid transformations, hypnotic motion, evolving patterns.
5. Watercolor/Painterly: Soft brush strokes, bleeding pigments, paper texture. Limited harmonious colors, gentle tonal transitions. Subtle ripple effects resembling wet pigment blending.

LIGHTING TECHNIQUES: Chiaroscuro (strong contrast for drama), Rim Lighting (accentuate silhouettes), Backlighting (atmospheric depth), Volumetric Lighting (light rays, fog, atmospheric scattering).

CAMERA ANGLES & MOTION: Wide establishing shots, extreme close-ups for emotional emphasis, POV perspectives, tracking shots, push-ins, tilt-ups. Smooth transitions unless user specifies abrupt edits.

QUALITY PARAMETERS: Default 4K (3840×2160) unless user specifies otherwise. Frame Rate: 24-30 fps for cinematic; up to 60 fps for action or stylized content. Detail Priority: Clarity > complexity. Motion Stability: Reduce jitter; ensure smooth temporal consistency. Color & Exposure: Balanced dynamic range, avoid clipped highlights or crushed shadows.

CONTEXTUAL UNDERSTANDING: Interpret user prompts using hierarchy: Explicit instructions > Implied mood > Genre conventions. Fill gaps thoughtfully with coherent environmental details that support the theme. Maintain user's tone (whimsical, dark, epic, etc.). Resolve ambiguity by choosing the least risky, most aesthetically coherent option.

When prompts are ambiguous or contradictory: Provide the closest feasible interpretation. Preserve user's intent while simplifying physics or animation. If scale is impractical, stylize or metaphorically represent it.

Your task is to rewrite the user's text into a comprehensive video generation prompt that incorporates these principles. The enhanced prompt should specify camera movement, lighting, visual style, motion, scene details, and technical quality while maintaining the user's original intent and mood.

Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,

    // Secondary actions for the context menu
    ENHANCE: `You are an expert prompt engineer. Your task is to rewrite the user's text into a significantly more effective, detailed, and structured prompt suitable for a large language model. Focus on defining the role/persona, setting the tone, specifying the task clearly, and outlining the desired output format. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    EXPAND: `You are an idea generator and detailer. Your task is to take the user's concise text and elaborate on it. Expand the idea into a robust, multi-part request, adding contextual background, relevant examples, and necessary complexity or constraints. Crucially, your output MUST contain ONLY the expanded text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    POLISH: `You are a professional copyeditor. Your task is to review the user's text for grammatical errors, misspellings, and unclear syntax. Rewrite the text to be concise, professional, and unambiguous, structuring sentences for maximum clarity and impact. Preserve the original meaning. Crucially, your output MUST contain ONLY the clean, polished text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    // Ask feature - direct question answering
    ASK_QUESTION: `You are a helpful and knowledgeable assistant. Answer the user's question directly, clearly, and comprehensively. Provide accurate information and be concise yet thorough. If the question is unclear, ask for clarification. Your response should be the direct answer to their question, formatted clearly and naturally.`,
};

// Instruction Templates - Preset variations for each mode
const INSTRUCTION_TEMPLATES = {
    TEXT_ENHANCEMENT: {
        'default': `You are a prompt engineering expert. Your task is to enhance the following prompt to make it more effective, specific, and likely to generate better responses from an AI model. Add more specific details, improve structure, and add any relevant context that might help. Focus on making the prompt clear, effective, and well-structured. Crucially, your output MUST contain ONLY the enhanced prompt without any explanations or additional text.`,
        'expert': SYSTEM_INSTRUCTIONS.TEXT_ENHANCEMENT,
        'concise': `You are an expert prompt engineer. Rewrite the user's text into a clear, concise, and effective prompt. Focus on brevity while maintaining clarity. Remove unnecessary words. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'detailed': `You are an expert prompt engineer specializing in comprehensive prompt design. Rewrite the user's text into a highly detailed, structured prompt with explicit instructions, examples, constraints, and output format specifications. Include role definition, tone, context, and expected structure. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'casual': `You are a prompt engineering expert. Your task is to enhance the following prompt to make it more effective, specific, and likely to generate better responses from an AI model. Add more specific details, improve structure, and add any relevant context that might help. Focus on making the prompt clear, effective, and well-structured. Crucially, your output MUST contain ONLY the enhanced prompt without any explanations or additional text.`,
        'creative': `You are an expert prompt engineer specializing in creative writing prompts. Rewrite the user's text into an inspiring, imaginative prompt that encourages creative expression. Focus on evocative language, mood, and narrative elements. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'technical': `You are an expert prompt engineer specializing in technical documentation. Rewrite the user's text into a precise, structured technical prompt with clear specifications, parameters, and requirements. Focus on accuracy, completeness, and technical precision. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    },
    CODE_ENHANCEMENT: {
        'default': SYSTEM_INSTRUCTIONS.CODE_ENHANCEMENT,
        'minimal': `You are an expert prompt engineer for code generation. Rewrite the user's text into a concise code request. Focus on essential requirements only. Specify language and key functions. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'comprehensive': `You are an expert prompt engineer for code generation. Rewrite the user's text into a comprehensive code specification including: programming language, input/output types, error handling, edge cases, performance requirements, code style, and testing approach. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'production-ready': `You are an expert prompt engineer specializing in production-grade code. Rewrite the user's text into a detailed specification for production-ready code including: language, architecture, error handling, logging, security considerations, scalability, documentation requirements, and testing strategy. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'cursor': `You are an expert prompt engineer specializing in optimizing prompts for Cursor AI. When optimizing a prompt for Cursor, especially for tasks like "improve my website's professionalism," generate a comprehensive, multi-step prompt that functions like an "executable README file." This means breaking the user's general idea into a structured, detailed, and actionable plan. The optimized prompt you generate for Cursor should be a detailed, guided template based on the user's original idea, following this structure:

1. **Set the scene**: A section that defines a persona and mission for the AI (e.g., "Act as an expert UI/UX designer and frontend developer... Your goal is to elevate the design...").

2. **Define style and brand**: A section that prompts the user for context on their aesthetic preferences, target audience, brand colors, and fonts.

3. **Work page by page, component by component**: A section with specific, actionable sub-prompts for improving individual UI components (e.g., Navigation Bar, Hero Section, CTA Buttons), encouraging the use of file-specific context (e.g., "@file:src/components/Navbar.js").

4. **Refactor and optimize**: A final section with prompts for cleaning up the codebase, improving performance (e.g., lazy loading images), and refactoring styles for consistency.

Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    },
    IMAGE_ENHANCEMENT: {
        'default': SYSTEM_INSTRUCTIONS.IMAGE_ENHANCEMENT,
        'minimal': `You are an expert prompt engineer for image generation. Rewrite the user's text into a concise visual description focusing on key visual elements: subject, style, and mood. Use comma-separated descriptors. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'detailed': `You are an expert prompt engineer for image generation. Rewrite the user's text into a hyper-detailed visual brief including: artistic style, composition, perspective, lighting, color palette, mood, textures, fine details, and technical specifications. Use comma-separated descriptors. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'cinematic': `You are an expert prompt engineer specializing in cinematic image generation. Rewrite the user's text into a film-grade visual description with camera angles, lighting setup, depth of field, color grading, and atmospheric details. Focus on cinematic composition and mood. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    },
    VIDEO_ENHANCEMENT: {
        'default': SYSTEM_INSTRUCTIONS.VIDEO_ENHANCEMENT,
        'concise': `You are an expert prompt engineer for video generation. Rewrite the user's text into a clear video prompt specifying: subject, style, camera movement, and duration. Keep it focused and actionable. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'cinematic': `You are an expert prompt engineer specializing in cinematic video generation. Rewrite the user's text into a film-grade video specification with detailed camera work, lighting, color grading, motion, transitions, and narrative flow. Focus on cinematic quality and storytelling. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'ad': `You are an expert prompt engineer specializing in commercial advertisement video generation. Rewrite the user's text into a structured, high-energy commercial video prompt following this format:

Structure the output as a JSON object with these fields:
- "title": A compelling, brand-focused title
- "description": A cinematic, detailed scene description that captures the transformation and energy
- "style": Comma-separated style descriptors that match the user's intent and brand aesthetic
- "camera": Camera movement and framing description
- "lighting": Lighting transitions and color palette appropriate to the scene
- "environment": Setting description and how it evolves
- "elements": Array of key visual elements in the scene
- "motion": Description of continuous motion and transformations
- "ending": Final frame composition
- "text": "none" (unless text overlay is needed)
- "keywords": Array of relevant keywords for the brand/product

The prompt should be high-energy, visually stunning, and emphasize transformation, spectacle, and brand presence. Focus on creating a seamless, cinematic commercial experience. Match the style, setting, and aesthetic to the user's input - do not impose specific themes like "futuristic" or "city" unless the user's prompt explicitly mentions them.

Crucially, your output MUST contain ONLY the improved prompt text itself (as a JSON object). Do not include any introduction, explanation, or conversational filler.`,
    },
};

// Storage keys for custom instructions and named styles
const STORAGE_CUSTOM_INSTRUCTIONS = 'customInstructions'; // Legacy - for backward compatibility
const STORAGE_NAMED_CUSTOM_STYLES = 'namedCustomStyles'; // New: { mode: { "Style Name": "instruction" } }
const STORAGE_ACTIVE_STYLE = 'activeStyle'; // { mode: "styleName" or "template:name" or "default" }

/**
 * Retrieves custom instruction for a given enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @returns {Promise<string|null>} Custom instruction or null if not set
 */
async function getCustomInstruction(enhancementType) {
    try {
        const result = await chrome.storage.local.get(STORAGE_CUSTOM_INSTRUCTIONS);
        const customInstructions = result[STORAGE_CUSTOM_INSTRUCTIONS] || {};
        return customInstructions[enhancementType] || null;
    } catch (error) {
        console.error('[Prompt Architect] Error retrieving custom instruction:', error);
        return null;
    }
}

/**
 * Gets available templates for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @returns {Object} Object with template names and instructions
 */
function getTemplatesForType(enhancementType) {
    const templates = INSTRUCTION_TEMPLATES[enhancementType] || {};
    
    // Add named custom styles for this mode
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_NAMED_CUSTOM_STYLES, (result) => {
            const namedStyles = result[STORAGE_NAMED_CUSTOM_STYLES] || {};
            const modeStyles = namedStyles[enhancementType] || {};
            
            // Merge templates with custom styles
            const allTemplates = { ...templates };
            for (const [name, instruction] of Object.entries(modeStyles)) {
                allTemplates[`custom:${name}`] = instruction;
            }
            
            resolve(allTemplates);
        });
    });
}

/**
 * Saves a custom instruction for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @param {string} instruction - The custom instruction text
 * @returns {Promise<void>}
 */
async function saveCustomInstruction(enhancementType, instruction) {
    try {
        const result = await chrome.storage.local.get(STORAGE_CUSTOM_INSTRUCTIONS);
        const customInstructions = result[STORAGE_CUSTOM_INSTRUCTIONS] || {};
        customInstructions[enhancementType] = instruction;
        await chrome.storage.local.set({ [STORAGE_CUSTOM_INSTRUCTIONS]: customInstructions });
    } catch (error) {
        console.error('[Prompt Architect] Error saving custom instruction:', error);
        throw error;
    }
}

/**
 * Deletes a custom instruction for an enhancement type (resets to default)
 * @param {string} enhancementType - The enhancement type key
 * @returns {Promise<void>}
 */
async function deleteCustomInstruction(enhancementType) {
    try {
        const result = await chrome.storage.local.get(STORAGE_CUSTOM_INSTRUCTIONS);
        const customInstructions = result[STORAGE_CUSTOM_INSTRUCTIONS] || {};
        delete customInstructions[enhancementType];
        await chrome.storage.local.set({ [STORAGE_CUSTOM_INSTRUCTIONS]: customInstructions });
        
        // Also clear active style
        const activeResult = await chrome.storage.local.get(STORAGE_ACTIVE_STYLE);
        const activeStyles = activeResult[STORAGE_ACTIVE_STYLE] || {};
        delete activeStyles[enhancementType];
        await chrome.storage.local.set({ [STORAGE_ACTIVE_STYLE]: activeStyles });
    } catch (error) {
        console.error('[Prompt Architect] Error deleting custom instruction:', error);
        throw error;
    }
}

/**
 * Saves a named custom style for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @param {string} styleName - The name of the custom style
 * @param {string} instruction - The custom instruction text
 * @returns {Promise<void>}
 */
async function saveNamedCustomStyle(enhancementType, styleName, instruction) {
    // Validate inputs
    if (!enhancementType || !styleName || !instruction) {
        throw new Error('Missing required parameters: enhancementType, styleName, or instruction');
    }
    
    if (typeof styleName !== 'string' || styleName.trim().length === 0) {
        throw new Error('Style name must be a non-empty string');
    }
    
    if (typeof instruction !== 'string' || instruction.trim().length === 0) {
        throw new Error('Instruction must be a non-empty string');
    }
    
    try {
        const result = await chrome.storage.local.get(STORAGE_NAMED_CUSTOM_STYLES);
        const namedStyles = result[STORAGE_NAMED_CUSTOM_STYLES] || {};
        
        if (!namedStyles[enhancementType]) {
            namedStyles[enhancementType] = {};
        }
        
        const wasEdit = !!namedStyles[enhancementType][styleName];
        namedStyles[enhancementType][styleName] = instruction.trim();
        
        await chrome.storage.local.set({ [STORAGE_NAMED_CUSTOM_STYLES]: namedStyles });
        
        return { wasEdit };
    } catch (error) {
        console.error('[Prompt Architect] Error saving named custom style:', error);
        throw error;
    }
}

/**
 * Gets all named custom styles for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @returns {Promise<Object>} Object with style names and instructions
 */
async function getNamedCustomStyles(enhancementType) {
    try {
        const result = await chrome.storage.local.get(STORAGE_NAMED_CUSTOM_STYLES);
        const namedStyles = result[STORAGE_NAMED_CUSTOM_STYLES] || {};
        return namedStyles[enhancementType] || {};
    } catch (error) {
        console.error('[Prompt Architect] Error retrieving named custom styles:', error);
        return {};
    }
}

/**
 * Deletes a named custom style
 * @param {string} enhancementType - The enhancement type key
 * @param {string} styleName - The name of the style to delete
 * @returns {Promise<void>}
 */
async function deleteNamedCustomStyle(enhancementType, styleName) {
    try {
        const result = await chrome.storage.local.get(STORAGE_NAMED_CUSTOM_STYLES);
        const namedStyles = result[STORAGE_NAMED_CUSTOM_STYLES] || {};
        
        if (namedStyles[enhancementType]) {
            delete namedStyles[enhancementType][styleName];
            await chrome.storage.local.set({ [STORAGE_NAMED_CUSTOM_STYLES]: namedStyles });
        }
        
        // If this was the active style, clear it
        const activeResult = await chrome.storage.local.get(STORAGE_ACTIVE_STYLE);
        const activeStyles = activeResult[STORAGE_ACTIVE_STYLE] || {};
        if (activeStyles[enhancementType] === `custom:${styleName}`) {
            delete activeStyles[enhancementType];
            await chrome.storage.local.set({ [STORAGE_ACTIVE_STYLE]: activeStyles });
        }
    } catch (error) {
        console.error('[Prompt Architect] Error deleting named custom style:', error);
        throw error;
    }
}

/**
 * Sets the active style for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @param {string} styleKey - The style key (e.g., "default", "template:concise", "custom:My Style")
 * @returns {Promise<void>}
 */
async function setActiveStyle(enhancementType, styleKey) {
    try {
        const result = await chrome.storage.local.get(STORAGE_ACTIVE_STYLE);
        const activeStyles = result[STORAGE_ACTIVE_STYLE] || {};
        activeStyles[enhancementType] = styleKey;
        await chrome.storage.local.set({ [STORAGE_ACTIVE_STYLE]: activeStyles });
    } catch (error) {
        console.error('[Prompt Architect] Error setting active style:', error);
        throw error;
    }
}

/**
 * Gets the active style for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @returns {Promise<string|null>} The active style key or null
 */
async function getActiveStyle(enhancementType) {
    try {
        const result = await chrome.storage.local.get(STORAGE_ACTIVE_STYLE);
        const activeStyles = result[STORAGE_ACTIVE_STYLE] || {};
        let styleKey = activeStyles[enhancementType] || null;
        // First-time users: use Default for Text enhancement
        if (!styleKey && enhancementType === 'TEXT_ENHANCEMENT') {
            styleKey = 'default';
        }
        if (styleKey) {
            debug.log(`Active style for ${enhancementType}: ${styleKey}`);
        }
        return styleKey;
    } catch (error) {
        console.error('[Prompt Architect] Error getting active style:', error);
        return null;
    }
}

// --- Helper Functions (Same as previous version, adapted for multiple modes) ---

// Store default API key in memory (set by popup.js)
let defaultApiKey = null;

/**
 * Retrieves the Gemini API key from chrome.storage.local.
 * Falls back to default key if user hasn't set their own.
 */
const getApiKey = () => {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_GEMINI_API_KEY, 'defaultGeminiApiKey'], (result) => {
            if (chrome.runtime.lastError) {
                debug.error("Error retrieving API key in background:", chrome.runtime.lastError);
                resolve(null);
            } else {
                // Use user's key if set, otherwise use default
                const apiKey = result[STORAGE_GEMINI_API_KEY] || result['defaultGeminiApiKey'] || defaultApiKey;
                resolve(apiKey || null);
            }
        });
    });
};

/**
 * Validates if a model ID exists in the available models list
 * @param {string} provider - The provider name
 * @param {string} modelId - The model ID to validate
 * @returns {boolean} True if model exists, false otherwise
 */
function isValidModel(provider, modelId) {
    let models = AVAILABLE_MODELS[provider] || [];
    
    // Filter out non-text models for Gemini (e.g., TTS models)
    if (provider === 'gemini') {
        models = models.filter(m => {
            const id = m.id.toLowerCase();
            // Filter out TTS (text-to-speech) models
            if (id.includes('tts') || id.includes('text-to-speech')) return false;
            // Filter out audio models
            if (id.includes('audio') && !id.includes('transcribe')) return false;
            return true;
        });
    }
    
    return models.some(model => model.id === modelId);
}

/**
 * Gets the model - always returns Gemini 2.5 Flash Lite
 * @returns {Promise<string>} The model ID to use
 */
async function getSelectedModel() {
    // Always use Gemma 3 4B
    return Promise.resolve('gemma-3-4b-it');
}

/**
 * Extracts the improved prompt text from Gemini API responses.
 */
const extractImprovedPrompt = (data) => {
    try {
        // Check for error structure first
        if (data?.error) {
            const errorMsg = (data.error.message || data.error || 'Unknown error').toString().toLowerCase();
            debug.warn('API returned error:', errorMsg);
            if (errorMsg.includes('api_key') || errorMsg.includes('key') || errorMsg.includes('authentication')) {
                return "Error: Invalid API key. Check your key in the Setup tab.";
            } else if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('429') || errorMsg.includes('rate')) {
                return "Error: API quota exceeded. Try again later or check your API limits.";
            } else if (errorMsg.includes('safety') || errorMsg.includes('blocked') || errorMsg.includes('content policy')) {
                return "Error: Content was blocked. Try rephrasing your prompt.";
            }
            return `Error: ${data.error.message || data.error || 'Unknown error'}`;
        }
        
        // Extract text from Gemini response
        if (data?.promptFeedback?.blockReason) {
            return `Error: Content was blocked. Try rephrasing your prompt.`;
        }
        
        const candidate = data.candidates?.[0];
        let extractedText = '';
        
        if (candidate?.content?.parts?.[0]?.text) {
            extractedText = candidate.content.parts[0].text.trim();
        }
        
        if (!extractedText) {
            debug.warn('Unexpected Gemini response structure:', data);
            return "Error: No response generated. Please try again.";
        }
        
        // Strip markdown code blocks if present
        // Matches patterns like ```text, ```, ```markdown, etc.
        extractedText = extractedText.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();
        
        return extractedText;
    } catch (e) {
        debug.error('Error processing Gemini API response:', e, data);
        return "Error: Failed to process the API response structure.";
    }
};

/**
 * Structures the request body for Gemini API.
 * @param {string} prompt - The user prompt
 * @param {string} systemInstruction - The system instruction
 * @param {string} modelId - The model ID to use (gemma-3-4b-it)
 * @returns {string} The request body as JSON string
 */
const getRequestBody = (prompt, systemInstruction, modelId = 'gemma-3-4b-it') => {
    const fullInstruction = `${systemInstruction}\n\nUser's raw text:\n"${prompt}"\n\nImproved Output:`;
    
    // Always use Gemini format
    return JSON.stringify({
        contents: [{
            parts: [{
                text: fullInstruction
            }]
        }],
        generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 8192,
            topP: 0.9,
        }
    });
};

/** Port for streaming enhanced prompt chunks to popup (set when popup connects) */
let enhanceStreamPort = null;
/** Ports for streaming to content script per tab (ChatGPT, Gemini, etc.) */
const enhanceStreamPagePorts = new Map();

/**
 * Resolves the system instruction for an enhancement type (same logic as executeEnhancement).
 * @param {string} enhancementType - The key from SYSTEM_INSTRUCTIONS
 * @param {boolean} forceDefaultStyle - If true, use default style only
 * @returns {Promise<string>} The system instruction text
 */
async function getSystemInstructionForEnhancement(enhancementType, forceDefaultStyle = false) {
    const activeStyleKey = forceDefaultStyle ? null : await getActiveStyle(enhancementType);
    let systemInstruction = null;
    if (!forceDefaultStyle && activeStyleKey) {
        if (activeStyleKey === 'default') {
            const templates = INSTRUCTION_TEMPLATES[enhancementType] || {};
            systemInstruction = templates['default'] || SYSTEM_INSTRUCTIONS[enhancementType];
        } else if (activeStyleKey.startsWith('template:')) {
            const templateKey = activeStyleKey.replace('template:', '');
            const templates = INSTRUCTION_TEMPLATES[enhancementType] || {};
            systemInstruction = templates[templateKey] || SYSTEM_INSTRUCTIONS[enhancementType];
        } else if (activeStyleKey.startsWith('custom:')) {
            const styleName = activeStyleKey.replace('custom:', '');
            const namedStyles = await getNamedCustomStyles(enhancementType);
            systemInstruction = namedStyles[styleName] || null;
        }
    }
    if (!systemInstruction) systemInstruction = await getCustomInstruction(enhancementType);
    if (!systemInstruction) systemInstruction = SYSTEM_INSTRUCTIONS[enhancementType];
    return systemInstruction || '';
}

/** Safely post to a port (no throw if disconnected). */
function safePortPost(port, msg) {
    try {
        if (port) port.postMessage(msg);
    } catch (e) {
        debug.warn('Port postMessage failed (port may be disconnected):', e?.message || e);
    }
}

/**
 * Calls the backend streaming endpoint and forwards SSE chunks to the given port.
 * @param {string} userText - The text to enhance
 * @param {string} systemInstruction - The system instruction
 * @param {string} enhancementType - The enhancement type
 * @param {chrome.runtime.Port} port - Port to postMessage({ chunk }) and ({ done, fullText }) or ({ error })
 */
async function callBackendEnhanceStream(userText, systemInstruction, enhancementType, port) {
    const controller = new AbortController();
    const timeoutMs = 65000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    function cleanup() {
        clearTimeout(timeoutId);
    }

    try {
        const response = await fetch(`${BACKEND_API_URL}/enhance-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userText, systemInstruction }),
            signal: controller.signal
        });

        if (!response.ok) {
            cleanup();
            const errText = await response.text();
            let errData;
            try { errData = JSON.parse(errText); } catch (e) { errData = { error: errText }; }
            safePortPost(port, { error: errData.error || `Request failed (${response.status})` });
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]' || jsonStr === '') continue;
                    try {
                        const data = JSON.parse(jsonStr);
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        if (text) {
                            fullText += text;
                            safePortPost(port, { chunk: text });
                        }
                    } catch (e) { /* skip malformed chunk */ }
                }
            }
        }
        // Flush any remaining in buffer
        if (buffer.trim() && buffer.startsWith('data: ')) {
            try {
                const data = JSON.parse(buffer.slice(6).trim());
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text) {
                    fullText += text;
                    safePortPost(port, { chunk: text });
                }
            } catch (e) { /* skip */ }
        }

        cleanup();
        let result = fullText.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();
        if (!result) {
            safePortPost(port, { error: 'Empty response from server' });
            return;
        }
        safePortPost(port, { done: true, fullText: result });

        if (usageTracker) {
            try { await usageTracker.trackUsage('enhancements'); } catch (e) { debug.warn('Usage tracking failed:', e); }
        }
        saveToHistory(userText, result, enhancementType, 'gemini');
    } catch (err) {
        cleanup();
        if (err.name === 'AbortError') safePortPost(port, { error: 'Request timed out. The server may be slow or unavailable. Please try again.' });
        else safePortPost(port, { error: err.message || 'Stream failed' });
    }
}

/**
 * Calls the backend proxy to enhance a prompt
 * @param {string} userText - The text to enhance
 * @param {string} systemInstruction - The system instruction
 * @param {string} enhancementType - The enhancement type
 * @returns {Promise<string>} The enhanced prompt
 */
async function callBackendEnhance(userText, systemInstruction, enhancementType) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s so popup 45s timeout can show error

    try {
        console.log('[Backend] Calling enhance endpoint:', BACKEND_API_URL);
        const response = await fetch(`${BACKEND_API_URL}/enhance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: userText,
                enhancementType: enhancementType,
                systemInstruction: systemInstruction
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText || `Backend request failed (${response.status})` };
            }
            console.error('[Backend] Enhancement failed:', response.status, errorData);
            throw new Error(errorData.error || `Backend request failed (${response.status})`);
        }

        const data = await response.json();
        if (!data.result) {
            console.error('[Backend] No result in response:', data);
            throw new Error('Backend returned empty result');
        }
        console.log('[Backend] Enhancement successful, result length:', data.result.length);
        return data.result;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('[Backend] Request timed out');
            throw new Error('Backend request timed out');
        }
        console.error('[Backend] Enhancement error:', error.message, error.stack);
        throw error;
    }
}

/**
 * Core function to call the appropriate API from the background worker.
 * Now includes request deduplication and caching.
 * @param {string} enhancementType - The key from SYSTEM_INSTRUCTIONS.
 * @param {string} userText - The text selected by the user.
 * @param {string} provider - The API provider ('gemini', 'openai', 'anthropic').
 * @param {boolean} forceDefaultStyle - If true, always use default style (ignores activeStyle). Used by injected button.
 * @returns {Promise<string>} The enhanced prompt text or an error message.
 */
async function executeEnhancement(enhancementType, userText, provider = 'gemini', forceDefaultStyle = false) {
    // Check usage limits for free users
    if (usageTracker) {
        try {
            const limitCheck = await usageTracker.canUseFeature('enhancements');
            if (!limitCheck.allowed) {
                const limit = limitCheck.limit != null ? limitCheck.limit : 10;
                const remaining = typeof limitCheck.remaining === 'number' && !isNaN(limitCheck.remaining) ? limitCheck.remaining : 0;
                return `You've reached your weekly limit of ${limit} prompt enhancements. You have ${remaining} remaining this week. Upgrade to Premium for unlimited enhancements!`;
            }
        } catch (error) {
            debug.warn('Usage limit check failed:', error);
            // Continue with enhancement if check fails (fail open)
        }
    }

    // Always use Gemma 3 4B
    const selectedProvider = 'gemini';

    // Get active style key first
    // If forceDefaultStyle is true, always use 'default' (injected button always uses default)
    const activeStyleKey = forceDefaultStyle ? null : await getActiveStyle(enhancementType);
    const styleKeyForCache = forceDefaultStyle ? 'default' : (activeStyleKey || 'default');
    
    // Caching disabled - always make fresh API calls
    // const cached = getCachedEnhancement(userText, enhancementType, selectedProvider, styleKeyForCache);
    // if (cached) {
    //     debug.log('Returning cached result');
    //     return cached;
    // }
    
    // Make each request unique by adding timestamp - ensures fresh API calls even for same prompt
    const timestamp = Date.now();
    const requestKey = `${userText}-${enhancementType}-${selectedProvider}-${styleKeyForCache}-${timestamp}`;
    // Disabled duplicate request prevention to allow fresh responses for same prompts
    // if (pendingRequests.has(requestKey)) {
    //     debug.log('Duplicate request detected, returning existing promise');
    //     return pendingRequests.get(requestKey);
    // }
    
    // Create the enhancement promise
    const enhancementPromise = (async () => {
        try {
            // 1. Resolve System Instruction first
            // Check for active style first, then fall back to legacy custom instruction, then default
            // If forceDefaultStyle is true, skip all style lookups and go straight to default
            let systemInstruction = null;
            
            if (!forceDefaultStyle) {
                // Popup mode: Use active style if set
                if (activeStyleKey) {
                    if (activeStyleKey === 'default') {
                        const templates = INSTRUCTION_TEMPLATES[enhancementType] || {};
                        systemInstruction = templates['default'] || SYSTEM_INSTRUCTIONS[enhancementType];
                    } else if (activeStyleKey.startsWith('template:')) {
                        const templateKey = activeStyleKey.replace('template:', '');
                        const templates = INSTRUCTION_TEMPLATES[enhancementType] || {};
                        systemInstruction = templates[templateKey] || SYSTEM_INSTRUCTIONS[enhancementType];
                    } else if (activeStyleKey.startsWith('custom:')) {
                        const styleName = activeStyleKey.replace('custom:', '');
                        const namedStyles = await getNamedCustomStyles(enhancementType);
                        systemInstruction = namedStyles[styleName] || null;
                        if (!systemInstruction) {
                            debug.warn(`Custom style "${styleName}" not found for ${enhancementType}, falling back to default`);
                        } else {
                            debug.log(`Using custom style "${styleName}" for ${enhancementType}`);
                        }
                    }
                }
                
                // Fallback to legacy custom instruction
                if (!systemInstruction) {
                    systemInstruction = await getCustomInstruction(enhancementType);
                }
            }
            
            // Final fallback to default (always used for injected button, or if no style found for popup)
            if (!systemInstruction) {
                systemInstruction = SYSTEM_INSTRUCTIONS[enhancementType];
            }
            
            if (!systemInstruction) {
                throw new EnhancementError(
                    ERROR_MESSAGES.INVALID_ENHANCEMENT_TYPE,
                    'INVALID_ENHANCEMENT_TYPE',
                    false,
                    `Invalid enhancement type: ${enhancementType}.`
                );
            }

            // 2. Try backend proxy if enabled
            if (USE_BACKEND_PROXY) {
                try {
                    const improvedPrompt = await callBackendEnhance(userText, systemInstruction, enhancementType);
                    if (improvedPrompt && !improvedPrompt.startsWith('Error:')) {
                        // Save to history
                        saveToHistory(userText, improvedPrompt, enhancementType, 'gemini');

                        // Track usage for free tier limits
                        if (usageTracker) {
                            try {
                                await usageTracker.trackUsage('enhancements');
                            } catch (error) {
                                debug.warn('Usage tracking failed:', error);
                            }
                        }

                        return improvedPrompt;
                    }
                    // If backend fails, fall through to direct API (if user has their own key)
                    debug.warn('Backend proxy failed, falling back to direct API');
                } catch (backendError) {
                    debug.warn('Backend proxy error, falling back to direct API:', backendError);
                    // Fall through to direct API
                }
            }

            // 3. Fallback to direct API (requires user's own API key)
            const apiKey = await getApiKey();
            if (!apiKey) {
                const providerNames = {
                    'gemini': 'Google AI',
                    'openai': 'OpenAI',
                    'anthropic': 'Anthropic',
                    'grok': 'xAI Grok',
                    'deepseek': 'DeepSeek'
                };
                const providerName = providerNames[selectedProvider] || 'AI Provider';
                throw new EnhancementError(
                    'Service temporarily unavailable. Please try again in a moment.',
                    'SERVICE_UNAVAILABLE',
                    true,
                    'Our enhancement service is temporarily unavailable. Please try again in a few moments.'
                );
            }
            
            const config = API_CONFIGS.gemini;
            
            // Always use Gemma 3 4B
            const selectedModel = 'gemma-3-4b-it';
            const actualModelId = config.getModelId ? config.getModelId(selectedModel) : selectedModel;
            
            // Gemma 3 4B - no special timeout needed
            const isReasoningModel = false;

            const requestBody = getRequestBody(userText, systemInstruction, selectedModel);

            // Build API URL and headers for Gemini
            const fullApiUrl = `${config.baseUrl}${actualModelId}${config.action}?key=${apiKey}`;
            const requestHeaders = { 'Content-Type': 'application/json' };

            // Validate URL was constructed
            if (!fullApiUrl) {
                throw new EnhancementError(
                    ERROR_MESSAGES.UNEXPECTED_ERROR,
                    'URL_CONSTRUCTION_FAILED',
                    false,
                    `Failed to construct API URL for ${selectedProvider}`
                );
            }

            // Apply rate limiting
            await apiRateLimiter.waitIfNeeded();
            
            // Use the isReasoningModel variable already declared above
            const timeoutMs = isReasoningModel ? 120000 : 60000; // 120s for reasoning, 60s for others
            
            // Set up timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, timeoutMs);
            
            let response;
            try {
                response = await fetch(fullApiUrl, {
                    method: 'POST',
                    headers: requestHeaders,
                    body: requestBody,
                    signal: controller.signal
                });
            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    const timeoutSeconds = isReasoningModel ? 120 : 60;
                    throw new EnhancementError(
                        `Request timed out after ${timeoutSeconds} seconds. Please try again.`,
                        'TIMEOUT',
                        true,
                        `Request timed out after ${timeoutSeconds} seconds. The API is taking too long to respond. Please try again.`
                    );
                }
                throw error;
            }
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData?.error?.message || `Connection failed (${response.status}).`);
                throw getUserFriendlyError(error);
            }

            const data = await response.json();
            const improvedPrompt = extractImprovedPrompt(data);
            
            // Cache successful results (now includes style in key)
            if (!improvedPrompt.startsWith('Error:')) {
                // Caching disabled - don't cache results
                // cacheEnhancement(userText, enhancementType, selectedProvider, improvedPrompt, styleKeyForCache);
                
                // Save to history
                saveToHistory(userText, improvedPrompt, enhancementType, 'gemini');
            }
            
            return improvedPrompt;

        } catch (error) {
            debug.error(`[${enhancementType}] API Call or Processing Error:`, error);
            
            // Return user-friendly error message
            if (error instanceof EnhancementError) {
                return `Error: ${error.userMessage}`;
            }
            
            const friendlyError = getUserFriendlyError(error);
            return `Error: ${friendlyError.userMessage}`;
        } finally {
            // Remove from pending requests
            pendingRequests.delete(requestKey);
        }
    })();
    
    // Store pending request
    pendingRequests.set(requestKey, enhancementPromise);
    
    return enhancementPromise;
}

/**
 * Calls the backend proxy to ask a question
 * @param {string} question - The user's question
 * @param {string} systemInstruction - The system instruction
 * @returns {Promise<string>} The answer
 */
async function callBackendAsk(question, systemInstruction) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
        const response = await fetch(`${BACKEND_API_URL}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: question,
                systemInstruction: systemInstruction
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Backend request failed (${response.status})`);
        }

        const data = await response.json();
        return data.result || 'Error: No result from backend';
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Backend request timed out');
        }
        throw error;
    }
}

/**
 * Executes a question-answering request (Ask feature)
 * @param {string} question - The user's question
 * @param {string} provider - The API provider ('gemini', 'openai', 'anthropic')
 * @returns {Promise<string>} The answer text or an error message
 */
async function executeAskQuestion(question, provider = 'gemini') {
    // Check usage limits for free users
    if (usageTracker) {
        try {
            const limitCheck = await usageTracker.canUseFeature('questions');
            if (!limitCheck.allowed) {
                const limit = limitCheck.limit != null ? limitCheck.limit : 5;
                const remaining = typeof limitCheck.remaining === 'number' && !isNaN(limitCheck.remaining) ? limitCheck.remaining : 0;
                return `You've reached your weekly limit of ${limit} questions. You have ${remaining} remaining this week. Upgrade to Premium for unlimited questions!`;
            }
        } catch (error) {
            debug.warn('Usage limit check failed:', error);
            // Continue with question if check fails (fail open)
        }
    }

    // Always use Gemma 3 4B
    const selectedProvider = 'gemini';
    
    // Caching disabled - always make fresh API calls for unique responses
    // const cached = getCachedEnhancement(question, 'ASK_QUESTION', selectedProvider);
    // if (cached) {
    //     debug.log('Returning cached answer');
    //     return cached;
    // }
    
    // Make each request unique by adding timestamp - ensures fresh API calls even for same question
    const timestamp = Date.now();
    const requestKey = `${question}-ASK_QUESTION-${selectedProvider}-${timestamp}`;
    // Disabled duplicate request prevention to allow fresh responses for same questions
    // if (pendingRequests.has(requestKey)) {
    //     debug.log('Duplicate question request detected, returning existing promise');
    //     return pendingRequests.get(requestKey);
    // }
    
    // Create the question-answering promise
    const questionPromise = (async () => {
        try {
            // Use ASK_QUESTION system instruction
            const systemInstruction = SYSTEM_INSTRUCTIONS.ASK_QUESTION;
            
            // Try backend proxy first if enabled
            if (USE_BACKEND_PROXY) {
                try {
                    const answer = await callBackendAsk(question, systemInstruction);
                    if (answer && !answer.startsWith('Error:')) {
                        // Save to history and track usage (same as direct API path)
                        saveToHistory(question, answer, 'ASK_QUESTION', 'gemini');
                        if (usageTracker) {
                            try {
                                await usageTracker.trackUsage('questions');
                            } catch (error) {
                                debug.warn('Usage tracking failed:', error);
                            }
                        }
                        return answer;
                    }
                    // If backend fails, fall through to direct API (if user has their own key)
                    debug.warn('Backend proxy failed for ask, falling back to direct API');
                } catch (backendError) {
                    debug.warn('Backend proxy error for ask, falling back to direct API:', backendError);
                    // Fall through to direct API
                }
            }

            // Fallback to direct API (requires user's own API key)
            const apiKey = await getApiKey();
            if (!apiKey) {
                throw new EnhancementError(
                    'Service temporarily unavailable. Please try again in a moment.',
                    'SERVICE_UNAVAILABLE',
                    true,
                    'Our question answering service is temporarily unavailable. Please try again in a few moments.'
                );
            }
            
            // Always use Gemini configuration
            const config = API_CONFIGS.gemini;
            
            // Always use Gemma 3 4B
            const selectedModel = 'gemma-3-4b-it';
            const actualModelId = config.getModelId ? config.getModelId(selectedModel) : selectedModel;
            
            // Gemma 3 4B - no special timeout needed
            const isReasoningModel = false;
            
            // Build request body for Ask (Gemini format)
            const requestBody = JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemInstruction}\n\nQuestion: ${question}\n\nAnswer:`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                    topP: 0.9,
                }
            });
            
            // Build API URL and headers for Gemini
            const fullApiUrl = `${config.baseUrl}${actualModelId}${config.action}?key=${apiKey}`;
            const requestHeaders = { 'Content-Type': 'application/json' };
            
            // Apply rate limiting
            await apiRateLimiter.waitIfNeeded();
            
            // Use the isReasoningModel variable already declared above
            const timeoutMs = isReasoningModel ? 120000 : 60000; // 120s for reasoning, 60s for others
            
            // Make API request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
                const response = await fetch(fullApiUrl, {
                    method: 'POST',
                    headers: requestHeaders,
                    body: requestBody,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('[Prompt Architect] Ask API error response:', {
                        status: response.status,
                        statusText: response.statusText,
                        errorData: errorData
                    });
                    const errorMessage = errorData?.error?.message || errorData?.message || `Connection failed (${response.status}).`;
                    const error = new Error(errorMessage);
                    throw getUserFriendlyError(error);
                }
                
                const data = await response.json();
                debug.log('Ask API response data:', data);
                const answer = extractImprovedPrompt(data);
                debug.log('Extracted answer (first 100 chars):', answer.substring(0, 100));
                
                // Cache successful results
                if (!answer.startsWith('Error:')) {
                    // Caching disabled - don't cache results
                    // cacheEnhancement(question, 'ASK_QUESTION', selectedProvider, answer, 'ask');

                    // Save to history (questions history)
                    saveToHistory(question, answer, 'ASK_QUESTION', 'gemini');

                    // Track usage for free tier limits
                    if (usageTracker) {
                        try {
                            await usageTracker.trackUsage('questions');
                        } catch (error) {
                            debug.warn('Usage tracking failed:', error);
                        }
                    }
                }
                
                return answer;
            } catch (fetchError) {
                clearTimeout(timeoutId);
                console.error('[Prompt Architect] Fetch error in executeAskQuestion:', fetchError);
                if (fetchError.name === 'AbortError') {
                    // Use the isReasoningModel variable already declared above
                    const timeoutSeconds = isReasoningModel ? 120 : 60;
                    throw new EnhancementError(
                        `Request timed out after ${timeoutSeconds} seconds. Please try again.`,
                        'TIMEOUT',
                        true,
                        `Request timed out after ${timeoutSeconds} seconds. The API is taking too long to respond. Please try again.`
                    );
                }
                throw fetchError;
            }
        } catch (error) {
            console.error("[Prompt Architect] Error in executeAskQuestion:", error);
            
            if (error instanceof EnhancementError) {
                return error.userMessage;
            }
            
            const friendlyError = getUserFriendlyError(error);
            return `Error: ${friendlyError.userMessage}`;
        } finally {
            // Remove from pending requests
            pendingRequests.delete(requestKey);
        }
    })();
    
    // Store pending request
    pendingRequests.set(requestKey, questionPromise);
    
    return questionPromise;
}

// Load default API key on startup
chrome.storage.local.get(['defaultGeminiApiKey'], (result) => {
    if (result['defaultGeminiApiKey']) {
        defaultApiKey = result['defaultGeminiApiKey'];
    }
});

// --- Message Listener (Communication from content.js) ---
if (typeof chrome !== 'undefined' && chrome.runtime) {
    // Handle default API key from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'setDefaultApiKey') {
            defaultApiKey = request.apiKey;
            // Also store in chrome.storage for persistence
            chrome.storage.local.set({ 'defaultGeminiApiKey': request.apiKey });
            sendResponse({ success: true });
            return true;
        }
    });
    
    // Handle template and custom instruction requests
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // Log for debugging
        debug.log('Received message:', request.action);
        
        // Model selection removed - always use Gemini 2.5 Flash Lite
        if (request.action === 'getAvailableModels' || request.action === 'getSelectedModel' || request.action === 'setSelectedModel') {
            // Always return Gemini 2.5 Flash Lite
            sendResponse({ 
                success: true, 
                modelId: 'gemma-3-4b-it',
                models: [{ id: 'gemma-3-4b-it', name: 'Gemma 3 4B', recommended: true }],
                recommendedModelId: 'gemma-3-4b-it'
            });
            return true;
        }
        
        if (request.action === 'getTemplates') {
            getTemplatesForType(request.enhancementType)
                .then(templates => {
                    sendResponse({ success: true, templates });
                })
                .catch(error => {
                    console.error('[Prompt Architect] Error in getTemplates:', error);
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Keep channel open for async response
        }
        
        if (request.action === 'saveNamedCustomStyle') {
            // Validate request
            if (!request.enhancementType || !request.styleName || !request.instruction) {
                const errorMsg = 'Missing required fields: enhancementType, styleName, or instruction';
                console.error('[Prompt Architect]', errorMsg, request);
                sendResponse({ 
                    success: false, 
                    error: errorMsg
                });
                return true;
            }
            
            debug.log('Saving named custom style:', {
                enhancementType: request.enhancementType,
                styleName: request.styleName,
                instructionLength: request.instruction.length
            });
            
            saveNamedCustomStyle(request.enhancementType, request.styleName, request.instruction)
                .then(result => {
                    debug.log('Style saved successfully:', result);
                    try {
                        sendResponse({ success: true, ...(result || {}) });
                    } catch (e) {
                        console.error('[Prompt Architect] Error sending response:', e);
                        // Try to send error response
                        try {
                            sendResponse({ success: false, error: 'Failed to send response' });
                        } catch (e2) {
                            console.error('[Prompt Architect] Failed to send error response:', e2);
                        }
                    }
                })
                .catch(error => {
                    console.error('[Prompt Architect] Error saving named custom style:', error);
                    try {
                        sendResponse({ 
                            success: false, 
                            error: error?.message || 'Unknown error saving style' 
                        });
                    } catch (e) {
                        console.error('[Prompt Architect] Error sending error response:', e);
                    }
                });
            return true; // Keep channel open for async response
        }
        
        if (request.action === 'getNamedCustomStyles') {
            getNamedCustomStyles(request.enhancementType)
                .then(styles => sendResponse({ success: true, styles }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'deleteNamedCustomStyle') {
            deleteNamedCustomStyle(request.enhancementType, request.styleName)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'setActiveStyle') {
            setActiveStyle(request.enhancementType, request.styleKey)
                .then(() => {
                    debug.log(`Active style set: ${request.enhancementType} -> ${request.styleKey}`);
                    sendResponse({ success: true });
                })
                .catch(error => {
                    debug.warn(`Error setting active style: ${error.message}`);
                    sendResponse({ success: false, error: error.message });
                });
            return true;
        }
        
        if (request.action === 'getActiveStyle') {
            getActiveStyle(request.enhancementType)
                .then(styleKey => sendResponse({ success: true, styleKey }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'saveCustomInstruction') {
            saveCustomInstruction(request.enhancementType, request.instruction)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'getCustomInstruction') {
            getCustomInstruction(request.enhancementType)
                .then(instruction => sendResponse({ success: true, instruction }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'deleteCustomInstruction') {
            deleteCustomInstruction(request.enhancementType)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
    });

    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'enhanceStream') {
            enhanceStreamPort = port;
            port.onDisconnect.addListener(() => { enhanceStreamPort = null; });
        }
        if (port.name === 'enhanceStreamPage') {
            const tabId = port.sender?.tab?.id;
            if (tabId != null) {
                enhanceStreamPagePorts.set(tabId, port);
                port.onDisconnect.addListener(() => { enhanceStreamPagePorts.delete(tabId); });
            }
        }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'enhancePromptStream') {
            const enhancementType = request.enhancementType || 'TEXT_ENHANCEMENT';
            const forceDefaultStyle = request.forceDefaultStyle || false;
            const port = sender.tab ? enhanceStreamPagePorts.get(sender.tab.id) : enhanceStreamPort;
            if (!port) {
                sendResponse({ error: 'Stream not connected. Please try again.' });
                return false;
            }
            (async () => {
                if (usageTracker) {
                    try {
                        const limitCheck = await usageTracker.canUseFeature('enhancements');
                        if (!limitCheck.allowed) {
                            const limit = limitCheck.limit != null ? limitCheck.limit : 10;
                            const remaining = typeof limitCheck.remaining === 'number' && !isNaN(limitCheck.remaining) ? limitCheck.remaining : 0;
                            safePortPost(port, { error: `You've reached your weekly limit of ${limit} prompt enhancements. You have ${remaining} remaining this week. Upgrade to Premium for unlimited enhancements!` });
                            sendResponse({ ok: false });
                            return;
                        }
                    } catch (e) { debug.warn('Usage limit check failed:', e); }
                }
                const systemInstruction = await getSystemInstructionForEnhancement(enhancementType, forceDefaultStyle);
                if (!systemInstruction) {
                    safePortPost(port, { error: 'Invalid enhancement type or missing system instruction.' });
                    sendResponse({ ok: false });
                    return;
                }
                if (!USE_BACKEND_PROXY) {
                    safePortPost(port, { error: 'Streaming is only available when using the backend proxy.' });
                    sendResponse({ ok: false });
                    return;
                }
                sendResponse({ ok: true });
                await callBackendEnhanceStream(request.prompt, systemInstruction, enhancementType, port);
            })();
            return true; // async response
        }

        if (request.action === 'enhancePrompt') {
            const enhancementType = request.enhancementType || 'TEXT_ENHANCEMENT';
            const forceDefaultStyle = request.forceDefaultStyle || false; // Injected button always uses default
            const enhancePromise = executeEnhancement(enhancementType, request.prompt, 'gemini', forceDefaultStyle);
            // Guarantee we respond within 40s so popup never hangs
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out. The server may be slow. Please try again.')), 40000)
            );

            Promise.race([enhancePromise, timeoutPromise])
                .then(result => {
                    sendResponse({ enhancedPrompt: result });
                })
                .catch(error => {
                    debug.error("Error during enhancement processing:", error);
                    sendResponse({ enhancedPrompt: `Error: ${error.message || 'Processing failed in background.'}` });
                });

            return true; // async response
        }
        
        if (request.action === 'askQuestion') {
            // Always use Gemma 3 4B
            let promise = executeAskQuestion(request.question, 'gemini');

            // Handle the promise result and send back
            promise.then(result => {
                sendResponse({ answer: result });
            }).catch(error => {
                debug.error("Error during question processing:", error);
                sendResponse({ answer: `Error: Processing failed in background. (${error.message || 'Unknown error'})` });
            });

            // Return true to indicate that we will send an asynchronous response
            return true;
        }
    });

    // --- Context Menu Initialization (Existing logic maintained) ---
    // The three sub-enhancements (Enhance, Expand, Polish) remain available via right-click
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "ENHANCE",
            title: "Architect: Enhance (General)",
            contexts: ["selection"]
        });

        chrome.contextMenus.create({
            id: "EXPAND",
            title: "Architect: Expand Details",
            contexts: ["selection"]
        });

        chrome.contextMenus.create({
            id: "POLISH",
            title: "Architect: Polish & Correct",
            contexts: ["selection"]
        });
    });


    // Handle clicks on the context menu items
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        const selectedText = info.selectionText;
        const enhancementType = info.menuItemId; // ID is now the enhancement type key
        
        // Always use Gemini
        const promise = executeEnhancement(enhancementType, selectedText, 'gemini');

        // Send the result back to the content script via a message to update the input box
        promise.then(result => {
            chrome.tabs.sendMessage(tab.id, {
                action: "contextMenuResult",
                resultText: result,
                originalText: selectedText
            });
        }).catch(error => {
            debug.error("Context Menu Enhancement Failed:", error);
            chrome.tabs.sendMessage(tab.id, {
                action: "contextMenuResult",
                resultText: `Error: Failed to process context menu request. ${error.message}`,
                originalText: selectedText
            });
        });
    });

    // --- Keyboard Shortcut Handler ---
    chrome.commands.onCommand.addListener((command) => {
        if (command === 'enhance-prompt') {
            // Get the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    // Send message to content script to trigger enhancement
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'enhance-prompt-shortcut'
                    }).catch(err => {
                        // Tab might not have content script loaded yet, or not on supported page
                        debug.log('Keyboard shortcut: Tab not ready or unsupported page');
                    });
                }
            });
        }
    });
}