/**
 * Feature Gating Utilities
 * Controls access to premium features based on subscription status
 */

// Import subscription manager functions
// Note: In a browser extension, these would be loaded via script tag
// For now, we'll assume they're available globally

/**
 * Check if a feature is available to the user
 * @param {string} featureName - Name of the feature to check
 * @returns {Promise<boolean>}
 */
async function isFeatureAvailable(featureName) {
  // Define feature requirements
  const featureRequirements = {
    'unlimited_enhancements': 'pro', // Pro or Premium
    'priority_api': 'pro',
    'advanced_templates': 'pro',
    'export_history': 'pro',
    'custom_models': 'premium',
    'api_access': 'premium',
    'white_label': 'premium',
  };
  
  const requiredPlan = featureRequirements[featureName];
  if (!requiredPlan) {
    // Feature doesn't require premium
    return true;
  }
  
  // Check subscription status
  const status = await getSubscriptionStatus();
  
  if (!status.active) {
    return false;
  }
  
  // Check plan level (any active subscription with a plan is pro/premium)
  if (requiredPlan === 'pro' || requiredPlan === 'premium') {
    return !!status.plan;
  }
  
  return false;
}

/**
 * Gate a feature - show upgrade prompt if not available
 * @param {string} featureName - Name of the feature
 * @param {Function} callback - Function to execute if feature is available
 * @param {Function} onDenied - Optional callback if feature is not available
 */
async function gateFeature(featureName, callback, onDenied = null) {
  const available = await isFeatureAvailable(featureName);
  
  if (available) {
    callback();
  } else {
    if (onDenied) {
      onDenied();
    } else {
      // Default: show upgrade prompt
      showUpgradePrompt(featureName);
    }
  }
}

/**
 * Show upgrade prompt
 * @param {string} featureName - Name of the feature that requires upgrade
 */
function showUpgradePrompt(featureName) {
  // Create a modal or notification
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Premium Feature</h3>
        <p class="modal-subtitle">This feature requires a premium subscription.</p>
      </div>
      <div style="padding: var(--spacing-lg);">
        <p style="margin: 0 0 var(--spacing-md) 0; font-size: 14px; color: var(--text-secondary);">
          Upgrade to unlock this and other premium features.
        </p>
      </div>
      <div class="modal-actions">
        <button id="upgrade-cancel" class="premium-button-secondary">Cancel</button>
        <button id="upgrade-button" class="premium-button">View Plans</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle button clicks
  modal.querySelector('#upgrade-cancel').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.querySelector('#upgrade-button').addEventListener('click', () => {
    modal.remove();
    // Switch to premium tab
    const premiumTabButton = document.querySelector('[data-tab="premium"]');
    if (premiumTabButton) {
      premiumTabButton.click();
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
 * Example: Gate a function that exports history
 */
async function exportHistory() {
  await gateFeature('export_history', async () => {
    // User has access - proceed with export
    console.log('Exporting history...');
    // Implement export logic here
  });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isFeatureAvailable,
    gateFeature,
    showUpgradePrompt,
  };
}
