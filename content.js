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
        domains: ['grok.com', 'www.grok.com', 'x.com', 'twitter.com'],
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
                return key;
            }
        }
    }
    
    // Return null for unsupported sites
    return null;
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
        generic: true
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
            chrome.storage.local.set({ [STORAGE_PLATFORMS]: defaults });
        }
    });
}

/**
 * Checks if the current platform is enabled
 * Only enabled on supported platforms: ChatGPT, Gemini, Claude, Grok, Perplexity
 * @returns {Promise<boolean>} True if platform is supported
 */
async function isPlatformEnabled() {
    const platform = detectPlatform();
    // Only enable on our 5 supported platforms
    const supportedPlatforms = ['chatgpt', 'gemini', 'claude', 'grok', 'perplexity'];
    return Promise.resolve(supportedPlatforms.includes(platform));
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
        'textarea[class*="prompt" i]',
        // Gemini-specific selectors (contenteditable divs)
        '[contenteditable="true"][aria-label*="Enter a prompt" i]',
        '[contenteditable="true"][aria-label*="prompt" i]',
        '[contenteditable="true"][data-placeholder*="prompt" i]',
        '[contenteditable="true"][class*="input" i]',
        '[contenteditable="true"][class*="text" i]',
        '[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]:not([contenteditable="false"])',
        // Grok/X-specific selectors (Twitter's composer)
        '[data-testid="tweetTextarea_0"]',
        '[data-testid*="tweetTextarea"]',
        '[contenteditable="true"][data-testid*="tweet"]',
        '[contenteditable="true"][aria-label*="Post text" i]',
        '[contenteditable="true"][aria-label*="Tweet text" i]',
        '[contenteditable="true"][aria-label*="What is happening" i]',
        // Generic contenteditable fallbacks
        '[contenteditable="true"]:not([contenteditable="false"])',
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
        
        // Grok/X patterns (Twitter/X composer)
        'button[data-testid="tweetButton"]',
        'button[data-testid*="tweetButton"]',
        'button[data-testid*="tweet"]',
        'button[aria-label*="Post" i]',
        'button[aria-label*="Tweet" i]',
        'button[type="button"][data-testid*="send"]',
        // Gemini-specific patterns
        'button[aria-label*="Send message" i]',
        'button[aria-label*="Submit prompt" i]',
        'button[jsname*="send"]',
        'button[jsname*="submit"]',
        'button[data-id*="send"]',
        'button[data-id*="submit"]',
        'button[class*="send-button"]',
        'button[class*="submit-button"]',
        
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
            return button;
        }
    }
    
    // Strategy 5: Last resort - find any button near the input
    for (const button of allButtons) {
        if (button.offsetParent === null) continue;
        const buttonRect = button.getBoundingClientRect();
        const distance = Math.abs(buttonRect.top - inputRect.bottom) + Math.abs(buttonRect.left - inputRect.right);
        if (distance < 100 && button.type === 'submit') {
            return button;
        }
    }
    
    return null;
}

/**
 * Finds the nearest container relative to the prompt input to inject our controls.
 * Enhanced with multiple fallback strategies for ChatGPT's dynamic structure.
 */
function findInjectionTarget(inputElement) {
    if (!inputElement) {
        return document.body;
    }
    
    // Strategy 1: Find parent with submit button (expanded search)
    let current = inputElement.parentElement;
    let attempts = 0;
    while (current && attempts < 20) { // Increased from 15 to 20
        const hasSubmitButton = current.querySelector('button[type="submit"]') || 
                                current.querySelector('button[aria-label*="Send" i]') ||
                                current.querySelector('button[aria-label*="submit" i]') ||
                                current.querySelector('button[data-testid*="send" i]') ||
                                current.querySelector('button[data-testid*="tweet" i]') ||
                                current.querySelector('button[data-testid="tweetButton"]');
        if (hasSubmitButton) {
            return current;
        }
        current = current.parentElement;
        attempts++;
    }
    
    // Strategy 2: Find form element
    const formElement = inputElement.closest('form');
    if (formElement) {
        return formElement;
    }
    
    // Strategy 3: Find parent with specific classes (expanded patterns)
    current = inputElement.parentElement;
    attempts = 0;
    while (current && attempts < 15) { // Increased from 10 to 15
        const classList = current.className || '';
        if (classList.includes('input') || classList.includes('prompt') || 
            classList.includes('container') || classList.includes('form') ||
            classList.includes('composer') || classList.includes('editor') ||
            classList.includes('toolbar') || classList.includes('footer')) {
            return current;
        }
        current = current.parentElement;
        attempts++;
    }
    
    // Strategy 4: Find container with buttons nearby
    const inputRect = inputElement.getBoundingClientRect();
    const allContainers = document.querySelectorAll('div, form, footer, section');
    let closestContainer = null;
    let closestDistance = Infinity;
    
    for (const container of allContainers) {
        if (container.contains(inputElement) && container.querySelector('button')) {
            const containerRect = container.getBoundingClientRect();
            const distance = Math.abs(containerRect.top - inputRect.bottom);
            if (distance < 100 && distance < closestDistance) {
                closestDistance = distance;
                closestContainer = container;
            }
        }
    }
    
    if (closestContainer) {
        return closestContainer;
    }
    
    // Strategy 5: Use fallback selector
    const fallback = document.querySelector(SELECTORS.BUTTON_CONTAINER_PARENT);
    if (fallback) {
        return fallback;
    }
    
    // Strategy 6: Use input's direct parent as last resort
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
 * Creates a simple "Improve" button - clean, minimal, focused.
 */
function createEnhanceButton(inputElement, enhancerDiv) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'main-enhance-button';
    button.textContent = 'Improve';
    
    // Simple, clean button styling
    button.className = 'text-white font-semibold rounded-lg text-sm';
    button.style.setProperty('height', '36px', 'important');
    button.style.setProperty('padding', '0 16px', 'important');
    button.style.setProperty('background', '#007AFF', 'important');
    button.style.setProperty('border', 'none', 'important');
    button.style.setProperty('white-space', 'nowrap', 'important');
    button.style.setProperty('font-family', '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 'important');
    button.style.setProperty('font-size', '13px', 'important');
    button.style.setProperty('font-weight', '600', 'important');
    button.style.setProperty('letter-spacing', '-0.01em', 'important');
    button.style.setProperty('flex-shrink', '0', 'important');
    button.style.setProperty('cursor', 'pointer', 'important');
    button.style.setProperty('user-select', 'none', 'important');
    button.style.setProperty('display', 'flex', 'important');
    button.style.setProperty('align-items', 'center', 'important');
    button.style.setProperty('justify-content', 'center', 'important');
    button.style.setProperty('visibility', 'visible', 'important');
    button.style.setProperty('opacity', '1', 'important');
    button.style.setProperty('z-index', '1000000', 'important');
    button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    button.style.transition = 'all 0.2s ease';
    button.style.borderRadius = '8px';
    
    // Simple hover effect
    button.onmouseenter = () => {
        button.style.background = '#0051D5';
        button.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)';
    };
    
    button.onmouseleave = () => {
        button.style.background = '#007AFF';
        button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    };
    
    // Prevent form submission
    let parentForm = button.closest('form');
    if (!parentForm) {
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
    
    if (parentForm) {
        const preventFormSubmit = (e) => {
            const submitter = e.submitter || (e.originalTarget && e.originalTarget.closest('button'));
            if (submitter === button || button.contains(submitter) || 
                (e.target && (e.target === button || e.target.contains(button)))) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        };
        parentForm.addEventListener('submit', preventFormSubmit, true);
    }
    
    // Button click handler - always use TEXT_ENHANCEMENT mode
    button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        handleButtonClick(inputElement, 'TEXT_ENHANCEMENT', enhancerDiv);
        return false;
    };
    
    button.onmousedown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.style.opacity = '0.9';
    };
    
    button.onmouseup = () => {
        button.style.opacity = '1';
    };
    
    return button;
}

/**
 * Sets up MutationObserver to protect the button from removal and maintain visibility
 */
let buttonProtectionObserver = null;

function setupButtonProtection(enhancerDiv, inputElement) {
    // Clean up existing observer if any
    if (buttonProtectionObserver) {
        buttonProtectionObserver.disconnect();
    }
    
    
    // Function to enforce visibility styles
    const enforceVisibility = () => {
        const button = document.getElementById('main-enhance-button');
        const container = document.getElementById('gemini-enhancer-buttons-container');
        
        if (button) {
            button.style.setProperty('display', 'flex', 'important');
            button.style.setProperty('visibility', 'visible', 'important');
            button.style.setProperty('opacity', '1', 'important');
            button.style.setProperty('z-index', '1000000', 'important');
        }
        
        if (container) {
            container.style.setProperty('display', 'inline-flex', 'important');
            container.style.setProperty('visibility', 'visible', 'important');
            container.style.setProperty('opacity', '1', 'important');
            container.style.setProperty('z-index', '999999', 'important');
        }
    };
    
    // Set up MutationObserver to watch for removal or style changes
    buttonProtectionObserver = new MutationObserver((mutations) => {
        let needsReinjection = false;
        
        for (const mutation of mutations) {
            // Check if our button was removed
            if (mutation.type === 'childList') {
                for (const node of mutation.removedNodes) {
                    if (node === enhancerDiv || (node.nodeType === 1 && node.contains && node.contains(enhancerDiv))) {
                        console.warn('[Gemini Architect] Button container was removed! Re-injecting...');
                        needsReinjection = true;
                        break;
                    }
                }
            }
            
            // Check if visibility styles were changed
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const button = document.getElementById('main-enhance-button');
                if (button && mutation.target === button) {
                    const style = window.getComputedStyle(button);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                        console.warn('[Gemini Architect] Button visibility was changed! Restoring...');
                        enforceVisibility();
                    }
                }
            }
        }
        
        // Re-inject if removed
        if (needsReinjection) {
            buttonProtectionObserver.disconnect();
            setTimeout(() => {
                if (inputElement && document.body.contains(inputElement)) {
                    injectUI(inputElement).catch(err => {
                        console.error('[Gemini Architect] Failed to re-inject after removal:', err);
                    });
                }
            }, 100);
        }
    });
    
    // Observe the container and its parent for changes
    if (enhancerDiv.parentElement) {
        buttonProtectionObserver.observe(enhancerDiv.parentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }
    
    // Also observe the button itself
    const button = document.getElementById('main-enhance-button');
    if (button) {
        buttonProtectionObserver.observe(button, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }
    
    // Periodically enforce visibility (in case styles are changed)
    const visibilityInterval = setInterval(() => {
        if (!document.body.contains(enhancerDiv)) {
            clearInterval(visibilityInterval);
            buttonProtectionObserver.disconnect();
            return;
        }
        enforceVisibility();
    }, 2000); // Check every 2 seconds
    
}

/**
 * Platform-specific injection functions
 */

/**
 * ChatGPT-specific injection
 */
async function injectChatGPT(inputElement) {
    // Find the send button using multiple strategies
    let sendButton = null;
    
    // Strategy 1: Look in the form containing the input
    const form = inputElement.closest('form');
    if (form) {
        sendButton = form.querySelector('button[data-testid*="send" i]') ||
                     form.querySelector('button[aria-label*="Send" i]') ||
                     form.querySelector('button[type="submit"]') ||
                     form.querySelector('button[id*="composer-submit"]') ||
                     form.querySelector('button[class*="composer-submit"]');
    }
    
    // Strategy 2: Search in parent hierarchy
    if (!sendButton) {
        let parent = inputElement.parentElement;
        for (let i = 0; i < 20 && parent; i++) {
            sendButton = parent.querySelector('button[data-testid*="send" i]') ||
                         parent.querySelector('button[aria-label*="Send" i]') ||
                         parent.querySelector('button[id*="composer-submit"]') ||
                         parent.querySelector('button[class*="composer-submit"]') ||
                         parent.querySelector('button[class*="submit"]');
            if (sendButton && sendButton.offsetParent !== null) break;
            parent = parent.parentElement;
        }
    }
    
    // Strategy 3: Search entire document for buttons near input
    if (!sendButton) {
        const inputRect = inputElement.getBoundingClientRect();
        const allButtons = document.querySelectorAll('button');
        let closestButton = null;
        let closestDistance = Infinity;
        
        for (const btn of allButtons) {
            if (btn.offsetParent === null) continue;
            const btnRect = btn.getBoundingClientRect();
            const distance = Math.abs(btnRect.top - inputRect.bottom) + Math.abs(btnRect.left - inputRect.right);
            
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const id = (btn.id || '').toLowerCase();
            const className = (btn.className || '').toLowerCase();
            const hasSendIcon = btn.querySelector('svg');
            const isSubmit = btn.type === 'submit';
            
            if ((isSubmit || ariaLabel.includes('send') || id.includes('submit') || 
                 className.includes('submit') || className.includes('send') || hasSendIcon) && 
                distance < 200) {
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestButton = btn;
                }
            }
        }
        
        if (closestButton) {
            sendButton = closestButton;
        }
    }
    
    if (!sendButton || !sendButton.parentElement) {
        throw new Error('ChatGPT send button not found');
    }
    
    return injectButtonNextToSend(inputElement, sendButton);
}

/**
 * Gemini-specific injection
 */
async function injectGemini(inputElement) {
    // Find send button - don't pass container, let injectButtonNextToSend find the correct one
    let sendButton = null;
    
    // Strategy 1: Search in parent hierarchy
    let parent = inputElement.parentElement;
    for (let i = 0; i < 25 && parent; i++) {
        const buttons = parent.querySelectorAll('button');
        for (const btn of buttons) {
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (ariaLabel.includes('send') || ariaLabel.includes('submit') || btn.querySelector('svg')) {
                if (btn.offsetParent !== null) { // Check if visible
                    sendButton = btn;
                    break;
                }
            }
        }
        if (sendButton) break;
        parent = parent.parentElement;
    }
    
    // Strategy 2: Search entire document for buttons near input
    if (!sendButton) {
        const inputRect = inputElement.getBoundingClientRect();
        const allButtons = document.querySelectorAll('button');
        let closestButton = null;
        let closestDistance = Infinity;
        
        for (const btn of allButtons) {
            if (btn.offsetParent === null) continue;
            const btnRect = btn.getBoundingClientRect();
            const distance = Math.abs(btnRect.top - inputRect.bottom) + Math.abs(btnRect.left - inputRect.right);
            
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const hasSendIcon = btn.querySelector('svg');
            const isSubmit = btn.type === 'submit';
            
            if ((hasSendIcon || isSubmit || ariaLabel.includes('send') || ariaLabel.includes('submit')) && 
                distance < 200) {
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestButton = btn;
                }
            }
        }
        
        if (closestButton) {
            sendButton = closestButton;
        }
    }
    
    if (!sendButton || !sendButton.parentElement) {
        throw new Error('Gemini send button not found');
    }
    
    // Don't pass container - let injectButtonNextToSend use sendButton.parentElement
    return injectButtonNextToSend(inputElement, sendButton);
}

/**
 * Claude-specific injection
 */
async function injectClaude(inputElement) {
    // Claude uses form with submit button
    const form = inputElement.closest('form');
    const sendButton = form?.querySelector('button[type="submit"], button[aria-label*="Send" i]');
    
    if (!sendButton || !sendButton.parentElement) {
        throw new Error('Claude send button not found');
    }
    
    return injectButtonNextToSend(inputElement, sendButton);
}

/**
 * Grok-specific injection
 */
async function injectGrok(inputElement) {
    // Grok uses Twitter's composer - find tweet button with multiple strategies
    let sendButton = null;
    
    // Strategy 1: Look for tweet button by data-testid
    sendButton = document.querySelector('[data-testid="tweetButton"]') ||
                 document.querySelector('button[data-testid*="tweetButton"]');
    
    // Strategy 2: Look in the form/composer area
    if (!sendButton) {
        const form = inputElement.closest('form');
        if (form) {
            sendButton = form.querySelector('[data-testid="tweetButton"]') ||
                         form.querySelector('button[data-testid*="tweetButton"]') ||
                         form.querySelector('button[type="submit"]');
        }
    }
    
    // Strategy 3: Search in parent hierarchy
    if (!sendButton) {
        let parent = inputElement.parentElement;
        for (let i = 0; i < 25 && parent; i++) {
            sendButton = parent.querySelector('[data-testid="tweetButton"]') ||
                         parent.querySelector('button[data-testid*="tweetButton"]') ||
                         parent.querySelector('button[type="submit"]');
            if (sendButton && sendButton.offsetParent !== null) break;
            parent = parent.parentElement;
        }
    }
    
    // Strategy 4: Find button near input by proximity
    if (!sendButton) {
        const inputRect = inputElement.getBoundingClientRect();
        const allButtons = document.querySelectorAll('button');
        let closestButton = null;
        let closestDistance = Infinity;
        
        for (const btn of allButtons) {
            if (btn.offsetParent === null) continue;
            const btnRect = btn.getBoundingClientRect();
            const distance = Math.abs(btnRect.top - inputRect.bottom) + Math.abs(btnRect.left - inputRect.right);
            
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const id = (btn.id || '').toLowerCase();
            const dataTestId = (btn.getAttribute('data-testid') || '').toLowerCase();
            
            if ((dataTestId.includes('tweet') || ariaLabel.includes('post') || 
                 ariaLabel.includes('tweet') || id.includes('tweet')) && distance < 300) {
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestButton = btn;
                }
            }
        }
        
        if (closestButton) {
            sendButton = closestButton;
        }
    }
    
    if (!sendButton || !sendButton.parentElement) {
        throw new Error('Grok send button not found');
    }
    
    // Make sure we're not inside the input field container
    let container = sendButton.parentElement;
    let attempts = 0;
    while (container && attempts < 10) {
        if (container.contains(inputElement) && container !== inputElement) {
            container = container.parentElement;
            attempts++;
        } else {
            break;
        }
    }
    
    return injectButtonNextToSend(inputElement, sendButton, container);
}

/**
 * Perplexity-specific injection
 */
async function injectPerplexity(inputElement) {
    // Perplexity uses search button
    const sendButton = inputElement.closest('form')?.querySelector('button[type="submit"], button[aria-label*="Search" i]') ||
                       document.querySelector('button[type="submit"][class*="search"]');
    
    if (!sendButton || !sendButton.parentElement) {
        throw new Error('Perplexity send button not found');
    }
    
    return injectButtonNextToSend(inputElement, sendButton);
}

/**
 * Common function to inject button next to send button
 */
async function injectButtonNextToSend(inputElement, sendButton, container = null) {
    return new Promise(async (resolve, reject) => {
        try {
            // Check if already injected
            const existingContainer = document.getElementById('gemini-enhancer-buttons-container');
            if (existingContainer && document.body.contains(existingContainer)) {
                resolve();
                return;
            }

            // Find the correct container - must be one that actually contains the send button
            let targetContainer = container || sendButton.parentElement;
            
            // Verify the send button is actually in this container
            if (targetContainer && !targetContainer.contains(sendButton)) {
                // If not, use the send button's actual parent
                targetContainer = sendButton.parentElement;
            }
            
            if (!targetContainer) {
                reject(new Error('No container found'));
                return;
            }

            // Create UI elements
            const enhancerDiv = document.createElement('div');
            enhancerDiv.id = 'gemini-enhancer-buttons-container';
            enhancerDiv.className = 'flex items-center';
            enhancerDiv.style.setProperty('display', 'inline-flex', 'important');
            enhancerDiv.style.setProperty('align-items', 'center', 'important');
            enhancerDiv.style.setProperty('gap', '8px', 'important');
            enhancerDiv.style.setProperty('margin-right', '8px', 'important');
            enhancerDiv.style.setProperty('z-index', '999999', 'important');
            enhancerDiv.style.setProperty('visibility', 'visible', 'important');
            enhancerDiv.style.setProperty('opacity', '1', 'important');

            // Status area
            const statusArea = document.createElement('div');
            statusArea.id = 'gemini-status-area';
            statusArea.style.cssText = `
                height: 36px; 
                display: none;
                align-items: center;
                width: 0;
                overflow: hidden;
            `;
            
            const loadingSpinner = document.createElement('div');
            loadingSpinner.className = 'spinner';
            loadingSpinner.style.cssText = `
                border: 2.5px solid rgba(0, 122, 255, 0.15); 
                border-top: 2.5px solid #007AFF; 
                border-radius: 50%; 
                width: 18px; 
                height: 18px; 
                animation: spin 0.7s linear infinite; 
                display: none;
            `;
            
            statusArea.appendChild(loadingSpinner);
            enhancerDiv.appendChild(statusArea);
            enhancerDiv.appendChild(createEnhanceButton(inputElement, enhancerDiv));

            // Ensure container is flex
            const containerStyle = window.getComputedStyle(targetContainer);
            if (!containerStyle.display.includes('flex')) {
                targetContainer.style.display = 'flex';
                targetContainer.style.alignItems = 'center';
                targetContainer.style.gap = '8px';
            }

            // Verify send button is still in the container before inserting
            if (!targetContainer.contains(sendButton)) {
                reject(new Error('Send button is not in the target container'));
                return;
            }

            // Insert before send button
            targetContainer.insertBefore(enhancerDiv, sendButton);

            // Verify and set up protection
            setTimeout(() => {
                const injectedButton = document.getElementById('main-enhance-button');
                if (injectedButton) {
                    setupButtonProtection(enhancerDiv, inputElement);
                    resolve();
                } else {
                    reject(new Error('Button not found after injection'));
                }
            }, 100);
        } catch (error) {
            console.error('[Gemini Architect] Injection error:', error);
            reject(error);
        }
    });
}

/**
 * Main injection function - routes to platform-specific handlers
 */
async function injectUI(inputElement) {
    const platform = detectPlatform();
    
    // Check if platform is enabled
    const enabled = await isPlatformEnabled();
    if (!enabled) {
        throw new Error('Platform not supported');
    }
    
    // Route to platform-specific injection
    switch (platform) {
        case 'chatgpt':
            return injectChatGPT(inputElement);
        case 'gemini':
            return injectGemini(inputElement);
        case 'claude':
            return injectClaude(inputElement);
        case 'grok':
            return injectGrok(inputElement);
        case 'perplexity':
            return injectPerplexity(inputElement);
        default:
            throw new Error(`Unsupported platform: ${platform}`);
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
        targetElement = document.querySelector(SELECTORS.PROMPT_INPUT);
    }
    
    if (!targetElement) {
        console.warn('[Gemini Architect] Could not find input element to update');
        return Promise.resolve(false);
    }
    
    
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
                } else {
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
                }
            }
            
            resolve(updateSuccess);
        });
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
                return text;
            }
        }
        
        // Strategy 2: Check if it's a contenteditable div
        if (element.contentEditable === 'true' || element.hasAttribute('contenteditable') || 
            element.getAttribute('contenteditable') === 'true') {
            // Try textContent first (includes hidden text)
            let text = (element.textContent || '').trim();
            if (text) {
                return text;
            }
            // Fallback to innerText
            text = (element.innerText || '').trim();
            if (text) {
                return text;
            }
            // For nested contenteditable structures, try finding the deepest contenteditable child
            const nestedContentEditable = element.querySelector('[contenteditable="true"], [contenteditable=""]');
            if (nestedContentEditable && nestedContentEditable !== element) {
                text = (nestedContentEditable.textContent || nestedContentEditable.innerText || '').trim();
                if (text) {
                    return text;
                }
            }
        }
        
        // Strategy 3: Try textContent (works for most elements, includes all text)
        if (element.textContent) {
            const text = element.textContent.trim();
            if (text) {
                return text;
            }
        }
        
        // Strategy 4: Try innerText (only visible text)
        if (element.innerText) {
            const text = element.innerText.trim();
            if (text) {
                return text;
            }
        }
        
        // Strategy 5: Try value property (for input elements)
        if (element.value) {
            const text = element.value.trim();
            if (text) {
                return text;
            }
        }
        
        return '';
    };
    
    // Try reading from the passed inputElement first
    rawPrompt = extractTextFromElement(inputElement);
    
    // Strategy 2: If no text found, try re-querying for the current active input
    if (!rawPrompt) {
        const queriedElement = document.querySelector(SELECTORS.PROMPT_INPUT);
        
        if (queriedElement && document.body.contains(queriedElement)) {
            const queriedText = extractTextFromElement(queriedElement);
            if (queriedText) {
                rawPrompt = queriedText;
                currentInputElement = queriedElement;
            }
        }
    }
    
    // Strategy 3: Try finding contenteditable divs near the input (ChatGPT sometimes uses these)
    if (!rawPrompt && inputElement) {
        let parent = inputElement.parentElement;
        let attempts = 0;
        while (parent && attempts < 10) {
            const contentEditableDivs = parent.querySelectorAll('[contenteditable="true"], [contenteditable=""]');
            for (const div of contentEditableDivs) {
                const text = extractTextFromElement(div);
                if (text) {
                    rawPrompt = text;
                    currentInputElement = div;
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
        const container = inputElement.closest('form') || inputElement.parentElement;
        if (container) {
            const textareas = container.querySelectorAll('textarea');
            for (const textarea of textareas) {
                const text = extractTextFromElement(textarea);
                if (text) {
                    rawPrompt = text;
                    currentInputElement = textarea;
                    break;
                }
            }
        }
    }
    
    // Strategy 5: Try finding input relative to the status container (where button is injected)
    if (!rawPrompt && statusContainer) {
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

    if (!rawPrompt) {
        console.warn('[Gemini Architect] No prompt found after all strategies. Element details:', {
            passedElement: inputElement?.tagName,
            passedElementId: inputElement?.id,
            passedElementClass: inputElement?.className,
            passedElementContentEditable: inputElement?.contentEditable,
            passedElementValue: inputElement?.value?.substring(0, 50),
            passedElementTextContent: inputElement?.textContent?.substring(0, 50)
        });
        // No status message - just return silently
        return;
    }
    
    // Update inputElement reference for later use
    inputElement = currentInputElement;

    // 1. Disable controls and show loading
    enhanceButton.disabled = true;
    enhanceButton.style.background = 'rgba(142, 142, 147, 0.3)'; // Gray out the button
    enhanceButton.style.transform = 'scale(0.98)';
    // Show spinner and status area only when processing
    const statusArea = document.getElementById('gemini-status-area');
    if (statusArea) {
        statusArea.style.display = 'inline-flex';
        statusArea.style.width = 'auto';
    }
    spinnerEl.style.display = 'inline-block';

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
            // Silent failure - let the error text in the input speak for itself
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
                // Success - the improved prompt in the input field is the feedback
                if (!updateSuccess) {
                    console.error('[Gemini Architect] Update failed');
                }
            }).catch(error => {
                console.error('[Gemini Architect] Error updating input:', error);
            });
        }

    } catch (error) {
        console.error('Gemini Architect communication error:', error);
        // Silent error - logged to console for debugging
    } finally {
        // 4. Re-enable controls and hide loading
        spinnerEl.style.display = 'none';
        enhanceButton.disabled = false;
        enhanceButton.style.background = '#007AFF'; // Restore button color
        enhanceButton.style.transform = 'translateY(0) scale(1)';
        // Hide status area completely when done (no text messages shown)
        const statusArea = document.getElementById('gemini-status-area');
        if (statusArea) {
            statusArea.style.display = 'none';
            statusArea.style.width = '0';
        }
        if (statusEl) statusEl.style.display = 'none';
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
                    // Success - the improved prompt in the input field is the feedback
                    if (!updateSuccess) {
                        console.error('[Gemini Architect] Context menu update failed');
                    }
                }).catch(error => {
                    console.error('[Gemini Architect] Error updating input from context menu:', error);
                });
            } else {
                // Silent error - logged to console for debugging
                console.error('[Gemini Architect] Context menu error');
            }
        }
        sendResponse({ success: true });
        return true;
    }
});


/**
 * Platform-specific input finder for better detection
 * Only works on supported platforms: ChatGPT, Gemini, Claude, Grok, Perplexity
 */
function findPlatformSpecificInput() {
    const platform = detectPlatform();
    
    // Only find input on supported platforms
    const supportedPlatforms = ['chatgpt', 'gemini', 'claude', 'grok', 'perplexity'];
    if (!supportedPlatforms.includes(platform)) {
        return null;
    }
    
    let input = null;
    
    if (platform === 'gemini') {
        // Gemini uses contenteditable divs, try multiple strategies in order of specificity
        const geminiSelectors = [
            // Most specific - aria labels
            '[contenteditable="true"][aria-label*="Enter a prompt" i]',
            '[contenteditable="true"][aria-label*="prompt" i]',
            '[contenteditable="true"][aria-label*="message" i]',
            '[contenteditable="true"][aria-label*="Type" i]',
            // Role-based
            '[contenteditable="true"][role="textbox"]',
            '[role="textbox"][contenteditable="true"]',
            // Class-based (more specific first)
            '[contenteditable="true"][class*="input" i]',
            '[contenteditable="true"][class*="text" i]',
            '[contenteditable="true"][class*="editor" i]',
            '[contenteditable="true"][class*="composer" i]',
            '[contenteditable="true"][class*="prompt" i]',
            // Generic contenteditable
            'div[contenteditable="true"]:not([contenteditable="false"])',
            // Search within containers
            'main [contenteditable="true"]',
            '[role="main"] [contenteditable="true"]',
            '[class*="input-container"] [contenteditable="true"]',
            '[class*="prompt-container"] [contenteditable="true"]',
            '[class*="composer"] [contenteditable="true"]',
            '[class*="editor"] [contenteditable="true"]',
            '[class*="textarea"] [contenteditable="true"]',
            // Very aggressive: any contenteditable in visible area
            '[contenteditable="true"]:not([contenteditable="false"])',
        ];
        
        for (const selector of geminiSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const elem of elements) {
                    const rect = elem.getBoundingClientRect();
                    const style = window.getComputedStyle(elem);
                    // Very relaxed visibility checks for Gemini
                    if (rect.width > 20 && rect.height > 5 && 
                        style.display !== 'none' && 
                        style.visibility !== 'hidden' &&
                        elem.offsetParent !== null &&
                        rect.top >= 0 && rect.left >= 0) {
                        input = elem;
                        break;
                    }
                }
                if (input) break;
            } catch (e) {
                // Continue if selector fails
                continue;
            }
        }
        
        // Fallback 1: find largest visible contenteditable
        if (!input) {
            const allContentEditables = document.querySelectorAll('[contenteditable="true"]:not([contenteditable="false"])');
            let largestElement = null;
            let largestArea = 0;
            
            for (const elem of allContentEditables) {
                const rect = elem.getBoundingClientRect();
                const style = window.getComputedStyle(elem);
                if (rect.width > 20 && rect.height > 5 && 
                    style.display !== 'none' && 
                    style.visibility !== 'hidden' &&
                    elem.offsetParent !== null &&
                    rect.top >= 0 && rect.left >= 0) {
                    const area = rect.width * rect.height;
                    if (area > largestArea) {
                        largestArea = area;
                        largestElement = elem;
                    }
                }
            }
            
            if (largestElement) {
                input = largestElement;
            }
        }
        
        // Fallback 2: find contenteditable in main chat area
        if (!input) {
            const mainArea = document.querySelector('main, [role="main"], [class*="chat"], [class*="conversation"]');
            if (mainArea) {
                const contentEditables = mainArea.querySelectorAll('[contenteditable="true"]:not([contenteditable="false"])');
                for (const elem of contentEditables) {
                    const rect = elem.getBoundingClientRect();
                    const style = window.getComputedStyle(elem);
                    if (rect.width > 20 && rect.height > 5 && 
                        style.display !== 'none' && 
                        style.visibility !== 'hidden' &&
                        elem.offsetParent !== null) {
                        input = elem;
                        break;
                    }
                }
            }
        }
        
    } else if (platform === 'grok') {
        // Grok uses Twitter's composer - try multiple selectors
        const grokSelectors = [
            // Grok-specific: look for the main input area first
            '[contenteditable="true"][aria-label*="What do you want to know" i]',
            '[contenteditable="true"][placeholder*="What do you want to know" i]',
            '[contenteditable="true"][data-placeholder*="What do you want to know" i]',
            // Twitter/X composer patterns
            '[data-testid="tweetTextarea_0"]',
            '[data-testid*="tweetTextarea"]',
            '[contenteditable="true"][data-testid*="tweet"]',
            '[contenteditable="true"][aria-label*="Post text" i]',
            '[contenteditable="true"][aria-label*="Tweet text" i]',
            '[contenteditable="true"][aria-label*="What is happening" i]',
            '[contenteditable="true"][placeholder*="What is happening" i]',
            // Nested contenteditable in composer
            '[data-testid="tweetTextarea_0"] [contenteditable="true"]',
            '[data-testid*="tweetTextarea"] [contenteditable="true"]',
            '[role="textbox"][contenteditable="true"]',
            // Search within composer containers
            '[class*="composer"] [contenteditable="true"]',
            '[class*="DraftEditor"] [contenteditable="true"]',
            '[class*="public-DraftEditor"] [contenteditable="true"]',
            // Grok-specific: look for main input area
            'main [contenteditable="true"]',
            '[role="main"] [contenteditable="true"]',
            '[class*="input"] [contenteditable="true"]',
        ];
        
        for (const selector of grokSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const elem of elements) {
                const rect = elem.getBoundingClientRect();
                const style = window.getComputedStyle(elem);
                // More relaxed checks for Grok
                if (rect.width > 20 && rect.height > 10 && 
                    style.display !== 'none' && 
                    style.visibility !== 'hidden' &&
                    elem.offsetParent !== null) {
                    input = elem;
                    break;
                }
            }
            if (input) break;
        }
        
        // Fallback 1: search within composer area
        if (!input) {
            const composerArea = document.querySelector('[data-testid*="tweetTextarea"], [class*="composer"], [class*="DraftEditor"], [class*="public-DraftEditor"]');
            if (composerArea) {
                const contentEditables = composerArea.querySelectorAll('[contenteditable="true"]');
                for (const elem of contentEditables) {
                    const rect = elem.getBoundingClientRect();
                    const style = window.getComputedStyle(elem);
                    if (rect.width > 20 && rect.height > 10 && 
                        style.display !== 'none' && 
                        style.visibility !== 'hidden' &&
                        elem.offsetParent !== null) {
                        input = elem;
                        break;
                    }
                }
            }
        }
        
        // Fallback 2: find largest visible contenteditable (Grok's main input is usually the largest)
        if (!input) {
            const allContentEditables = document.querySelectorAll('[contenteditable="true"]:not([contenteditable="false"])');
            let largestElement = null;
            let largestArea = 0;
            
            for (const elem of allContentEditables) {
                const rect = elem.getBoundingClientRect();
                const style = window.getComputedStyle(elem);
                if (rect.width > 20 && rect.height > 10 && 
                    style.display !== 'none' && 
                    style.visibility !== 'hidden' &&
                    elem.offsetParent !== null) {
                    const area = rect.width * rect.height;
                    // Prefer elements that are likely input fields (have some minimum size)
                    if (area > largestArea && rect.width > 100) {
                        largestArea = area;
                        largestElement = elem;
                    }
                }
            }
            
            if (largestElement) {
                input = largestElement;
            }
        }
        
    }
    
    // Fallback to generic selectors with relaxed checks
    if (!input) {
        const genericInputs = document.querySelectorAll(SELECTORS.PROMPT_INPUT);
        for (const elem of genericInputs) {
            const rect = elem.getBoundingClientRect();
            const style = window.getComputedStyle(elem);
            // Relaxed checks - reduced minimum width from 50 to 30, height from 20 to 10
            if (rect.width > 30 && rect.height > 10 && 
                style.display !== 'none' && 
                style.visibility !== 'hidden' &&
                elem.offsetParent !== null) {
                input = elem;
                break;
            }
        }
    }
    
    if (!input) {
        console.warn('[Gemini Architect] No input element found after all search strategies');
    }
    
    return input;
}

/**
 * Uses a MutationObserver to detect when the target chat interface is loaded.
 * Enhanced to stay active for ChatGPT's dynamic interface and prevent excessive re-injections.
 */
let injectionDebounceTimer = null;
let lastInjectedInput = null;

/**
 * Retry injection with exponential backoff and DOM mutation triggers
 */
let retryCount = 0;
const MAX_RETRIES = 15; // Increased from 10 to 15
const RETRY_DELAYS = [100, 200, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000]; // Extended delays

let retryMutationObserver = null;

function retryInjection() {
    if (retryCount >= MAX_RETRIES) {
        if (retryMutationObserver) {
            retryMutationObserver.disconnect();
            retryMutationObserver = null;
        }
        return;
    }
    
    const delay = RETRY_DELAYS[retryCount] || 10000;
    retryCount++;
    
    
    const timeoutId = setTimeout(() => {
        isPlatformEnabled().then(enabled => {
            if (!enabled) {
                if (retryMutationObserver) {
                    retryMutationObserver.disconnect();
                    retryMutationObserver = null;
                }
                retryCount = 0;
                return;
            }
            
            const existingUI = document.getElementById('gemini-enhancer-buttons-container');
            if (existingUI && document.body.contains(existingUI)) {
                retryCount = 0; // Reset for future attempts
                if (retryMutationObserver) {
                    retryMutationObserver.disconnect();
                    retryMutationObserver = null;
                }
                return;
            }
            
            const input = findPlatformSpecificInput();
            if (input) {
                injectUI(input).then(() => {
                    retryCount = 0; // Reset on success
                    if (retryMutationObserver) {
                        retryMutationObserver.disconnect();
                        retryMutationObserver = null;
                    }
                }).catch(err => {
                    // Silent retry - only log after max retries
                    if (retryCount >= MAX_RETRIES) {
                        console.error('[Gemini Architect] Max retries reached, injection failed');
                    }
                    if (retryCount < MAX_RETRIES) {
                        retryInjection();
                    }
                });
            } else {
                if (retryCount < MAX_RETRIES) {
                    retryInjection();
                }
            }
        });
    }, delay);
    
    // Set up MutationObserver to trigger retry on DOM changes (page loading)
    if (!retryMutationObserver && retryCount <= 5) { // Only set up for first few retries
        retryMutationObserver = new MutationObserver((mutations) => {
            // Check if significant DOM changes occurred (new elements added)
            let significantChange = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if any added node might be an input or button
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Element node
                            if (node.matches && (
                                node.matches('[contenteditable="true"]') ||
                                node.matches('textarea') ||
                                node.matches('button') ||
                                node.querySelector('[contenteditable="true"]') ||
                                node.querySelector('textarea') ||
                                node.querySelector('button')
                            )) {
                                significantChange = true;
                                break;
                            }
                        }
                    }
                    if (significantChange) break;
                }
            }
            
            if (significantChange) {
                clearTimeout(timeoutId);
                retryCount--; // Don't count this as a retry since it's triggered by mutation
                retryInjection();
            }
        });
        
        // Observe document body for changes
        retryMutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

function observeDOM() {
    
    // Try immediate injection with platform-specific finder
    let input = findPlatformSpecificInput();
    if (input) {
        injectUI(input).then(() => {
            lastInjectedInput = input;
            retryCount = 0; // Reset retry count on success
        }).catch(err => {
            // Silent failure - will retry
            retryInjection(); // Start retry sequence
        });
    } else {
        retryInjection(); // Start retry sequence
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
                    }
                    retryCount = 0;
                    return;
                }
                
                const currentInput = findPlatformSpecificInput();
                
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
                        lastInjectedInput = currentInput;
                        retryCount = 0; // Reset retry count
                        injectUI(currentInput).then(() => {
                            retryCount = 0;
                        }).catch(err => {
                            // Silent re-injection failure
                        });
                    }
                } else {
                    // Input disappeared, might need to retry
                    const existingUI = document.getElementById('gemini-enhancer-buttons-container');
                    if (!existingUI || !document.body.contains(existingUI)) {
                        if (retryCount < MAX_RETRIES) {
                            retryInjection();
                        }
                    }
                }
            });
        }, 500); // Increased debounce to 500ms
    });

    // Observe with comprehensive options for dynamic interfaces
    observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: false,
        attributeOldValue: false
    });
    
}

// Initialization - only on supported platforms
(function() {
    try {
        const platform = detectPlatform();
        const supportedPlatforms = ['chatgpt', 'gemini', 'claude', 'grok', 'perplexity'];
        
        // Only initialize on supported platforms
        if (!supportedPlatforms.includes(platform)) {
            return;
        }
        
        // Temporary debug for Grok
        if (platform === 'grok') {
            console.log('[Gemini Architect] Grok detected on:', window.location.hostname);
            setTimeout(() => {
                const input = findPlatformSpecificInput();
                console.log('[Gemini Architect] Grok input found:', input ? 'YES' : 'NO');
                if (input) {
                    console.log('[Gemini Architect] Input element:', input.tagName, input.className);
                    const sendButton = document.querySelector('[data-testid="tweetButton"]') ||
                                     document.querySelector('button[data-testid*="tweetButton"]');
                    console.log('[Gemini Architect] Grok send button found:', sendButton ? 'YES' : 'NO');
                }
            }, 3000);
        }
        
        // Start the detection process immediately
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                try {
                    observeDOM();
                } catch (error) {
                    console.error('[Gemini Architect] Error in observeDOM after DOMContentLoaded:', error);
                }
            });
        } else {
            // DOM already loaded
            try {
                observeDOM();
            } catch (error) {
                console.error('[Gemini Architect] Error in observeDOM (immediate):', error);
            }
        }
        
        // Also try after a short delay to catch late-loading pages
        setTimeout(() => {
            const existingUI = document.getElementById('gemini-enhancer-buttons-container');
            if (!existingUI || !document.body.contains(existingUI)) {
                const input = findPlatformSpecificInput();
                if (input) {
                    injectUI(input).catch(err => {
                        // Silent delayed injection failure
                    });
                }
            }
        }, 2000);
        
    } catch (error) {
        console.error('[Gemini Architect] Fatal error during initialization:', error);
        console.error('[Gemini Architect] Stack:', error.stack);
    }
})();