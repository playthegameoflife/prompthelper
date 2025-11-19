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
  const STORAGE_ENHANCEMENT_MODE = 'selectedEnhancementMode';
  
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
  const recentTab = document.getElementById('recent-section');
  const setupTab = document.getElementById('setup-section');
  const advancedTab = document.getElementById('advanced-section');
  
  if (enhanceTab) {
    enhanceTab.classList.add('active');
    enhanceTab.style.display = 'flex';
    enhanceTab.style.flexDirection = 'column';
    enhanceTab.style.gap = '16px';
  }
  
  if (recentTab) {
    recentTab.classList.remove('active');
    recentTab.style.display = 'none';
  }
  
  if (setupTab) {
    setupTab.classList.remove('active');
    setupTab.style.display = 'none';
  }
  
  if (advancedTab) {
    advancedTab.classList.remove('active');
    advancedTab.style.display = 'none';
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
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
        if (advancedTab) {
          advancedTab.classList.remove('active');
          advancedTab.style.display = 'none';
        }
      } else if (tab === 'recent') {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        recentTab.classList.add('active');
        recentTab.style.display = 'flex';
        recentTab.style.flexDirection = 'column';
        recentTab.style.gap = '16px';
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
        if (advancedTab) {
          advancedTab.classList.remove('active');
          advancedTab.style.display = 'none';
        }
        loadHistory(); // Load history when tab is opened
      } else if (tab === 'advanced') {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
        if (advancedTab) {
          advancedTab.classList.add('active');
          advancedTab.style.display = 'flex';
          advancedTab.style.flexDirection = 'column';
          advancedTab.style.gap = '16px';
          loadAdvancedSettings(); // Load settings when tab is opened
        }
      } else {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
        setupTab.classList.add('active');
        setupTab.style.display = 'flex';
        setupTab.style.flexDirection = 'column';
        setupTab.style.gap = '16px';
        if (advancedTab) {
          advancedTab.classList.remove('active');
          advancedTab.style.display = 'none';
        }
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

  // ============================================================================
  // SMART MODE DETECTION
  // ============================================================================

  /**
   * Automatically detects the most appropriate enhancement mode based on prompt content
   * @param {string} text - The prompt text to analyze
   * @returns {string} The detected enhancement mode
   */
  function detectPromptType(text) {
    if (!text || typeof text !== 'string') {
      return 'TEXT_ENHANCEMENT';
    }
    
    const normalized = text.toLowerCase().trim();
    
    // Code detection patterns
    const codePatterns = [
      /\b(function|class|def |import |const |let |var |return |async |await |=>|\.js|\.py|\.ts|\.java|\.cpp|\.html|\.css|\.json|\.sql)\b/,
      /\b(programming|code|script|algorithm|function|variable|array|object|method|api|endpoint|database|query)\b/,
      /\b(create a|write a|build a|implement|code|program|script)\s+(function|class|component|module|app|application)\b/,
    ];
    
    // Image detection patterns
    const imagePatterns = [
      /\b(image|photo|picture|visual|draw|paint|art|illustration|graphic|design|logo|icon|screenshot|diagram|chart|visualization)\b/,
      /\b(create|generate|make|design|draw|paint)\s+(an|a)\s+(image|photo|picture|visual|art|illustration|graphic)\b/,
      /\b(dalle|midjourney|stable diffusion|image generation|visual description)\b/,
    ];
    
    // Video detection patterns
    const videoPatterns = [
      /\b(video|film|movie|cinematic|animation|motion|footage|clip|sequence|scene|shot|camera|frame|fps)\b/,
      /\b(create|generate|make|produce|edit)\s+(a|an)\s+(video|film|movie|animation|clip)\b/,
      /\b(runway|pika|luma|video generation|motion graphics)\b/,
    ];
    
    // Check code patterns first (most specific)
    for (const pattern of codePatterns) {
      if (pattern.test(normalized)) {
        return 'CODE_ENHANCEMENT';
      }
    }
    
    // Check video patterns (more specific than image)
    for (const pattern of videoPatterns) {
      if (pattern.test(normalized)) {
        return 'VIDEO_ENHANCEMENT';
      }
    }
    
    // Check image patterns
    for (const pattern of imagePatterns) {
      if (pattern.test(normalized)) {
        return 'IMAGE_ENHANCEMENT';
      }
    }
    
    // Default to text enhancement
    return 'TEXT_ENHANCEMENT';
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
  let userManuallySelectedMode = false; // Track if user manually selected a mode (persists until input cleared or new manual selection)
  let autoDetectionTimeout = null; // For debouncing auto-detection
  
  // Load saved mode on popup open
  chrome.storage.local.get([STORAGE_ENHANCEMENT_MODE], (result) => {
    const savedMode = result[STORAGE_ENHANCEMENT_MODE] || 'TEXT_ENHANCEMENT';
    selectedMode = savedMode;
    
    // Update UI to reflect saved mode
    modeOptions.forEach(opt => {
      if (opt.dataset.mode === savedMode) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  });
  
  /**
   * Updates the selected mode in UI and storage
   * @param {string} mode - The mode to select
   * @param {boolean} isAutoDetected - Whether this was auto-detected (true) or manual (false)
   */
  function updateSelectedMode(mode, isAutoDetected = false) {
    // Remove active and auto-detected classes from all options
    modeOptions.forEach(opt => {
      opt.classList.remove('active', 'auto-detected');
    });
    
    const targetOption = Array.from(modeOptions).find(opt => opt.dataset.mode === mode);
    if (targetOption) {
      targetOption.classList.add('active');
      selectedMode = mode;
      
      // Save to storage
      chrome.storage.local.set({ [STORAGE_ENHANCEMENT_MODE]: selectedMode }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving enhancement mode:', chrome.runtime.lastError);
        }
      });
      
      if (isAutoDetected) {
        // Add auto-detected class for visual "lighting up" effect
        targetOption.classList.add('auto-detected');
        
        // Remove the auto-detected class after animation completes
        setTimeout(() => {
          targetOption.classList.remove('auto-detected');
        }, 600);
      }
    }
  }
  
  modeOptions.forEach(option => {
    option.addEventListener('click', () => {
      // User manually selected a mode - this is a permanent override until input is cleared
      userManuallySelectedMode = true;
      // Remove any auto-detected styling when user manually selects
      modeOptions.forEach(opt => opt.classList.remove('auto-detected'));
      updateSelectedMode(option.dataset.mode, false);
      
      // Manual selection persists - no timeout reset
      // Auto-detection will only resume when input is cleared
    });
  });
  
  /**
   * Smart mode detection on textarea input
   */
  if (promptInput) {
    promptInput.addEventListener('input', () => {
      const text = promptInput.value.trim();
      
      // Clear existing timeout
      if (autoDetectionTimeout) {
        clearTimeout(autoDetectionTimeout);
      }
      
      // Only auto-detect if:
      // 1. There's text in the input
      // 2. User hasn't manually selected a mode recently
      // 3. Text is long enough to make a meaningful detection (at least 5 chars for faster response)
      if (text.length >= 5 && !userManuallySelectedMode) {
        autoDetectionTimeout = setTimeout(() => {
          const detectedMode = detectPromptType(text);
          
          // Only update if detected mode is different from current (to show visual feedback)
          if (detectedMode !== selectedMode) {
            updateSelectedMode(detectedMode, true);
            console.log(`[Prompt Architect] Auto-detected mode: ${detectedMode}`);
          }
        }, 300); // Reduced debounce: wait 300ms after user stops typing for faster response
      } else if (text.length === 0) {
        // Reset to Text mode and re-enable auto-detection when input is cleared
        userManuallySelectedMode = false; // Clear manual override when input is cleared
        updateSelectedMode('TEXT_ENHANCEMENT', false);
      }
    });
  }

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
      'TEXT_ENHANCEMENT': 'Text',
      'CODE_ENHANCEMENT': 'Code',
      'IMAGE_ENHANCEMENT': 'Image',
      'VIDEO_ENHANCEMENT': 'Video'
    };
    return modeMap[mode] || 'Text';
  }
  
  /**
   * Creates a history item element
   */
  function createHistoryItem(entry) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    item.innerHTML = `
      <div class="history-item-header">
        <div class="history-item-meta">
          <span class="history-item-mode">${getModeLabel(entry.mode)}</span>
          <span class="history-item-time">${formatTimeAgo(entry.timestamp)}</span>
        </div>
      </div>
      <div class="history-item-original" title="${entry.original}">
        <strong>Original:</strong> ${entry.original.length > 100 ? entry.original.substring(0, 100) + '...' : entry.original}
      </div>
      <div class="history-item-enhanced" title="${entry.enhanced}">
        ${entry.enhanced.length > 150 ? entry.enhanced.substring(0, 150) + '...' : entry.enhanced}
      </div>
      <div class="history-item-actions">
        <button class="history-action-button" data-action="copy-enhanced" data-id="${entry.id}">Copy Enhanced</button>
        <button class="history-action-button secondary" data-action="copy-original" data-id="${entry.id}">Copy Original</button>
        <button class="history-action-button secondary" data-action="use-enhanced" data-id="${entry.id}">Use Enhanced</button>
      </div>
    `;
    
    // Add event listeners
    const copyEnhancedBtn = item.querySelector('[data-action="copy-enhanced"]');
    const copyOriginalBtn = item.querySelector('[data-action="copy-original"]');
    const useEnhancedBtn = item.querySelector('[data-action="use-enhanced"]');
    
    copyEnhancedBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(entry.enhanced);
        copyEnhancedBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyEnhancedBtn.textContent = 'Copy Enhanced';
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
          copyOriginalBtn.textContent = 'Copy Original';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showStatus('Failed to copy to clipboard.', 'error');
      }
    });
    
    useEnhancedBtn.addEventListener('click', () => {
      // Switch to enhance tab and populate the input
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
    
    return item;
  }
  
  /**
   * Loads and displays prompt history
   */
  function loadHistory() {
    chrome.storage.local.get(['promptHistory'], (result) => {
      const history = result.promptHistory || [];
      
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
    });
  }

  // ============================================================================
  // ONBOARDING
  // ============================================================================
  
  /**
   * Shows onboarding welcome message for first-time users
   */
  function checkAndShowOnboarding() {
    chrome.storage.local.get(['hasSeenOnboarding'], (result) => {
      if (!result.hasSeenOnboarding) {
        // Check if API key is set
        chrome.storage.local.get(['userGeminiApiKey', 'userOpenAIApiKey', 'userAnthropicApiKey'], (keys) => {
          const hasApiKey = keys.userGeminiApiKey || keys.userOpenAIApiKey || keys.userAnthropicApiKey;
          
          if (!hasApiKey) {
            // Show onboarding - guide user to setup
            showOnboarding();
          } else {
            // Mark onboarding as seen
            chrome.storage.local.set({ hasSeenOnboarding: true });
          }
        });
      }
    });
  }
  
  /**
   * Shows onboarding welcome message
   */
  function showOnboarding() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    modal.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 64px; margin-bottom: 16px;">✨</div>
        <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: var(--text-primary);">Welcome to Prompt Architect!</h2>
        <p style="margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5;">
          Enhance your AI prompts with one click
        </p>
      </div>
      
      <div style="margin-bottom: 24px; padding: 16px; background: rgba(0, 122, 255, 0.05); border-radius: 8px; border-left: 3px solid var(--primary-blue);">
        <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: var(--text-primary);">Quick Start:</p>
        <ol style="margin: 0; padding-left: 20px; font-size: 12px; color: var(--text-secondary); line-height: 1.8;">
          <li>Get an API key from your AI provider</li>
          <li>Enter it in the Setup tab</li>
          <li>Click "Improve" in any AI chat to enhance prompts!</li>
        </ol>
      </div>
      
      <button id="onboarding-got-it" class="premium-button" style="width: 100%;">
        Get Started
      </button>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Handle close
    const gotItBtn = modal.querySelector('#onboarding-got-it');
    gotItBtn.addEventListener('click', () => {
      chrome.storage.local.set({ hasSeenOnboarding: true });
      overlay.remove();
      
      // Switch to setup tab
      const setupTabButton = document.querySelector('[data-tab="setup"]');
      if (setupTabButton) {
        setupTabButton.click();
      }
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        chrome.storage.local.set({ hasSeenOnboarding: true });
        overlay.remove();
      }
    });
  }

  // ============================================================================
  // ADVANCED SETTINGS - Custom Instructions
  // ============================================================================
  
  const instructionModeSelector = document.getElementById('instruction-mode-selector');
  const instructionSourceSelector = document.getElementById('instruction-source-selector');
  const templateSelectorContainer = document.getElementById('template-selector-container');
  const templateSelector = document.getElementById('template-selector');
  const customInstructionContainer = document.getElementById('custom-instruction-container');
  const customInstructionInput = document.getElementById('custom-instruction-input');
  const instructionPreview = document.getElementById('instruction-preview');
  const instructionPreviewText = document.getElementById('instruction-preview-text');
  const saveInstructionButton = document.getElementById('save-instruction-button');
  const resetInstructionButton = document.getElementById('reset-instruction-button');
  
  let currentTemplates = {};
  let currentMode = 'TEXT_ENHANCEMENT';
  
  // Load templates for current mode
  async function loadTemplates(enhancementType) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getTemplates',
        enhancementType: enhancementType
      });
      
      if (response && response.success) {
        currentTemplates = response.templates || {};
        updateTemplateSelector();
      }
    } catch (error) {
      console.error('[Prompt Architect] Error loading templates:', error);
    }
  }
  
  // Update template selector dropdown
  function updateTemplateSelector() {
    if (!templateSelector) return;
    
    templateSelector.innerHTML = '';
    const templates = currentTemplates;
    
    for (const [key, value] of Object.entries(templates)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      templateSelector.appendChild(option);
    }
  }
  
  // Load custom instruction for current mode
  async function loadCustomInstruction(enhancementType) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCustomInstruction',
        enhancementType: enhancementType
      });
      
      if (response && response.success && response.instruction) {
        customInstructionInput.value = response.instruction;
        resetInstructionButton.style.display = 'block';
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Prompt Architect] Error loading custom instruction:', error);
      return false;
    }
  }
  
  // Update preview based on current selection
  function updatePreview() {
    const source = instructionSourceSelector.value;
    let previewText = '';
    
    if (source === 'default') {
      previewText = currentTemplates['default'] || 'Default instruction';
    } else if (source === 'template') {
      const selectedTemplate = templateSelector.value;
      previewText = currentTemplates[selectedTemplate] || 'Select a template';
    } else if (source === 'custom') {
      previewText = customInstructionInput.value || 'Enter custom instruction';
    }
    
    if (previewText && previewText !== 'Select a template' && previewText !== 'Enter custom instruction') {
      instructionPreviewText.textContent = previewText;
      instructionPreview.style.display = 'block';
    } else {
      instructionPreview.style.display = 'none';
    }
  }
  
  // Handle instruction source change
  if (instructionSourceSelector) {
    instructionSourceSelector.addEventListener('change', () => {
      const source = instructionSourceSelector.value;
      templateSelectorContainer.style.display = source === 'template' ? 'block' : 'none';
      customInstructionContainer.style.display = source === 'custom' ? 'block' : 'none';
      updatePreview();
    });
  }
  
  // Handle mode change
  if (instructionModeSelector) {
    instructionModeSelector.addEventListener('change', async () => {
      currentMode = instructionModeSelector.value;
      await loadTemplates(currentMode);
      await loadCustomInstruction(currentMode);
      updatePreview();
    });
  }
  
  // Handle template selection
  if (templateSelector) {
    templateSelector.addEventListener('change', () => {
      updatePreview();
    });
  }
  
  // Handle custom instruction input
  if (customInstructionInput) {
    customInstructionInput.addEventListener('input', () => {
      updatePreview();
    });
  }
  
  // Save instruction
  if (saveInstructionButton) {
    saveInstructionButton.addEventListener('click', async () => {
      const source = instructionSourceSelector.value;
      let instruction = '';
      
      if (source === 'default') {
        // Delete custom instruction to use default
        try {
          await chrome.runtime.sendMessage({
            action: 'deleteCustomInstruction',
            enhancementType: currentMode
          });
          resetInstructionButton.style.display = 'none';
          customInstructionInput.value = '';
          alert('Reset to default instruction');
          return;
        } catch (error) {
          console.error('[Prompt Architect] Error resetting instruction:', error);
          alert('Error resetting instruction');
          return;
        }
      } else if (source === 'template') {
        const selectedTemplate = templateSelector.value;
        instruction = currentTemplates[selectedTemplate];
      } else if (source === 'custom') {
        instruction = customInstructionInput.value.trim();
        if (!instruction) {
          alert('Please enter a custom instruction');
          return;
        }
      }
      
      if (instruction) {
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'saveCustomInstruction',
            enhancementType: currentMode,
            instruction: instruction
          });
          
          if (response && response.success) {
            resetInstructionButton.style.display = 'block';
            alert('Instruction saved successfully!');
          } else {
            alert('Error saving instruction: ' + (response.error || 'Unknown error'));
          }
        } catch (error) {
          console.error('[Prompt Architect] Error saving instruction:', error);
          alert('Error saving instruction');
        }
      }
    });
  }
  
  // Reset instruction
  if (resetInstructionButton) {
    resetInstructionButton.addEventListener('click', async () => {
      if (confirm('Reset to default instruction for this mode?')) {
        try {
          await chrome.runtime.sendMessage({
            action: 'deleteCustomInstruction',
            enhancementType: currentMode
          });
          resetInstructionButton.style.display = 'none';
          customInstructionInput.value = '';
          instructionSourceSelector.value = 'default';
          templateSelectorContainer.style.display = 'none';
          customInstructionContainer.style.display = 'none';
          updatePreview();
          alert('Reset to default instruction');
        } catch (error) {
          console.error('[Prompt Architect] Error resetting instruction:', error);
          alert('Error resetting instruction');
        }
      }
    });
  }
  
  // Load advanced settings when tab is opened
  async function loadAdvancedSettings() {
    if (!instructionModeSelector) return;
    
    currentMode = instructionModeSelector.value;
    await loadTemplates(currentMode);
    const hasCustom = await loadCustomInstruction(currentMode);
    
    if (hasCustom) {
      instructionSourceSelector.value = 'custom';
      customInstructionContainer.style.display = 'block';
    } else {
      instructionSourceSelector.value = 'default';
      customInstructionContainer.style.display = 'none';
    }
    
    templateSelectorContainer.style.display = 'none';
    updatePreview();
  }

  // ============================================================================
  // AUTO-SEND TOGGLE
  // ============================================================================
  
  const autoSendToggle = document.getElementById('auto-send-toggle');
  
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

  // Initial load
  loadApiKey();
  checkAndShowOnboarding();
});
