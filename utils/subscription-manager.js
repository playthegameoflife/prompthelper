/**
 * Subscription Manager
 * Handles subscription status checking and feature gating
 */

// Configuration - Keep in sync with config.js and background.js when changing server URL
const PAYMENT_SERVER_URL = 'https://api-clyep56cdq-uc.a.run.app';
// Fallback when create-portal-session fails: Stripe customer portal login (Dashboard → Billing → Customer portal)
const STRIPE_CUSTOMER_PORTAL_URL = 'https://billing.stripe.com/p/login/bJe28racM6RSgzC1cT7AI00';
// Publishable key only - safe in client. Use pk_live_... for production.
const STRIPE_PUBLISHABLE_KEY = ''; // optional: pk_live_... from Stripe Dashboard

// Storage keys
const STORAGE_USER_ID = 'userId';
const STORAGE_SUBSCRIPTION_STATUS = 'subscriptionStatus';
const STORAGE_SUBSCRIPTION_CACHE = 'subscriptionCache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Generate or retrieve a unique user ID
 */
async function getUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_USER_ID], (result) => {
      if (result[STORAGE_USER_ID]) {
        resolve(result[STORAGE_USER_ID]);
      } else {
        // Generate a unique ID (in production, use a more robust method)
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        chrome.storage.local.set({ [STORAGE_USER_ID]: userId }, () => {
          resolve(userId);
        });
      }
    });
  });
}

/**
 * Get subscription status from cache or server
 */
async function getSubscriptionStatus(forceRefresh = false) {
  try {
    // Check cache first
    if (!forceRefresh) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_SUBSCRIPTION_CACHE], async (result) => {
          const cached = result[STORAGE_SUBSCRIPTION_CACHE];
          if (cached && cached.expiresAt > Date.now()) {
            resolve(cached.status);
            return;
          }
          
          // Cache expired, fetch from server
          try {
            const status = await fetchSubscriptionStatus();
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
      return await fetchSubscriptionStatus();
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
}

/**
 * Fetch subscription status from server
 */
async function fetchSubscriptionStatus() {
  try {
    const userId = await getUserId();
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${PAYMENT_SERVER_URL}/subscription-status/${userId}`, {
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
      [STORAGE_SUBSCRIPTION_CACHE]: {
        status: status,
        expiresAt: Date.now() + CACHE_DURATION
      },
      [STORAGE_SUBSCRIPTION_STATUS]: status
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

/**
 * Check if user has active subscription
 */
async function hasActiveSubscription() {
  const status = await getSubscriptionStatus();
  return status.active === true && status.status === 'active';
}

/**
 * Check if user has a specific plan
 */
async function hasPlan(planId) {
  const status = await getSubscriptionStatus();
  return status.active === true && status.plan === planId;
}

/**
 * Create Stripe Checkout Session
 */
async function createCheckoutSession(priceId, successUrl, cancelUrl) {
  try {
    const userId = await getUserId();
    const response = await fetch(`${PAYMENT_SERVER_URL}/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        priceId: priceId,
        successUrl: successUrl,
        cancelUrl: cancelUrl,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create checkout session');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Open Stripe Checkout
 */
async function openCheckout(priceId) {
  try {
    // Get current tab URL for redirect
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tabs[0]?.url || chrome.runtime.getURL('popup.html');
    const baseUrl = new URL(currentUrl).origin;
    
    const successUrl = chrome.runtime.getURL('popup.html?payment=success');
    const cancelUrl = chrome.runtime.getURL('popup.html?payment=canceled');
    
    const session = await createCheckoutSession(priceId, successUrl, cancelUrl);
    
    // Open Stripe Checkout in a new tab
    chrome.tabs.create({ url: session.url });
    
    return session;
  } catch (error) {
    console.error('Error opening checkout:', error);
    throw error;
  }
}

/**
 * Create Customer Portal Session (for managing subscriptions).
 * On API failure, opens Stripe customer portal login as fallback.
 */
async function openCustomerPortal() {
  try {
    const userId = await getUserId();
    const returnUrl = chrome.runtime.getURL('popup-extension.html');
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_SUBSCRIPTION_STATUS], resolve);
    });
    const status = result[STORAGE_SUBSCRIPTION_STATUS];

    const response = await fetch(`${PAYMENT_SERVER_URL}/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        returnUrl,
        customerId: status?.customerId || null,
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
    chrome.tabs.create({ url: STRIPE_CUSTOMER_PORTAL_URL });
    throw error;
  }
}

/**
 * Clear subscription cache (call after payment success)
 */
function clearSubscriptionCache() {
  chrome.storage.local.remove([STORAGE_SUBSCRIPTION_CACHE], () => {
    // Force refresh on next check
    getSubscriptionStatus(true);
  });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getUserId,
    getSubscriptionStatus,
    hasActiveSubscription,
    hasPlan,
    openCheckout,
    openCustomerPortal,
    clearSubscriptionCache,
  };
}
