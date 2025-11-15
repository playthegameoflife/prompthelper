/**
 * content.js
 * Injects the premium Prompt Architect UI (Mode Selector + Enhance Button) 
 * into target AI chat interfaces. Designed with a clean, Apple-inspired aesthetic.
 */

// Define supported platforms and their domain patterns
const PLATFORMS = {
    chatgpt: {
        name: 'ChatGPT',
        domains: ['chat.openai.com', 'chatgpt.com', 'www.chatgpt.com'],
        icon: '🤖'
    },
    gemini: {
        name: 'Google Gemini',
        domains: ['gemini.google.com', 'bard.google.com'],
        icon: '💎'
    },
    claude: {
        name: 'Anthropic Claude',
        domains: ['claude.ai', 'console.anthropic.com'],
        icon: '🧠'
    },
    grok: {
        name: 'Grok / X',
        domains: ['x.com', 'twitter.com'],
        icon: '🐦'
    },
    perplexity: {
        name: 'Perplexity',
        domains: ['perplexity.ai', 'www.perplexity.ai'],
        icon: '🔍'
    },
    generic: {
        name: 'Other Sites',
        domains: ['*'], // Wildcard for all other sites
        icon: '🌐'
    }
};

// Storage key for platform preferences
const STORAGE_PLATFORMS = 'enabledPlatforms';

/**
 * Detects the current platform based on hostname
 * @returns {string|null} Platform key or null if not detected
 */
function detectPlatform() {
    const hostname = window.location.hostname;
    
    for (const [key, platform] of Object.entries(PLATFORMS)) {
        if (key === 'generic') continue; // Skip generic, it's a fallback
        
        for (const domain of platform.domains) {
            if (hostname === domain || hostname.endsWith('.' + domain)) {
                console.log('[Gemini Architect] Detected platform:', key, 'on', hostname);
                return key;
            }
        }
    }
    
    // Return generic for unknown sites
    console.log('[Gemini Architect] Unknown platform, using generic:', hostname);
    return 'generic';
}

/**
 * Gets default platform preferences for first install
 */
function getDefaultPlatformPreferences() {
    return {
        chatgpt: true,
        gemini: true,
        claude: true,
        grok: true,
        perplexity: true,
        generic: false
    };
}

/**
 * Initializes platform preferences with defaults if not set
 */
function initializePlatformPreferences() {
    chrome.storage.local.get([STORAGE_PLATFORMS], (result) => {
        // If no preferences exist, initialize with defaults
        if (!result[STORAGE_PLATFORMS] || Object.keys(result[STORAGE_PLATFORMS]).length === 0) {
            const defaults = getDefaultPlatformPreferences();
            chrome.storage.local.set({ [STORAGE_PLATFORMS]: defaults }, () => {
                console.log('[Gemini Architect] Initialized platform preferences with defaults');
            });
        }
    });
}

/**
 * Checks if the current platform is enabled
 * @returns {Promise<boolean>} True if platform is enabled
 */
async function isPlatformEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_PLATFORMS], (result) => {
            const enabledPlatforms = result[STORAGE_PLATFORMS];
            const currentPlatform = detectPlatform();
            const defaults = getDefaultPlatformPreferences();
            
            // Use stored value, or default if not set
            const isEnabled = enabledPlatforms && enabledPlatforms.hasOwnProperty(currentPlatform)
                ? enabledPlatforms[currentPlatform]
                : defaults[currentPlatform];
            
            console.log('[Gemini Architect] Platform enabled check:', currentPlatform, '=', isEnabled);
            resolve(isEnabled);
        });
    });
}

// Initialize platform preferences on script load
initializePlatformPreferences();

// Define common CSS selectors for major AI platforms
const SELECTORS = {
    // Comprehensive selectors for ChatGPT/OpenAI interfaces (multiple fallbacks for different versions)
    PROMPT_INPUT: [
        'textarea[id^="prompt-textarea"]',
        'textarea[data-testid="textarea-input"]',
        'textarea:not([readonly])[class*="text-area-"]',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="message"]',
        'textarea[role="textbox"]',
        'textarea[aria-label*="message" i]',
        'textarea[aria-label*="prompt" i]',
        'form textarea:not([readonly])',
        'textarea[class*="input" i]',
        'textarea[class*="prompt" i]'
    ].join(', '),
    BUTTON_CONTAINER_PARENT: 'form, footer, .w-full.flex.flex-col.items-center.justify-center.gap-2, [class*="input-container"], [class*="prompt-container"]',
};

// Define the modes for the segmented control (keys must match background.js)
const ENHANCEMENT_MODES = [
    { label: 'Text', value: 'TEXT_ENHANCEMENT', icon: '📝' },
    { label: 'Code', value: 'CODE_ENHANCEMENT', icon: '💻' },
    { label: 'Image', value: 'IMAGE_ENHANCEMENT', icon: '🎨' },
];

/**
 * Finds the send button relative to the input field.
 * Uses multiple selector strategies to locate the send/submit button.
 * @param {HTMLElement} inputElement - The textarea input element
 * @param {HTMLElement} container - The container to search within
 * @returns {HTMLElement|null} The send button element or null
 */
function findSendButton(inputElement, container) {
    console.log('[Gemini Architect] Finding send button near input element');
    
    // Strategy 1: Find button in the same container
    const sendButtonSelectors = [
        // Standard submit buttons
        'button[type="submit"]',
        
        // ChatGPT/OpenAI patterns
        'button[aria-label*="Send" i]',
        'button[data-testid*="send" i]',
        'button[title*="Send" i]',
        
        // Claude patterns
        'button[aria-label*="Send message" i]',
        'button[class*="send"]',
        
        // Gemini patterns (expanded)
        'button[aria-label*="Submit" i]',
        'button[aria-label*="Send" i]',
        'button[data-testid*="submit" i]',
        'button[data-testid*="send" i]',
        'button[class*="send"]',
        'button[class*="submit"]',
        'button[class*="send-button"]',
        // Gemini-specific: buttons in composer/input containers
        '[class*="composer"] button[type="submit"]',
        '[class*="input-container"] button',
        '[data-testid*="composer"] button',
        // Gemini: look for buttons with specific data attributes
        'button[data-id*="send"]',
        'button[data-id*="submit"]',
        'button[jsname*="send"]',
        'button[jsname*="submit"]',
        
        // Grok/X patterns
        'button[data-testid*="tweetButton"]',
        'button[data-testid*="tweet"]',
        'button[aria-label*="Post" i]',
        
        // Perplexity patterns
        'button[type="submit"][class*="search"]',
        'button[aria-label*="Search" i]',
        
        // Generic patterns
        'button svg[viewBox*="0 0"]', // Many send buttons have SVG icons
    ];
    
    // Strategy 1: Search in container
    for (const selector of sendButtonSelectors) {
        try {
            const button = container.querySelector(selector);
            if (button && button.offsetParent !== null) { // Check if visible
                console.log('[Gemini Architect] Found send button with selector:', selector, button);
                return button;
            }
        } catch (e) {
            // Continue if selector fails
        }
    }
    
    // Strategy 2: Search in parent hierarchy (expanded search radius)
    let current = inputElement.parentElement;
    let attempts = 0;
    while (current && attempts < 20) { // Increased from 10 to 20
        for (const selector of sendButtonSelectors) {
            try {
                const button = current.querySelector(selector);
                if (button && button !== inputElement && button.offsetParent !== null) {
                    console.log('[Gemini Architect] Found send button in parent hierarchy:', button);
                    return button;
                }
            } catch (e) {
                // Continue if selector fails
            }
        }
        current = current.parentElement;
        attempts++;
    }
    
    // Strategy 3: Search entire document for buttons near input (Gemini fallback)
    const inputRect = inputElement.getBoundingClientRect();
    const allButtons = document.querySelectorAll('button');
    let closestButton = null;
    let closestDistance = Infinity;
    
    for (const button of allButtons) {
        if (button.offsetParent === null) continue; // Skip hidden buttons
        
        const buttonRect = button.getBoundingClientRect();
        const distance = Math.abs(buttonRect.top - inputRect.bottom) + Math.abs(buttonRect.left - inputRect.right);
        
        // Check if button is likely a send button
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const title = (button.getAttribute('title') || '').toLowerCase();
        const hasSendIcon = button.querySelector('svg');
        const isSubmit = button.type === 'submit';
        
        if ((hasSendIcon || isSubmit || ariaLabel.includes('send') || ariaLabel.includes('submit') || 
             title.includes('send') || title.includes('submit')) && distance < 200) {
            if (distance < closestDistance) {
                closestDistance = distance;
                closestButton = button;
            }
        }
    }
    
    if (closestButton) {
        console.log('[Gemini Architect] Found send button by proximity:', closestButton);
        return closestButton;
    }
    
    // Strategy 4: Look for buttons with common send button patterns (icon-based)
    for (const button of allButtons) {
        if (button.offsetParent === null) continue;
        
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const title = (button.getAttribute('title') || '').toLowerCase();
        const hasSendIcon = button.querySelector('svg');
        
        if (hasSendIcon && (ariaLabel.includes('send') || title.includes('send') || 
            ariaLabel.includes('submit') || title.includes('submit'))) {
            console.log('[Gemini Architect] Found send button by pattern matching:', button);
            return button;
        }
    }
    
    // Strategy 5: Last resort - find any button near the input
    for (const button of allButtons) {
        if (button.offsetParent === null) continue;
        const buttonRect = button.getBoundingClientRect();
        const distance = Math.abs(buttonRect.top - inputRect.bottom) + Math.abs(buttonRect.left - inputRect.right);
        if (distance < 100 && button.type === 'submit') {
            console.log('[Gemini Architect] Found nearby submit button as fallback:', button);
            return button;
        }
    }
    
    console.warn('[Gemini Architect] Could not find send button - will use fallback positioning');
    return null;
}

/**
 * Finds the nearest container relative to the prompt input to inject our controls.
 * Enhanced with multiple fallback strategies for ChatGPT's dynamic structure.
 */
function findInjectionTarget(inputElement) {
    console.log('[Gemini Architect] Finding injection target for input element:', inputElement);
    
    // Strategy 1: Find parent with submit button
    let current = inputElement.parentElement;
    let attempts = 0;
    while (current && attempts < 15) {
        const hasSubmitButton = current.querySelector('button[type="submit"]') || 
                                current.querySelector('button[aria-label*="Send" i]') ||
                                current.querySelector('button[aria-label*="submit" i]') ||
                                current.querySelector('button[data-testid*="send" i]');
        if (hasSubmitButton) {
            console.log('[Gemini Architect] Found container with submit button:', current);
            return current;
        }
        current = current.parentElement;
        attempts++;
    }
    
    // Strategy 2: Find form element
    const formElement = inputElement.closest('form');
    if (formElement) {
        console.log('[Gemini Architect] Using form element as container:', formElement);
        return formElement;
    }
    
    // Strategy 3: Find parent with specific classes (ChatGPT patterns)
    current = inputElement.parentElement;
    attempts = 0;
    while (current && attempts < 10) {
        const classList = current.className || '';
        if (classList.includes('input') || classList.includes('prompt') || 
            classList.includes('container') || classList.includes('form')) {
            console.log('[Gemini Architect] Found container by class pattern:', current);
            return current;
        }
        current = current.parentElement;
        attempts++;
    }
    
    // Strategy 4: Use fallback selector
    const fallback = document.querySelector(SELECTORS.BUTTON_CONTAINER_PARENT);
    if (fallback) {
        console.log('[Gemini Architect] Using fallback container:', fallback);
        return fallback;
    }
    
    // Strategy 5: Use input's direct parent as last resort
    console.log('[Gemini Architect] Using input parent as last resort:', inputElement.parentElement);
    return inputElement.parentElement || document.body;
}

/**
 * Creates a compact icon-only mode selector for space efficiency.
 * Uses only emoji icons with tooltips for clarity.
 * @returns {HTMLElement} The compact mode selector div.
 */
function createModeSelector() {
    const segmentedControl = document.createElement('div');
    segmentedControl.id = 'gemini-mode-selector';
    
    // Compact glassmorphism container - much smaller than before
    segmentedControl.className = 'flex items-center rounded-lg';
    segmentedControl.style.cssText = `
        height: 28px; 
        margin-right: 0;
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 0.5px solid rgba(255, 255, 255, 0.8);
        box-shadow: 
            0 1px 2px rgba(0, 0, 0, 0.05),
            0 2px 6px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        flex-shrink: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 2px;
        gap: 2px;
        opacity: 0;
        pointer-events: none;
        width: 0;
        margin-right: 0;
        overflow: hidden;
    `;

    ENHANCEMENT_MODES.forEach(mode => {
        const input = document.createElement('input');
        input.type = 'radio';
        input.id = `mode-${mode.value}`;
        input.name = 'enhancement-mode';
        input.value = mode.value;
        input.className = 'hidden';
        
        // Default to Text mode
        if (mode.value === 'TEXT_ENHANCEMENT') {
            input.checked = true;
        }

        const label = document.createElement('label');
        label.setAttribute('for', `mode-${mode.value}`);
        label.title = mode.tooltip || mode.label; // Tooltip for accessibility
        label.textContent = mode.icon; // Icon only, no text
        
        // Compact icon-only styling - minimal padding
        label.className = 'cursor-pointer rounded-md transition-all';
        label.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            font-size: 14px;
            line-height: 1;
            color: rgba(60, 60, 67, 0.6);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
            position: relative;
        `;

        // Add hover effect for icon-only buttons
        label.addEventListener('mouseenter', () => {
            if (!input.checked) {
                label.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                label.style.transform = 'scale(1.1)';
            }
        });
        
        label.addEventListener('mouseleave', () => {
            if (!input.checked) {
                label.style.backgroundColor = 'transparent';
                label.style.transform = 'scale(1)';
            }
        });

        // Function to apply/remove active style with compact premium effects
        const updateStyles = () => {
            document.querySelectorAll('#gemini-mode-selector input').forEach(i => {
                const l = document.querySelector(`label[for="${i.id}"]`);
                if (i.checked) {
                    // Active state: Compact white background with subtle shadow
                    l.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                    l.style.boxShadow = `
                        0 1px 2px rgba(0, 0, 0, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 1)
                    `;
                    l.style.transform = 'scale(1)';
                    l.style.opacity = '1';
                } else {
                    // Inactive state: Transparent
                    l.style.backgroundColor = 'transparent';
                    l.style.boxShadow = 'none';
                    l.style.transform = 'scale(1)';
                    l.style.opacity = '0.6';
                }
            });
        };

        input.addEventListener('change', () => {
            updateStyles();
        });

        segmentedControl.appendChild(input);
        segmentedControl.appendChild(label);
        
        // Initial style application
        if (mode.value === 'TEXT_ENHANCEMENT') {
            setTimeout(updateStyles, 0); 
        }
    });

    return segmentedControl;
}

/**
 * Creates the single "Enhance Prompt" execution button with subtle icon indicator.
 * Minimal design: icon shows current mode and cycles on click.
 */
function createEnhanceButton(inputElement, enhancerDiv) {
    const button = document.createElement('button');
    button.type = 'button'; // Prevent form submission
    button.id = 'main-enhance-button';
    
    // Current mode state (default to Text)
    let currentMode = 'TEXT_ENHANCEMENT';
    
    // Get current mode data
    const getCurrentModeData = () => ENHANCEMENT_MODES.find(m => m.value === currentMode);
    
    // Create button content with text and icon
    const buttonText = document.createElement('span');
    buttonText.textContent = 'Improve';
    
    const modeIcon = document.createElement('span');
    modeIcon.className = 'mode-icon';
    modeIcon.style.cssText = `
        margin-left: 8px;
        font-size: 16px;
        line-height: 1;
        opacity: 0.9;
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        user-select: none;
        display: inline-flex;
        align-items: center;
    `;
    
    // Function to update icon and tooltip
    const updateModeIcon = () => {
        const modeData = getCurrentModeData();
        if (modeData) {
            modeIcon.textContent = modeData.icon;
            modeIcon.title = modeData.label;
        }
    };
    
    // Initialize icon
    updateModeIcon();
    
    // Cycle through modes function
    const cycleMode = (e) => {
        e.stopPropagation();
        const currentIndex = ENHANCEMENT_MODES.findIndex(m => m.value === currentMode);
        const nextIndex = (currentIndex + 1) % ENHANCEMENT_MODES.length;
        currentMode = ENHANCEMENT_MODES[nextIndex].value;
        updateModeIcon();
        
        // Subtle animation feedback
        modeIcon.style.transform = 'scale(1.2)';
        setTimeout(() => {
            modeIcon.style.transform = 'scale(1)';
        }, 150);
    };
    
    // Make icon clickable to cycle modes
    modeIcon.addEventListener('click', cycleMode);
    
    // Hover effect on icon
    modeIcon.addEventListener('mouseenter', () => {
        modeIcon.style.opacity = '1';
        modeIcon.style.transform = 'scale(1.1)';
    });
    
    modeIcon.addEventListener('mouseleave', () => {
        modeIcon.style.opacity = '0.9';
        modeIcon.style.transform = 'scale(1)';
    });
    
    button.appendChild(buttonText);
    button.appendChild(modeIcon);
    
    // Premium button with gradient, depth, and smooth animations
    button.className = 'text-white font-semibold rounded-xl text-sm transition-all'; 
    button.style.cssText = `
        height: 36px; 
        padding: 0 20px;
        background: linear-gradient(180deg, #007AFF 0%, #0051D5 100%);
        border: none;
        box-shadow: 
            0 2px 8px rgba(0, 122, 255, 0.25),
            0 4px 16px rgba(0, 122, 255, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        white-space: nowrap;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
        flex-shrink: 0;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Premium hover effect with scale and enhanced shadow
    button.onmouseenter = () => {
        button.style.background = 'linear-gradient(180deg, #0051D5 0%, #003D9E 100%)';
        button.style.transform = 'translateY(-1px) scale(1.02)';
        button.style.boxShadow = `
            0 4px 12px rgba(0, 122, 255, 0.3),
            0 8px 24px rgba(0, 122, 255, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.25)
        `;
    };
    
    button.onmouseleave = () => {
        button.style.background = 'linear-gradient(180deg, #007AFF 0%, #0051D5 100%)';
        button.style.transform = 'translateY(0) scale(1)';
        button.style.boxShadow = `
            0 2px 8px rgba(0, 122, 255, 0.25),
            0 4px 16px rgba(0, 122, 255, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.2)
        `;
    };
    
    // Active/press effect
    button.onmouseup = () => {
        button.style.transform = 'translateY(-1px) scale(1.02)';
    };
    
    // Find parent form and prevent its submission (works for all chatbot platforms)
    let parentForm = button.closest('form');
    if (!parentForm) {
        // Also check if button is inside a form-like container
        let parent = button.parentElement;
        let attempts = 0;
        while (parent && attempts < 10) {
            if (parent.tagName === 'FORM' || parent.querySelector('form')) {
                parentForm = parent.tagName === 'FORM' ? parent : parent.querySelector('form');
                break;
            }
            parent = parent.parentElement;
            attempts++;
        }
    }
    
    // Add form submit prevention if form exists (for all chatbot platforms)
    if (parentForm) {
        console.log('[Gemini Architect] Found parent form, adding submit prevention');
        const preventFormSubmit = (e) => {
            // Check if the submit was triggered by our button
            const submitter = e.submitter || (e.originalTarget && e.originalTarget.closest('button'));
            if (submitter === button || button.contains(submitter) || 
                (e.target && (e.target === button || e.target.contains(button)))) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('[Gemini Architect] Prevented form submission triggered by Improve button');
                return false;
            }
        };
        
        // Add submit listener with capture phase to catch early (before other handlers)
        parentForm.addEventListener('submit', preventFormSubmit, true);
    }
    
    // Button click handler - execute enhancement (not when clicking icon)
    button.onclick = (event) => {
        // Don't execute if clicking the mode icon (it has its own handler)
        if (event.target === modeIcon || modeIcon.contains(event.target)) {
            return;
        }
        
        // Multiple layers of form submission prevention
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // Additional prevention: stop any form submission that might be triggered
        // The form submit listener above should handle this, but this is a backup
        if (parentForm && event.isTrusted) {
            // Only prevent if this is a user-initiated click (not programmatic)
            console.log('[Gemini Architect] Button clicked, ensuring form does not submit');
        }
        
        // Execute enhancement with current mode
        handleButtonClick(inputElement, currentMode, enhancerDiv);
        
        // Return false as additional safeguard
        return false;
    };
    
    // Also add mousedown prevention (some platforms trigger on mousedown)
    button.onmousedown = (event) => {
        // Don't prevent if clicking icon
        if (event.target === modeIcon || modeIcon.contains(event.target)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        button.style.transform = 'translateY(0) scale(0.98)';
    };
    
    return button;
}

/**
 * Injects the UI elements next to the send button.
 * Enhanced with better positioning, error handling, and debugging.
 */
async function injectUI(inputElement) {
    console.log('[Gemini Architect] injectUI called with input element:', inputElement);
    
    // Check if platform is enabled
    const enabled = await isPlatformEnabled();
    if (!enabled) {
        console.log('[Gemini Architect] Platform is disabled, not injecting UI');
        return;
    }
    
    // Check if already injected (but allow re-injection if element was removed)
    const existingContainer = document.getElementById('gemini-enhancer-buttons-container');
    if (existingContainer && document.body.contains(existingContainer)) {
        console.log('[Gemini Architect] UI already injected, skipping');
        return;
    }

    const container = findInjectionTarget(inputElement);
    if (!container) {
        console.error('[Gemini Architect] Failed to find injection container');
        return;
    }
    
    console.log('[Gemini Architect] Using container for injection:', container);
    
    // Find the send button
    const sendButton = findSendButton(inputElement, container);
    
    // 1. Create the UI container - positioned inline next to send button
    const enhancerDiv = document.createElement('div');
    enhancerDiv.id = 'gemini-enhancer-buttons-container';
    enhancerDiv.className = 'flex items-center';
    
    // Inline positioning - appears on same row as send button
    enhancerDiv.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-right: 8px;
        z-index: 999999;
        pointer-events: auto;
        flex-shrink: 0;
    `;
    
    // 2. Status/Loading area - premium styling for inline display
    const statusArea = document.createElement('div');
    statusArea.className = 'flex items-center';
    statusArea.style.cssText = `
        height: 36px; 
        margin-right: 0;
        display: inline-flex;
        align-items: center;
    `;
    
    // 2a. Status message element with glassmorphism
    const statusMessage = document.createElement('span');
    statusMessage.id = 'gemini-enhancer-status';
    statusMessage.className = 'text-xs font-semibold hidden whitespace-nowrap px-3 py-1.5 rounded-lg transition-all';
    statusMessage.style.cssText = `
        color: #1D1D1F; 
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
        border: 0.5px solid rgba(255, 255, 255, 0.6);
        height: 28px; 
        line-height: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: -0.01em;
        display: inline-flex;
        align-items: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    `;
    
    // 2b. Premium loading indicator with smooth animation
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'spinner self-center hidden'; 
    loadingSpinner.style.cssText = `
        @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
        } 
        border: 2.5px solid rgba(0, 122, 255, 0.15); 
        border-top: 2.5px solid #007AFF; 
        border-radius: 50%; 
        width: 18px; 
        height: 18px; 
        animation: spin 0.7s cubic-bezier(0.5, 0, 0.5, 1) infinite; 
        margin-right: 8px;
        flex-shrink: 0;
    `;
    
    statusArea.appendChild(loadingSpinner);
    statusArea.appendChild(statusMessage);
    
    // 3. Create and add UI elements in the correct order
    const enhanceButtonContainer = createEnhanceButton(inputElement, enhancerDiv);

    enhancerDiv.appendChild(statusArea);
    enhancerDiv.appendChild(enhanceButtonContainer);

    // 4. Insertion - place next to send button or in the same row container
    try {
        if (sendButton && sendButton.parentElement) {
            // Best case: Insert right before the send button
            const sendButtonParent = sendButton.parentElement;
            
            // Ensure parent is a flex container for proper alignment
            const parentStyle = window.getComputedStyle(sendButtonParent);
            if (!parentStyle.display.includes('flex')) {
                sendButtonParent.style.display = 'flex';
                sendButtonParent.style.alignItems = 'center';
                sendButtonParent.style.gap = '8px';
                console.log('[Gemini Architect] Set parent to flex container');
            }
            
            sendButtonParent.insertBefore(enhancerDiv, sendButton);
            console.log('[Gemini Architect] Injected before send button');
        } else if (sendButton) {
            // Send button found but no parent - try to find a container
            let parent = sendButton.parentElement || container;
            if (parent) {
                const parentStyle = window.getComputedStyle(parent);
                if (!parentStyle.display.includes('flex')) {
                    parent.style.display = 'flex';
                    parent.style.alignItems = 'center';
                    parent.style.gap = '8px';
                }
                parent.insertBefore(enhancerDiv, sendButton);
                console.log('[Gemini Architect] Injected before send button (fallback parent)');
            }
        } else {
            // Fallback: Find the row container that holds input and buttons
            let rowContainer = inputElement.parentElement;
            let attempts = 0;
            
            // Look for a container that has both the input and likely the send button
            while (rowContainer && attempts < 15) { // Increased attempts
                const hasInput = rowContainer.contains(inputElement);
                const hasButtons = rowContainer.querySelectorAll('button').length > 0;
                
                if (hasInput && hasButtons) {
                    // Ensure it's a flex container
                    const rowStyle = window.getComputedStyle(rowContainer);
                    if (!rowStyle.display.includes('flex')) {
                        rowContainer.style.display = 'flex';
                        rowContainer.style.alignItems = 'center';
                        rowContainer.style.gap = '8px';
                    }
                    
                    // Insert before the first button or at the end
                    const firstButton = rowContainer.querySelector('button');
                    if (firstButton) {
                        rowContainer.insertBefore(enhancerDiv, firstButton);
                    } else {
                        rowContainer.appendChild(enhancerDiv);
                    }
                    console.log('[Gemini Architect] Injected into row container');
                    break;
                }
                rowContainer = rowContainer.parentElement;
                attempts++;
            }
            
            // Enhanced fallback: Try to find any button container near input
            if (!rowContainer || attempts >= 15) {
                // Look for any flex container or button group near the input
                const inputRect = inputElement.getBoundingClientRect();
                const allContainers = document.querySelectorAll('div, form, footer');
                
                for (const elem of allContainers) {
                    if (elem.offsetParent === null) continue;
                    const elemRect = elem.getBoundingClientRect();
                    const distance = Math.abs(elemRect.top - inputRect.bottom);
                    
                    if (distance < 50 && elem.querySelector('button')) {
                        const elemStyle = window.getComputedStyle(elem);
                        if (!elemStyle.display.includes('flex')) {
                            elem.style.display = 'flex';
                            elem.style.alignItems = 'center';
                            elem.style.gap = '8px';
                        }
                        const firstBtn = elem.querySelector('button');
                        if (firstBtn) {
                            elem.insertBefore(enhancerDiv, firstBtn);
                        } else {
                            elem.appendChild(enhancerDiv);
                        }
                        console.log('[Gemini Architect] Injected into nearby container with button');
                        rowContainer = elem;
                        break;
                    }
                }
            }
            
            // Last resort: Insert in form or container
            if (!rowContainer || attempts >= 15) {
    const formElement = inputElement.closest('form');
    if (formElement) {
                    // Ensure form is flex
                    const formStyle = window.getComputedStyle(formElement);
                    if (!formStyle.display.includes('flex')) {
                        formElement.style.display = 'flex';
                        formElement.style.alignItems = 'center';
                        formElement.style.gap = '8px';
                    }
                    formElement.appendChild(enhancerDiv);
                    console.log('[Gemini Architect] Injected into form element as fallback');
                } else {
                    // Create a wrapper div if needed
                    if (container && container !== document.body) {
                        const containerStyle = window.getComputedStyle(container);
                        if (!containerStyle.display.includes('flex')) {
                            container.style.display = 'flex';
                            container.style.alignItems = 'center';
                            container.style.gap = '8px';
                        }
                        container.appendChild(enhancerDiv);
                        console.log('[Gemini Architect] Injected into container as last resort');
    } else {
                        // Absolute last resort: append after input element
                        inputElement.parentElement.insertBefore(enhancerDiv, inputElement.nextSibling);
                        console.log('[Gemini Architect] Injected after input element as absolute fallback');
                    }
                }
            }
        }
        
        // Verify injection was successful
        if (document.body.contains(enhancerDiv)) {
            console.log('[Gemini Architect] UI successfully injected and visible in DOM');
        } else {
            console.error('[Gemini Architect] UI injection failed - element not in DOM');
        }
    } catch (error) {
        console.error('[Gemini Architect] Error during injection:', error);
        // Last resort: append to body with fixed positioning
        document.body.appendChild(enhancerDiv);
        enhancerDiv.style.position = 'fixed';
        enhancerDiv.style.bottom = '20px';
        enhancerDiv.style.right = '20px';
        enhancerDiv.style.left = 'auto';
        enhancerDiv.style.top = 'auto';
        console.log('[Gemini Architect] Used fallback fixed positioning on body');
    }
}

/**
 * Updates the input field value and triggers a synthetic input event.
 * Handles both textarea and contenteditable divs for all chatbot platforms.
 * @param {string} newText - The text to insert into the input field
 * @param {HTMLElement} inputElement - The input element to update (optional, will query if not provided)
 */
function updateInputAndDispatch(newText, inputElement = null) {
    // Use provided element or fallback to querying
    let targetElement = inputElement;
    
    if (!targetElement || !document.body.contains(targetElement)) {
        console.log('[Gemini Architect] Input element not provided or invalid, querying...');
        targetElement = document.querySelector(SELECTORS.PROMPT_INPUT);
    }
    
    if (!targetElement) {
        console.warn('[Gemini Architect] Could not find input element to update');
        return Promise.resolve(false);
    }
    
    console.log('[Gemini Architect] Updating input element:', {
        tagName: targetElement.tagName,
        contentEditable: targetElement.contentEditable,
        hasValue: !!targetElement.value,
        textLength: newText.length
    });
    
    // Use requestAnimationFrame to ensure DOM is ready for update
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            let updateSuccess = false;
            
            // Handle contenteditable divs (used by some platforms like Gemini)
            if (targetElement.contentEditable === 'true' || targetElement.hasAttribute('contenteditable') || 
                targetElement.getAttribute('contenteditable') === 'true') {
                // Update both textContent and innerText for compatibility
                targetElement.textContent = newText;
                targetElement.innerText = newText;
                
                // Verify the update
                const actualText = (targetElement.textContent || targetElement.innerText || '').trim();
                if (actualText === newText.trim() || actualText.length > 0) {
                    // Trigger input events for contenteditable (without keyboard events to avoid auto-send)
                    const inputEvent = new InputEvent('input', { 
                        bubbles: true, 
                        cancelable: true,
                        inputType: 'insertText',
                        data: newText
                    });
                    targetElement.dispatchEvent(inputEvent);
                    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Focus for better compatibility
                    targetElement.focus();
                    updateSuccess = true;
                    console.log('[Gemini Architect] Updated contenteditable div with new text, length:', actualText.length);
                } else {
                    console.warn('[Gemini Architect] Failed to verify contenteditable update');
                }
            } else if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
                // Handle regular textarea/input (ChatGPT, Claude, etc.)
                // Store original value for verification
                const originalValue = targetElement.value;
                
                // Set the value directly
                targetElement.value = newText;
                
                // Verify the update was successful
                if (targetElement.value === newText || targetElement.value.length === newText.length) {
                    // Use InputEvent for better compatibility with modern frameworks
                    const inputEvent = new InputEvent('input', { 
                        bubbles: true, 
                        cancelable: true,
                        inputType: 'insertText',
                        data: newText
                    });
                    targetElement.dispatchEvent(inputEvent);
                    
                    // Also dispatch change event
                    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Focus for better compatibility (but don't trigger keyboard events that might auto-send)
                    targetElement.focus();
                    
                    updateSuccess = true;
                    console.log('[Gemini Architect] Updated textarea/input with new text, length:', targetElement.value.length);
                } else {
                    console.warn('[Gemini Architect] Failed to verify textarea update. Expected:', newText.length, 'Got:', targetElement.value.length);
                    // Try alternative method: clear and set
                    targetElement.value = '';
                    targetElement.value = newText;
                    if (targetElement.value === newText) {
                        targetElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: newText }));
                        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                        updateSuccess = true;
                    }
                }
            } else {
                // Fallback: try setting textContent for other element types
                targetElement.textContent = newText;
                const actualText = (targetElement.textContent || '').trim();
                if (actualText === newText.trim() || actualText.length > 0) {
                    targetElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: newText }));
                    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                    targetElement.focus();
                    updateSuccess = true;
                    console.log('[Gemini Architect] Updated element (fallback) with new text, length:', actualText.length);
                }
            }
            
            resolve(updateSuccess);
        });
    }).then(success => {
        if (success) {
            console.log('[Gemini Architect] Input update completed successfully');
        } else {
            console.warn('[Gemini Architect] Input update may have failed');
        }
        return success;
    });
}

/**
 * Displays a status message in the injected UI with premium styling.
 */
function showStatus(message, color, bgColor) {
    const statusEl = document.querySelector('#gemini-enhancer-status');
    const spinnerEl = document.querySelector('.spinner');
    
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = color; 
        statusEl.style.background = bgColor;
        statusEl.style.borderColor = color + '40'; // Add transparency to border
        statusEl.style.display = 'inline-flex';
        statusEl.style.alignItems = 'center';
        
        // Smooth fade-in animation
        statusEl.style.opacity = '0';
        statusEl.style.transform = 'translateY(-4px)';
        setTimeout(() => {
            statusEl.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            statusEl.style.opacity = '1';
            statusEl.style.transform = 'translateY(0)';
        }, 10);
    }
    if (spinnerEl) {
         spinnerEl.style.display = 'none';
    }
}

/**
 * Handles the button click, sends message to the background script, and updates the input.
 */
async function handleButtonClick(inputElement, enhancementType, statusContainer) {
    // Strategy 1: Try to read from the passed inputElement first (most reliable)
    let rawPrompt = '';
    let currentInputElement = inputElement;
    
    // Function to extract text from an element using multiple strategies
    const extractTextFromElement = (element) => {
        if (!element) return '';
        
        // Strategy 1: Check if it's a textarea with value (most reliable for textareas)
        if (element.tagName === 'TEXTAREA') {
            const text = (element.value || '').trim();
            if (text) {
                console.log('[Gemini Architect] Read from textarea value, length:', text.length);
                return text;
            }
        }
        
        // Strategy 2: Check if it's a contenteditable div
        if (element.contentEditable === 'true' || element.hasAttribute('contenteditable') || 
            element.getAttribute('contenteditable') === 'true') {
            // Try textContent first (includes hidden text)
            let text = (element.textContent || '').trim();
            if (text) {
                console.log('[Gemini Architect] Read from contenteditable textContent, length:', text.length);
                return text;
            }
            // Fallback to innerText
            text = (element.innerText || '').trim();
            if (text) {
                console.log('[Gemini Architect] Read from contenteditable innerText, length:', text.length);
                return text;
            }
            // For nested contenteditable structures, try finding the deepest contenteditable child
            const nestedContentEditable = element.querySelector('[contenteditable="true"], [contenteditable=""]');
            if (nestedContentEditable && nestedContentEditable !== element) {
                text = (nestedContentEditable.textContent || nestedContentEditable.innerText || '').trim();
                if (text) {
                    console.log('[Gemini Architect] Read from nested contenteditable, length:', text.length);
                    return text;
                }
            }
        }
        
        // Strategy 3: Try textContent (works for most elements, includes all text)
        if (element.textContent) {
            const text = element.textContent.trim();
            if (text) {
                console.log('[Gemini Architect] Read from textContent, length:', text.length);
                return text;
            }
        }
        
        // Strategy 4: Try innerText (only visible text)
        if (element.innerText) {
            const text = element.innerText.trim();
            if (text) {
                console.log('[Gemini Architect] Read from innerText, length:', text.length);
                return text;
            }
        }
        
        // Strategy 5: Try value property (for input elements)
        if (element.value) {
            const text = element.value.trim();
            if (text) {
                console.log('[Gemini Architect] Read from value property, length:', text.length);
                return text;
            }
        }
        
        return '';
    };
    
    // Try reading from the passed inputElement first
    rawPrompt = extractTextFromElement(inputElement);
    console.log('[Gemini Architect] Attempt 1 - Read from passed inputElement:', {
        tagName: inputElement?.tagName,
        contentEditable: inputElement?.contentEditable,
        hasValue: !!inputElement?.value,
        textLength: rawPrompt.length
    });
    
    // Strategy 2: If no text found, try re-querying for the current active input
    if (!rawPrompt) {
        console.log('[Gemini Architect] No text from passed element, trying re-query...');
        const queriedElement = document.querySelector(SELECTORS.PROMPT_INPUT);
        
        if (queriedElement && document.body.contains(queriedElement)) {
            console.log('[Gemini Architect] Found element via re-query:', queriedElement.tagName);
            const queriedText = extractTextFromElement(queriedElement);
            if (queriedText) {
                rawPrompt = queriedText;
                currentInputElement = queriedElement;
                console.log('[Gemini Architect] Successfully read from re-queried element, length:', rawPrompt.length);
            }
        }
    }
    
    // Strategy 3: Try finding contenteditable divs near the input (ChatGPT sometimes uses these)
    if (!rawPrompt && inputElement) {
        console.log('[Gemini Architect] Trying to find contenteditable divs near input...');
        let parent = inputElement.parentElement;
        let attempts = 0;
        while (parent && attempts < 10) {
            const contentEditableDivs = parent.querySelectorAll('[contenteditable="true"], [contenteditable=""]');
            for (const div of contentEditableDivs) {
                const text = extractTextFromElement(div);
                if (text) {
                    rawPrompt = text;
                    currentInputElement = div;
                    console.log('[Gemini Architect] Found text in contenteditable div, length:', rawPrompt.length);
                    break;
                }
            }
            if (rawPrompt) break;
            parent = parent.parentElement;
            attempts++;
        }
    }
    
    // Strategy 4: Try finding any textarea in the form/container
    if (!rawPrompt && inputElement) {
        console.log('[Gemini Architect] Trying to find any textarea in container...');
        const container = inputElement.closest('form') || inputElement.parentElement;
        if (container) {
            const textareas = container.querySelectorAll('textarea');
            for (const textarea of textareas) {
                const text = extractTextFromElement(textarea);
                if (text) {
                    rawPrompt = text;
                    currentInputElement = textarea;
                    console.log('[Gemini Architect] Found text in textarea within container, length:', rawPrompt.length);
                    break;
                }
            }
        }
    }
    
    // Strategy 5: Try finding input relative to the status container (where button is injected)
    if (!rawPrompt && statusContainer) {
        console.log('[Gemini Architect] Trying to find input relative to status container...');
        let container = statusContainer.parentElement;
        let attempts = 0;
        while (container && attempts < 15) {
            // Look for textareas or contenteditable divs
            const textareas = container.querySelectorAll('textarea');
            for (const textarea of textareas) {
                const text = extractTextFromElement(textarea);
                if (text) {
                    rawPrompt = text;
                    currentInputElement = textarea;
                    console.log('[Gemini Architect] Found text in textarea near status container, length:', rawPrompt.length);
                    break;
                }
            }
            if (rawPrompt) break;
            
            const contentEditableDivs = container.querySelectorAll('[contenteditable="true"], [contenteditable=""]');
            for (const div of contentEditableDivs) {
                const text = extractTextFromElement(div);
                if (text) {
                    rawPrompt = text;
                    currentInputElement = div;
                    console.log('[Gemini Architect] Found text in contenteditable div near status container, length:', rawPrompt.length);
                    break;
                }
            }
            if (rawPrompt) break;
            
            container = container.parentElement;
            attempts++;
        }
    }
    
    const statusEl = statusContainer.querySelector('#gemini-enhancer-status');
    const spinnerEl = statusContainer.querySelector('.spinner');
    const enhanceButton = document.getElementById('main-enhance-button');
    const modeSelector = document.getElementById('gemini-mode-selector');

    if (!rawPrompt) {
        console.warn('[Gemini Architect] No prompt found after all strategies. Element details:', {
            passedElement: inputElement?.tagName,
            passedElementId: inputElement?.id,
            passedElementClass: inputElement?.className,
            passedElementContentEditable: inputElement?.contentEditable,
            passedElementValue: inputElement?.value?.substring(0, 50),
            passedElementTextContent: inputElement?.textContent?.substring(0, 50)
        });
        showStatus('Enter a prompt first', '#FF3B30', 'rgba(255, 59, 48, 0.1)');
        setTimeout(() => {
            if (statusEl) statusEl.style.display = 'none';
        }, 3000);
        return;
    }
    
    // Update inputElement reference for later use
    inputElement = currentInputElement;

    // 1. Disable controls and show loading
    enhanceButton.disabled = true;
    enhanceButton.style.background = 'rgba(142, 142, 147, 0.3)'; // Gray out the button
    enhanceButton.style.transform = 'scale(0.98)';
    if (modeSelector) modeSelector.style.opacity = '0.5';
    spinnerEl.style.display = 'inline-block';
    
    const modeName = enhancementType.split('_')[0].toLowerCase();
    showStatus(`Architecting for ${modeName}...`, '#007AFF', 'rgba(0, 122, 255, 0.1)');

    try {
        // 2. Send message to the Service Worker (background.js)
        const response = await chrome.runtime.sendMessage({
            action: 'enhancePrompt',
            prompt: rawPrompt,
            enhancementType: enhancementType,
        });
        
        const improvedPrompt = response?.enhancedPrompt || "Error: Failed to receive improved prompt.";

        // 3. Update the input field using the currentInputElement we found
        if (improvedPrompt.startsWith("Error:")) {
            showStatus('Enhancement Failed', '#FF3B30', 'rgba(255, 59, 48, 0.1)');
            if (currentInputElement) {
                if (currentInputElement.tagName === 'TEXTAREA' || currentInputElement.tagName === 'INPUT') {
                    currentInputElement.value = improvedPrompt;
                } else {
                    currentInputElement.textContent = improvedPrompt;
                }
            }
        } else {
            // updateInputAndDispatch now returns a Promise
            updateInputAndDispatch(improvedPrompt, currentInputElement).then(updateSuccess => {
                if (updateSuccess) {
                    showStatus('Prompt Architecture Complete', '#30D158', 'rgba(52, 199, 89, 0.1)');
                } else {
                    showStatus('Update failed - check console', '#FF3B30', 'rgba(255, 59, 48, 0.1)');
                }
            }).catch(error => {
                console.error('[Gemini Architect] Error updating input:', error);
                showStatus('Update error - check console', '#FF3B30', 'rgba(255, 59, 48, 0.1)');
            });
        }

    } catch (error) {
        console.error('Gemini Architect communication error:', error);
        showStatus('Error: Communication issue.', '#FF3B30', 'rgba(255, 59, 48, 0.1)');
    } finally {
        // 4. Re-enable controls and hide loading
        spinnerEl.style.display = 'none';
        enhanceButton.disabled = false;
        enhanceButton.style.background = 'linear-gradient(180deg, #007AFF 0%, #0051D5 100%)'; // Restore button gradient
        enhanceButton.style.transform = 'translateY(0) scale(1)';
        if (modeSelector) modeSelector.style.opacity = '1.0';
        setTimeout(() => statusEl.style.display = 'none', 5000);
    }
}

// --- Listener for Context Menu Results (Maintained for flexibility) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'contextMenuResult') {
        const inputElement = document.querySelector(SELECTORS.PROMPT_INPUT);
        const statusContainer = document.querySelector('#gemini-enhancer-buttons-container');
        const statusEl = statusContainer ? statusContainer.querySelector('#gemini-enhancer-status') : null;

        if (inputElement) {
            if (request.resultText && !request.resultText.startsWith("Error:")) {
                // updateInputAndDispatch now returns a Promise
                updateInputAndDispatch(request.resultText, inputElement).then(updateSuccess => {
                    if (updateSuccess && statusEl) {
                        showStatus('Context Menu: Quick Polish Complete', '#30D158', 'rgba(52, 199, 89, 0.1)');
                        setTimeout(() => statusEl.style.display = 'none', 5000);
                    }
                }).catch(error => {
                    console.error('[Gemini Architect] Error updating input from context menu:', error);
                });
            } else {
                 if (statusEl) {
                    showStatus(`Context Menu Error`, '#FF3B30', 'rgba(255, 59, 48, 0.1)');
                    setTimeout(() => statusEl.style.display = 'none', 5000);
                 }
            }
        }
        sendResponse({ success: true });
        return true;
    }
});


/**
 * Uses a MutationObserver to detect when the target chat interface is loaded.
 * Enhanced to stay active for ChatGPT's dynamic interface and prevent excessive re-injections.
 */
let injectionDebounceTimer = null;
let lastInjectedInput = null;

function observeDOM() {
    console.log('[Gemini Architect] Starting DOM observation');
    
    // Try immediate injection
    let input = document.querySelector(SELECTORS.PROMPT_INPUT);
    if (input) {
        console.log('[Gemini Architect] Found input immediately:', input);
        injectUI(input);
        lastInjectedInput = input;
    }

    // Keep observer active - don't disconnect (ChatGPT recreates elements dynamically)
    const observer = new MutationObserver((mutationsList, observer) => {
        // Debounce to prevent excessive re-injections
        if (injectionDebounceTimer) {
            clearTimeout(injectionDebounceTimer);
        }
        
        injectionDebounceTimer = setTimeout(() => {
            // Check if platform is enabled
            isPlatformEnabled().then(enabled => {
                if (!enabled) {
                    // Remove UI if platform was disabled
                    const existingUI = document.getElementById('gemini-enhancer-buttons-container');
                    if (existingUI && document.body.contains(existingUI)) {
                        existingUI.remove();
                        console.log('[Gemini Architect] Platform disabled, removed UI');
                    }
                    return;
                }
                
                const currentInput = document.querySelector(SELECTORS.PROMPT_INPUT);
                
                if (currentInput) {
                    // Only re-inject if:
                    // 1. We haven't injected before, OR
                    // 2. The input element changed, OR
                    // 3. The UI container is missing from DOM
                    const existingUI = document.getElementById('gemini-enhancer-buttons-container');
                    const needsInjection = !existingUI || 
                                          !document.body.contains(existingUI) ||
                                          currentInput !== lastInjectedInput;
                    
                    if (needsInjection) {
                        console.log('[Gemini Architect] Detected input change, re-injecting UI');
                        lastInjectedInput = currentInput;
                        injectUI(currentInput);
                    }
                }
            });
        }, 300); // 300ms debounce
    });

    // Observe with comprehensive options for dynamic interfaces
    observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: false,
        attributeOldValue: false
    });
    
    console.log('[Gemini Architect] MutationObserver active and watching for changes');
}

// Start the detection process
observeDOM();