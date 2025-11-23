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
  const STORAGE_ENHANCEMENT_MODE = 'popupEnhancementMode'; // Separate from injected button mode
  const STORAGE_PROMPT_INPUT = 'savedPromptInput';
  const STORAGE_ASK_INPUT = 'savedAskInput';
  const STORAGE_ENHANCED_RESULT = 'savedEnhancedResult';
  const STORAGE_ASK_RESULT = 'savedAskResult';
  const STORAGE_ENHANCE_QUESTION_TOGGLE = 'enhanceQuestionToggle';
  const STORAGE_INJECT_BUTTON_ENABLED = 'injectButtonEnabled';
  const STORAGE_ZOOM_LEVEL = 'popupZoomLevel';
  const STORAGE_SHOW_STYLE_SELECTOR = 'showStyleSelector';
  
  // Provider configuration
  const PROVIDERS = {
    gemini: {
      name: 'Google Gemini',
      placeholder: 'AIza... (paste your key here)',
      helpUrl: 'https://aistudio.google.com/api-keys',
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
  
  // No auto-save - start fresh each time popup opens
  const enhanceButton = document.getElementById('enhance-button');
  const enhanceButtonText = document.getElementById('enhance-button-text');
  const enhanceSpinner = document.getElementById('enhance-spinner');
  const statusMessage = document.getElementById('status-message');
  const resultContainer = document.getElementById('result-container');
  const resultText = document.getElementById('result-text');
  const copyButton = document.getElementById('copy-button');

  // Verify all elements exist
  if (!promptInput || !enhanceButton) {
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
      // Update API key notice in Enhance tab
      updateApiKeyNotice();
  }
  
  /**
   * Shows/hides API key CTA and enhance button based on API key status
   */
  async function updateApiKeyNotice() {
    const apiKeyCta = document.getElementById('api-key-cta');
    const enhanceButton = document.getElementById('enhance-button');
    if (!apiKeyCta || !enhanceButton) return;
    
    const hasKey = await new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_PROVIDER, ...Object.values(STORAGE_KEYS)], (result) => {
        const selectedProvider = result[STORAGE_PROVIDER] || 'gemini';
        const storageKey = STORAGE_KEYS[selectedProvider];
        const apiKey = result[storageKey];
        resolve(!!apiKey);
      });
    });
    
    if (hasKey) {
      apiKeyCta.style.display = 'none';
    } else {
      apiKeyCta.style.display = 'block';
    }
    // Enhance button is always visible
    enhanceButton.style.display = 'block';
    }
  
  // Handle setup CTA button click
  const setupCtaButton = document.getElementById('setup-cta-button');
  if (setupCtaButton) {
    setupCtaButton.addEventListener('click', () => {
      // Switch to setup tab
      const setupTabButton = document.querySelector('[data-tab="setup"]');
      if (setupTabButton) {
        setupTabButton.click();
      }
    });
  }
  
  // Handle API key notice link (legacy - may not exist)
  const apiKeyNoticeLink = document.getElementById('api-key-notice-link');
  if (apiKeyNoticeLink) {
    apiKeyNoticeLink.addEventListener('click', (e) => {
      e.preventDefault();
      const setupTabButton = document.querySelector('[data-tab="setup"]');
      if (setupTabButton) {
        setupTabButton.click();
      }
    });
    
    // Subtle hover effect (Apple-style)
    apiKeyNoticeLink.addEventListener('mouseenter', () => {
      apiKeyNoticeLink.style.opacity = '0.7';
    });
    apiKeyNoticeLink.addEventListener('mouseleave', () => {
      apiKeyNoticeLink.style.opacity = '1';
    });
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
      
      // Update API key notice
      updateApiKeyNotice();
    });
  }
  
  // Handle enhance setup button
  const enhanceSetupButton = document.getElementById('enhance-setup-button');
  if (enhanceSetupButton) {
    enhanceSetupButton.addEventListener('click', () => {
      const setupTabButton = document.querySelector('[data-tab="setup"]');
      if (setupTabButton) {
        setupTabButton.click();
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
              updateApiKeyNotice();
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
    
    // Load styles for the saved mode
    if (typeof loadStylesForMode === 'function') {
      await loadStylesForMode(savedMode);
    }
    if (typeof loadCustomStylesList === 'function') {
      await loadCustomStylesList();
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
    } else {
      // Fallback if UI not found
      selectedMode = mode;
      chrome.storage.local.set({ [STORAGE_ENHANCEMENT_MODE]: selectedMode }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving enhancement mode:', chrome.runtime.lastError);
        }
      });
    }
  }
  
  // Handle manual mode selection
  modeOptions.forEach(option => {
    option.addEventListener('click', async () => {
      const newMode = option.dataset.mode;
      
      // User manually selected a mode - this is a permanent override until input is cleared
      userManuallySelectedMode = true;
      // Remove any auto-detected styling when user manually selects
      modeOptions.forEach(opt => opt.classList.remove('auto-detected'));
      
      // Update mode and save
      updateSelectedMode(newMode, false);
      selectedMode = newMode;
      currentMode = newMode;
      
      // Load styles for the new mode
      loadStylesForMode(newMode);
      
      // Manual selection persists - no timeout reset
      // Auto-detection will only resume when input is cleared
    });
  });

  // ============================================================================
  // STYLE MANAGEMENT
  // ============================================================================
  
  const styleSelector = document.getElementById('style-selector');
  const customizeStyleButton = document.getElementById('customize-style-button');
  const customStylesList = document.getElementById('custom-styles-list');
  const addCustomStyleButton = document.getElementById('add-custom-style-button');

  // Template options for each mode
  const TEMPLATE_OPTIONS = {
    TEXT_ENHANCEMENT: ['default', 'concise', 'detailed', 'creative', 'technical'],
    CODE_ENHANCEMENT: ['default', 'minimal', 'comprehensive', 'production-ready'],
    IMAGE_ENHANCEMENT: ['default', 'minimal', 'detailed', 'cinematic'],
    VIDEO_ENHANCEMENT: ['default', 'concise', 'cinematic', 'ad']
  };

  /**
   * Loads and populates styles for the current mode
   */
  async function loadStylesForMode(mode) {
    if (!styleSelector) return;

    // Clear existing options except default
    styleSelector.innerHTML = '<option value="default">Default</option>';

    try {
      // Load templates
      const templates = TEMPLATE_OPTIONS[mode] || ['default'];
      templates.forEach(template => {
        if (template !== 'default') {
          const option = document.createElement('option');
          option.value = `template:${template}`;
          option.textContent = template.charAt(0).toUpperCase() + template.slice(1);
          styleSelector.appendChild(option);
        }
      });

      // Load custom styles
      const response = await chrome.runtime.sendMessage({
        action: 'getNamedCustomStyles',
        enhancementType: mode
      });

      if (response.success && response.styles) {
        Object.keys(response.styles).forEach(styleName => {
          const option = document.createElement('option');
          option.value = `custom:${styleName}`;
          option.textContent = `★ ${styleName}`;
          styleSelector.appendChild(option);
        });
      }

      // Load active style
      const activeResponse = await chrome.runtime.sendMessage({
        action: 'getActiveStyle',
        enhancementType: mode
      });

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
            styleSelector.value = styleKey;
            console.log(`Loaded active custom style "${styleName}" for ${mode}`);
          } else {
            // Custom style no longer exists, reset to default
            console.warn(`Custom style "${styleName}" not found, resetting to default`);
            styleSelector.value = 'default';
            // Update storage to reflect default
            await chrome.runtime.sendMessage({
              action: 'setActiveStyle',
              enhancementType: mode,
              styleKey: 'default'
            });
          }
        } else {
          // Template or default style
          styleSelector.value = styleKey;
          console.log(`Loaded active style "${styleKey}" for ${mode}`);
        }
      } else {
        styleSelector.value = 'default';
        console.log(`No active style found for ${mode}, using default`);
      }
    } catch (error) {
      console.error('Error loading styles:', error);
    }
  }

  /**
   * Handles style selection change
   */
  if (styleSelector) {
    styleSelector.addEventListener('change', async (e) => {
      const styleKey = e.target.value;
      const currentMode = selectedMode; // Capture current mode
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'setActiveStyle',
          enhancementType: currentMode,
          styleKey: styleKey
        });
        
        if (response && response.success) {
          // Show subtle feedback
          styleSelector.style.borderColor = 'var(--primary-blue)';
          setTimeout(() => {
            styleSelector.style.borderColor = '';
          }, 300);
          
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
  }

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
            item.innerHTML = `
              <div>
                <div class="custom-style-name">${styleName}</div>
                <div class="custom-style-mode">${mode.replace('_ENHANCEMENT', '').replace('_', ' ')}</div>
              </div>
              <div class="custom-style-actions">
                <button class="premium-button-secondary edit-style-btn" data-mode="${mode}" data-name="${styleName}">Edit</button>
                <button class="premium-button-secondary delete-style-btn" data-mode="${mode}" data-name="${styleName}">Delete</button>
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

  // Handle customize button click
  if (customizeStyleButton) {
    customizeStyleButton.addEventListener('click', () => {
      showCustomStyleModal(selectedMode);
    });
  }

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
          
          // Only update if detected mode is different from current
          if (detectedMode !== selectedMode) {
            updateSelectedMode(detectedMode, true);
            loadStylesForMode(detectedMode);
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

          // Check for runtime errors
          if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            showStatus(`Error: ${chrome.runtime.lastError.message || 'Extension context invalidated. Please reload the extension.'}`, 'error');
            if (resultContainer) resultContainer.classList.remove('show');
            return;
          }

          // Check if response is null/undefined (background script didn't respond)
          if (!response) {
            console.error('No response from background script');
            showStatus('Error: No response from background script. Please check if the extension is enabled and try again.', 'error');
            if (resultContainer) resultContainer.classList.remove('show');
            return;
          }

          const enhancedPrompt = response?.enhancedPrompt || "Error: Failed to receive enhanced prompt.";

          if (enhancedPrompt.startsWith("Error:")) {
            showStatus(enhancedPrompt.replace("Error: ", ""), 'error');
            if (resultContainer) resultContainer.classList.remove('show');
          } else {
            if (resultText) resultText.textContent = enhancedPrompt;
            if (resultContainer) resultContainer.classList.add('show');
            // No save - start fresh each time
            showStatus('Prompt enhanced successfully!', 'success');
          }
        } catch (error) {
          console.error('Enhancement error:', error);
          const errorMessage = error.message || 'Unknown error occurred';
          showStatus(`Error: ${errorMessage}. Please check the console for details.`, 'error');
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
   * Shows onboarding welcome message with visual demonstration
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
      border-radius: 20px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    modal.innerHTML = `
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="font-size: 64px; margin-bottom: 16px;">✨</div>
        <h2 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em;">Welcome to Prompt Helper</h2>
        <p style="margin: 0; font-size: 15px; color: var(--text-secondary); line-height: 1.5;">
          Transform your prompts into powerful AI instructions
        </p>
      </div>
      
      <!-- Before/After Example -->
      <div style="margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, rgba(0, 122, 255, 0.05) 0%, rgba(0, 122, 255, 0.02) 100%); border-radius: 12px; border: 1px solid rgba(0, 122, 255, 0.1);">
        <div style="margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Before</span>
          </div>
          <div style="padding: 12px; background: rgba(0, 0, 0, 0.03); border-radius: 8px; border-left: 3px solid rgba(0, 0, 0, 0.1);">
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary); font-style: italic;">"write a blog post"</p>
          </div>
        </div>
        <div style="text-align: center; margin: 12px 0;">
          <div style="font-size: 20px; color: var(--primary-blue);">↓</div>
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 600; color: var(--primary-blue); text-transform: uppercase; letter-spacing: 0.05em;">After</span>
          </div>
          <div style="padding: 12px; background: rgba(0, 122, 255, 0.08); border-radius: 8px; border-left: 3px solid var(--primary-blue);">
            <p style="margin: 0; font-size: 13px; color: var(--text-primary); font-weight: 500;">"Write a comprehensive, engaging blog post that explores [topic] with depth and clarity. Include an attention-grabbing introduction, well-structured body paragraphs with supporting evidence, and a compelling conclusion that leaves readers with actionable insights."</p>
          </div>
        </div>
      </div>
      
      <!-- Where to Find Improve Button -->
      <div style="margin-bottom: 24px; padding: 20px; background: rgba(0, 122, 255, 0.05); border-radius: 12px; border-left: 3px solid var(--primary-blue);">
        <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">📍 Where to Find the "Improve" Button</p>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
          Look for the <strong style="color: var(--primary-blue);">"Improve"</strong> button next to the Send button on:
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
          <span style="padding: 6px 12px; background: white; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--text-primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">ChatGPT</span>
          <span style="padding: 6px 12px; background: white; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--text-primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">Gemini</span>
          <span style="padding: 6px 12px; background: white; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--text-primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">Claude</span>
          <span style="padding: 6px 12px; background: white; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--text-primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">Grok</span>
          <span style="padding: 6px 12px; background: white; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--text-primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">Perplexity</span>
        </div>
        <div style="padding: 12px; background: rgba(0, 122, 255, 0.1); border-radius: 8px; margin-top: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">💡</span>
            <p style="margin: 0; font-size: 12px; color: var(--text-primary); line-height: 1.5;">
              The button appears automatically when you visit these sites. Just type your prompt and click <strong>"Improve"</strong> before sending!
            </p>
          </div>
        </div>
      </div>
      
      <!-- Quick Start -->
      <div style="margin-bottom: 24px; padding: 16px; background: rgba(0, 122, 255, 0.05); border-radius: 8px; border-left: 3px solid var(--primary-blue);">
        <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: var(--text-primary);">🚀 Quick Start:</p>
        <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-secondary); line-height: 1.8;">
          <li>Get an API key from your AI provider (free options available)</li>
          <li>Enter it in the Setup tab</li>
          <li>Visit ChatGPT, Gemini, or Claude and look for the "Improve" button!</li>
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
      
      // Switch to enhance tab
      const enhanceTabButton = document.querySelector('[data-tab="enhance"]');
      if (enhanceTabButton) {
        enhanceTabButton.click();
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
  // Style selector removed
  
  let saveTimeout = null;
  let isSaving = false;
  
  let currentTemplates = {};
  let currentMode = 'TEXT_ENHANCEMENT';
  
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
            // No save - start fresh each time
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
    const container = document.querySelector('.container') || document.body;
    if (container) {
      // Use CSS zoom property (better for popups)
      container.style.zoom = zoomLevel;
      // Fallback for browsers that don't support zoom
      if (!container.style.zoom) {
        container.style.transform = `scale(${zoomLevel})`;
        container.style.transformOrigin = 'top left';
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
   * Updates style selector visibility based on toggle state
   */
  function updateStyleSelectorVisibility(show) {
    if (styleSelectorContainer) {
      styleSelectorContainer.style.display = show ? 'block' : 'none';
    }
  }
  
  /**
   * Loads saved style selector visibility preference
   */
  function loadStyleSelectorVisibility() {
    chrome.storage.local.get([STORAGE_SHOW_STYLE_SELECTOR], (result) => {
      const show = result[STORAGE_SHOW_STYLE_SELECTOR] === true;
      if (showStyleSelectorToggle) {
        showStyleSelectorToggle.checked = show;
      }
      updateStyleSelectorVisibility(show);
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

  // Initial load - start fresh
  loadApiKey();
  checkAndShowOnboarding();
  clearSavedContent();
  updateApiKeyNotice();
});

