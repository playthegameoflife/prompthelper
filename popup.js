/**
 * popup.js
 * Handles the logic for API key management and prompt enhancement.
 * Premium UI with tab navigation and full enhancement functionality.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded event fired');
  console.log('Body exists:', !!document.body);
  console.log('Main container exists:', !!document.getElementById('main-container'));

  // DEBUG: Add immediate visibility check
  console.log('Popup loaded, checking elements...');
  const loginSection = document.getElementById('login-section');
  console.log('Login section found:', !!loginSection);
  console.log('Login section display:', loginSection?.style?.display);

  // Setup reload button event listener
  const reloadButton = document.getElementById('reload-button');
  if (reloadButton) {
    reloadButton.addEventListener('click', () => {
      location.reload();
    });
  }

  // DOM element declarations first to avoid ReferenceErrors
  const tabsContainer = document.querySelector('.tabs');
  const mainContent = document.querySelectorAll('.setup-section:not(#login-section)');
  const enhanceTab = document.getElementById('enhance-section');
  const askTab = document.getElementById('ask-section');
  const recentTab = document.getElementById('recent-section');
  const premiumTab = document.getElementById('premium-section');
  const setupTab = document.getElementById('setup-section');
  const advancedSection = document.getElementById('advanced-section');

  // User account elements
  const userInfo = document.getElementById('user-info');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const logoutButton = document.getElementById('logout-button');
  
  // Backend auth (no Firebase SDK - Chrome Web Store MV3 no remote code)
  const STORAGE_FIREBASE_USER = 'pa_firebase_user';
  let currentUser = null; // { uid, email, displayName } from backend
  const BACKEND_URL = typeof BACKEND_API_URL !== 'undefined' ? BACKEND_API_URL : 'https://api-clyep56cdq-uc.a.run.app';

  function saveUserToStorage(user) {
    if (!user || !chrome.storage?.local) return;
    chrome.storage.local.set({
      [STORAGE_FIREBASE_USER]: { uid: user.uid, email: user.email || null }
    });
  }

  function clearFirebaseUserFromStorage() {
    if (chrome.storage?.local) chrome.storage.local.remove([STORAGE_FIREBASE_USER]);
    currentUser = null;
  }

  /**
   * Close any tab showing the Google OAuth 400 error page.
   * chrome.identity.getAuthToken can leave that tab open even when sign-in succeeded.
   */
  function closeGoogleOAuthErrorTabs() {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return;
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        const url = (tab.url || '').toLowerCase();
        const title = (tab.title || '');
        const isGoogleAuth = url.includes('accounts.google.com');
        const isErrorPage = title.includes("That's an error") || (title.includes('400') && title.includes('error'));
        if (isGoogleAuth && isErrorPage) {
          chrome.tabs.remove(tab.id, () => {});
        }
      }
    });
  }

  async function verifyGoogleToken(accessToken) {
    // Use long names so minifiers don't shadow the Response (e.g. inner `t` breaking `t.status`).
    const fetchResponse = await fetch(`${BACKEND_URL}/verify-google-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken })
    });
    if (!fetchResponse.ok) {
      let detail = '';
      try {
        const responseText = await fetchResponse.text();
        try {
          const errJson = JSON.parse(responseText);
          detail = errJson.error || errJson.message || responseText;
        } catch {
          detail = responseText || '';
        }
      } catch (_) { /* ignore */ }
      const status = fetchResponse.status;
      const msg = detail ? `Verification failed (${status}): ${detail}` : `Verification failed (${status})`;
      throw new Error(msg);
    }
    return fetchResponse.json();
  }

  async function tryRestoreSession() {
    if (!chrome.identity?.getAuthToken) return false;
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_FIREBASE_USER], (result) => {
        const saved = result[STORAGE_FIREBASE_USER];
        if (!saved?.uid) { resolve(false); return; }
        chrome.identity.getAuthToken({ interactive: false }, async (token) => {
          if (chrome.runtime.lastError || !token) {
            clearFirebaseUserFromStorage();
            resolve(false);
            return;
          }
          try {
            const user = await verifyGoogleToken(token);
            currentUser = user;
            saveUserToStorage(user);
            resolve(true);
          } catch (e) {
            clearFirebaseUserFromStorage();
            resolve(false);
          }
        });
      });
    });
  }

  async function setupBackendAuth() {
    const googleSignInButton = document.getElementById('google-signin-button');
    const authStatus = document.getElementById('auth-status');
    if (googleSignInButton) {
      googleSignInButton.disabled = false;
      googleSignInButton.style.cursor = 'pointer';
      googleSignInButton.style.opacity = '1';
      googleSignInButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign in with Google';
      googleSignInButton.addEventListener('click', async () => {
        try {
          googleSignInButton.disabled = true;
          googleSignInButton.textContent = 'Signing in...';
          if (authStatus) { authStatus.style.display = 'block'; authStatus.textContent = 'Opening Google sign-in...'; }
          chrome.identity.getAuthToken({ interactive: true }, async (token) => {
            try {
              if (chrome.runtime.lastError || !token) throw new Error(chrome.runtime.lastError?.message || 'No token');
              const user = await verifyGoogleToken(token);
              currentUser = user;
              saveUserToStorage(user);
              setTimeout(closeGoogleOAuthErrorTabs, 800);
              showMainInterface(user);
              subscriptionManager.getSubscriptionStatus(true).catch(() => {}).then(() => { if (typeof loadPremiumTab === 'function') loadPremiumTab(); });
            } catch (err) {
              console.error('Sign-in error:', err);
              googleSignInButton.disabled = false;
              googleSignInButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign in with Google';
              if (authStatus) { authStatus.style.display = 'block'; authStatus.style.color = '#FF3B30'; authStatus.textContent = 'Sign-in failed: ' + (err.message || 'Unknown error'); }
            }
          });
        } catch (e) {
          googleSignInButton.disabled = false;
          if (authStatus) { authStatus.style.display = 'block'; authStatus.style.color = '#FF3B30'; authStatus.textContent = 'Sign-in failed.'; }
        }
      });
    }
    const forceSignOutButton = document.getElementById('force-signout');
    if (forceSignOutButton) {
      forceSignOutButton.addEventListener('click', () => {
        currentUser = null;
        clearFirebaseUserFromStorage();
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (token) chrome.identity.removeCachedAuthToken({ token }, () => {});
        });
        forceSignOutButton.textContent = 'Signed Out!';
        setTimeout(() => { forceSignOutButton.textContent = 'Force Sign Out'; }, 2000);
        showLoginSection();
      });
    }

    const restored = await tryRestoreSession();
    if (restored && currentUser) {
      showMainInterface(currentUser);
      subscriptionManager.getSubscriptionStatus(true).catch(() => {}).then(() => { if (typeof loadPremiumTab === 'function') loadPremiumTab(); });
    } else {
      showLoginSection();
    }
  }

  let authSetupDone = false;
  function runSetupOnce() {
    if (authSetupDone) return;
    authSetupDone = true;
    setupBackendAuth();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runSetupOnce);
  } else {
    runSetupOnce();
  }

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
          const usage = result[this.STORAGE_DAILY_USAGE] || {
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
          const usage = result[this.STORAGE_WEEKLY_USAGE] || {
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
      const weekStart = new Date(now.setDate(diff));
      return weekStart.toDateString();
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
      const limit = this.FREE_TIER_LIMITS[feature];

      const withinLimit = usage[feature] < limit;
      const remaining = Math.max(0, limit - usage[feature]);

      return {
        allowed: withinLimit,
        isPremium: false,
        current: usage[feature],
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

  // Inline subscription manager functions (BACKEND_API_URL from config.js when loaded in popup)
  const subscriptionManager = {
    PAYMENT_SERVER_URL: typeof BACKEND_API_URL !== 'undefined' ? BACKEND_API_URL : 'https://api-clyep56cdq-uc.a.run.app',
    STORAGE_USER_ID: 'userId',
    STORAGE_SUBSCRIPTION_STATUS: 'subscriptionStatus',
    STORAGE_SUBSCRIPTION_CACHE: 'subscriptionCache',
    CACHE_DURATION: 10 * 60 * 1000, // 10 minutes (increased to reduce API calls)
    
    // Check if payment server is reachable
    checkServerHealth: async function() {
      try {
        const response = await fetch(`${this.PAYMENT_SERVER_URL}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        return response.ok;
      } catch (error) {
        console.warn('[Subscription] Server health check failed:', error);
        return false;
      }
    },
    
    // Request throttling and debouncing
    _pendingRequest: null,
    _lastRequestTime: 0,
    _minRequestInterval: 2000, // Minimum 2 seconds between requests
    _errorBackoff: 0, // Exponential backoff delay
    _maxBackoff: 60000, // Max 60 seconds backoff
    _consecutiveErrors: 0,
    _maxConsecutiveErrors: 5, // Stop retrying after 5 consecutive errors

    getUserId: function() {
      return new Promise((resolve) => {
        // 1. Signed-in user (currentUser or stored pa_firebase_user)
        if (currentUser && currentUser.uid) {
          resolve(currentUser.uid);
          return;
        }
        chrome.storage.local.get([STORAGE_FIREBASE_USER], (result) => {
          const stored = result[STORAGE_FIREBASE_USER];
          if (stored && stored.uid) {
            resolve(stored.uid);
            return;
          }
          // 2. Fallback to local storage (guest usage tracking)
          chrome.storage.local.get([this.STORAGE_USER_ID], (result2) => {
            if (result2[this.STORAGE_USER_ID]) {
              resolve(result2[this.STORAGE_USER_ID]);
            } else {
              const userId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              chrome.storage.local.set({ [this.STORAGE_USER_ID]: userId }, () => {
                resolve(userId);
              });
            }
          });
        });
      });
    },

    getSubscriptionStatus: async function(forceRefresh = false) {
      try {
        // If we have too many errors, don't make new requests even for force refresh
        // unless enough time has passed
        if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
          const timeSinceLastError = Date.now() - this._lastRequestTime;
          if (timeSinceLastError < this._errorBackoff) {
            // Still in backoff period, return cached/default
            return new Promise((resolve) => {
              chrome.storage.local.get([this.STORAGE_SUBSCRIPTION_CACHE], (result) => {
                const cached = result[this.STORAGE_SUBSCRIPTION_CACHE];
                if (cached && cached.status) {
                  resolve(cached.status);
                } else {
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
            // Backoff period expired, reset and allow retry
            this._consecutiveErrors = Math.max(0, this._consecutiveErrors - 1);
            this._errorBackoff = Math.max(0, this._errorBackoff / 2);
          }
        }

        // Check cache first
        if (!forceRefresh) {
          return new Promise((resolve) => {
            chrome.storage.local.get([this.STORAGE_SUBSCRIPTION_CACHE], async (result) => {
              const cached = result[this.STORAGE_SUBSCRIPTION_CACHE];
              if (cached && cached.expiresAt > Date.now()) {
                resolve(cached.status);
                return;
              }

              // Cache expired, fetch from server with throttling
              try {
                const status = await this._throttledFetchSubscriptionStatus();
                resolve(status);
              } catch (error) {
                // Error already handled by throttling logic, just return default
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
          // Force refresh with throttling
          return await this._throttledFetchSubscriptionStatus();
        }
      } catch (error) {
        // Error already handled by throttling logic, just return default
        return {
          active: false,
          plan: null,
          status: 'inactive',
          expiresAt: null
        };
      }
    },

    _throttledFetchSubscriptionStatus: async function() {
      // If we have too many consecutive errors, return cached/default status immediately
      if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
        console.warn(`Too many consecutive errors (${this._consecutiveErrors}), using cached/default status. Will retry after ${Math.round(this._errorBackoff / 1000)}s`);
        return new Promise((resolve) => {
          chrome.storage.local.get([this.STORAGE_SUBSCRIPTION_CACHE], (result) => {
            const cached = result[this.STORAGE_SUBSCRIPTION_CACHE];
            if (cached && cached.status) {
              resolve(cached.status);
            } else {
              resolve({
                active: false,
                plan: null,
                status: 'inactive',
                expiresAt: null
              });
            }
          });
        });
      }

      // If there's a pending request, return it
      if (this._pendingRequest) {
        return this._pendingRequest;
      }

      // Check if we need to wait due to rate limiting or backoff
      const now = Date.now();
      const timeSinceLastRequest = now - this._lastRequestTime;
      const waitTime = Math.max(
        this._minRequestInterval - timeSinceLastRequest,
        this._errorBackoff
      );

      if (waitTime > 0 && this._errorBackoff > 0) {
        console.log(`Waiting ${Math.round(waitTime / 1000)}s before retry (backoff: ${Math.round(this._errorBackoff / 1000)}s)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else if (waitTime > 0) {
        // Only log rate limiting, not backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Create the request promise
      this._pendingRequest = this.fetchSubscriptionStatus()
        .then((status) => {
          // Success - reset error counters
          this._consecutiveErrors = 0;
          this._errorBackoff = 0;
          this._lastRequestTime = Date.now();
          this._pendingRequest = null;
          return status;
        })
        .catch((error) => {
          // Error - increment backoff
          this._consecutiveErrors++;
          this._errorBackoff = Math.min(
            Math.pow(2, this._consecutiveErrors) * 1000, // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
            this._maxBackoff
          );
          this._lastRequestTime = Date.now();
          this._pendingRequest = null;
          // Return default status instead of throwing to prevent uncaught errors
          // Only log if we haven't hit max errors yet (to reduce console spam)
          if (this._consecutiveErrors < this._maxConsecutiveErrors) {
            console.warn(`Subscription status fetch failed (${this._consecutiveErrors}/${this._maxConsecutiveErrors} errors). Backoff: ${Math.round(this._errorBackoff / 1000)}s`);
          }
          return {
            active: false,
            plan: null,
            status: 'inactive',
            expiresAt: null
          };
        });

      return this._pendingRequest;
    },

    fetchSubscriptionStatus: async function() {
      const userId = await this.getUserId();

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(`${this.PAYMENT_SERVER_URL}/subscription-status/${userId}`, {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Throw error so it can be caught by throttling logic
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
        clearTimeout(timeoutId);
        // Re-throw error so throttling logic can handle it
        throw error;
      }
    },

    createCheckoutSession: async function(priceId, successUrl, cancelUrl) {
      try {
        const userId = await this.getUserId();
        
        if (!userId) {
          throw new Error('Unable to get user ID. Please try refreshing the extension.');
        }
        
        if (!priceId) {
          throw new Error('Price ID is missing. Please contact support.');
        }
        
        const requestBody = {
          userId: userId,
          priceId: priceId,
          successUrl: successUrl,
          cancelUrl: cancelUrl,
        };
        
        console.log('[Subscription] Creating checkout session:', {
          url: `${this.PAYMENT_SERVER_URL}/create-checkout-session`,
          userId: userId,
          priceId: priceId
        });
        
        const response = await fetch(`${this.PAYMENT_SERVER_URL}/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
          let errorMessage = `Server error (${response.status})`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            // If response isn't JSON, use status text
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.url) {
          throw new Error('Invalid response from server: missing checkout URL');
        }
        
        return data;
      } catch (error) {
        console.error('[Subscription] Error creating checkout session:', error);
        // Re-throw with more context
        if (error.message.includes('fetch')) {
          throw new Error('Unable to connect to payment server. Please check your internet connection.');
        }
        throw error;
      }
    },

    openCheckout: async function(priceId) {
      try {
        const successUrl = chrome.runtime.getURL('popup-extension.html?payment=success');
        const cancelUrl = chrome.runtime.getURL('popup-extension.html?payment=canceled');
        
        const session = await this.createCheckoutSession(priceId, successUrl, cancelUrl);
        
        // Open Stripe Checkout in a new tab
        chrome.tabs.create({ url: session.url });
        
        return session;
      } catch (error) {
        console.error('Error opening checkout:', error);
        throw error;
      }
    },

    openCustomerPortal: async function() {
      const portalLoginUrl = typeof window !== 'undefined' && window.STRIPE_CUSTOMER_PORTAL_URL
        ? window.STRIPE_CUSTOMER_PORTAL_URL
        : 'https://billing.stripe.com/p/login/bJe28racM6RSgzC1cT7AI00';
      try {
        const userId = await this.getUserId();
        const returnUrl = chrome.runtime.getURL('popup-extension.html');
        
        // Check if we have a customerId in storage first
        const result = await new Promise(resolve => {
          chrome.storage.local.get([this.STORAGE_SUBSCRIPTION_STATUS], resolve);
        });
        
        const status = result[this.STORAGE_SUBSCRIPTION_STATUS];
        
        const response = await fetch(`${this.PAYMENT_SERVER_URL}/create-portal-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
            returnUrl: returnUrl,
            customerId: status?.customerId || null // The backend should handle mapping if null
          }),
        });
        
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || 'Failed to create portal session');
        }
        
        const data = await response.json();
        if (data.url) {
          chrome.tabs.create({ url: data.url });
          return data;
        }
        throw new Error('No portal URL returned');
      } catch (error) {
        console.error('Error opening customer portal:', error);
        // Fallback: open Stripe customer portal login so user can manage subscription with their email
        chrome.tabs.create({ url: portalLoginUrl });
        throw error;
      }
    },

    clearSubscriptionCache: function() {
      chrome.storage.local.remove([this.STORAGE_SUBSCRIPTION_CACHE, this.STORAGE_SUBSCRIPTION_STATUS], () => {
        this._consecutiveErrors = 0;
        this._errorBackoff = 0;
        this.getSubscriptionStatus(true).catch(() => {});
      });
    },

    resetErrorState: function() {
      this._consecutiveErrors = 0;
      this._errorBackoff = 0;
      this._pendingRequest = null;
    }
  };

  // Set up subscription checker for usage tracker
  const hasActiveSubscription = async () => {
    const status = await subscriptionManager.getSubscriptionStatus();
    return status.active === true && status.status === 'active';
  };
  usageTracker.setSubscriptionChecker(hasActiveSubscription);

  // Storage key for Gemini API key
  const STORAGE_GEMINI_API_KEY = 'userGeminiApiKey';
  const STORAGE_ENHANCEMENT_MODE = 'popupEnhancementMode'; // Separate from injected button mode
  const STORAGE_PROMPT_INPUT = 'savedPromptInput';
  const STORAGE_ASK_INPUT = 'savedAskInput';
  const STORAGE_ENHANCED_RESULT = 'savedEnhancedResult';
  const STORAGE_ASK_RESULT = 'savedAskResult';
  const STORAGE_ENHANCE_QUESTION_TOGGLE = 'enhanceQuestionToggle';
  const STORAGE_INJECT_BUTTON_ENABLED = 'injectButtonEnabled';
  const STORAGE_ZOOM_LEVEL = 'popupZoomLevel';
  const STORAGE_SHOW_STYLE_SELECTOR = 'showStyleSelector';
  
  // Gemini API configuration
  const GEMINI_CONFIG = {
    name: 'Google Gemini',
    placeholder: 'AIza... (paste your key here)',
    helpUrl: 'https://aistudio.google.com/api-keys',
    keyPrefix: 'AIza',
    model: 'gemma-3-4b-it'
  };

  // Ensure sections are handled by auth state
  // (Declarations moved to top)
  
  // Hide all sections initially (will be shown by showLoginSection or showMainInterface)
  [enhanceTab, askTab, recentTab, premiumTab, setupTab, loginSection].forEach(section => {
    if (section) {
      section.style.display = 'none';
      section.classList.remove('active');
    }
  });
  if (tabsContainer) tabsContainer.style.display = 'none';

  function hideInitialLoader() {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 300);
    }
  }

  // Tab Management
  const tabButtons = document.querySelectorAll('.tab-button');

  tabButtons.forEach(button => {
    if (!button) return;
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tab = button.dataset.tab;
      
      if (!tab) {
        console.error('[Prompt Architect] Tab button missing data-tab attribute');
        return;
      }
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show/hide header badge only on Pro tab (look up each time so it works regardless of load order)
      const goProEl = document.getElementById('go-pro-header');
      if (goProEl) goProEl.style.display = (tab === 'premium') ? 'block' : 'none';

      if (tab === 'enhance') {
        enhanceTab.classList.add('active');
        enhanceTab.style.display = 'flex';
        enhanceTab.style.flexDirection = 'column';
        enhanceTab.style.gap = '16px';
        if (askTab) { askTab.classList.remove('active'); askTab.style.display = 'none'; }
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
        if (premiumTab) { premiumTab.classList.remove('active'); premiumTab.style.display = 'none'; }
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
        updateUsageIndicator(); // Update usage display when enhance tab opens
        // Load styles for current mode when enhance tab opens
        if (selectedMode) {
          currentMode = selectedMode;
          if (typeof loadStylesForMode === 'function') {
            loadStylesForMode(selectedMode);
          }
        }
      } else if (tab === 'ask') {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        if (askTab) {
          askTab.classList.add('active');
          askTab.style.display = 'flex';
          askTab.style.flexDirection = 'column';
          askTab.style.gap = '16px';
          updateAskUsageIndicator();
        }
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
        if (premiumTab) { premiumTab.classList.remove('active'); premiumTab.style.display = 'none'; }
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
      } else if (tab === 'recent') {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        if (askTab) {
          askTab.classList.remove('active');
          askTab.style.display = 'none';
        }
        recentTab.classList.add('active');
        recentTab.style.display = 'flex';
        recentTab.style.flexDirection = 'column';
        recentTab.style.gap = '16px';
        recentTab.style.overflowY = 'auto';
        recentTab.style.maxHeight = '400px';
        if (premiumTab) {
          premiumTab.classList.remove('active');
          premiumTab.style.display = 'none';
        }
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
        loadHistory(); // Load history when tab is opened
      } else if (tab === 'premium') {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        if (askTab) {
          askTab.classList.remove('active');
          askTab.style.display = 'none';
        }
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
        if (premiumTab) {
          premiumTab.classList.add('active');
          premiumTab.style.display = 'flex';
          premiumTab.style.flexDirection = 'column';
          premiumTab.style.gap = '16px';
          premiumTab.style.overflowY = 'auto';
          premiumTab.style.maxHeight = '400px';
        }
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
        loadPremiumTab(); // Load premium tab content
      } else {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        if (askTab) {
          askTab.classList.remove('active');
          askTab.style.display = 'none';
        }
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
        if (premiumTab) {
          premiumTab.classList.remove('active');
          premiumTab.style.display = 'none';
        }
        setupTab.classList.add('active');
        setupTab.style.display = 'flex';
        setupTab.style.flexDirection = 'column';
        setupTab.style.gap = '16px';
        setupTab.style.overflowY = 'auto';
        setupTab.style.maxHeight = '400px';
        // Load advanced settings when setup tab opens (if function exists)
        if (typeof loadAdvancedSettings === 'function') {
          try {
            loadAdvancedSettings();
          } catch (error) {
            console.warn('Error loading advanced settings:', error);
          }
        }
      }
    });
  });

  // Setup View Elements (removed - no longer needed)

  // Enhance View Elements
  const promptInput = document.getElementById('prompt-input');
  const modeOptions = document.querySelectorAll('.mode-option');
  
  // No auto-save - start fresh each time popup opens
  const enhanceButton = document.getElementById('enhance-button');
  const enhanceButtonText = document.getElementById('enhance-button-text');
  const enhanceSpinner = document.getElementById('enhance-spinner');
  const statusMessage = document.getElementById('status-message');
  const resultContainer = document.getElementById('result-container');
  const resultText = document.getElementById('result-text');
  const copyButton = document.getElementById('copy-button');

  /**
   * Format enhanced prompt for display: escape HTML, then **bold**, numbered lists, * bullets, spacing.
   * @param {string} raw - Raw enhanced text (may contain markdown-like ** and lists)
   * @returns {string} HTML safe for innerHTML
   */
  function formatEnhancedPromptForDisplay(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    let out = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|\n)(\s*)[*\-](\s+)/gm, '$1$2\u2022$3');
    out = out.replace(/\n/g, '<br>');
    return out;
  }

  /**
   * Set refined prompt content: formatted HTML and store raw for copy.
   */
  function setRefinedPromptContent(element, rawText) {
    if (!element) return;
    element.classList.add('result-text-formatted');
    element.dataset.rawText = rawText;
    element.innerHTML = formatEnhancedPromptForDisplay(rawText);
  }

  /**
   * Clear formatted state (e.g. when starting a new enhancement).
   */
  function clearRefinedPromptFormat(element) {
    if (!element) return;
    element.classList.remove('result-text-formatted');
    delete element.dataset.rawText;
  }

  // Verify all elements exist
  if (!promptInput || !enhanceButton) {
    console.error('[Prompt Architect] Critical elements missing in popup');
  }

  // ============================================================================
  // SMART MODE DETECTION - REMOVED
  // Users now manually select their desired mode by clicking the mode buttons
  // ============================================================================

  /**
   * Display a status message.
   */
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type} show`;
    setTimeout(() => {
      statusMessage.classList.remove('show');
    }, 4000);
  }

  // No provider/model selection needed - always use Gemini 2.5 Flash Lite

  /**
   * Updates the UI to reflect whether the key is saved or needs to be entered.
   */
  function updateUIState(key) {
      // Always show the input form
      const setupCard = document.querySelector('#setup-section .glass-card:first-child');
      if (setupCard) {
          setupCard.style.display = 'block';
      }
  }
  
  /**
   * API key notice removed - using backend proxy
   */
  
  // Setup CTA button removed - no longer needed
  
  // API key notice link removed - using backend proxy

  /**
   * API key management removed - using backend proxy
   */
  
  // Enhance setup button removed - no longer needed

  /**
   * API key saving removed - using backend proxy
   */


  /**
   * Mode Selection
   */
  let selectedMode = 'TEXT_ENHANCEMENT';
  
  // Load saved mode and style on popup open
  chrome.storage.local.get([STORAGE_ENHANCEMENT_MODE], async (result) => {
    const savedMode = result[STORAGE_ENHANCEMENT_MODE] || 'TEXT_ENHANCEMENT';
    updateSelectedMode(savedMode);
    
    // Load custom styles list
    if (typeof loadCustomStylesList === 'function') {
      await loadCustomStylesList();
    }
  });
  
  /**
   * Updates the selected mode in UI and storage
   * @param {string} mode - The mode to select
   */
  function updateSelectedMode(mode) {
    // Remove active class from all options
    modeOptions.forEach(opt => {
      opt.classList.remove('active');
    });
    
    const targetOption = Array.from(modeOptions).find(opt => opt.dataset.mode === mode);
    if (targetOption) {
      targetOption.classList.add('active');
      selectedMode = mode;
      currentMode = mode;
      
      // Save to storage
      chrome.storage.local.set({ [STORAGE_ENHANCEMENT_MODE]: selectedMode }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving enhancement mode:', chrome.runtime.lastError);
        }
      });
      
      // Load styles for the new mode
      loadStylesForMode(mode);
    } else {
      // Fallback if UI not found
      selectedMode = mode;
      currentMode = mode;
      chrome.storage.local.set({ [STORAGE_ENHANCEMENT_MODE]: selectedMode }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving enhancement mode:', chrome.runtime.lastError);
        }
      });
    }
  }
  
  // Handle mode selection
  modeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const newMode = option.dataset.mode;
      updateSelectedMode(newMode);
    });
  });

  // ============================================================================
  // STYLE MANAGEMENT
  // ============================================================================

  const styleSelectorButton = document.getElementById('style-selector-button');
  const styleSelectorValue = document.getElementById('style-selector-value');
  const styleSelectorDropdown = document.getElementById('style-selector-dropdown');
  const styleSelectorOptions = document.getElementById('style-selector-options');
  const customStylesList = document.getElementById('custom-styles-list');
  const addCustomStyleButton = document.getElementById('add-custom-style-button');

  // Template options for each mode
  const TEMPLATE_OPTIONS = {
    TEXT_ENHANCEMENT: ['default', 'expert', 'concise', 'detailed', 'creative', 'technical'],
    CODE_ENHANCEMENT: ['default', 'minimal', 'comprehensive', 'production-ready', 'cursor'],
    IMAGE_ENHANCEMENT: ['default', 'minimal', 'detailed', 'cinematic'],
    VIDEO_ENHANCEMENT: ['default', 'concise', 'cinematic', 'ad']
  };

  let currentTemplates = {};
  let currentMode = 'TEXT_ENHANCEMENT';

  /**
   * Loads and populates styles for the current mode
   */
  async function loadStylesForMode(mode) {
    if (!styleSelectorOptions) return;

    // Ensure we're loading styles for a valid mode
    if (!TEMPLATE_OPTIONS[mode]) {
      console.warn(`No templates defined for mode: ${mode}`);
      return;
    }

    // Clear existing options
    styleSelectorOptions.innerHTML = '';

    try {
      // Load templates for THIS specific mode only
      const templates = TEMPLATE_OPTIONS[mode] || ['default'];
      templates.forEach(template => {
        const option = document.createElement('div');
        option.className = 'style-selector-option';
        option.dataset.value = template === 'default' ? 'default' : `template:${template}`;
        option.innerHTML = `
          <span>${template === 'default' ? 'Default' : template.charAt(0).toUpperCase() + template.slice(1)}</span>
          <svg class="style-selector-option-check" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.6667 3.5L5.25 9.91667L2.33334 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        styleSelectorOptions.appendChild(option);
      });

      // Load custom styles for THIS specific mode only
      const response = await chrome.runtime.sendMessage({
        action: 'getNamedCustomStyles',
        enhancementType: mode
      });

      if (response.success && response.styles) {
        Object.keys(response.styles).forEach(styleName => {
          const option = document.createElement('div');
          option.className = 'style-selector-option';
          option.dataset.value = `custom:${styleName}`;
          option.innerHTML = `
            <span>★ ${styleName}</span>
            <svg class="style-selector-option-check" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.6667 3.5L5.25 9.91667L2.33334 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
          styleSelectorOptions.appendChild(option);
        });
      }

      // Add Customize option
      const customizeOption = document.createElement('div');
      customizeOption.className = 'style-selector-option customize';
      customizeOption.dataset.value = 'customize';
      customizeOption.innerHTML = '<span>Customize...</span>';
      styleSelectorOptions.appendChild(customizeOption);

      // Load active style for THIS mode
      const activeResponse = await chrome.runtime.sendMessage({
        action: 'getActiveStyle',
        enhancementType: mode
      });

      let activeStyleKey = 'default';
      if (activeResponse && activeResponse.success && activeResponse.styleKey) {
        const styleKey = activeResponse.styleKey;
        
        // If it's a custom style, verify it still exists
        if (styleKey.startsWith('custom:')) {
          const styleName = styleKey.replace('custom:', '');
          const stylesResponse = await chrome.runtime.sendMessage({
            action: 'getNamedCustomStyles',
            enhancementType: mode
          });
          
          if (stylesResponse && stylesResponse.success && stylesResponse.styles && stylesResponse.styles[styleName]) {
            activeStyleKey = styleKey;
            console.log(`Loaded active custom style "${styleName}" for ${mode}`);
          } else {
            // Custom style no longer exists, reset to default
            console.warn(`Custom style "${styleName}" not found, resetting to default`);
            activeStyleKey = 'default';
            // Update storage to reflect default
            await chrome.runtime.sendMessage({
              action: 'setActiveStyle',
              enhancementType: mode,
              styleKey: 'default'
            });
          }
        } else {
          // Template or default style - verify it exists in templates for this mode
          const templateName = styleKey.replace('template:', '');
          if (templates.includes(templateName) || styleKey === 'default') {
            activeStyleKey = styleKey;
            console.log(`Loaded active style "${styleKey}" for ${mode}`);
          } else {
            // Template doesn't exist for this mode, reset to default
            console.warn(`Template "${templateName}" not found for ${mode}, resetting to default`);
            activeStyleKey = 'default';
            await chrome.runtime.sendMessage({
              action: 'setActiveStyle',
              enhancementType: mode,
              styleKey: 'default'
            });
          }
        }
      } else {
        console.log(`No active style found for ${mode}, using default`);
      }

      // Update UI to show active style
      updateStyleSelectorValue(activeStyleKey);
      setActiveStyleOption(activeStyleKey);
    } catch (error) {
      console.error('Error loading styles:', error);
    }
  }

  /**
   * Updates the style selector button value display
   */
  function updateStyleSelectorValue(styleKey) {
    if (!styleSelectorValue) return;
    
    let displayText = 'Default';
    if (styleKey === 'default') {
      displayText = 'Default';
    } else if (styleKey.startsWith('template:')) {
      const template = styleKey.replace('template:', '');
      displayText = template === 'casual' ? 'Default' : template.charAt(0).toUpperCase() + template.slice(1);
    } else if (styleKey.startsWith('custom:')) {
      const styleName = styleKey.replace('custom:', '');
      displayText = `★ ${styleName}`;
    }
    
    styleSelectorValue.textContent = displayText;
  }

  /**
   * Sets the active style option in the dropdown
   */
  function setActiveStyleOption(styleKey) {
    if (!styleSelectorOptions) return;
    
    const options = styleSelectorOptions.querySelectorAll('.style-selector-option');
    options.forEach(option => {
      if (option.dataset.value === styleKey) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
  }

  /**
   * Toggles the style selector dropdown
   */
  function toggleStyleDropdown() {
    if (!styleSelectorDropdown || !styleSelectorButton) return;
    
    const isOpen = styleSelectorDropdown.classList.contains('show');
    if (isOpen) {
      styleSelectorDropdown.classList.remove('show');
      styleSelectorButton.classList.remove('active');
    } else {
      styleSelectorDropdown.classList.add('show');
      styleSelectorButton.classList.add('active');
    }
  }

  /**
   * Closes the style selector dropdown
   */
  function closeStyleDropdown() {
    if (styleSelectorDropdown) {
      styleSelectorDropdown.classList.remove('show');
    }
    if (styleSelectorButton) {
      styleSelectorButton.classList.remove('active');
    }
  }

  /**
   * Handles style selection
   */
  if (styleSelectorButton && styleSelectorOptions) {
    // Toggle dropdown on button click
    styleSelectorButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStyleDropdown();
    });

    // Handle option clicks
    styleSelectorOptions.addEventListener('click', async (e) => {
      const option = e.target.closest('.style-selector-option');
      if (!option) return;

      const styleKey = option.dataset.value;
      
      // Handle customize option
      if (styleKey === 'customize') {
        closeStyleDropdown();
        // Open customize modal
        showCustomStyleModal(selectedMode);
        return;
      }

      const currentMode = selectedMode; // Capture current mode
      
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'setActiveStyle',
          enhancementType: currentMode,
          styleKey: styleKey
        });
        
        if (response && response.success) {
          // Update UI
          updateStyleSelectorValue(styleKey);
          setActiveStyleOption(styleKey);
          closeStyleDropdown();
          
          // Verify it was saved by reading it back
          const verifyResponse = await chrome.runtime.sendMessage({
            action: 'getActiveStyle',
            enhancementType: currentMode
          });
          
          if (verifyResponse && verifyResponse.success && verifyResponse.styleKey === styleKey) {
            console.log(`Style "${styleKey}" successfully saved and verified for ${currentMode}`);
          } else {
            console.warn('Style may not have been saved correctly');
          }
        } else {
          console.error('Failed to save style:', response?.error);
        }
      } catch (error) {
        console.error('Error setting active style:', error);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (styleSelectorContainer && !styleSelectorContainer.contains(e.target)) {
        closeStyleDropdown();
      }
    });
  }

  // Dropdown stays open when scrolling - only closes on click outside or option selection

  /**
   * Shows modal for adding/editing custom style
   */
  function showCustomStyleModal(mode, styleName = null, instruction = '') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">${styleName ? 'Edit' : 'Add'} Custom Style</h3>
          <p class="modal-subtitle">Create a custom enhancement style for ${mode.replace('_ENHANCEMENT', '').toLowerCase()} mode</p>
        </div>
        <div class="form-group">
          <label class="form-label">Style Name</label>
          <input type="text" id="style-name-input" class="premium-input" value="${styleName || ''}" placeholder="e.g., Marketing Copy, Technical Docs">
        </div>
        <div class="form-group">
          <label class="form-label">Custom Instruction</label>
          <textarea id="style-instruction-input" class="premium-textarea" rows="8" placeholder="Enter your custom enhancement instruction...">${instruction}</textarea>
        </div>
        <div class="modal-actions">
          <button id="cancel-style-button" class="premium-button-secondary">Cancel</button>
          <button id="save-style-button" class="premium-button">${styleName ? 'Update' : 'Save'} Style</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const saveButton = modal.querySelector('#save-style-button');
    const cancelButton = modal.querySelector('#cancel-style-button');
    const nameInput = modal.querySelector('#style-name-input');
    const instructionInput = modal.querySelector('#style-instruction-input');

    cancelButton.addEventListener('click', () => {
      modal.remove();
    });

    saveButton.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const instruction = instructionInput.value.trim();

      if (!name || !instruction) {
        alert('Please fill in both style name and instruction.');
        return;
      }

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'saveNamedCustomStyle',
          enhancementType: mode,
          styleName: name,
          instruction: instruction
        });

        if (response.success) {
          modal.remove();
          closeStyleDropdown();
          loadStylesForMode(mode);
          loadCustomStylesList();
          
          // Show subtle feedback
          saveButton.style.background = 'var(--primary-blue)';
          setTimeout(() => {
            saveButton.style.background = '';
          }, 300);
        } else {
          alert('Error saving style: ' + (response.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error saving style:', error);
        alert('Error saving style. Please try again.');
      }
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Loads and displays custom styles list
   */
  async function loadCustomStylesList() {
    if (!customStylesList) return;

    customStylesList.innerHTML = '';

    const modes = ['TEXT_ENHANCEMENT', 'CODE_ENHANCEMENT', 'IMAGE_ENHANCEMENT', 'VIDEO_ENHANCEMENT'];
    
    for (const mode of modes) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getNamedCustomStyles',
          enhancementType: mode
        });

        if (response.success && response.styles) {
          Object.entries(response.styles).forEach(([styleName, instruction]) => {
            const item = document.createElement('div');
            item.className = 'custom-style-item';
            const safeName = escapeHtml(styleName);
            item.innerHTML = `
              <div>
                <div class="custom-style-name">${safeName}</div>
                <div class="custom-style-mode">${mode.replace('_ENHANCEMENT', '').replace('_', ' ')}</div>
              </div>
              <div class="custom-style-actions">
                <button class="premium-button-secondary edit-style-btn" data-mode="${escapeHtml(mode)}" data-name="${safeName}">Edit</button>
                <button class="premium-button-secondary delete-style-btn" data-mode="${escapeHtml(mode)}" data-name="${safeName}">Delete</button>
              </div>
            `;
            customStylesList.appendChild(item);
          });
        }
      } catch (error) {
        console.error('Error loading custom styles:', error);
      }
    }

    // Add event listeners for edit/delete buttons
    customStylesList.querySelectorAll('.edit-style-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        const styleName = btn.dataset.name;
        
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'getNamedCustomStyles',
            enhancementType: mode
          });

          if (response.success && response.styles && response.styles[styleName]) {
            showCustomStyleModal(mode, styleName, response.styles[styleName]);
          }
        } catch (error) {
          console.error('Error loading style for edit:', error);
        }
      });
    });

    customStylesList.querySelectorAll('.delete-style-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this custom style?')) {
          return;
        }

        const mode = btn.dataset.mode;
        const styleName = btn.dataset.name;

        try {
          const response = await chrome.runtime.sendMessage({
            action: 'deleteNamedCustomStyle',
            enhancementType: mode,
            styleName: styleName
          });

          if (response.success) {
            closeStyleDropdown();
            loadStylesForMode(selectedMode);
            loadCustomStylesList();
            
            // Show subtle feedback
            btn.style.borderColor = 'var(--primary-blue)';
            setTimeout(() => {
              btn.style.borderColor = '';
            }, 300);
          } else {
            alert('Error deleting style: ' + (response.error || 'Unknown error'));
          }
        } catch (error) {
          console.error('Error deleting style:', error);
          alert('Error deleting style. Please try again.');
        }
      });
    });
  }

  // Customize button is now integrated into the dropdown menu

  // Handle add custom style button
  if (addCustomStyleButton) {
    addCustomStyleButton.addEventListener('click', () => {
      showCustomStyleModal(selectedMode);
    });
  }

  // Styles will be loaded after mode is loaded from storage (see storage callback above)
  // This ensures the correct mode is set before loading styles
  // Fallback: Load styles after a short delay to ensure storage callback has run
  setTimeout(() => {
    if (typeof loadStylesForMode === 'function' && selectedMode) {
      loadStylesForMode(selectedMode);
    }
    if (typeof loadCustomStylesList === 'function') {
      loadCustomStylesList();
    }
  }, 100);
  
  // Smart mode detection has been removed - users manually select their mode

  /**
   * Copy to Clipboard
   */
  copyButton.addEventListener('click', async () => {
    const text = (resultText && (resultText.dataset.rawText != null ? resultText.dataset.rawText : resultText.textContent)) || '';
    try {
      await navigator.clipboard.writeText(text);
      const originalText = copyButton.textContent;
      copyButton.textContent = 'Copied!';
      copyButton.style.background = 'rgba(52, 199, 89, 0.1)';
      copyButton.style.color = '#30D158';
      copyButton.style.borderColor = 'rgba(52, 199, 89, 0.2)';
      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.style.background = 'rgba(0, 122, 255, 0.1)';
        copyButton.style.color = '#007AFF';
        copyButton.style.borderColor = 'rgba(0, 122, 255, 0.2)';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showStatus('Failed to copy to clipboard.', 'error');
    }
  });



  // Connect port for streaming enhanced prompt (so background can push chunks)
  let enhanceStreamPort = null;
  let streamingInProgress = false;
  let streamTimeoutId = null;
  const STREAM_TIMEOUT_MS = 70000;

  function clearStreamTimeout() {
    if (streamTimeoutId) {
      clearTimeout(streamTimeoutId);
      streamTimeoutId = null;
    }
  }

  function resetStreamingUI() {
    streamingInProgress = false;
    enhanceButton.disabled = false;
    if (enhanceButtonText) enhanceButtonText.style.display = 'inline';
    if (enhanceSpinner) enhanceSpinner.classList.remove('show');
  }

  const connectEnhanceStreamPort = () => {
    if (enhanceStreamPort) return;
    enhanceStreamPort = chrome.runtime.connect({ name: 'enhanceStream' });
    enhanceStreamPort.onMessage.addListener((msg) => {
      if (!streamingInProgress) return;
      if (msg.chunk && resultText) {
        resultText.textContent = (resultText.textContent || '') + msg.chunk;
        if (resultContainer) resultContainer.classList.add('show');
      }
      if (msg.done) {
        clearStreamTimeout();
        if (msg.fullText != null && resultText) setRefinedPromptContent(resultText, msg.fullText);
        resetStreamingUI();
        showStatus('Prompt enhanced successfully!', 'success');
      }
      if (msg.error) {
        clearStreamTimeout();
        resetStreamingUI();
        showStatus(msg.error, 'error');
        if (resultContainer) resultContainer.classList.remove('show');
      }
    });
    enhanceStreamPort.onDisconnect.addListener(() => {
      enhanceStreamPort = null;
      clearStreamTimeout();
      if (streamingInProgress) {
        resetStreamingUI();
        showStatus('Connection lost. Please try again.', 'error');
      }
    });
  };
  connectEnhanceStreamPort();

  /**
   * Handles prompt enhancement (streaming when possible).
   */
  if (enhanceButton && promptInput) {
    enhanceButton.addEventListener('click', async () => {
      const prompt = promptInput.value.trim();
      
      if (!prompt) {
        showStatus('Please enter a prompt to enhance.', 'error');
        return;
      }
      if (streamingInProgress) {
        showStatus('Enhancement in progress...', 'info');
        return;
      }

      // Disable button and show loading
      enhanceButton.disabled = true;
      if (enhanceButtonText) enhanceButtonText.style.display = 'none';
      if (enhanceSpinner) enhanceSpinner.classList.add('show');
      if (resultContainer) resultContainer.classList.remove('show');
      if (resultText) {
        clearRefinedPromptFormat(resultText);
        resultText.textContent = '';
      }

      try {
        // Ensure port is connected (popup may have been reopened)
        if (!enhanceStreamPort) connectEnhanceStreamPort();
        streamingInProgress = true;

        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'enhancePromptStream',
            prompt: prompt,
            enhancementType: selectedMode,
            provider: 'gemini'
          }, (r) => {
            if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
            else resolve(r);
          });
        });

        if (response?.error) {
          streamingInProgress = false;
          showStatus(response.error, 'error');
          enhanceButton.disabled = false;
          if (enhanceButtonText) enhanceButtonText.style.display = 'inline';
          if (enhanceSpinner) enhanceSpinner.classList.remove('show');
          return;
        }
        if (response?.ok !== true) {
          clearStreamTimeout();
          // Fallback to non-streaming if stream not available
          streamingInProgress = false;
          const timeoutMs = 45000;
          const fallbackResponse = await Promise.race([
            chrome.runtime.sendMessage({
              action: 'enhancePrompt',
              prompt: prompt,
              enhancementType: selectedMode,
              provider: 'gemini'
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Request timed out. The server may be slow or unavailable. Please try again.')), timeoutMs)
            )
          ]);
          if (chrome.runtime.lastError) {
            showStatus(`Error: ${chrome.runtime.lastError.message || 'Extension context invalidated.'}`, 'error');
          } else if (!fallbackResponse) {
            showStatus('Error: No response from background script.', 'error');
          } else {
            const enhancedPrompt = fallbackResponse?.enhancedPrompt || 'Error: Failed to receive enhanced prompt.';
            if (enhancedPrompt.startsWith('Error:')) {
              showStatus(enhancedPrompt.replace('Error: ', ''), 'error');
            } else {
              if (resultText) setRefinedPromptContent(resultText, enhancedPrompt);
              if (resultContainer) resultContainer.classList.add('show');
              showStatus('Prompt enhanced successfully!', 'success');
            }
          }
          enhanceButton.disabled = false;
          if (enhanceButtonText) enhanceButtonText.style.display = 'inline';
          if (enhanceSpinner) enhanceSpinner.classList.remove('show');
          return;
        }
        // Stream started; chunks and done/error will arrive via port. Safety timeout if backend never responds.
        clearStreamTimeout();
        streamTimeoutId = setTimeout(() => {
          streamTimeoutId = null;
          if (!streamingInProgress) return;
          resetStreamingUI();
          showStatus('Request timed out. The server may be slow or unavailable. Please try again.', 'error');
        }, STREAM_TIMEOUT_MS);
      } catch (error) {
        clearStreamTimeout();
        streamingInProgress = false;
        console.error('Enhancement error:', error);
        showStatus(`Error: ${error.message || 'Unknown error occurred.'}`, 'error');
        enhanceButton.disabled = false;
        if (enhanceButtonText) enhanceButtonText.style.display = 'inline';
        if (enhanceSpinner) enhanceSpinner.classList.remove('show');
      }
    });
  } else {
    console.error('[Prompt Architect] Enhance button or prompt input not found');
  }

  // ============================================================================
  // PROMPT HISTORY
  // ============================================================================
  
  const historyContainer = document.getElementById('history-container');
  const historyEmpty = document.getElementById('history-empty');
  
  /**
   * Formats timestamp to relative time (e.g., "2 hours ago")
   */
  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
  
  /**
   * Gets mode label from mode value
   */
  function getModeLabel(mode) {
    const modeMap = {
      'TEXT_ENHANCEMENT': 'Enhanced',
      'CODE_ENHANCEMENT': 'Code',
      'IMAGE_ENHANCEMENT': 'Image',
      'VIDEO_ENHANCEMENT': 'Video',
      'ASK_QUESTION': 'Ask'
    };
    return modeMap[mode] || 'Enhanced';
  }
  
  /**
   * Escapes HTML for safe display (avoids XSS)
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Creates a history item element
   */
  function createHistoryItem(entry) {
    const isAsk = entry.mode === 'ASK_QUESTION';
    const item = document.createElement('div');
    item.className = 'history-item' + (isAsk ? ' history-item-ask' : '');

    const originalPreview = entry.original.length > 120 ? entry.original.substring(0, 120) + '…' : entry.original;
    const enhancedPreview = entry.enhanced.length > 180 ? entry.enhanced.substring(0, 180) + '…' : entry.enhanced;

    const originalLabel = isAsk ? 'Question' : 'Original';
    const enhancedLabel = isAsk ? 'Answer' : 'Refined';
    const copyEnhancedLabel = isAsk ? 'Copy Answer' : 'Copy Enhanced';
    const copyOriginalLabel = isAsk ? 'Copy Question' : 'Copy Original';

    item.innerHTML = `
      <div class="history-item-header">
        <div class="history-item-meta">
          <span class="history-item-mode ${isAsk ? 'history-item-mode-ask' : ''}">${escapeHtml(getModeLabel(entry.mode))}</span>
          <span class="history-item-time">${escapeHtml(formatTimeAgo(entry.timestamp))}</span>
        </div>
      </div>
      <div class="history-item-original" title="${escapeHtml(entry.original)}">
        <strong>${escapeHtml(originalLabel)}</strong>
        <span class="history-item-original-text"></span>
      </div>
      <div class="history-item-enhanced" title="${escapeHtml(entry.enhanced)}">
        <div class="history-label">${escapeHtml(enhancedLabel)}</div>
        <span class="history-item-enhanced-text"></span>
      </div>
      <div class="history-item-actions">
        <button class="history-action-button" data-action="copy-enhanced" data-id="${escapeHtml(entry.id)}">${escapeHtml(copyEnhancedLabel)}</button>
        <button class="history-action-button secondary" data-action="copy-original" data-id="${escapeHtml(entry.id)}">${escapeHtml(copyOriginalLabel)}</button>
        ${!isAsk ? `<button class="history-action-button secondary" data-action="use-enhanced" data-id="${escapeHtml(entry.id)}">Use in Build</button>` : ''}
      </div>
    `;

    item.querySelector('.history-item-original-text').textContent = originalPreview;
    item.querySelector('.history-item-enhanced-text').textContent = enhancedPreview;

    // Add event listeners
    const copyEnhancedBtn = item.querySelector('[data-action="copy-enhanced"]');
    const copyOriginalBtn = item.querySelector('[data-action="copy-original"]');
    const useEnhancedBtn = item.querySelector('[data-action="use-enhanced"]');
    
    copyEnhancedBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(entry.enhanced);
        copyEnhancedBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyEnhancedBtn.textContent = copyEnhancedLabel;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showStatus('Failed to copy to clipboard.', 'error');
      }
    });
    
    copyOriginalBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(entry.original);
        copyOriginalBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyOriginalBtn.textContent = copyOriginalLabel;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showStatus('Failed to copy to clipboard.', 'error');
      }
    });
    
    if (useEnhancedBtn) {
      useEnhancedBtn.addEventListener('click', () => {
        const enhanceTabButton = document.querySelector('[data-tab="enhance"]');
        if (enhanceTabButton) {
          enhanceTabButton.click();
          const promptInput = document.getElementById('prompt-input');
          if (promptInput) {
            promptInput.value = entry.enhanced;
            promptInput.focus();
          }
        }
      });
    }

    return item;
  }
  
  /**
   * Loads and displays prompt history
   */
  async function loadHistory() {
    let history = [];

    try {
      if (usageTracker) {
        history = await usageTracker.getLimitedHistory();
      } else {
        // Fallback to full history if usage tracker not available
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(['promptHistory'], resolve);
        });
        history = result.promptHistory || [];
      }
    } catch (error) {
      console.warn('Failed to load history:', error);
      // Final fallback
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['promptHistory'], resolve);
      });
      history = result.promptHistory || [];
    }

    if (historyContainer) {
      historyContainer.innerHTML = '';
    }

    if (history.length === 0) {
      if (historyEmpty) {
        historyEmpty.style.display = 'block';
      }
      if (historyContainer) {
        historyContainer.style.display = 'none';
      }
      return;
    }

    if (historyEmpty) {
      historyEmpty.style.display = 'none';
    }
    if (historyContainer) {
      historyContainer.style.display = 'flex';
    }

    // Create history items
    history.forEach(entry => {
      const item = createHistoryItem(entry);
      if (historyContainer) {
        historyContainer.appendChild(item);
      }
    });
  }

  // ============================================================================
  // USAGE INDICATOR
  // ============================================================================

  const usageIndicator = document.getElementById('usage-indicator');
  const enhancementsUsage = document.getElementById('enhancements-usage');
  const questionsUsage = document.getElementById('questions-usage');
  const upgradeUsageButton = document.getElementById('upgrade-usage-button');

  /**
   * Updates the usage indicator display
   */
  async function updateUsageIndicator() {
    if (!usageTracker || !usageIndicator) return;

    try {
      // Refresh subscription so paid users don't see stale "out of 10" from cache
      await subscriptionManager.getSubscriptionStatus(true).catch(() => null);
      const summary = await usageTracker.getUsageSummary();

      if (summary.isPremium) {
        // Hide usage indicator for premium users
        usageIndicator.style.display = 'none';
        return;
      }

      // Show usage indicator for free users
      usageIndicator.style.display = 'block';

      // Update usage displays
      if (enhancementsUsage) {
        enhancementsUsage.textContent = `${summary.enhancements.current} / ${summary.enhancements.limit}`;
      }
      if (questionsUsage) {
        questionsUsage.textContent = `${summary.questions.current} / ${summary.questions.limit}`;
      }

      // Show upgrade button if limits are close to being reached
      if (upgradeUsageButton) {
        const showUpgrade = summary.enhancements.remaining <= 2 || summary.questions.remaining <= 1;
        upgradeUsageButton.style.display = showUpgrade ? 'inline-flex' : 'none';
      }
    } catch (error) {
      console.warn('Failed to update usage indicator:', error);
      usageIndicator.style.display = 'none';
    }
  }

  // Handle upgrade button click
  if (upgradeUsageButton) {
    upgradeUsageButton.addEventListener('click', () => {
      const premiumTabButton = document.querySelector('[data-tab="premium"]');
      if (premiumTabButton) {
        premiumTabButton.click();
      }
    });
  }

  // Ask tab usage indicator elements
  const askUsageIndicator = document.getElementById('ask-usage-indicator');
  const askQuestionsUsage = document.getElementById('ask-questions-usage');
  const askUpgradeUsageButton = document.getElementById('ask-upgrade-usage-button');

  /**
   * Updates the ask usage indicator display
   */
  async function updateAskUsageIndicator() {
    if (!usageTracker || !askUsageIndicator) return;

    try {
      // Refresh subscription so paid users don't see stale limit from cache
      await subscriptionManager.getSubscriptionStatus(true).catch(() => null);
      const summary = await usageTracker.getUsageSummary();

      if (summary.isPremium) {
        // Hide usage indicator for premium users
        askUsageIndicator.style.display = 'none';
        return;
      }

      // Show usage indicator for free users
      askUsageIndicator.style.display = 'block';

      // Update usage displays
      if (askQuestionsUsage) {
        askQuestionsUsage.textContent = `${summary.questions.current} / ${summary.questions.limit}`;
      }

      // Show upgrade button if limits are close to being reached
      if (askUpgradeUsageButton) {
        const showUpgrade = summary.questions.remaining <= 1;
        askUpgradeUsageButton.style.display = showUpgrade ? 'inline-flex' : 'none';
      }
    } catch (error) {
      console.warn('Failed to update ask usage indicator:', error);
      askUsageIndicator.style.display = 'none';
    }
  }

  // Handle ask upgrade button click
  if (askUpgradeUsageButton) {
    askUpgradeUsageButton.addEventListener('click', () => {
      const premiumTabButton = document.querySelector('[data-tab="premium"]');
      if (premiumTabButton) {
        premiumTabButton.click();
      }
    });
  }

  // ============================================================================
  // USER ACCOUNT MANAGEMENT
  // ============================================================================

  /**
   * Updates the user info display in settings
   */
  function updateUserInfo(user) {
    if (!user) return;

    if (userAvatar && user.photoURL) {
      userAvatar.src = user.photoURL;
    }
    if (userName) {
      userName.textContent = user.displayName || 'User';
    }
    if (userEmail) {
      userEmail.textContent = user.email;
    }

    // Show user info and logout button
    if (userInfo) userInfo.style.display = 'block';
    if (logoutButton) logoutButton.style.display = 'block';
  }

  /**
   * Handles user logout
   */
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        currentUser = null;
        clearFirebaseUserFromStorage();
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (token) chrome.identity.removeCachedAuthToken({ token }, () => {});
        });
        console.log('User signed out');

        // Reset UI
        if (userInfo) userInfo.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'none';

        const headerTitle = document.querySelector('.header-title');
        if (headerTitle) {
          headerTitle.textContent = 'Prompt Helper Gemini';
          headerTitle.style.fontSize = '22px';
        }

        showLoginSection();
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
  }

  // ============================================================================
  // ONBOARDING & LOGIN FLOW
  // ============================================================================

  // (Element declarations moved to top)

  /**
   * Auth state is handled by setupBackendAuth / tryRestoreSession
   * This function is kept for backwards compatibility but does nothing
   */
  function checkAndShowLogin() {
    // Auth is handled by backend auth flow on load
  }

  /**
   * Shows the login/onboarding section
   */
  function showLoginSection() {
    hideInitialLoader();

    // Hide tabs and main content
    if (tabsContainer) tabsContainer.style.display = 'none';
    mainContent.forEach(section => {
      section.style.display = 'none';
    });

    // Reset header
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) {
      headerTitle.textContent = 'Prompt Helper Gemini';
    }

    // Hide user info
    if (userInfo) userInfo.style.display = 'none';
    if (logoutButton) logoutButton.style.display = 'none';

    // Show login section
    if (loginSection) {
      loginSection.style.display = 'flex';
      loginSection.style.flexDirection = 'column';
      loginSection.style.gap = '16px';
    }
  }

  /**
   * Shows the main interface after login
   */
  function showMainInterface(user = null) {
    hideInitialLoader();
    
    // Hide login section
    if (loginSection) loginSection.style.display = 'none';

    // Show tabs and main content
    if (tabsContainer) tabsContainer.style.display = 'flex';

    // Update header to show user info if logged in
    if (user) {
      const headerTitle = document.getElementById('header-title');
      if (headerTitle) {
        headerTitle.textContent = `Hi, ${user.displayName?.split(' ')[0] || 'User'}!`;
      }

      // Update user info in settings
      updateUserInfo(user);
    }

    // Show the enhance tab by default
    const enhanceTabButton = document.querySelector('[data-tab="enhance"]');
    if (enhanceTabButton) {
      // Ensure enhance tab is shown
      enhanceTab.classList.add('active');
      enhanceTab.style.display = 'flex';
      enhanceTab.style.flexDirection = 'column';
      enhanceTab.style.gap = '16px';
      
      // Hide other tabs
      if (askTab) askTab.style.display = 'none';
      recentTab.style.display = 'none';
      if (premiumTab) premiumTab.style.display = 'none';
      setupTab.style.display = 'none';
      
      // Update button states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      enhanceTabButton.classList.add('active');
      
      // Click to trigger any tab-specific initialization
      enhanceTabButton.click();
    } else {
      // Fallback: directly show enhance tab if button not found
      console.warn('[Prompt Architect] Enhance tab button not found, showing enhance tab directly');
      enhanceTab.classList.add('active');
      enhanceTab.style.display = 'flex';
      enhanceTab.style.flexDirection = 'column';
      enhanceTab.style.gap = '16px';
    }
  }
  
  // ============================================================================
  // GOOGLE SIGN-IN HANDLER - MOVED TO FIREBASE INITIALIZATION TIMEOUT
  // ============================================================================

  // ============================================================================
  // ADVANCED SETTINGS - Custom Instructions
  // ============================================================================
  
  // Enhance tab style selector
  // Style selector removed

  let saveTimeout = null;
  let isSaving = false;
  
  // Style selector removed - all styles now use default
  
  // Subtle checkmark animation for save button (Steve Jobs style)
  function showSaveSuccess(button) {
    const originalHTML = button.innerHTML;
    button.innerHTML = '<span class="button-with-icon"><span>✓</span><span>Saved</span></span>';
    button.style.background = 'rgba(52, 199, 89, 0.15)';
    button.style.color = '#30D158';
    
          setTimeout(() => {
      button.innerHTML = originalHTML;
      button.style.background = '';
      button.style.color = '';
    }, 1500);
  }

  // Subtle feedback for apply/delete actions (Steve Jobs style)
  function showButtonSuccess(button, text = '✓') {
    const originalHTML = button.innerHTML;
    const originalBg = button.style.background;
    button.innerHTML = text;
    button.style.background = 'rgba(52, 199, 89, 0.15)';
    button.style.color = '#30D158';
    button.style.minWidth = button.offsetWidth + 'px';
    
          setTimeout(() => {
      button.innerHTML = originalHTML;
      button.style.background = originalBg;
      button.style.color = '';
      button.style.minWidth = '';
    }, 1000);
  }

  function showButtonDelete(button) {
    const originalHTML = button.innerHTML;
    const originalBg = button.style.background;
    button.innerHTML = '✓';
    button.style.background = 'rgba(255, 59, 48, 0.15)';
    button.style.color = '#FF3B30';
    button.style.minWidth = button.offsetWidth + 'px';
    
        setTimeout(() => {
      button.innerHTML = originalHTML;
      button.style.background = originalBg;
      button.style.color = '';
      button.style.minWidth = '';
    }, 1000);
  }

  // Custom styles removed - no save handler needed
  
  // Custom styles removed - no handlers needed

  // ============================================================================
  // AUTO-SEND TOGGLE
  // ============================================================================
  
  const injectButtonToggle = document.getElementById('inject-button-toggle');
  const autoSendToggle = document.getElementById('auto-send-toggle');
  
  // Load inject button preference (default to true for backward compatibility)
  if (injectButtonToggle) {
    chrome.storage.local.get([STORAGE_INJECT_BUTTON_ENABLED], (result) => {
      const isEnabled = result[STORAGE_INJECT_BUTTON_ENABLED] !== false; // Default true
      injectButtonToggle.checked = isEnabled;
      // Ensure the value is saved to storage (in case it was undefined)
      if (result[STORAGE_INJECT_BUTTON_ENABLED] === undefined) {
        chrome.storage.local.set({ [STORAGE_INJECT_BUTTON_ENABLED]: isEnabled });
      }
    });
    
    // Save inject button preference
    injectButtonToggle.addEventListener('change', (e) => {
      const value = e.target.checked;
      chrome.storage.local.set({ [STORAGE_INJECT_BUTTON_ENABLED]: value }, () => {
        // Optional: Verify it was saved
        if (chrome.runtime.lastError) {
          console.error('Error saving inject button preference:', chrome.runtime.lastError);
        }
      });
    });
  }
  
  // Load auto-send preference
  if (autoSendToggle) {
    chrome.storage.local.get(['autoSendAfterEnhancement'], (result) => {
      autoSendToggle.checked = result.autoSendAfterEnhancement || false;
    });
    
    // Save auto-send preference
    autoSendToggle.addEventListener('change', (e) => {
      chrome.storage.local.set({ autoSendAfterEnhancement: e.target.checked });
    });
  }

  // Style selector is now always visible and simplified to just "Default"

  // ============================================================================
  // ASK TAB - Question Answering
  // ============================================================================
  
  const askInput = document.getElementById('ask-input');
  const askButton = document.getElementById('ask-button');
  const askButtonText = document.getElementById('ask-button-text');
  const askSpinner = document.getElementById('ask-spinner');
  const askStatusMessage = document.getElementById('ask-status-message');
  const askResultContainer = document.getElementById('ask-result-container');
  const askResultText = document.getElementById('ask-result-text');
  const askCopyButton = document.getElementById('ask-copy-button');
  const enhanceQuestionToggle = document.getElementById('enhance-question-toggle');

  /**
   * Format API answer for display: escape HTML, then apply simple markdown (bold, bullets, line breaks).
   * @param {string} raw - Raw answer text
   * @returns {string} HTML safe for innerHTML
   */
  function formatAskAnswerForDisplay(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const withStrong = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const withBr = withStrong.replace(/\n/g, '<br>');
    const withBullets = withBr.replace(/(^|<br>)(\s*)\*(\s+)/g, '$1$2\u2022 ');
    return withBullets;
  }
  
  // No auto-save - start fresh each time popup opens
  
  // No longer saving results - start fresh each time
  
  /**
   * Display status message for Ask tab
   */
  function showAskStatus(message, type, persist = false) {
    if (askStatusMessage) {
      askStatusMessage.textContent = message;
      askStatusMessage.className = `status-message status-${type} show`;
      // Don't auto-hide info/warning messages during processing, or if persist is true
      if (!persist && type !== 'info' && type !== 'warning') {
        setTimeout(() => {
          askStatusMessage.classList.remove('show');
        }, 4000);
      }
    }
  }
  
  /**
   * Update button text based on toggle state
   */
  function updateAskButtonText() {
    if (enhanceQuestionToggle && askButtonText) {
      if (enhanceQuestionToggle.checked) {
        askButtonText.textContent = 'Enhance & Ask';
      } else {
        askButtonText.textContent = 'Ask Question';
      }
    }
  }
  
  // Update button text when toggle changes and save/restore state
  if (enhanceQuestionToggle) {
    // Load saved toggle state
    chrome.storage.local.get([STORAGE_ENHANCE_QUESTION_TOGGLE], (result) => {
      if (result[STORAGE_ENHANCE_QUESTION_TOGGLE] !== undefined) {
        enhanceQuestionToggle.checked = result[STORAGE_ENHANCE_QUESTION_TOGGLE];
        updateAskButtonText();
      }
    });
    
    // Save toggle state when changed
    enhanceQuestionToggle.addEventListener('change', () => {
      chrome.storage.local.set({ [STORAGE_ENHANCE_QUESTION_TOGGLE]: enhanceQuestionToggle.checked });
      updateAskButtonText();
    });
  }

  /**
   * Handles question asking (with optional enhancement)
   */
  if (askButton && askInput) {
    askButton.addEventListener('click', async () => {
      let question = askInput.value.trim();
      
      if (!question) {
        showAskStatus('Please enter a question.', 'error');
        return;
      }

      // No API key check: extension uses backend proxy; background script handles ask.
      askButton.disabled = true;
      if (askButtonText) askButtonText.style.display = 'none';
      if (askSpinner) askSpinner.classList.add('show');
      if (askResultContainer) askResultContainer.classList.remove('show');

      try {
        // If enhance toggle is enabled, enhance the question first
        if (enhanceQuestionToggle && enhanceQuestionToggle.checked) {
          showAskStatus('Enhancing question...', 'info', true);

          const enhanceResponse = await chrome.runtime.sendMessage({
            action: 'enhancePrompt',
            prompt: question,
            enhancementType: 'TEXT_ENHANCEMENT',
            provider: 'gemini'
          });

          const enhancedQuestion = enhanceResponse?.enhancedPrompt || question;

          if (enhancedQuestion.startsWith("Error:")) {
            showAskStatus('Enhancement failed, using original question...', 'warning', true);
          } else {
            question = enhancedQuestion;
            if (askInput) askInput.value = question;
            showAskStatus('Question enhanced, asking now...', 'info', true);
          }
        }

        // Ask the question (enhanced or original) - background uses backend proxy
        const response = await chrome.runtime.sendMessage({
          action: 'askQuestion',
          question: question,
          provider: 'gemini'
        });

        const answer = response?.answer || "Error: Failed to receive answer.";

        if (answer.startsWith("Error:")) {
          showAskStatus(answer.replace("Error: ", ""), 'error');
          if (askResultContainer) askResultContainer.classList.remove('show');
        } else {
          if (askResultText) {
            askResultText.innerHTML = formatAskAnswerForDisplay(answer);
            askResultText.dataset.rawAnswer = answer;
          }
          if (askResultContainer) {
            askResultContainer.classList.add('show');
            askResultText.classList.add('ask-result-formatted');
          }
          showAskStatus('Answer received!', 'success');
        }
      } catch (error) {
        console.error('Ask question error:', error);
        showAskStatus('Error: Communication issue. Please try again.', 'error');
        if (askResultContainer) askResultContainer.classList.remove('show');
      } finally {
        askButton.disabled = false;
        if (askButtonText) askButtonText.style.display = 'inline';
        if (askSpinner) askSpinner.classList.remove('show');
        // Refresh Ask balance so it updates after each question (and after Enhance & Ask)
        updateAskUsageIndicator();
      }
    });
  }
  
  // Initialize button text
  updateAskButtonText();
  
  /**
   * Copy answer to clipboard
   */
  if (askCopyButton && askResultText) {
    askCopyButton.addEventListener('click', async () => {
      const answer = askResultText.dataset.rawAnswer || askResultText.innerText || askResultText.textContent;
      
      try {
        await navigator.clipboard.writeText(answer);
        showAskStatus('Answer copied to clipboard!', 'success');
        
        // Visual feedback
        askCopyButton.textContent = 'Copied!';
        setTimeout(() => {
          askCopyButton.textContent = 'Copy';
        }, 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
        showAskStatus('Failed to copy to clipboard.', 'error');
      }
    });
  }


  // Start fresh - no restore on popup open
  // Clear any saved content to ensure fresh start
  function clearSavedContent() {
    chrome.storage.local.set({
      [STORAGE_PROMPT_INPUT]: '',
      [STORAGE_ASK_INPUT]: '',
      [STORAGE_ENHANCED_RESULT]: '',
      [STORAGE_ASK_RESULT]: ''
    });
  }

  // ============================================================================
  // ZOOM CONTROLS
  // ============================================================================
  
  const zoomOutButton = document.getElementById('zoom-out-button');
  const zoomInButton = document.getElementById('zoom-in-button');
  const zoomResetButton = document.getElementById('zoom-reset-button');
  const zoomLevelDisplay = document.getElementById('zoom-level');
  
  let currentZoom = 1.0; // Default zoom level (100%)
  const MIN_ZOOM = 0.5; // 50%
  const MAX_ZOOM = 2.0; // 200%
  const ZOOM_STEP = 0.1; // 10% increments
  
  /**
   * Applies zoom to the popup
   */
  function applyZoom(zoomLevel) {
    // Apply zoom to body for better scrolling behavior
    const body = document.body;
    if (body) {
      // Use CSS zoom property (better for popups and scrolling)
      body.style.zoom = zoomLevel;
      // Fallback for browsers that don't support zoom
      if (!body.style.zoom) {
        body.style.transform = `scale(${zoomLevel})`;
        body.style.transformOrigin = 'top left';
        // Adjust max-height to account for scale
        const originalMaxHeight = 600;
        body.style.maxHeight = `${originalMaxHeight / zoomLevel}px`;
      } else {
        // Reset max-height when using zoom property (it handles it automatically)
        body.style.maxHeight = '';
      }
    }
    if (zoomLevelDisplay) {
      zoomLevelDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
  }
  
  /**
   * Loads saved zoom level
   */
  function loadZoomLevel() {
    chrome.storage.local.get([STORAGE_ZOOM_LEVEL], (result) => {
      const savedZoom = result[STORAGE_ZOOM_LEVEL];
      if (savedZoom && savedZoom >= MIN_ZOOM && savedZoom <= MAX_ZOOM) {
        currentZoom = savedZoom;
        applyZoom(currentZoom);
      }
    });
  }
  
  /**
   * Saves zoom level
   */
  function saveZoomLevel(zoomLevel) {
    chrome.storage.local.set({ [STORAGE_ZOOM_LEVEL]: zoomLevel });
  }
  
  /**
   * Zooms in
   */
  function zoomIn() {
    if (currentZoom < MAX_ZOOM) {
      currentZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
      applyZoom(currentZoom);
      saveZoomLevel(currentZoom);
    }
  }
  
  /**
   * Zooms out
   */
  function zoomOut() {
    if (currentZoom > MIN_ZOOM) {
      currentZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
      applyZoom(currentZoom);
      saveZoomLevel(currentZoom);
    }
  }
  
  /**
   * Resets zoom to 100%
   */
  function resetZoom() {
    currentZoom = 1.0;
    applyZoom(currentZoom);
    saveZoomLevel(currentZoom);
  }
  
  // Add event listeners
  if (zoomInButton) {
    zoomInButton.addEventListener('click', zoomIn);
  }
  
  if (zoomOutButton) {
    zoomOutButton.addEventListener('click', zoomOut);
  }
  
  if (zoomResetButton) {
    zoomResetButton.addEventListener('click', resetZoom);
  }
  
  // Load saved zoom level on popup open
  loadZoomLevel();

  // ============================================================================
  // STYLE SELECTOR VISIBILITY TOGGLE
  // ============================================================================
  
  const showStyleSelectorToggle = document.getElementById('show-style-selector-toggle');
  const styleSelectorContainer = document.getElementById('style-selector-container');
  
  /**
   * Resets all enhancement modes to default style
   */
  async function resetAllModesToDefault() {
    const modes = ['TEXT_ENHANCEMENT', 'CODE_ENHANCEMENT', 'IMAGE_ENHANCEMENT', 'VIDEO_ENHANCEMENT'];
    for (const mode of modes) {
      try {
        await chrome.runtime.sendMessage({
          action: 'setActiveStyle',
          enhancementType: mode,
          styleKey: 'default'
        });
      } catch (error) {
        console.error(`Error resetting ${mode} to default:`, error);
      }
    }
  }

  /**
   * Updates style selector visibility based on toggle state
   */
  function updateStyleSelectorVisibility(show) {
    if (styleSelectorContainer) {
      styleSelectorContainer.style.display = show ? 'block' : 'none';
    }
    // When hiding the style selector, reset all modes to default
    if (!show) {
      resetAllModesToDefault();
    }
  }
  
  /**
   * Loads saved style selector visibility preference
   */
  function loadStyleSelectorVisibility() {
    chrome.storage.local.get([STORAGE_SHOW_STYLE_SELECTOR], (result) => {
      // Show by default on first boot; only hide when user explicitly set to false
      const show = result[STORAGE_SHOW_STYLE_SELECTOR] !== false;
      if (showStyleSelectorToggle) {
        showStyleSelectorToggle.checked = show;
      }
      updateStyleSelectorVisibility(show);
      // If style selector is hidden on load, reset all modes to default
      if (!show) {
        resetAllModesToDefault();
      }
    });
  }
  
  /**
   * Saves style selector visibility preference
   */
  function saveStyleSelectorVisibility(show) {
    chrome.storage.local.set({ [STORAGE_SHOW_STYLE_SELECTOR]: show });
  }
  
  // Handle toggle change
  if (showStyleSelectorToggle) {
    showStyleSelectorToggle.addEventListener('change', (e) => {
      const show = e.target.checked;
      updateStyleSelectorVisibility(show);
      saveStyleSelectorVisibility(show);
    });
  }
  
  // Load style selector visibility on popup open
  loadStyleSelectorVisibility();

  // ============================================================================
  // PREMIUM / SUBSCRIPTION MANAGEMENT
  // ============================================================================
  
  const subscriptionStatus = document.getElementById('subscription-status');
  const subscriptionStatusText = document.getElementById('subscription-status-text');
  const pricingPlans = document.getElementById('pricing-plans');
  const activeSubscription = document.getElementById('active-subscription');
  const subscriptionLoading = document.getElementById('subscription-loading');
  const subscribePremiumButton = document.getElementById('subscribe-premium-button');
  const manageSubscriptionButton = document.getElementById('manage-subscription-button');
  const subscriptionDetails = document.getElementById('subscription-details');
  const goProHeader = document.getElementById('go-pro-header');
  
  // Debug: Log all subscription-related elements
  console.log('[Subscription] Element check:', {
    subscriptionStatus: !!subscriptionStatus,
    subscriptionStatusText: !!subscriptionStatusText,
    pricingPlans: !!pricingPlans,
    activeSubscription: !!activeSubscription,
    subscriptionLoading: !!subscriptionLoading,
    subscribePremiumButton: !!subscribePremiumButton,
    goProHeader: !!goProHeader
  });
  
  if (subscribePremiumButton) {
    if (typeof window !== 'undefined' && window.STRIPE_PRO_PRICE_ID) {
      subscribePremiumButton.dataset.priceId = window.STRIPE_PRO_PRICE_ID;
      subscribePremiumButton.setAttribute('data-price-id', window.STRIPE_PRO_PRICE_ID);
    }
    console.log('[Subscription] Subscribe button found:', {
      id: subscribePremiumButton.id,
      text: subscribePremiumButton.textContent,
      priceId: subscribePremiumButton.dataset.priceId,
      disabled: subscribePremiumButton.disabled,
      display: subscribePremiumButton.style.display,
      visible: subscribePremiumButton.offsetParent !== null
    });
  } else {
    console.error('[Subscription] Subscribe button NOT FOUND! Check HTML structure.');
  }
  
  if (goProHeader) {
    goProHeader.style.display = 'none'; // Only show on Pro tab (set in tab switch)
    goProHeader.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const premiumTabButton = document.querySelector('[data-tab="premium"]');
      if (premiumTabButton) premiumTabButton.click();
    });
  }
  
  /**
   * Load premium tab content
   */
  let isLoadingPremiumTab = false;
  /**
   * @param {object} [preloadedStatus] - If provided (e.g. after upgrade), use this and skip fetch.
   */
  async function loadPremiumTab(preloadedStatus) {
    // Prevent multiple simultaneous calls
    if (isLoadingPremiumTab) {
      console.log('[Premium Tab] Already loading, skipping duplicate call');
      return;
    }
    
    if (!subscriptionStatus || !subscriptionLoading) {
      console.warn('[Premium Tab] Required elements not found');
      return;
    }
    
    isLoadingPremiumTab = true;
    console.log('[Premium Tab] Loading premium tab content...');
    
    // Show loading state
    subscriptionLoading.style.display = 'block';
    pricingPlans.style.display = 'none';
    activeSubscription.style.display = 'none';
    const syncRowLoading = document.getElementById('sync-subscription-row');
    if (syncRowLoading) syncRowLoading.style.display = 'none';
    subscriptionStatusText.textContent = 'Checking...';
    
    try {
      let status;
      if (preloadedStatus != null && typeof preloadedStatus === 'object') {
        status = preloadedStatus;
        console.log('[Premium Tab] Using preloaded subscription status:', status);
      } else {
        // Force refresh when opening Premium tab so we see latest after payment
        const statusPromise = subscriptionManager.getSubscriptionStatus(true);
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.warn('[Premium Tab] Subscription check timed out, showing pricing');
            resolve({
              active: false,
              plan: null,
              status: 'inactive',
              expiresAt: null
            });
          }, 10000); // 10 second timeout (reduced from 15s)
        });
        status = await Promise.race([statusPromise, timeoutPromise]);
      }
      
      console.log('[Premium Tab] Subscription status received:', status);
      
      // Hide loading
      subscriptionLoading.style.display = 'none';
      
      const syncRow = document.getElementById('sync-subscription-row');
      if (syncRow) syncRow.style.display = 'none';
      if (status && status.active && status.status === 'active') {
        // User has active subscription
        console.log('[Premium Tab] User has active subscription');
        activeSubscription.style.display = 'block';
        pricingPlans.style.display = 'none';
        if (goProHeader) goProHeader.style.display = 'none';
        
        subscriptionStatusText.textContent = 'Active - Premium Plan';
        subscriptionStatus.style.background = 'rgba(52, 199, 89, 0.1)';
        subscriptionStatus.style.borderLeftColor = '#30D158';
        
        if (subscriptionDetails) {
          const expiresDate = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : 'N/A';
          subscriptionDetails.textContent = `Your Premium subscription is active. Renews on ${expiresDate}. Enjoy unlimited enhancements!`;
        }
      } else {
        // User doesn't have subscription - show pricing
        console.log('[Premium Tab] User does not have subscription, showing pricing plans');
        activeSubscription.style.display = 'none';
        pricingPlans.style.display = 'block';
        if (goProHeader) goProHeader.style.display = 'block';
        
        // Show "Sign in to upgrade" notice when not signed in
        const premiumSignInNotice = document.getElementById('premium-sign-in-notice');
        if (premiumSignInNotice) {
          premiumSignInNotice.style.display = currentUser ? 'none' : 'block';
        }
        
        // Ensure subscribe button is visible and enabled
        if (subscribePremiumButton) {
          subscribePremiumButton.style.display = 'block';
          subscribePremiumButton.style.visibility = 'visible';
          subscribePremiumButton.disabled = false;
          subscribePremiumButton.textContent = 'Upgrade to Pro — $19.99/mo';
          console.log('[Premium Tab] Subscribe button enabled and visible');
          
          // Re-attach click handler to ensure it works
          attachSubscribeHandler();
        } else {
          console.error('[Premium Tab] Subscribe button element not found!');
        }
        
        subscriptionStatusText.textContent = 'Free';
        subscriptionStatus.style.background = 'rgba(0, 122, 255, 0.05)';
        subscriptionStatus.style.borderLeftColor = 'var(--primary-blue)';
        const syncRow = document.getElementById('sync-subscription-row');
        if (syncRow) syncRow.style.display = 'block';
      }
    } catch (error) {
      console.error('[Premium Tab] Error loading premium tab:', error);
      // On error, show pricing plans so user can still subscribe
      subscriptionLoading.style.display = 'none';
      pricingPlans.style.display = 'block';
      activeSubscription.style.display = 'none';
      const syncRowErr = document.getElementById('sync-subscription-row');
      if (syncRowErr) syncRowErr.style.display = 'block';
      if (goProHeader) goProHeader.style.display = 'block';
      const signInNoticeErr = document.getElementById('premium-sign-in-notice');
      if (signInNoticeErr) signInNoticeErr.style.display = currentUser ? 'none' : 'block';
      
      // Ensure subscribe button is visible and enabled
      if (subscribePremiumButton) {
        subscribePremiumButton.style.display = 'block';
        subscribePremiumButton.style.visibility = 'visible';
        subscribePremiumButton.disabled = false;
        subscribePremiumButton.textContent = 'Upgrade to Pro — $19.99/mo';
        
        // Re-attach click handler
        attachSubscribeHandler();
      }
      
      subscriptionStatusText.textContent = 'Unable to verify status';
      subscriptionStatus.style.background = 'rgba(255, 149, 0, 0.1)';
      subscriptionStatus.style.borderLeftColor = '#FF9500';
      
      // Show helpful message
      if (subscriptionDetails) {
        subscriptionDetails.textContent = 'Unable to check subscription status. You can still subscribe below.';
      }
      subscriptionStatus.style.background = 'rgba(255, 59, 48, 0.1)';
      subscriptionStatus.style.borderLeftColor = '#FF3B30';
    } finally {
      // Always reset loading flag
      isLoadingPremiumTab = false;
    }
  }
  
  // Ensure pricing plans are visible when premium tab is opened, even if status check fails
  // This is a fallback to make sure users can always see the subscribe button
  const premiumTabButton = document.querySelector('[data-tab="premium"]');
  if (premiumTabButton) {
    // Add a listener to ensure pricing is shown after tab switch
    premiumTabButton.addEventListener('click', () => {
      // After a short delay, if pricing plans aren't visible, show them as fallback
      setTimeout(() => {
        if (pricingPlans && pricingPlans.style.display === 'none' && 
            activeSubscription && activeSubscription.style.display === 'none' &&
            subscriptionLoading && subscriptionLoading.style.display === 'none') {
          console.log('[Premium Tab] Fallback: Showing pricing plans');
          pricingPlans.style.display = 'block';
          const signInNoticeFallback = document.getElementById('premium-sign-in-notice');
          if (signInNoticeFallback) signInNoticeFallback.style.display = currentUser ? 'none' : 'block';
          if (subscribePremiumButton) {
            subscribePremiumButton.style.display = 'block';
            subscribePremiumButton.style.visibility = 'visible';
            subscribePremiumButton.disabled = false;
            subscribePremiumButton.textContent = 'Upgrade to Pro — $19.99/mo';
            
            // Re-attach click handler
            attachSubscribeHandler();
          }
          if (subscriptionStatusText) {
            subscriptionStatusText.textContent = 'Free';
          }
        }
      }, 3000); // 3 second delay to allow status check to complete or timeout
    });
  }
  
  /**
   * Handle subscription button clicks
   */
  // Use event delegation from pricing-plans container (works even if button is recreated)
  const pricingPlansContainer = document.getElementById('pricing-plans');
  if (pricingPlansContainer) {
    pricingPlansContainer.addEventListener('click', async function(e) {
      // Check if the click was on the subscribe button or its children
      const button = e.target.closest('#subscribe-premium-button');
      if (button) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Subscription] ✅ Subscribe button CLICKED via delegation!');
        console.log('[Subscription] Event target:', e.target);
        console.log('[Subscription] Button element:', button);
        
        const priceId = button.dataset.priceId || button.getAttribute('data-price-id') || (typeof window !== 'undefined' && window.STRIPE_PRO_PRICE_ID) || '';
        console.log('[Subscription] Price ID:', priceId);
        
        try {
          await handleSubscribe(priceId);
        } catch (error) {
          console.error('[Subscription] Error in delegation handler:', error);
        }
      }
    }, { capture: true }); // Use capture phase to catch it early
    
    console.log('[Subscription] ✅ Event delegation attached to pricing-plans container');
  }
  
  // Also attach direct handler as backup
  function attachSubscribeHandler() {
    const button = document.getElementById('subscribe-premium-button');
    if (!button) {
      console.warn('[Subscription] Button not found for direct handler attachment');
      return null;
    }
    
    // Remove old onclick
    button.onclick = null;
    
    // Attach direct handler
    button.onclick = async function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Subscription] ✅ Subscribe button CLICKED (direct onclick)!');
      const priceId = this.dataset.priceId || this.getAttribute('data-price-id') || (typeof window !== 'undefined' && window.STRIPE_PRO_PRICE_ID) || '';
      console.log('[Subscription] Using Price ID:', priceId);
      try {
        await handleSubscribe(priceId);
      } catch (error) {
        console.error('[Subscription] Error in direct onclick:', error);
      }
      return false;
    };
    
    // Ensure button is clickable
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';
    button.style.position = 'relative';
    button.style.zIndex = '1000';
    
    console.log('[Subscription] ✅ Direct handler attached to button:', {
      id: button.id,
      text: button.textContent.trim(),
      priceId: button.dataset.priceId || button.getAttribute('data-price-id'),
      disabled: button.disabled,
      display: button.style.display,
      pointerEvents: button.style.pointerEvents
    });
    
    return button;
  }
  
  // Attach handler initially if button exists
  if (subscribePremiumButton) {
    console.log('[Subscription] Subscribe button found initially, attaching direct handler');
    attachSubscribeHandler();
  } else {
    console.warn('[Subscription] Subscribe button not found on initial load - delegation handler will catch clicks');
  }
  
  // Also attach when premium tab is shown (in case button wasn't ready initially)
  if (premiumTab) {
    // Use MutationObserver to detect when button becomes visible
    const observer = new MutationObserver(() => {
      const button = document.getElementById('subscribe-premium-button');
      if (button && button.offsetParent !== null) {
        console.log('[Subscription] Button became visible, attaching direct handler');
        attachSubscribeHandler();
      }
    });
    
    observer.observe(premiumTab, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    console.log('[Subscription] MutationObserver set up to watch for button visibility');
  }
  
  /**
   * Handle subscription flow
   */
  async function handleSubscribe(priceId) {
    console.log('[Prompt Architect] handleSubscribe called with priceId:', priceId);
    const btn = document.getElementById('subscribe-premium-button'); // live reference
    try {
      // Require sign-in so subscription is tied to their account (works across devices/reinstalls)
      if (!currentUser) {
        showStatus('Sign in with Google to upgrade. Your subscription will work on all your devices.', 'error');
        const setupTabButton = document.querySelector('[data-tab="setup"]');
        if (setupTabButton) setupTabButton.click();
        return;
      }
      if (!priceId || !priceId.trim()) {
        throw new Error('Stripe Price ID not set. Edit stripe-config.js and set STRIPE_PRO_PRICE_ID to your Price ID from Stripe Dashboard (Dashboard → Products → your product → Price ID).');
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Checking...';
      }
      
      // Check server health first
      console.log('[Prompt Architect] Checking server health...');
      const serverHealthy = await subscriptionManager.checkServerHealth();
      if (!serverHealthy) {
        throw new Error('Payment server is not reachable. Please check your internet connection or try again later.');
      }
      
      console.log('[Prompt Architect] Server is healthy, requesting checkout session...');
      if (btn) btn.textContent = 'Opening...';
      
      const userId = await subscriptionManager.getUserId();
      console.log('[Prompt Architect] User ID:', userId);
      
      const session = await subscriptionManager.openCheckout(priceId);
      console.log('[Prompt Architect] Checkout session received:', session);
      
      if (!session || !session.url) {
        throw new Error('Invalid checkout session response from server');
      }
      
      console.log('[Prompt Architect] Opening Stripe checkout:', session.url);
      // Tab is opened by subscriptionManager.openCheckout(); ensure button is reset
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Upgrade to Pro — $19.99/mo';
      }
    } catch (error) {
      console.error('[Prompt Architect] Error in handleSubscribe:', error);
      console.error('[Prompt Architect] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Show user-friendly error message
      let errorMessage = error.message || 'Failed to open checkout. Please check your connection and try again.';
      
      // Provide more specific error messages
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        errorMessage = 'Unable to connect to payment server. Please check your internet connection.';
      } else if (errorMessage.includes('500')) {
        errorMessage = 'Server error. The payment service may be temporarily unavailable. Please try again in a few moments.';
      }
      
      alert(`Subscription Error\n\n${errorMessage}\n\nNote: Subscription does NOT require an API key. This is a separate payment service.\n\nIf this problem persists, please contact support.`);
      
      const errBtn = document.getElementById('subscribe-premium-button');
      if (errBtn) {
        errBtn.disabled = false;
        errBtn.textContent = 'Upgrade to Pro — $19.99/mo';
      }
    }
  }
  
  /**
   * Handle manage subscription button
   */
  if (manageSubscriptionButton) {
    manageSubscriptionButton.addEventListener('click', async () => {
      try {
        manageSubscriptionButton.disabled = true;
        manageSubscriptionButton.textContent = 'Opening...';
        
        await subscriptionManager.openCustomerPortal();
        
        // Re-enable after a delay (portal opens in new tab)
        setTimeout(() => {
          manageSubscriptionButton.disabled = false;
          manageSubscriptionButton.textContent = 'Manage Subscription';
        }, 2000);
      } catch (error) {
        console.error('Error opening customer portal:', error);
        // Portal login tab was opened as fallback; show short message
        showStatus('Billing portal opened in a new tab. Log in with your email to manage your subscription.', 'success');
        manageSubscriptionButton.disabled = false;
        manageSubscriptionButton.textContent = 'Manage Subscription';
      }
    });
  }
  
  /**
   * Sync subscription (for "I paid but still see Free")
   */
  const syncSubscriptionButton = document.getElementById('sync-subscription-button');
  if (syncSubscriptionButton) {
    syncSubscriptionButton.addEventListener('click', async () => {
      try {
        syncSubscriptionButton.disabled = true;
        syncSubscriptionButton.textContent = 'Syncing...';
        const userId = await subscriptionManager.getUserId();
        const email = (currentUser && currentUser.email) ? currentUser.email : null;
        const response = await fetch(`${subscriptionManager.PAYMENT_SERVER_URL}/sync-subscription-by-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, email })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Sync failed');
        }
        chrome.storage.local.remove([subscriptionManager.STORAGE_SUBSCRIPTION_CACHE, subscriptionManager.STORAGE_SUBSCRIPTION_STATUS], async () => {
          subscriptionManager.resetErrorState();
        });
        const freshStatus = await subscriptionManager.getSubscriptionStatus(true);
        loadPremiumTab(freshStatus);
        showStatus('Subscription synced. You should see Premium now.', 'success');
      } catch (err) {
        console.error('Sync subscription error:', err);
        showStatus(err.message || 'Sync failed. Try the link from your payment success email.', 'error');
      } finally {
        syncSubscriptionButton.disabled = false;
        syncSubscriptionButton.textContent = 'Sync my subscription';
      }
    });
  }

  /**
   * After upgrade: clear cache and poll for active status (handles webhook delay).
   * Returns the latest status so the Premium tab can show it immediately.
   */
  async function refreshSubscriptionAfterUpgrade() {
    subscriptionManager.clearSubscriptionCache();
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const maxAttempts = 3;
    const retryDelayMs = 2000;
    let lastStatus = { active: false, plan: null, status: 'inactive', expiresAt: null };
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        lastStatus = await subscriptionManager.getSubscriptionStatus(true);
        if (lastStatus && lastStatus.active && lastStatus.status === 'active') {
          return lastStatus;
        }
      } catch (e) {
        // Ignore and retry
      }
      if (attempt < maxAttempts - 1) {
        await delay(retryDelayMs);
      }
    }
    return lastStatus;
  }

  /**
   * Check for payment success/cancel in URL params
   */
  async function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus === 'success') {
      showStatus('Payment successful! Checking your subscription...', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);

      const premiumTabButton = document.querySelector('[data-tab="premium"]');
      if (premiumTabButton) {
        premiumTabButton.click();
        const status = await refreshSubscriptionAfterUpgrade();
        loadPremiumTab(status);
        if (status && status.active && status.status === 'active') {
          showStatus('Your subscription is now active.', 'success');
        } else {
          showStatus('Payment received. If you don\'t see Premium yet, refresh in a moment.', 'success');
        }
      } else {
        showStatus('Payment successful! Your subscription is now active.', 'success');
      }
    } else if (paymentStatus === 'canceled') {
      showStatus('Payment canceled. You can try again anytime.', 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
  
  // Check payment status on load
  checkPaymentStatus();
  
  // Poll for subscription updates (every 60 seconds when on premium tab)
  // Increased interval and added error handling to prevent request floods
  setInterval(() => {
    const premiumTabButton = document.querySelector('[data-tab="premium"]');
    if (premiumTabButton && premiumTabButton.classList.contains('active')) {
      // Refresh subscription status (throttled automatically)
      subscriptionManager.getSubscriptionStatus(true).then(status => {
        if (status.active && status.status === 'active') {
          loadPremiumTab();
        }
      }).catch(() => {
        // Silently handle errors - throttling will prevent spam
      });
    }
  }, 60000); // 60 seconds (increased from 30 to reduce load)

  // Initial load - Firebase handles auth state automatically
  clearSavedContent();
  
  // Default API key setup removed - using backend proxy
});

