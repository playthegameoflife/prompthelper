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
  const STORAGE_PROMPT_INPUT = 'savedPromptInput';
  const STORAGE_ASK_INPUT = 'savedAskInput';
  const STORAGE_ENHANCED_RESULT = 'savedEnhancedResult';
  const STORAGE_ASK_RESULT = 'savedAskResult';
  
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
  const askTab = document.getElementById('ask-section');
  const recentTab = document.getElementById('recent-section');
  const setupTab = document.getElementById('setup-section');
  const advancedSection = document.getElementById('advanced-section');
  
  if (enhanceTab) {
    enhanceTab.classList.add('active');
    enhanceTab.style.display = 'flex';
    enhanceTab.style.flexDirection = 'column';
    enhanceTab.style.gap = '16px';
  }
  
  if (askTab) {
    askTab.classList.remove('active');
    askTab.style.display = 'none';
  }
  
  if (recentTab) {
    recentTab.classList.remove('active');
    recentTab.style.display = 'none';
  }
  
  if (setupTab) {
    setupTab.classList.remove('active');
    setupTab.style.display = 'none';
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
      
      // Show/hide sections
      if (tab === 'enhance') {
        enhanceTab.classList.add('active');
        enhanceTab.style.display = 'flex';
        enhanceTab.style.flexDirection = 'column';
        enhanceTab.style.gap = '16px';
        if (askTab) {
          askTab.classList.remove('active');
          askTab.style.display = 'none';
        }
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
        // Load style for current mode when enhance tab opens
        if (selectedMode) {
          currentMode = selectedMode;
          loadTemplates(selectedMode).then(() => {
            loadStyleForEnhanceTab(selectedMode);
          });
        }
      } else if (tab === 'ask') {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        if (askTab) {
          askTab.classList.add('active');
          askTab.style.display = 'flex';
          askTab.style.flexDirection = 'column';
          askTab.style.gap = '16px';
        }
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
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
        setupTab.classList.remove('active');
        setupTab.style.display = 'none';
        loadHistory(); // Load history when tab is opened
      } else {
        enhanceTab.classList.remove('active');
        enhanceTab.style.display = 'none';
        if (askTab) {
          askTab.classList.remove('active');
          askTab.style.display = 'none';
        }
        recentTab.classList.remove('active');
        recentTab.style.display = 'none';
        setupTab.classList.add('active');
        setupTab.style.display = 'flex';
        setupTab.style.flexDirection = 'column';
        setupTab.style.gap = '16px';
        // Load advanced settings when setup tab opens
        loadAdvancedSettings();
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
  
  // Save prompt input to storage on change (debounced)
  let promptInputSaveTimeout = null;
  if (promptInput) {
    promptInput.addEventListener('input', () => {
      clearTimeout(promptInputSaveTimeout);
      promptInputSaveTimeout = setTimeout(() => {
        chrome.storage.local.set({ [STORAGE_PROMPT_INPUT]: promptInput.value });
      }, 500);
    });
  }
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
  
  // Load saved mode and style on popup open
  chrome.storage.local.get([STORAGE_ENHANCEMENT_MODE], async (result) => {
    const savedMode = result[STORAGE_ENHANCEMENT_MODE] || 'TEXT_ENHANCEMENT';
    selectedMode = savedMode;
    currentMode = savedMode;
    
    // Update UI to reflect saved mode
    modeOptions.forEach(opt => {
      if (opt.dataset.mode === savedMode) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
    
    // Load templates and style for the saved mode (only if enhance tab is visible)
    const enhanceTab = document.getElementById('enhance-section');
    if (enhanceTab && enhanceTab.classList.contains('active')) {
      await loadTemplates(savedMode);
      await loadStyleForEnhanceTab(savedMode);
    }
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
            saveEnhancedResult(enhancedPrompt);
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
  
  // Enhance tab style selector
  const enhanceStyleSelector = document.getElementById('enhance-style-selector');
  const enhanceStyleStatus = document.getElementById('enhance-style-status');
  const enhanceStyleStatusText = document.getElementById('enhance-style-status-text');
  const styleSettingsLink = document.getElementById('style-settings-link');
  
  // Advanced tab elements
  const instructionModeSelector = document.getElementById('instruction-mode-selector');
  const customStyleNameInput = document.getElementById('custom-style-name-input');
  const customInstructionContainer = document.getElementById('custom-instruction-container');
  const customInstructionInput = document.getElementById('custom-instruction-input');
  const saveInstructionButton = document.getElementById('save-instruction-button');
  const resetInstructionButton = document.getElementById('reset-instruction-button');
  const savedStylesList = document.getElementById('saved-styles-list');
  const savedStylesEmpty = document.getElementById('saved-styles-empty');
  
  let saveTimeout = null;
  let isSaving = false;
  
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
        // Update enhance tab style selector
        if (enhanceStyleSelector) {
          await updateStyleSelector(enhanceStyleSelector);
        }
      }
    } catch (error) {
      console.error('[Prompt Architect] Error loading templates:', error);
    }
  }
  
  // Load and display saved custom styles for Advanced tab
  async function loadSavedStyles(enhancementType) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getNamedCustomStyles',
        enhancementType: enhancementType
      });
      
      if (savedStylesList && savedStylesEmpty) {
        savedStylesList.innerHTML = '';
        
        if (response && response.success && response.styles) {
          const styles = response.styles;
          const styleNames = Object.keys(styles).sort();
          
          if (styleNames.length === 0) {
            savedStylesList.style.display = 'none';
            savedStylesEmpty.style.display = 'block';
          } else {
            savedStylesList.style.display = 'flex';
            savedStylesEmpty.style.display = 'none';
            
            // Create style items
            styleNames.forEach(styleName => {
              const styleItem = document.createElement('div');
              styleItem.className = 'saved-style-item';
              
              styleItem.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="flex: 1;">
                    <div class="saved-style-item-name">${styleName}</div>
                    <div class="saved-style-item-preview">
                      ${styles[styleName].substring(0, 80)}${styles[styleName].length > 80 ? '...' : ''}
                    </div>
                  </div>
                  <div style="display: flex; gap: 6px; margin-left: 12px; flex-shrink: 0;">
                    <button class="history-action-button" data-action="apply" data-name="${styleName}" style="font-size: 10px; padding: 4px 8px;">Apply</button>
                    <button class="history-action-button secondary" data-action="delete" data-name="${styleName}" style="font-size: 10px; padding: 4px 8px;">Delete</button>
                  </div>
                </div>
              `;
              
              // Add event listeners
              const applyBtn = styleItem.querySelector('[data-action="apply"]');
              const deleteBtn = styleItem.querySelector('[data-action="delete"]');
              
              // Click on item to edit
              styleItem.addEventListener('click', (e) => {
                if (e.target === applyBtn || e.target === deleteBtn || applyBtn.contains(e.target) || deleteBtn.contains(e.target)) {
                  return; // Don't edit if clicking buttons
                }
                // Load style into inputs for editing
                if (customStyleNameInput) customStyleNameInput.value = styleName;
                customInstructionInput.value = styles[styleName];
              });
              
              applyBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await applyNamedStyle(styleName);
              });
              
              deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${styleName}" style?`)) {
                  await deleteNamedStyle(styleName);
                  await loadSavedStyles(enhancementType);
                  if (enhanceStyleSelector) {
                    await updateStyleSelector(enhanceStyleSelector);
                    await loadStyleForEnhanceTab(enhancementType);
                  }
                }
              });
              
              savedStylesList.appendChild(styleItem);
            });
          }
        } else {
          savedStylesList.style.display = 'none';
          savedStylesEmpty.style.display = 'block';
        }
      }
    } catch (error) {
      console.error('[Prompt Architect] Error loading saved styles:', error);
    }
  }
  
  // Apply a named custom style
  async function applyNamedStyle(styleName) {
    try {
      await chrome.runtime.sendMessage({
        action: 'setActiveStyle',
        enhancementType: currentMode,
        styleKey: `custom:${styleName}`
      });
      
      // Update enhance tab selector if it exists
      if (enhanceStyleSelector) {
        enhanceStyleSelector.value = `custom:${styleName}`;
        updateEnhanceStyleIndicator();
      }
      
      alert(`"${styleName}" style is now active`);
    } catch (error) {
      console.error('[Prompt Architect] Error applying named style:', error);
      alert('Error applying style');
    }
  }
  
  // Delete a named custom style
  async function deleteNamedStyle(styleName) {
    try {
      await chrome.runtime.sendMessage({
        action: 'deleteNamedCustomStyle',
        enhancementType: currentMode,
        styleName: styleName
      });
    } catch (error) {
      console.error('[Prompt Architect] Error deleting named style:', error);
      throw error;
    }
  }
  
  // Load style for Enhance tab based on active style
  async function loadStyleForEnhanceTab(enhancementType) {
    try {
      // Get active style
      const activeResponse = await chrome.runtime.sendMessage({
        action: 'getActiveStyle',
        enhancementType: enhancementType
      });
      
      if (activeResponse && activeResponse.success && activeResponse.styleKey && enhanceStyleSelector) {
        enhanceStyleSelector.value = activeResponse.styleKey;
      } else if (enhanceStyleSelector) {
        // Fallback: check legacy custom instruction
      const response = await chrome.runtime.sendMessage({
        action: 'getCustomInstruction',
        enhancementType: enhancementType
      });
      
      if (response && response.success && response.instruction) {
          // Check if this instruction matches a template
          const matchingTemplate = findMatchingTemplate(response.instruction);
          
          if (matchingTemplate) {
            enhanceStyleSelector.value = `template:${matchingTemplate}`;
          } else {
            // Check if it matches a named custom style
            const stylesResponse = await chrome.runtime.sendMessage({
              action: 'getNamedCustomStyles',
              enhancementType: enhancementType
            });
            
            if (stylesResponse && stylesResponse.success && stylesResponse.styles) {
              const styles = stylesResponse.styles;
              for (const [name, instruction] of Object.entries(styles)) {
                if (instruction.trim() === response.instruction.trim()) {
                  enhanceStyleSelector.value = `custom:${name}`;
                  break;
                }
              }
            }
          }
        } else {
          enhanceStyleSelector.value = 'default';
        }
      }
      
      updateEnhanceStyleIndicator();
    } catch (error) {
      console.error('[Prompt Architect] Error loading style for enhance tab:', error);
    }
  }
  
  // Update enhance tab style indicator
  function updateEnhanceStyleIndicator() {
    if (!enhanceStyleStatus || !enhanceStyleStatusText || !enhanceStyleSelector) return;
    
    const source = enhanceStyleSelector.value;
    
    if (source === 'default') {
      enhanceStyleStatus.style.display = 'none';
    } else if (source && source.startsWith('template:')) {
      const templateKey = source.replace('template:', '');
      const templateName = templateKey.charAt(0).toUpperCase() + templateKey.slice(1).replace(/_/g, ' ');
      enhanceStyleStatus.style.display = 'flex';
      enhanceStyleStatus.className = 'status-indicator style-status-success show';
      enhanceStyleStatusText.textContent = `${templateName} style`;
    } else if (source && source.startsWith('custom:')) {
      const styleName = source.replace('custom:', '');
      enhanceStyleStatus.style.display = 'flex';
      enhanceStyleStatus.className = 'status-indicator style-status-success show';
      enhanceStyleStatusText.textContent = `${styleName} style`;
    } else {
      enhanceStyleStatus.style.display = 'none';
    }
  }
  
  // Update style selector dropdown with templates and named custom styles (for Enhance tab)
  async function updateStyleSelector(selector) {
    if (!selector) return;
    
    // Get current selection to preserve it
    const currentValue = selector.value;
    
    // Clear all options
    selector.innerHTML = '';
    
    // Add default option
    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'default';
    defaultOpt.textContent = 'Default';
    selector.appendChild(defaultOpt);
    
    // Add all templates
    const templates = currentTemplates;
    for (const [key, value] of Object.entries(templates)) {
      // Skip 'default' template and custom styles (they have custom: prefix)
      if (key === 'default' || key.startsWith('custom:')) continue;
      
      const option = document.createElement('option');
      option.value = `template:${key}`;
      option.textContent = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
      selector.appendChild(option);
    }
    
    // Add named custom styles
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getNamedCustomStyles',
        enhancementType: selectedMode
      });
      
      if (response && response.success && response.styles) {
        const customStyles = response.styles;
        const styleNames = Object.keys(customStyles).sort();
        
        if (styleNames.length > 0) {
          // Add separator
          const separator = document.createElement('option');
          separator.disabled = true;
          separator.textContent = '─── Your Styles ───';
          selector.appendChild(separator);
          
          // Add custom styles
          for (const styleName of styleNames) {
            const option = document.createElement('option');
            option.value = `custom:${styleName}`;
            option.textContent = styleName;
            selector.appendChild(option);
          }
        }
      }
    } catch (error) {
      console.error('[Prompt Architect] Error loading named custom styles:', error);
    }
    
    // Restore previous selection if it still exists
    if (currentValue && selector.querySelector(`option[value="${currentValue}"]`)) {
      selector.value = currentValue;
    }
  }
  
  // Check if a saved instruction matches a template
  function findMatchingTemplate(savedInstruction) {
    if (!savedInstruction || !currentTemplates) return null;
    
    // Compare the saved instruction with each template
    for (const [key, templateInstruction] of Object.entries(currentTemplates)) {
      // Skip default template
      if (key === 'default') continue;
      
      // Normalize both strings for comparison (trim whitespace)
      const normalizedSaved = savedInstruction.trim();
      const normalizedTemplate = templateInstruction.trim();
      
      if (normalizedSaved === normalizedTemplate) {
        return key;
      }
    }
    
    return null;
  }
  
  // Load custom instruction for Advanced tab (clears inputs, shows saved styles list)
  async function loadCustomInstruction(enhancementType) {
    // Clear inputs - user creates new styles here
    if (customStyleNameInput) customStyleNameInput.value = '';
    if (customInstructionInput) customInstructionInput.value = '';
    if (resetInstructionButton) resetInstructionButton.style.display = 'none';
    return false;
  }
  
  // Update preview based on current selection (preview removed - instructions hidden)
  function updatePreview() {
    // Preview functionality removed - instructions are not shown to users
    return;
  }
  
  // Auto-save style for Enhance tab (handles default, templates, and named custom styles)
  async function autoSaveStyleForEnhanceTab(source) {
    if (isSaving) return;
    
    // Show saving status in enhance tab
    if (enhanceStyleStatus && enhanceStyleStatusText) {
      enhanceStyleStatus.style.display = 'flex';
      enhanceStyleStatus.className = 'status-indicator style-status-saving show';
      enhanceStyleStatusText.textContent = 'Saving...';
    }
    
    isSaving = true;
    
    try {
      // Set active style
      await chrome.runtime.sendMessage({
        action: 'setActiveStyle',
        enhancementType: selectedMode,
        styleKey: source
      });
      
      if (source === 'default') {
        // Show success
        if (enhanceStyleStatus && enhanceStyleStatusText) {
          enhanceStyleStatus.className = 'status-indicator style-status-success show';
          enhanceStyleStatus.style.display = 'flex';
          enhanceStyleStatusText.textContent = 'Default style';
          setTimeout(() => {
            enhanceStyleStatus.style.display = 'none';
          }, 2000);
        }
      } else if (source && source.startsWith('template:')) {
        // Template selected
        const templateKey = source.replace('template:', '');
        const templateName = templateKey.charAt(0).toUpperCase() + templateKey.slice(1).replace(/_/g, ' ');
        
        // Show success
        if (enhanceStyleStatus && enhanceStyleStatusText) {
          enhanceStyleStatus.className = 'status-indicator style-status-success show';
          enhanceStyleStatus.style.display = 'flex';
          enhanceStyleStatusText.textContent = `${templateName} style`;
          setTimeout(() => {
            enhanceStyleStatus.style.display = 'none';
          }, 2000);
        }
      } else if (source && source.startsWith('custom:')) {
        // Named custom style selected
        const styleName = source.replace('custom:', '');
        
        // Show success
        if (enhanceStyleStatus && enhanceStyleStatusText) {
          enhanceStyleStatus.className = 'status-indicator style-status-success show';
          enhanceStyleStatus.style.display = 'flex';
          enhanceStyleStatusText.textContent = `${styleName} style`;
          setTimeout(() => {
            enhanceStyleStatus.style.display = 'none';
          }, 2000);
        }
      }
    } catch (error) {
      console.error('[Prompt Architect] Error auto-saving style:', error);
      if (enhanceStyleStatus && enhanceStyleStatusText) {
        enhanceStyleStatus.style.display = 'none';
      }
    } finally {
      isSaving = false;
    }
  }
  
  // Handle mode change in Enhance tab
  modeOptions.forEach(option => {
    option.addEventListener('click', async () => {
      const newMode = option.dataset.mode;
      selectedMode = newMode;
      currentMode = newMode;
      
      // Save mode to storage
      chrome.storage.local.set({ [STORAGE_ENHANCEMENT_MODE]: newMode });
      
      // Load templates and style for the new mode
      await loadTemplates(newMode);
      await loadStyleForEnhanceTab(newMode);
    });
  });
  
  // Handle mode change in Advanced tab
  if (instructionModeSelector) {
    instructionModeSelector.addEventListener('change', async () => {
      currentMode = instructionModeSelector.value;
      await loadTemplates(currentMode);
      await loadCustomInstruction(currentMode);
      await loadSavedStyles(currentMode);
    });
  }
  
  // Handle style selection in Enhance tab
  if (enhanceStyleSelector) {
    enhanceStyleSelector.addEventListener('change', async () => {
      const source = enhanceStyleSelector.value;
      
      // All selections (default, template, or named custom) auto-save
      await autoSaveStyleForEnhanceTab(source);
      updateEnhanceStyleIndicator();
    });
  }
  
  // Handle style settings link (scrolls to Advanced section in Setup tab)
  if (styleSettingsLink) {
    styleSettingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      const setupTabButton = document.querySelector('[data-tab="setup"]');
      if (setupTabButton) {
        setupTabButton.click();
        // Scroll to advanced section after a brief delay to allow tab to render
        setTimeout(() => {
          if (advancedSection) {
            advancedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Set the mode selector to match current mode
            if (instructionModeSelector && selectedMode) {
              instructionModeSelector.value = selectedMode;
              currentMode = selectedMode;
              loadTemplates(selectedMode).then(() => {
                loadCustomInstruction(selectedMode);
                loadSavedStyles(selectedMode);
              });
            }
          }
        }, 100);
      }
    });
  }
  
  // Auto-save style for Enhance tab
  async function autoSaveStyleForEnhanceTab(source) {
    if (isSaving) return;
    
    isSaving = true;
    
    try {
      if (source === 'default') {
        // Delete custom instruction to use default
          await chrome.runtime.sendMessage({
            action: 'deleteCustomInstruction',
          enhancementType: selectedMode
        });
      } else if (source && source.startsWith('template:')) {
        // Template selected
        const templateKey = source.replace('template:', '');
        const instruction = currentTemplates[templateKey];
        if (instruction) {
          await chrome.runtime.sendMessage({
            action: 'saveCustomInstruction',
            enhancementType: selectedMode,
            instruction: instruction
          });
        }
      }
      // Custom is handled separately - user needs to go to Advanced tab
        } catch (error) {
      console.error('[Prompt Architect] Error auto-saving style:', error);
    } finally {
      isSaving = false;
    }
  }
  
  // Save named custom style in Advanced tab
  if (saveInstructionButton) {
    saveInstructionButton.addEventListener('click', async () => {
      const styleName = customStyleNameInput ? customStyleNameInput.value.trim() : '';
      const instruction = customInstructionInput.value.trim();
      
      if (!styleName) {
        alert('Please enter a name for your custom style');
        if (customStyleNameInput) customStyleNameInput.focus();
          return;
        }
      
        if (!instruction) {
        alert('Please enter the custom instruction text');
        if (customInstructionInput) customInstructionInput.focus();
          return;
      }
      
      try {
        // Ensure we're using the correct mode (sync with instruction mode selector)
        const modeToUse = instructionModeSelector ? instructionModeSelector.value : currentMode;
        
        if (!modeToUse) {
          alert('Error: No enhancement mode selected');
          return;
        }
        
        // Validate inputs before sending
        if (!styleName || styleName.trim().length === 0) {
          alert('Please enter a name for your custom style');
          if (customStyleNameInput) customStyleNameInput.focus();
          return;
        }
        
        if (!instruction || instruction.trim().length === 0) {
          alert('Please enter the custom instruction text');
          if (customInstructionInput) customInstructionInput.focus();
          return;
        }
        
        // Add timeout to detect if background script isn't responding
        const messagePromise = chrome.runtime.sendMessage({
          action: 'saveNamedCustomStyle',
          enhancementType: modeToUse,
          styleName: styleName.trim(),
          instruction: instruction.trim()
        });
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timed out. Please reload the extension and try again.')), 10000);
        });
        
        const response = await Promise.race([messagePromise, timeoutPromise]);
        
        if (!response) {
          throw new Error('No response from background script. Please reload the extension and try again.');
        }
          
          if (response && response.success) {
          // Update currentMode to match what we just saved
          currentMode = modeToUse;
          // Set as active style
          const setActiveResponse = await chrome.runtime.sendMessage({
            action: 'setActiveStyle',
            enhancementType: currentMode,
            styleKey: `custom:${styleName}`
          });
          
          if (!setActiveResponse || !setActiveResponse.success) {
            console.warn('[Prompt Architect] Failed to set active style, but style was saved');
          }
          
          // Clear inputs
          if (customStyleNameInput) customStyleNameInput.value = '';
          customInstructionInput.value = '';
          
          // Reload saved styles list
          await loadSavedStyles(currentMode);
          
          // Update enhance tab style selector
          if (enhanceStyleSelector) {
            await updateStyleSelector(enhanceStyleSelector);
            enhanceStyleSelector.value = `custom:${styleName}`;
            updateEnhanceStyleIndicator();
          }
          
          // Show success message
          const wasEdit = response.wasEdit || false;
          alert(`"${styleName}" style ${wasEdit ? 'updated' : 'saved'} and applied!`);
          } else {
          const errorMsg = response?.error || 'Unknown error';
          console.error('[Prompt Architect] Error saving style:', errorMsg);
          alert('Error saving style: ' + errorMsg);
          }
        } catch (error) {
        console.error('[Prompt Architect] Error saving named style:', error);
        alert('Error saving style: ' + (error.message || 'Unknown error'));
      }
    });
  }
  
  // Reset instruction (clear active style to default)
  if (resetInstructionButton) {
    resetInstructionButton.addEventListener('click', async () => {
        try {
          await chrome.runtime.sendMessage({
          action: 'setActiveStyle',
          enhancementType: currentMode,
          styleKey: 'default'
          });
        
        // Clear inputs
        if (customStyleNameInput) customStyleNameInput.value = '';
          customInstructionInput.value = '';
        resetInstructionButton.style.display = 'none';
        
        // Update enhance tab style selector if it exists
        if (enhanceStyleSelector) {
          enhanceStyleSelector.value = 'default';
          updateEnhanceStyleIndicator();
        }
        
        alert('Reset to default style');
        } catch (error) {
        console.error('[Prompt Architect] Error resetting style:', error);
        alert('Error resetting style');
      }
    });
  }
  
  // Load advanced settings when tab is opened
  async function loadAdvancedSettings() {
    if (!instructionModeSelector) return;
    
    // Sync instruction mode selector with selectedMode
    instructionModeSelector.value = selectedMode;
    currentMode = selectedMode;
    
    await loadTemplates(currentMode);
    await loadCustomInstruction(currentMode);
    await loadSavedStyles(currentMode);
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
  
  // Save ask input to storage on change (debounced)
  let askInputSaveTimeout = null;
  if (askInput) {
    askInput.addEventListener('input', () => {
      clearTimeout(askInputSaveTimeout);
      askInputSaveTimeout = setTimeout(() => {
        chrome.storage.local.set({ [STORAGE_ASK_INPUT]: askInput.value });
      }, 500);
    });
  }
  
  // Save ask result to storage
  function saveAskResult(result) {
    if (result && !result.startsWith('Error:')) {
      chrome.storage.local.set({ [STORAGE_ASK_RESULT]: result });
    }
  }
  
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
  
  // Update button text when toggle changes
  if (enhanceQuestionToggle) {
    enhanceQuestionToggle.addEventListener('change', updateAskButtonText);
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

      // Check for API key
      chrome.storage.local.get([STORAGE_PROVIDER, ...Object.values(STORAGE_KEYS)], async (result) => {
        const selectedProvider = result[STORAGE_PROVIDER] || 'gemini';
        const storageKey = STORAGE_KEYS[selectedProvider];
        const apiKey = result[storageKey];
        
        if (!apiKey) {
          showAskStatus('Please set your API key in the Setup tab first.', 'error');
          // Switch to setup tab
          const setupTabButton = document.querySelector('[data-tab="setup"]');
          if (setupTabButton) {
            setupTabButton.click();
          }
          return;
        }

        // Disable button and show loading
        askButton.disabled = true;
        if (askButtonText) askButtonText.style.display = 'none';
        if (askSpinner) askSpinner.classList.add('show');
        if (askResultContainer) askResultContainer.classList.remove('show');

        try {
          // If enhance toggle is enabled, enhance the question first
          if (enhanceQuestionToggle && enhanceQuestionToggle.checked) {
            showAskStatus('Enhancing question...', 'info', true);
            
            // Enhance the question using TEXT_ENHANCEMENT mode
            const enhanceResponse = await chrome.runtime.sendMessage({
              action: 'enhancePrompt',
              prompt: question,
              enhancementType: 'TEXT_ENHANCEMENT',
              provider: selectedProvider
            });

            const enhancedQuestion = enhanceResponse?.enhancedPrompt || question;

            if (enhancedQuestion.startsWith("Error:")) {
              // If enhancement fails, use original question
              showAskStatus('Enhancement failed, using original question...', 'warning', true);
            } else {
              // Update input with enhanced question
              question = enhancedQuestion;
              if (askInput) {
                askInput.value = question;
              }
              showAskStatus('Question enhanced, asking now...', 'info', true);
            }
          }

          // Now ask the question (enhanced or original)
          const response = await chrome.runtime.sendMessage({
            action: 'askQuestion',
            question: question,
            provider: selectedProvider
          });

          const answer = response?.answer || "Error: Failed to receive answer.";

          if (answer.startsWith("Error:")) {
            showAskStatus(answer.replace("Error: ", ""), 'error');
            if (askResultContainer) askResultContainer.classList.remove('show');
          } else {
            if (askResultText) askResultText.textContent = answer;
            if (askResultContainer) askResultContainer.classList.add('show');
            saveAskResult(answer);
            showAskStatus('Answer received!', 'success');
          }
        } catch (error) {
          console.error('Ask question error:', error);
          showAskStatus('Error: Communication issue. Please try again.', 'error');
          if (askResultContainer) askResultContainer.classList.remove('show');
        } finally {
          // Re-enable button and hide loading
          askButton.disabled = false;
          if (askButtonText) askButtonText.style.display = 'inline';
          if (askSpinner) askSpinner.classList.remove('show');
        }
      });
    });
  }
  
  // Initialize button text
  updateAskButtonText();
  
  /**
   * Copy answer to clipboard
   */
  if (askCopyButton && askResultText) {
    askCopyButton.addEventListener('click', async () => {
      const answer = askResultText.textContent;
      
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

  // Restore saved inputs and results on popup open
  function restoreSavedContent() {
    chrome.storage.local.get([
      STORAGE_PROMPT_INPUT,
      STORAGE_ASK_INPUT,
      STORAGE_ENHANCED_RESULT,
      STORAGE_ASK_RESULT
    ], (result) => {
      // Restore prompt input
      if (promptInput && result[STORAGE_PROMPT_INPUT]) {
        promptInput.value = result[STORAGE_PROMPT_INPUT];
      }
      
      // Restore enhanced result
      if (resultText && result[STORAGE_ENHANCED_RESULT]) {
        resultText.textContent = result[STORAGE_ENHANCED_RESULT];
        if (resultContainer) {
          resultContainer.classList.add('show');
        }
      }
      
      // Restore ask input
      if (askInput && result[STORAGE_ASK_INPUT]) {
        askInput.value = result[STORAGE_ASK_INPUT];
      }
      
      // Restore ask result
      if (askResultText && result[STORAGE_ASK_RESULT]) {
        askResultText.textContent = result[STORAGE_ASK_RESULT];
        if (askResultContainer) {
          askResultContainer.classList.add('show');
        }
      }
    });
  }

  // Initial load
  loadApiKey();
  checkAndShowOnboarding();
  restoreSavedContent();
});
