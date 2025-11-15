/**
 * popup.js
 * Handles the logic for API key management and prompt enhancement.
 * Premium UI with tab navigation and full enhancement functionality.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Storage keys for different providers
  const STORAGE_KEYS = {
    gemini: 'userGeminiApiKey',
    openai: 'userOpenAIApiKey',
    anthropic: 'userAnthropicApiKey'
  };
  const STORAGE_PROVIDER = 'selectedProvider';
  
  // Provider configuration
  const PROVIDERS = {
    gemini: {
      name: 'Google Gemini',
      placeholder: 'AIza... (paste your key here)',
      helpUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
      keyPrefix: 'AIza'
    },
    openai: {
      name: 'OpenAI',
      placeholder: 'sk-... (paste your key here)',
      helpUrl: 'https://platform.openai.com/api-keys',
      keyPrefix: 'sk-'
    },
    anthropic: {
      name: 'Anthropic Claude',
      placeholder: 'sk-ant-... (paste your key here)',
      helpUrl: 'https://console.anthropic.com/settings/keys',
      keyPrefix: 'sk-ant-'
    }
  };

  // Ensure enhance section is visible by default
  const enhanceTab = document.getElementById('enhance-section');
  const setupTab = document.getElementById('setup-section');
  
  if (enhanceTab) {
    enhanceTab.classList.add('active');
    enhanceTab.style.display = 'flex';
    enhanceTab.style.flexDirection = 'column';
    enhanceTab.style.gap = '16px';
  }
  
  if (setupTab) {
    setupTab.classList.remove('active');
    setupTab.style.display = 'none';
  }

  // Tab Management
  const tabButtons = document.querySelectorAll('.tab-button');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show/hide sections
      if (tab === 'enhance') {
        enhanceTab.classList.add('active');
        enhanceTab.style.display = 'flex';
        enhanceTab.style.flexDirection = 'column';
        enhanceTab.style.gap = '16px';
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
      } else {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        setupTab.classList.add('active');
        setupTab.style.display = 'flex';
        setupTab.style.flexDirection = 'column';
        setupTab.style.gap = '16px';
      }
    });
  });

  // Setup View Elements
  const providerSelector = document.getElementById('provider-selector');
  const apiKeyInput = document.getElementById('api-key-input');
  const apiKeyLabel = document.getElementById('api-key-label');
  const apiKeyLink = document.getElementById('api-key-link');
  const saveButton = document.getElementById('save-button');
  const savedView = document.getElementById('saved-view');
  const changeKeyLink = document.getElementById('change-key-link');

  let currentProvider = 'gemini'; // Default provider

  // Enhance View Elements
  const promptInput = document.getElementById('prompt-input');
  const modeOptions = document.querySelectorAll('.mode-option');
  const enhanceButton = document.getElementById('enhance-button');
  const enhanceButtonText = document.getElementById('enhance-button-text');
  const enhanceSpinner = document.getElementById('enhance-spinner');
  const statusMessage = document.getElementById('status-message');
  const resultContainer = document.getElementById('result-container');
  const resultText = document.getElementById('result-text');
  const copyButton = document.getElementById('copy-button');

  // Verify all elements exist
  if (!promptInput || !enhanceButton || !modeOptions.length) {
    console.error('[Prompt Architect] Critical elements missing in popup');
  }

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

  /**
   * Updates the UI based on selected provider.
   */
  function updateProviderUI(provider) {
    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) return;
    
    apiKeyLabel.textContent = `${providerConfig.name} API Key`;
    apiKeyInput.placeholder = providerConfig.placeholder;
    apiKeyLink.href = providerConfig.helpUrl;
    apiKeyLink.textContent = `Get your ${providerConfig.name} API key`;
  }

  /**
   * Updates the UI to reflect whether the key is saved or needs to be entered.
   */
  function updateUIState(key) {
      if (key) {
          savedView.style.display = 'block';
      document.querySelector('#setup-section .glass-card:first-child').style.display = 'none';
      } else {
          savedView.style.display = 'none';
      document.querySelector('#setup-section .glass-card:first-child').style.display = 'block';
      }
  }

  /**
   * Loads the stored API key and updates the UI state.
   */
  function loadApiKey() {
    chrome.storage.local.get([STORAGE_PROVIDER, ...Object.values(STORAGE_KEYS)], (result) => {
      const selectedProvider = result[STORAGE_PROVIDER] || 'gemini';
      currentProvider = selectedProvider;
      
      if (providerSelector) {
        providerSelector.value = selectedProvider;
      }
      
      updateProviderUI(selectedProvider);
      
      const storageKey = STORAGE_KEYS[selectedProvider];
      const key = result[storageKey];
          updateUIState(key);
      
      if (apiKeyInput && key) {
        apiKeyInput.value = key;
      }
    });
  }
  
  /**
   * Handle provider selection change.
   */
  if (providerSelector) {
    providerSelector.addEventListener('change', (e) => {
      currentProvider = e.target.value;
      updateProviderUI(currentProvider);
      
      // Load the key for the selected provider
      const storageKey = STORAGE_KEYS[currentProvider];
      chrome.storage.local.get([storageKey], (result) => {
        const key = result[storageKey];
        if (apiKeyInput) {
          apiKeyInput.value = key || '';
        }
        updateUIState(key);
      });
      
      // Save selected provider
      chrome.storage.local.set({ [STORAGE_PROVIDER]: currentProvider });
      });
  }

  /**
   * Handles saving the key when the button is clicked.
   */
  if (saveButton && apiKeyInput) {
  saveButton.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      
      if (!key) {
          showStatus('Key cannot be empty.', 'error');
          return;
      }

      saveButton.disabled = true;
      const originalText = saveButton.querySelector('span:last-child')?.textContent || 'Save & Activate';
      if (saveButton.querySelector('span:last-child')) {
        saveButton.querySelector('span:last-child').textContent = 'Saving...';
      }
      
      const storageKey = STORAGE_KEYS[currentProvider];
      const providerName = PROVIDERS[currentProvider].name;
      
      chrome.storage.local.set({ 
        [storageKey]: key,
        [STORAGE_PROVIDER]: currentProvider
      }, () => {
          if (chrome.runtime.lastError) {
              showStatus('Error saving key.', 'error');
              console.error("Storage error:", chrome.runtime.lastError);
              updateUIState(null);
          } else {
          showStatus(`${providerName} key saved successfully!`, 'success');
              apiKeyInput.value = ''; 
              updateUIState(key);
          }
          saveButton.disabled = false;
        if (saveButton.querySelector('span:last-child')) {
          saveButton.querySelector('span:last-child').textContent = originalText;
        }
      });
  });
  }

  /**
   * Handles the link to change the key.
   */
  if (changeKeyLink) {
  changeKeyLink.addEventListener('click', (e) => {
      e.preventDefault();
      const storageKey = STORAGE_KEYS[currentProvider];
      chrome.storage.local.remove(storageKey, () => {
          updateUIState(null);
        if (apiKeyInput) apiKeyInput.value = '';
          showStatus('Key removed. Enter new key below.', 'success');
        // Switch to the input view
        const setupCard = document.querySelector('#setup-section .glass-card:first-child');
        if (setupCard) setupCard.style.display = 'block';
        if (savedView) savedView.style.display = 'none';
      });
    });
  }

  /**
   * Mode Selection
   */
  let selectedMode = 'TEXT_ENHANCEMENT';
  modeOptions.forEach(option => {
    option.addEventListener('click', () => {
      modeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      selectedMode = option.dataset.mode;
    });
  });

  /**
   * Copy to Clipboard
   */
  copyButton.addEventListener('click', async () => {
    const text = resultText.textContent;
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

  /**
   * Handles prompt enhancement.
   */
  if (enhanceButton && promptInput) {
    enhanceButton.addEventListener('click', async () => {
      const prompt = promptInput.value.trim();
      
      if (!prompt) {
        showStatus('Please enter a prompt to enhance.', 'error');
        return;
      }

      // Check for API key
      chrome.storage.local.get([STORAGE_PROVIDER, ...Object.values(STORAGE_KEYS)], async (result) => {
        const selectedProvider = result[STORAGE_PROVIDER] || 'gemini';
        const storageKey = STORAGE_KEYS[selectedProvider];
        const apiKey = result[storageKey];
        
        if (!apiKey) {
          showStatus('Please set your API key in the Setup tab first.', 'error');
          // Switch to setup tab
          const setupTabButton = document.querySelector('[data-tab="setup"]');
          if (setupTabButton) {
            setupTabButton.click();
          }
          return;
        }

        // Disable button and show loading
        enhanceButton.disabled = true;
        if (enhanceButtonText) enhanceButtonText.style.display = 'none';
        if (enhanceSpinner) enhanceSpinner.classList.add('show');
        if (resultContainer) resultContainer.classList.remove('show');

        try {
          // Send message to background script
          const response = await chrome.runtime.sendMessage({
            action: 'enhancePrompt',
            prompt: prompt,
            enhancementType: selectedMode,
            provider: selectedProvider
          });

          const enhancedPrompt = response?.enhancedPrompt || "Error: Failed to receive enhanced prompt.";

          if (enhancedPrompt.startsWith("Error:")) {
            showStatus(enhancedPrompt.replace("Error: ", ""), 'error');
            if (resultContainer) resultContainer.classList.remove('show');
          } else {
            if (resultText) resultText.textContent = enhancedPrompt;
            if (resultContainer) resultContainer.classList.add('show');
            showStatus('Prompt enhanced successfully!', 'success');
          }
        } catch (error) {
          console.error('Enhancement error:', error);
          showStatus('Error: Communication issue. Please try again.', 'error');
          if (resultContainer) resultContainer.classList.remove('show');
        } finally {
          // Re-enable button and hide loading
          enhanceButton.disabled = false;
          if (enhanceButtonText) enhanceButtonText.style.display = 'inline';
          if (enhanceSpinner) enhanceSpinner.classList.remove('show');
        }
      });
    });
  } else {
    console.error('[Prompt Architect] Enhance button or prompt input not found');
  }

  // Platform Settings
  const PLATFORMS = {
    chatgpt: { name: 'ChatGPT', icon: '🤖' },
    gemini: { name: 'Google Gemini', icon: '💎' },
    claude: { name: 'Anthropic Claude', icon: '🧠' },
    grok: { name: 'Grok / X', icon: '🐦' },
    perplexity: { name: 'Perplexity', icon: '🔍' },
    generic: { name: 'Other Sites', icon: '🌐' }
  };
  const STORAGE_PLATFORMS = 'enabledPlatforms';
  const platformTogglesContainer = document.getElementById('platform-toggles');
  const enableAllButton = document.getElementById('enable-all-platforms');
  const disableAllButton = document.getElementById('disable-all-platforms');

  /**
   * Creates platform toggle UI
   */
  function createPlatformToggles() {
    if (!platformTogglesContainer) return;

    platformTogglesContainer.innerHTML = '';

    Object.entries(PLATFORMS).forEach(([key, platform]) => {
      const toggleItem = document.createElement('div');
      toggleItem.className = 'platform-toggle-item';
      toggleItem.dataset.platform = key;

      const label = document.createElement('div');
      label.className = 'platform-toggle-label';
      label.innerHTML = `
        <span class="platform-toggle-icon">${platform.icon}</span>
        <span>${platform.name}</span>
      `;

      const toggleSwitch = document.createElement('div');
      toggleSwitch.className = 'toggle-switch';
      toggleSwitch.dataset.platform = key;

      toggleSwitch.addEventListener('click', () => {
        togglePlatform(key);
      });

      toggleItem.appendChild(label);
      toggleItem.appendChild(toggleSwitch);
      platformTogglesContainer.appendChild(toggleItem);
    });

    loadPlatformPreferences();
  }

  /**
   * Loads and displays platform preferences
   */
  function loadPlatformPreferences() {
    chrome.storage.local.get([STORAGE_PLATFORMS], (result) => {
      const enabledPlatforms = result[STORAGE_PLATFORMS] || {};
      
      Object.keys(PLATFORMS).forEach(key => {
        const toggle = document.querySelector(`.toggle-switch[data-platform="${key}"]`);
        if (toggle) {
          // Default to enabled if not set
          const isEnabled = enabledPlatforms[key] !== false;
          toggle.classList.toggle('active', isEnabled);
        }
      });
    });
  }

  /**
   * Toggles a platform on/off
   */
  function togglePlatform(platformKey) {
    chrome.storage.local.get([STORAGE_PLATFORMS], (result) => {
      const enabledPlatforms = result[STORAGE_PLATFORMS] || {};
      const toggle = document.querySelector(`.toggle-switch[data-platform="${platformKey}"]`);
      
      // Toggle state
      const isCurrentlyEnabled = enabledPlatforms[platformKey] !== false;
      enabledPlatforms[platformKey] = !isCurrentlyEnabled;
      
      chrome.storage.local.set({ [STORAGE_PLATFORMS]: enabledPlatforms }, () => {
        if (toggle) {
          toggle.classList.toggle('active', !isCurrentlyEnabled);
        }
        console.log(`[Prompt Architect] ${PLATFORMS[platformKey].name} ${!isCurrentlyEnabled ? 'enabled' : 'disabled'}`);
      });
    });
  }

  /**
   * Enable all platforms
   */
  if (enableAllButton) {
    enableAllButton.addEventListener('click', () => {
      const enabledPlatforms = {};
      Object.keys(PLATFORMS).forEach(key => {
        enabledPlatforms[key] = true;
        const toggle = document.querySelector(`.toggle-switch[data-platform="${key}"]`);
        if (toggle) toggle.classList.add('active');
      });
      
      chrome.storage.local.set({ [STORAGE_PLATFORMS]: enabledPlatforms }, () => {
        showStatus('All platforms enabled', 'success');
      });
    });
  }

  /**
   * Disable all platforms
   */
  if (disableAllButton) {
    disableAllButton.addEventListener('click', () => {
      const enabledPlatforms = {};
      Object.keys(PLATFORMS).forEach(key => {
        enabledPlatforms[key] = false;
        const toggle = document.querySelector(`.toggle-switch[data-platform="${key}"]`);
        if (toggle) toggle.classList.remove('active');
      });
      
      chrome.storage.local.set({ [STORAGE_PLATFORMS]: enabledPlatforms }, () => {
        showStatus('All platforms disabled', 'success');
      });
    });
  }

  // Initialize platform toggles
  createPlatformToggles();

  // Initial load
  loadApiKey();
});
