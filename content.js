/**
 * content.js
 * Injects the premium Prompt Architect UI (Mode Selector + Enhance Button)
 * into target AI chat interfaces. Designed with a clean, Apple-inspired aesthetic.
 */

(function() {
  const host = window.location.hostname;
  if (/chat\.openai\.com|chatgpt\.com|gemini\.google\.com|claude\.ai|perplexity\.ai|grok\.com|x\.com/i.test(host)) {
    console.log('[Prompt Architect] Content script loaded on', host);
  }
})();

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

// ============================================================================
// PERFORMANCE CACHING
// ============================================================================

/** Cache for platform detection - only computed once per page load */
let cachedPlatform = null;

/** Cache for frequently accessed DOM elements */
const elementCache = {
    buttonsContainer: null,
    enhanceButton: null,
    statusArea: null,
    statusMessage: null,
    spinner: null,
    currentInput: null,
    sendButton: null,
};

/** Cache for platform design tokens */
const designCache = new Map();

/** Stream port for enhanced prompt on this tab (ChatGPT, Gemini, etc.) */
let enhanceStreamPagePort = null;
/** Active streaming state: { currentInputElement, elementToUpdate, enhanceButton, statusEl, statusArea, design, platform, accumulated } */
let streamingContext = null;
/** Throttle: last time we updated the input during streaming */
let streamUpdateScheduled = null;

function connectEnhanceStreamPagePort() {
    if (enhanceStreamPagePort) return;
    try {
        enhanceStreamPagePort = chrome.runtime.connect({ name: 'enhanceStreamPage' });
        enhanceStreamPagePort.onMessage.addListener((msg) => {
            const ctx = streamingContext;
            if (!ctx) return;
            if (msg.chunk) {
                ctx.accumulated += msg.chunk;
                // Keep spinner visible until stream ends (re-apply in case button was re-injected)
                const btn = document.getElementById('main-enhance-button');
                if (btn) {
                    const iconEl = btn.querySelector('.pa-enhance-button-icon');
                    const spinnerEl = btn.querySelector('.pa-enhance-spinner');
                    if (iconEl) iconEl.style.display = 'none';
                    if (spinnerEl) spinnerEl.style.display = 'flex';
                }
                if (!streamUpdateScheduled) {
                    streamUpdateScheduled = true;
                    requestAnimationFrame(() => {
                        streamUpdateScheduled = null;
                        if (streamingContext && streamingContext.currentInputElement && document.body.contains(streamingContext.currentInputElement)) {
                            updateInputAndDispatch(streamingContext.accumulated, streamingContext.currentInputElement).catch(() => {});
                        }
                    });
                }
            }
            if (msg.done && msg.fullText != null) {
                const fullText = msg.fullText;
                let elementToUpdate = ctx.elementToUpdate || ctx.currentInputElement;
                if (ctx.platform === 'perplexity' && (!elementToUpdate || !document.body.contains(elementToUpdate))) {
                    const perplexityInput = findPlatformSpecificInput();
                    if (perplexityInput) elementToUpdate = perplexityInput;
                }
                updateInputAndDispatch(fullText, elementToUpdate).then((updateSuccess) => {
                    if (!updateSuccess && ctx.platform === 'perplexity') {
                        setTimeout(() => {
                            const freshInput = findPlatformSpecificInput();
                            if (freshInput) updateInputAndDispatch(fullText, freshInput).catch(() => {});
                        }, 200);
                    } else if (updateSuccess) {
                        chrome.storage.local.get(['autoSendAfterEnhancement'], async (result) => {
                            if (result.autoSendAfterEnhancement) {
                                await new Promise(r => setTimeout(r, 300));
                                const sendButton = findSendButton(elementToUpdate || ctx.currentInputElement);
                                if (sendButton && sendButton.offsetParent !== null) sendButton.click();
                            }
                        });
                    }
                }).catch(() => {});
                // Use current button in DOM so we clear spinner even if React replaced the node (fixes stuck spinner)
                const btn = document.getElementById('main-enhance-button') || ctx.enhanceButton;
                if (btn) {
                    const iconEl = btn.querySelector('.pa-enhance-button-icon');
                    const spinnerEl = btn.querySelector('.pa-enhance-spinner');
                    if (iconEl) iconEl.style.display = 'flex';
                    if (spinnerEl) spinnerEl.style.display = 'none';
                    btn.disabled = false;
                    btn.style.animation = '';
                    btn.style.background = `linear-gradient(180deg, ${ctx.design.primaryHover || ctx.design.primary} 0%, ${ctx.design.primary} 100%)`;
                    btn.style.cursor = 'pointer';
                    btn.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.2s ease, background 0.2s ease';
                    btn.style.animation = 'pa-success-pop 0.4s ease-out forwards';
                    setTimeout(() => {
                        const currentBtn = document.getElementById('main-enhance-button') || btn;
                        if (currentBtn) {
                            currentBtn.style.animation = '';
                            currentBtn.style.transition = 'box-shadow 0.2s ease, background 0.2s ease, transform 0.15s ease';
                            currentBtn.style.transform = '';
                        }
                    }, 420);
                }
                const statusAreaEl = document.getElementById('prompt-architect-status-area');
                const statusElEl = document.getElementById('prompt-architect-status');
                if (statusAreaEl) { statusAreaEl.style.display = 'none'; statusAreaEl.style.width = '0'; }
                if (statusElEl) statusElEl.style.display = 'none';
                streamingContext = null;
            }
            if (msg.error) {
                const errMsg = msg.error;
                const statusArea = document.getElementById('prompt-architect-status-area') || ctx.statusArea;
                const statusEl = document.getElementById('prompt-architect-status') || ctx.statusEl;
                if (statusArea && statusEl) {
                    statusArea.style.display = 'inline-flex';
                    statusArea.style.width = 'auto';
                    statusEl.textContent = errMsg;
                    statusEl.style.color = '#ef4444';
                    statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
                    statusEl.style.border = '0.5px solid rgba(239, 68, 68, 0.2)';
                    statusEl.style.display = 'inline-flex';
                    statusEl.style.opacity = '1';
                    setTimeout(() => {
                        if (statusArea) { statusArea.style.display = 'none'; statusArea.style.width = '0'; }
                        if (statusEl) statusEl.style.display = 'none';
                    }, 5000);
                }
                const btn = document.getElementById('main-enhance-button') || ctx.enhanceButton;
                if (btn) {
                    const iconEl = btn.querySelector('.pa-enhance-button-icon');
                    const spinnerEl = btn.querySelector('.pa-enhance-spinner');
                    if (iconEl) iconEl.style.display = 'flex';
                    if (spinnerEl) spinnerEl.style.display = 'none';
                    btn.disabled = false;
                    btn.style.animation = '';
                    btn.style.background = '#ef4444';
                    btn.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
                    setTimeout(() => {
                        const currentBtn = document.getElementById('main-enhance-button') || btn;
                        if (currentBtn) {
                            const hex = (ctx.design.primary || '#1a73e8').replace('#', '');
                            const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                            const glow = `rgba(${r},${g},${b},0.4)`;
                            currentBtn.style.background = `linear-gradient(180deg, ${ctx.design.primaryHover || ctx.design.primary} 0%, ${ctx.design.primary} 100%)`;
                            currentBtn.style.boxShadow = `0 2px 10px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.15) inset, 0 0 20px ${glow}`;
                        }
                    }, 2000);
                }
                streamingContext = null;
            }
        });
        enhanceStreamPagePort.onDisconnect.addListener(() => {
            enhanceStreamPagePort = null;
            const ctx = streamingContext;
            streamingContext = null;
            if (ctx) {
                const btn = document.getElementById('main-enhance-button') || ctx.enhanceButton;
                if (btn) {
                    const iconEl = btn.querySelector('.pa-enhance-button-icon');
                    const spinnerEl = btn.querySelector('.pa-enhance-spinner');
                    if (iconEl) iconEl.style.display = 'flex';
                    if (spinnerEl) spinnerEl.style.display = 'none';
                    btn.disabled = false;
                    btn.style.animation = '';
                    const hex = (ctx.design?.primary || '#1a73e8').replace('#', '');
                    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                    const glow = `rgba(${r},${g},${b},0.4)`;
                    btn.style.background = `linear-gradient(180deg, ${ctx.design?.primaryHover || ctx.design?.primary || '#1a73e8'} 0%, ${ctx.design?.primary || '#1a73e8'} 100%)`;
                    btn.style.boxShadow = `0 2px 10px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.15) inset, 0 0 20px ${glow}`;
                    btn.style.cursor = 'pointer';
                }
                const statusArea = document.getElementById('prompt-architect-status-area') || ctx.statusArea;
                const statusEl = document.getElementById('prompt-architect-status') || ctx.statusEl;
                if (statusArea && statusEl) {
                    statusArea.style.display = 'inline-flex';
                    statusArea.style.width = 'auto';
                    statusEl.textContent = 'Connection lost. Please try again.';
                    statusEl.style.color = '#f59e0b';
                    statusEl.style.background = 'rgba(245, 158, 11, 0.1)';
                    statusEl.style.display = 'inline-flex';
                    setTimeout(() => {
                        if (statusArea) { statusArea.style.display = 'none'; statusArea.style.width = '0'; }
                        if (statusEl) statusEl.style.display = 'none';
                    }, 4000);
                }
            }
        });
    } catch (e) {
        enhanceStreamPagePort = null;
    }
}

/**
 * Gets cached element or queries and caches it
 * @param {string} key - Cache key
 * @param {Function} queryFn - Function to query if not cached
 * @returns {HTMLElement|null}
 */
function getCachedElement(key, queryFn) {
    if (elementCache[key] && document.body.contains(elementCache[key])) {
        return elementCache[key];
    }
    const element = queryFn();
    if (element) {
        elementCache[key] = element;
    }
    return element;
}

/**
 * Clears element cache (useful when DOM changes significantly)
 */
function clearElementCache() {
    Object.keys(elementCache).forEach(key => {
        elementCache[key] = null;
    });
}

/**
 * Detects the current platform based on hostname (cached)
 * @returns {string|null} Platform key or null if not detected
 */
function detectPlatform() {
    if (cachedPlatform !== null) {
        return cachedPlatform;
    }
    
    const hostname = window.location.hostname;
    
    for (const [key, platform] of Object.entries(PLATFORMS)) {
        if (key === 'generic') continue; // Skip generic, it's a fallback
        
        for (const domain of platform.domains) {
            if (hostname === domain || hostname.endsWith('.' + domain)) {
                cachedPlatform = key;
                return cachedPlatform;
            }
        }
    }
    
    cachedPlatform = null;
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
 * Initializes button mode storage if not set
 */
function initializeButtonMode() {
    chrome.storage.local.get(['buttonEnhancementMode'], (result) => {
        if (!result.buttonEnhancementMode) {
            chrome.storage.local.set({ buttonEnhancementMode: 'TEXT_ENHANCEMENT' });
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
// Initialize button mode storage
initializeButtonMode();

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
    { label: 'Video', value: 'VIDEO_ENHANCEMENT', icon: '🎬' },
];

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
    segmentedControl.id = 'prompt-architect-mode-selector';
    
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
            document.querySelectorAll('#prompt-architect-mode-selector input').forEach(i => {
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
 * Gets platform-specific design tokens (colors, styling) - cached
 */
function getPlatformDesign(platform) {
    // Check cache first
    if (designCache.has(platform)) {
        return designCache.get(platform);
    }
    
    const designs = {
        chatgpt: {
            primary: '#007AFF', // System blue - our own identity
            primaryHover: '#0051D5',
            borderRadius: '6px',
            height: '32px',
            fontSize: '14px',
            fontWeight: '500'
        },
        gemini: {
            primary: '#1a73e8', // Google blue
            primaryHover: '#1557b0',
            borderRadius: '20px',
            height: '36px',
            fontSize: '14px',
            fontWeight: '500'
        },
        claude: {
            primary: '#d97757', // Claude orange
            primaryHover: '#c4694a',
            borderRadius: '8px',
            height: '36px',
            fontSize: '14px',
            fontWeight: '500'
        },
        grok: {
            primary: '#1d9bf0', // Twitter/X blue
            primaryHover: '#1a8cd8',
            borderRadius: '20px',
            height: '36px',
            fontSize: '14px',
            fontWeight: '600'
        },
        perplexity: {
            primary: '#32B9C6', // Teal/cyan - matching Perplexity brand
            primaryHover: '#2AA5B0',
            borderRadius: '8px',
            height: '36px',
            fontSize: '14px',
            fontWeight: '500'
        }
    };
    
    const design = designs[platform] || {
        primary: '#007AFF',
        primaryHover: '#0051D5',
        borderRadius: '8px',
        height: '36px',
        fontSize: '13px',
        fontWeight: '600'
    };
    
    // Cache the design
    designCache.set(platform, design);
    return design;
}

/**
 * Creates an "Enhance" button - matches platform design language.
 */
function createEnhanceButton(inputElement, enhancerDiv) {
    const platform = detectPlatform();
    const design = getPlatformDesign(platform);
    
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'main-enhance-button';
    // Detect platform for keyboard shortcut hint
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    button.title = isMac
      ? 'Enhance prompt with AI (Cmd+Shift+E)'
      : 'Enhance prompt with AI (Ctrl+Shift+E)';

    // Premium circular icon button — clean, polished look on dark composer bars
    const size = 40;
    const hex = design.primary.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const glow = `rgba(${r},${g},${b},0.32)`;
    const glowHover = `rgba(${r},${g},${b},0.48)`;

    const iconSize = 24; // Slightly bigger, centered in 40px button
    const sparkleSvg = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;margin:0;vertical-align:middle;"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg>`;
    const iconWrap = document.createElement('span');
    iconWrap.className = 'pa-enhance-button-icon';
    iconWrap.style.cssText = `position:absolute;inset:0;margin:auto;display:flex;align-items:center;justify-content:center;width:${iconSize}px;height:${iconSize}px;line-height:0;pointer-events:none;filter:drop-shadow(0 0 1px rgba(0,0,0,0.25));`;
    iconWrap.innerHTML = sparkleSvg;
    button.appendChild(iconWrap);

    const spinner = document.createElement('span');
    spinner.id = 'pa-enhance-button-spinner';
    spinner.className = 'pa-enhance-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    spinner.style.cssText = 'position:absolute;inset:0;margin:auto;display:none;align-items:center;justify-content:center;width:20px;height:20px;pointer-events:none;border:2px solid rgba(255,255,255,0.35);border-top-color:white;border-radius:50%;animation:pa-spinner-rotate 0.7s linear infinite;';
    button.appendChild(spinner);

    button.className = 'text-white text-sm';
    button.style.setProperty('width', size + 'px', 'important');
    button.style.setProperty('height', size + 'px', 'important');
    button.style.setProperty('padding', '0', 'important');
    button.style.setProperty('min-width', size + 'px', 'important');
    button.style.setProperty('background', `linear-gradient(165deg, ${design.primaryHover || design.primary} 0%, ${design.primary} 45%, ${design.primary} 100%)`, 'important');
    button.style.setProperty('border', 'none', 'important');
    button.style.setProperty('white-space', 'nowrap', 'important');
    button.style.setProperty('font-family', '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 'important');
    button.style.setProperty('flex-shrink', '0', 'important');
    button.style.setProperty('cursor', 'pointer', 'important');
    button.style.setProperty('user-select', 'none', 'important');
    button.style.setProperty('display', 'flex', 'important');
    button.style.setProperty('align-items', 'center', 'important');
    button.style.setProperty('justify-content', 'center', 'important');
    button.style.setProperty('visibility', 'visible', 'important');
    button.style.setProperty('opacity', '1', 'important');
    button.style.setProperty('z-index', '1000000', 'important');
    button.style.setProperty('position', 'relative', 'important');
    button.style.borderRadius = '50%';
    button.style.boxShadow = `0 2px 8px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.12) inset, 0 0 16px ${glow}`;
    button.style.transition = 'box-shadow 0.28s ease, background 0.22s ease, transform 0.24s cubic-bezier(0.34, 1.2, 0.64, 1)';

    button.dataset.originalColor = design.primary;
    button.dataset.originalHover = design.primaryHover;

    button.onmouseenter = () => {
        button.style.background = `linear-gradient(165deg, ${design.primary} 0%, ${design.primaryHover || design.primary} 55%, ${design.primaryHover || design.primary} 100%)`;
        button.style.transform = 'translateY(-1.5px)';
        button.style.boxShadow = `0 4px 14px rgba(0,0,0,0.26), 0 0 0 1px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.18) inset, 0 0 22px ${glowHover}`;
    };
    button.onmouseleave = () => {
        button.style.background = `linear-gradient(165deg, ${design.primaryHover || design.primary} 0%, ${design.primary} 45%, ${design.primary} 100%)`;
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = `0 2px 8px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.12) inset, 0 0 16px ${glow}`;
    };

    sessionStorage.setItem('prompt-architect-seen', 'true');
    
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
    
    // Always text enhancement (no mode selection)
    button.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        handleButtonClick(inputElement, 'TEXT_ENHANCEMENT', enhancerDiv);
        return false;
    };

    button.onmousedown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.style.transform = 'translateY(0) scale(0.96)';
    };
    button.onmouseup = () => {
        button.style.transform = '';
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
        const container = document.getElementById('prompt-architect-buttons-container');
        
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
                        console.warn('[Prompt Architect] Button container was removed! Re-injecting...');
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
                        console.warn('[Prompt Architect] Button visibility was changed! Restoring...');
                        enforceVisibility();
                    }
                }
            }
        }
        
        if (needsReinjection) {
            buttonProtectionObserver.disconnect();
            const container = document.getElementById('prompt-architect-buttons-container');
            if (container && document.body.contains(container)) return;
            if (enhancerDiv && !document.body.contains(enhancerDiv)) {
                if (reattachContainerToCurrentParent(enhancerDiv)) {
                    const currentInput = findPlatformSpecificInput();
                    if (currentInput) setupButtonProtection(enhancerDiv, currentInput);
                    return;
                }
            }
            setTimeout(() => {
                if (document.getElementById('prompt-architect-buttons-container') && document.body.contains(document.getElementById('prompt-architect-buttons-container'))) return;
                const input = inputElement && document.body.contains(inputElement) ? inputElement : findPlatformSpecificInput();
                if (input) injectUI(input).catch(() => {});
            }, 50);
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
 * Zero-flicker ChatGPT: persistent container in body so the button is never removed when composer re-renders.
 */
const CHATGPT_PERSISTENT_WRAPPER_ID = 'prompt-architect-chatgpt-persistent';

function getOrCreateChatGPTPersistentWrapper() {
    let wrapper = document.getElementById(CHATGPT_PERSISTENT_WRAPPER_ID);
    if (wrapper) return wrapper;
    wrapper = document.createElement('div');
    wrapper.id = CHATGPT_PERSISTENT_WRAPPER_ID;
    wrapper.style.cssText = 'position:fixed;z-index:999999;pointer-events:none;margin:0;padding:0;';
    document.body.appendChild(wrapper);
    return wrapper;
}

function updateChatGPTPersistentPosition() {
    const wrapper = document.getElementById(CHATGPT_PERSISTENT_WRAPPER_ID);
    if (!wrapper || !wrapper.firstElementChild) return;
    const input = findPlatformSpecificInput();
    const sendButton = input ? _findSendButton(input, 'chatgpt') : null;
    if (!sendButton || !sendButton.parentElement) return;
    // Position to the left of the leftmost button in the row (dictate/mic) so we don't cover it
    const row = sendButton.parentElement;
    let leftmost = sendButton;
    let leftmostLeft = sendButton.getBoundingClientRect().left;
    const siblings = row.querySelectorAll('button, [role="button"], a[role="button"]');
    for (const el of siblings) {
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.left < leftmostLeft) {
            leftmostLeft = r.left;
            leftmost = el;
        }
    }
    const inner = wrapper.firstElementChild;
    const w = inner.offsetWidth || 48;
    const h = inner.offsetHeight || 40;
    const leftRect = leftmost.getBoundingClientRect();
    const sendRect = sendButton.getBoundingClientRect();
    // Horizontal: to the left of the leftmost (dictate). Vertical: centered with send button so all three are level.
    const rowCenterY = sendRect.top + sendRect.height / 2;
    wrapper.style.left = (leftRect.left - w - 8) + 'px';
    wrapper.style.top = (rowCenterY - h / 2) + 'px';
    wrapper.style.pointerEvents = '';
}

function ensureChatGPTButtonInWrapper(wrapper) {
    if (wrapper.querySelector('#prompt-architect-buttons-container')) return;
    const design = getPlatformDesign('chatgpt');
    const enhancerDiv = document.createElement('div');
    enhancerDiv.id = 'prompt-architect-buttons-container';
    enhancerDiv.className = 'flex items-center';
    enhancerDiv.style.setProperty('display', 'inline-flex', 'important');
    enhancerDiv.style.setProperty('align-items', 'center', 'important');
    enhancerDiv.style.setProperty('gap', '8px', 'important');
    enhancerDiv.style.setProperty('margin-right', '8px', 'important');
    enhancerDiv.style.setProperty('pointer-events', 'auto', 'important');
    enhancerDiv.style.setProperty('visibility', 'visible', 'important');
    enhancerDiv.style.setProperty('opacity', '1', 'important');
    enhancerDiv.style.setProperty('flex-shrink', '0', 'important');
    enhancerDiv.style.setProperty('position', 'relative', 'important');
    enhancerDiv.style.setProperty('align-self', 'center', 'important');
    const statusArea = document.createElement('div');
    statusArea.id = 'prompt-architect-status-area';
    statusArea.style.cssText = 'display:none;align-items:center;gap:6px;';
    const statusEl = document.createElement('span');
    statusEl.id = 'prompt-architect-status';
    statusArea.appendChild(statusEl);
    enhancerDiv.appendChild(statusArea);
    // null inputElement: handleButtonClick will use findPlatformSpecificInput() at click time
    enhancerDiv.appendChild(createEnhanceButton(null, enhancerDiv));
    wrapper.appendChild(enhancerDiv);
}

/**
 * ChatGPT-specific injection (persistent container = zero flicker when typing)
 */
async function injectChatGPT(inputElement) {
    const sendButton = _findSendButton(inputElement, 'chatgpt');
    if (!sendButton || !sendButton.parentElement) {
        console.warn('[Prompt Architect] ChatGPT: send button not found. Input found:', !!inputElement);
        throw new Error('ChatGPT send button not found');
    }
    // Remove any old inline container from composer so only the persistent one remains
    const wrapperEl = document.getElementById(CHATGPT_PERSISTENT_WRAPPER_ID);
    const anyContainer = document.getElementById('prompt-architect-buttons-container');
    if (anyContainer && (!wrapperEl || !wrapperEl.contains(anyContainer))) anyContainer.remove();
    const wrapper = getOrCreateChatGPTPersistentWrapper();
    ensureChatGPTButtonInWrapper(wrapper);
    updateChatGPTPersistentPosition();
    wrapper.style.display = '';
}

/**
 * Gemini-specific injection
 */
async function injectGemini(inputElement) {
    const sendButton = _findSendButton(inputElement, 'gemini');
    if (!sendButton || !sendButton.parentElement) {
        console.warn('[Prompt Architect] Gemini: send button not found. Input found:', !!inputElement);
        throw new Error('Gemini send button not found');
    }
    // Use the found container or fall back to sendButton.parentElement
    return injectButtonNextToSend(inputElement, sendButton, sendButton.parentElement); // targetContainer can be null, so use parent
}

/**
 * Claude-specific injection
 */
async function injectClaude(inputElement) {
    const sendButton = _findSendButton(inputElement, 'claude');
    if (!sendButton || !sendButton.parentElement) {
        throw new Error('Claude send button not found');
    }
    return injectButtonNextToSend(inputElement, sendButton);
}

/**
 * Grok-specific injection
 */
async function injectGrok(inputElement) {
    const sendButton = _findSendButton(inputElement, 'grok');
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
    const sendButton = _findSendButton(inputElement, 'perplexity');
    if (!sendButton || !sendButton.parentElement) {
        throw new Error('Perplexity send button not found');
    }
    return injectButtonNextToSend(inputElement, sendButton);
}

function _findSendButton(inputElement, platform) {
    let sendButton = null;

    // Platform-specific strategies
    switch (platform) {
        case 'chatgpt':
            // Strategy 1: Look in the form containing the input
            const formChatGPT = inputElement.closest('form');
            if (formChatGPT) {
                sendButton = formChatGPT.querySelector('button[data-testid*="send" i]') ||
                             formChatGPT.querySelector('button[data-testid*="submit" i]') ||
                             formChatGPT.querySelector('button[aria-label*="Send" i]') ||
                             formChatGPT.querySelector('button[aria-label*="Submit" i]') ||
                             formChatGPT.querySelector('button[type="submit"]') ||
                             formChatGPT.querySelector('button[id*="composer-submit"]') ||
                             formChatGPT.querySelector('button[class*="composer-submit"]') ||
                             formChatGPT.querySelector('button[class*="send"]') ||
                             formChatGPT.querySelector('a[href="#"][role="button"] button') ||
                             formChatGPT.querySelector('button');
            }

            // Strategy 2: Search in parent hierarchy
            if (!sendButton) {
                let parent = inputElement.parentElement;
                for (let i = 0; i < 25 && parent; i++) {
                    sendButton = parent.querySelector('button[data-testid*="send" i]') ||
                                 parent.querySelector('button[data-testid*="submit" i]') ||
                                 parent.querySelector('button[aria-label*="Send" i]') ||
                                 parent.querySelector('button[aria-label*="Submit" i]') ||
                                 parent.querySelector('button[id*="composer-submit"]') ||
                                 parent.querySelector('button[class*="composer-submit"]') ||
                                 parent.querySelector('button[class*="send"]') ||
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
                sendButton = closestButton;
            }
            break;

        case 'gemini':
            const geminiButtonSelectors = [
                'button[aria-label*="Send" i]',
                'button[aria-label*="Send message" i]',
                'button[aria-label*="Submit" i]',
                'button[data-testid*="send" i]',
                'button[type="submit"]',
                '[role="button"][aria-label*="Send" i]',
                'button[class*="send" i]',
                'button[class*="submit" i]',
            ];

            let parentGemini = inputElement.parentElement;
            for (let i = 0; i < 35 && parentGemini; i++) {
                for (const selector of geminiButtonSelectors) {
                    const buttons = parentGemini.querySelectorAll(selector);
                    for (const btn of buttons) {
                        if (btn.offsetParent !== null) {
                            sendButton = btn;
                            break;
                        }
                    }
                    if (sendButton) break;
                }
                if (!sendButton) {
                    const buttons = parentGemini.querySelectorAll('button');
                    for (const btn of buttons) {
                        const hasIcon = btn.querySelector('svg');
                        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                        if (hasIcon && (ariaLabel.includes('send') || ariaLabel.includes('submit') || !ariaLabel)) {
                            if (btn.offsetParent !== null) {
                                sendButton = btn;
                                break;
                            }
                        }
                    }
                }
                if (sendButton) break;
                parentGemini = parentGemini.parentElement;
            }

            if (!sendButton) {
                parentGemini = inputElement.parentElement;
                for (let i = 0; i < 30 && parentGemini; i++) {
                    const style = window.getComputedStyle(parentGemini);
                    if (style.display === 'flex' || style.display === 'inline-flex') {
                        const buttons = parentGemini.querySelectorAll('button');
                        for (const btn of buttons) {
                            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                            const hasIcon = btn.querySelector('svg');
                            if ((ariaLabel.includes('send') || ariaLabel.includes('submit') || hasIcon) &&
                                btn.offsetParent !== null) {
                                sendButton = btn;
                                break;
                            }
                        }
                    }
                    if (sendButton) break;
                    parentGemini = parentGemini.parentElement;
                }
            }

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
                sendButton = closestButton;
            }
            break;

        case 'perplexity':
            const formPerplexity = inputElement.closest('form');
            if (formPerplexity) {
                sendButton = formPerplexity.querySelector('button[type="submit"]') ||
                             formPerplexity.querySelector('button[aria-label*="Search" i]') ||
                             formPerplexity.querySelector('button[aria-label*="Ask" i]') ||
                             formPerplexity.querySelector('button[class*="search"]') ||
                             formPerplexity.querySelector('button[class*="submit"]');
            }

            if (!sendButton) {
                let parent = inputElement.parentElement;
                for (let i = 0; i < 25 && parent; i++) {
                    sendButton = parent.querySelector('button[type="submit"]') ||
                                 parent.querySelector('button[aria-label*="Search" i]') ||
                                 parent.querySelector('button[aria-label*="Ask" i]') ||
                                 parent.querySelector('button[class*="search"]') ||
                                 parent.querySelector('button[class*="submit"]');
                    if (sendButton && sendButton.offsetParent !== null) break;
                    parent = parent.parentElement;
                }
            }

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
                    const className = (btn.className || '').toLowerCase();
                    const hasSearchIcon = btn.querySelector('svg');
                    const isSubmit = btn.type === 'submit';

                    if ((isSubmit || ariaLabel.includes('search') || ariaLabel.includes('ask') ||
                         className.includes('search') || className.includes('submit') || hasSearchIcon) &&
                        distance < 200) {
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestButton = btn;
                        }
                    }
                }
                sendButton = closestButton;
            }
            break;
        
        case 'claude':
            const formClaude = inputElement.closest('form');
            if (formClaude) {
                sendButton = formClaude.querySelector('button[type="submit"]') ||
                             formClaude.querySelector('button[aria-label*="Send" i]') ||
                             formClaude.querySelector('button[aria-label*="send" i]') ||
                             formClaude.querySelector('button[data-testid*="send" i]');
            }

            if (!sendButton) {
                let parent = inputElement.parentElement;
                for (let i = 0; i < 15 && parent; i++) {
                    sendButton = parent.querySelector('button[type="submit"]') ||
                                 parent.querySelector('button[aria-label*="Send" i]') ||
                                 parent.querySelector('button[aria-label*="send" i]') ||
                                 parent.querySelector('button[data-testid*="send" i]');
                    if (sendButton && sendButton.offsetParent !== null) break;
                    parent = parent.parentElement;
                }
            }

            if (!sendButton) {
                const inputRect = inputElement.getBoundingClientRect();
                const allButtons = document.querySelectorAll('button');
                let closestButton = null;
                let closestDistance = Infinity;

                for (const btn of allButtons) {
                    if (btn.offsetParent === null) continue;
                    const btnRect = btn.getBoundingClientRect();
                    const distance = Math.abs(btnRect.top - inputRect.bottom) + Math.abs(btnRect.left - inputRect.right);
                    const type = btn.type || '';

                    if ((type === 'submit' || ariaLabel.includes('send') || ariaLabel.includes('submit')) && distance < 300) {
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestButton = btn;
                        }
                    }
                }
                sendButton = closestButton;
            }
            break;

        case 'grok':
            sendButton = document.querySelector('[data-testid="tweetButton"]') ||
                         document.querySelector('button[data-testid*="tweetButton"]');

            if (!sendButton) {
                const formGrok = inputElement.closest('form');
                if (formGrok) {
                    sendButton = formGrok.querySelector('[data-testid="tweetButton"]') ||
                                 formGrok.querySelector('button[data-testid*="tweetButton"]') ||
                                 formGrok.querySelector('button[type="submit"]');
                }
            }

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
                sendButton = closestButton;
            }
            break;
        
        default: // Generic fallback
            const genericSelectors = [
                'button[type="submit"]',
                'button[aria-label*="Send" i]',
                'button[aria-label*="Submit" i]',
                'button[class*="send" i]',
                'button[class*="submit" i]',
                'button'
            ];
            let parentGeneric = inputElement.parentElement;
            for (let i = 0; i < 40 && parentGeneric; i++) {
                for (const sel of genericSelectors) {
                    try {
                        const buttons = parentGeneric.querySelectorAll(sel);
                        for (const btn of buttons) {
                            if (btn.offsetParent !== null && parentGeneric.contains(btn)) return btn;
                        }
                    } catch (_) { /* ignore */ }
                }
                parentGeneric = parentGeneric.parentElement;
            }
            break;
    }
    return sendButton;
}

/**
 * Find the send button near the given input (shared logic for reattach).
 * Used when React replaces the parent and we need to move our container to the new tree.
 */
function findSendButtonNearInput(inputElement) {
    if (!inputElement || !document.body.contains(inputElement)) return null;
    return _findSendButton(inputElement, detectPlatform());
}

/**
 * Reattach an existing container (that was removed by React) to the current send-button parent.
 * Avoids visible "disappear then reappear" when typing on ChatGPT/Perplexity.
 */
function reattachContainerToCurrentParent(enhancerDiv) {
    const input = findPlatformSpecificInput();
    const sendButton = input ? findSendButtonNearInput(input) : null;
    if (!sendButton || !sendButton.parentElement) return false;
    const insertParent = sendButton.parentElement;
    if (!insertParent.contains(sendButton)) return false;
    try {
        insertParent.style.setProperty('display', 'flex', 'important');
        insertParent.style.setProperty('flex-direction', 'row', 'important');
        insertParent.style.setProperty('align-items', 'center', 'important');
        insertParent.style.setProperty('flex-wrap', 'nowrap', 'important');
        if (!insertParent.style.gap) insertParent.style.gap = '6px';
        insertParent.insertBefore(enhancerDiv, sendButton);
        // Re-apply placement styles so button stays in the right place on all sites
        enhancerDiv.style.setProperty('flex-shrink', '0', 'important');
        enhancerDiv.style.setProperty('align-self', 'center', 'important');
        enhancerDiv.style.setProperty('display', 'inline-flex', 'important');
        return true;
    } catch (_) {
        return false;
    }
}


/**
 * Common function to inject button next to send button
 */
async function injectButtonNextToSend(inputElement, sendButton, container = null) {
    return new Promise(async (resolve, reject) => {
        try {
            // Check if button injection is enabled by user preference
            const buttonEnabled = await isInjectButtonEnabled();
            if (!buttonEnabled) {
                resolve(); // Resolve silently - button shouldn't be shown
                return;
            }

            // Show button regardless of API key - backend proxy can handle enhancements without user key

            // If we already have a visible container, do nothing — avoids "freaking out" on ChatGPT
            const existingContainer = document.getElementById('prompt-architect-buttons-container');
            if (existingContainer && document.body.contains(existingContainer)) {
                resolve();
                return;
            }
            // Clean up detached container only (so we don't leave orphans)
            if (existingContainer && existingContainer.parentNode) {
                existingContainer.remove();
            }

            // Find the correct container - must be one that actually contains the send button
            let targetContainer = container || sendButton.parentElement;
            
            // Verify the send button is actually in this container
            if (targetContainer && !targetContainer.contains(sendButton)) {
                // If not, use the send button's actual parent
                targetContainer = sendButton.parentElement;
            }
            
            // For Gemini: Look for a flex container that makes sense for button placement
            if (targetContainer) {
                const containerStyle = window.getComputedStyle(targetContainer);
                // If container is not flex, try to find a parent that is flex and contains the button
                if (!containerStyle.display.includes('flex')) {
                    let parent = targetContainer.parentElement;
                    for (let i = 0; i < 10 && parent; i++) {
                        const parentStyle = window.getComputedStyle(parent);
                        if (parentStyle.display.includes('flex') && parent.contains(sendButton)) {
                            targetContainer = parent;
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
            }
            
            if (!targetContainer) {
                reject(new Error('No container found'));
                return;
            }

            connectEnhanceStreamPagePort();

            // Create UI elements
            const enhancerDiv = document.createElement('div');
            enhancerDiv.id = 'prompt-architect-buttons-container';
            enhancerDiv.className = 'flex items-center';
            enhancerDiv.style.setProperty('display', 'inline-flex', 'important');
            enhancerDiv.style.setProperty('align-items', 'center', 'important');
            enhancerDiv.style.setProperty('gap', '8px', 'important');
            enhancerDiv.style.setProperty('margin-right', '8px', 'important');
            enhancerDiv.style.setProperty('margin-left', '4px', 'important');
            enhancerDiv.style.setProperty('z-index', '999999', 'important');
            enhancerDiv.style.setProperty('visibility', 'visible', 'important');
            enhancerDiv.style.setProperty('opacity', '1', 'important');
            // Keep button in the same row as send on all sites (no wrap, no shrink)
            enhancerDiv.style.setProperty('flex-shrink', '0', 'important');
            enhancerDiv.style.setProperty('position', 'relative', 'important');
            enhancerDiv.style.setProperty('align-self', 'center', 'important');

            // Status area
            const statusArea = document.createElement('div');
            statusArea.id = 'prompt-architect-status-area';
            statusArea.style.cssText = `
                height: 36px; 
                display: none;
                align-items: center;
                width: 0;
                overflow: hidden;
            `;
            
            // Status message element for errors (no spinner; button pulse indicates loading)
            const statusMessage = document.createElement('div');
            statusMessage.id = 'prompt-architect-status';
            statusMessage.style.cssText = `
                font-size: 11px;
                font-weight: 500;
                padding: 6px 10px;
                border-radius: 6px;
                white-space: nowrap;
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                display: none;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            `;
            
            statusArea.appendChild(statusMessage);
            enhancerDiv.appendChild(statusArea);
            enhancerDiv.appendChild(createEnhanceButton(inputElement, enhancerDiv));

            // Use the send button's actual parent for insertion (Gemini/SPAs can move nodes; targetContainer may be stale)
            const insertParent = sendButton.parentElement;
            if (!insertParent) {
                reject(new Error('Send button has no parent'));
                return;
            }
            if (!insertParent.contains(sendButton)) {
                reject(new Error('Send button is not in the target container'));
                return;
            }

            // Force horizontal row so enhance button is always directly to the left of send (never above/below)
            insertParent.style.setProperty('display', 'flex', 'important');
            insertParent.style.setProperty('flex-direction', 'row', 'important');
            insertParent.style.setProperty('align-items', 'center', 'important');
            insertParent.style.setProperty('flex-wrap', 'nowrap', 'important');
            if (!insertParent.style.gap) insertParent.style.gap = '6px';

            try {
                insertParent.insertBefore(enhancerDiv, sendButton);
            } catch (e) {
                reject(e);
                return;
            }

            // Verify and set up protection
            setTimeout(() => {
                const injectedButton = document.getElementById('main-enhance-button');
                if (injectedButton) {
                    // Verify button is visible and in correct position
                    const buttonRect = injectedButton.getBoundingClientRect();
                    const sendButtonRect = sendButton.getBoundingClientRect();
                    
                    // For Gemini: Ensure button is near the send button
                    const platform = detectPlatform();
                    if (platform === 'gemini') {
                        const distance = Math.abs(buttonRect.top - sendButtonRect.top) + 
                                       Math.abs(buttonRect.right - sendButtonRect.left);
                        if (distance > 100 && insertParent.contains(enhancerDiv)) {
                            enhancerDiv.style.setProperty('order', '-1', 'important');
                        }
                    }
                    
                    setupButtonProtection(enhancerDiv, inputElement);
                    console.log('[Prompt Architect] Improve button added on', window.location.hostname);
                    resolve();
                } else {
                    reject(new Error('Button not found after injection'));
                }
            }, 100);
        } catch (error) {
            console.error('[Prompt Architect] Injection error:', error);
            reject(error);
        }
    });
}

/** Storage key for persisted Firebase user (must match popup.js); when set, user is signed in */
const STORAGE_FIREBASE_USER = 'pa_firebase_user';

/**
 * Checks if the user is signed in (Firebase auth persisted in chrome.storage by popup).
 * In-chat Improve button is shown only when signed in for a consistent experience.
 */
async function isUserSignedIn() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_FIREBASE_USER], (result) => {
            const user = result[STORAGE_FIREBASE_USER];
            resolve(!!(user && user.uid));
        });
    });
}

/**
 * Checks if injected button is enabled by user preference
 */
async function isInjectButtonEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['injectButtonEnabled'], (result) => {
            // Default to true for backward compatibility
            resolve(result.injectButtonEnabled !== false);
        });
    });
}

/**
 * True only when we should show the in-chat Improve button: preference on, platform supported, and user signed in.
 */
async function shouldShowEnhanceButton() {
    const [platformEnabled, buttonEnabled, signedIn] = await Promise.all([
        isPlatformEnabled(),
        isInjectButtonEnabled(),
        isUserSignedIn()
    ]);
    return platformEnabled && buttonEnabled && signedIn;
}

/**
 * Checks if any API key is configured
 */
async function hasApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['userGeminiApiKey', 'defaultGeminiApiKey'], (result) => {
            const hasKey = !!(result.userGeminiApiKey || result.defaultGeminiApiKey);
            resolve(hasKey);
        });
    });
}

/** Remove all in-chat Improve button UI (used when user disables button or signs out) */
function removeInjectedButtonUI() {
    requestAnimationFrame(() => {
        const existingUI = document.getElementById('prompt-architect-buttons-container');
        if (existingUI) existingUI.remove();
        const button = document.getElementById('main-enhance-button');
        if (button) {
            const container = button.closest('#prompt-architect-buttons-container');
            if (container) container.remove();
            else if (button.parentElement) button.remove();
        }
        const statusArea = document.getElementById('prompt-architect-status-area');
        if (statusArea) statusArea.remove();
        document.querySelectorAll('button#main-enhance-button').forEach(btn => {
            const p = btn.parentElement;
            if (p && p.id === 'prompt-architect-buttons-container') p.remove();
            else btn.remove();
        });
    });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        if (changes.injectButtonEnabled) {
            const buttonEnabled = changes.injectButtonEnabled.newValue !== false;
            if (!buttonEnabled) {
                removeInjectedButtonUI();
            } else {
                (async () => {
                    if (!(await shouldShowEnhanceButton())) return;
                    const existingUI = document.getElementById('prompt-architect-buttons-container');
                    const input = findPlatformSpecificInput();
                    if (input && (!existingUI || !document.body.contains(existingUI))) {
                        injectUI(input).catch(() => {});
                    }
                })();
            }
        }
        if (changes[STORAGE_FIREBASE_USER]) {
            const user = changes[STORAGE_FIREBASE_USER].newValue;
            const signedIn = !!(user && user.uid);
            if (!signedIn) removeInjectedButtonUI();
            else {
                (async () => {
                    if (!(await shouldShowEnhanceButton())) return;
                    const existingUI = document.getElementById('prompt-architect-buttons-container');
                    const input = findPlatformSpecificInput();
                    if (input && (!existingUI || !document.body.contains(existingUI))) {
                        injectUI(input).catch(() => {});
                    }
                })();
            }
        }
        const apiKeyChanged = changes.userGeminiApiKey || changes.defaultGeminiApiKey;
        if (apiKeyChanged) {
            (async () => {
                const existingUI = document.getElementById('prompt-architect-buttons-container');
                if (!(await shouldShowEnhanceButton()) || existingUI) return;
                const input = findPlatformSpecificInput();
                if (input) injectUI(input).catch(() => {});
            })();
        }
    }
});

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
    
    // Check if user has enabled injected button
    const buttonEnabled = await isInjectButtonEnabled();
    if (!buttonEnabled) {
        throw new Error('Injected button disabled by user');
    }
    
    // Show in-chat button only when signed in (consistent with popup)
    const signedIn = await isUserSignedIn();
    if (!signedIn) {
        throw new Error('Sign in required');
    }

    // Route to platform-specific injection (backend proxy works without user API key)
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
    const platform = detectPlatform();
    
    // For Perplexity, try to find the input element using platform-specific selectors
    if ((!targetElement || !document.body.contains(targetElement)) && platform === 'perplexity') {
        // Try Perplexity-specific selectors first
        const perplexitySelectors = [
            'textarea[placeholder*="Ask" i]',
            'textarea[placeholder*="Search" i]',
            '[contenteditable="true"][placeholder*="Ask" i]',
            '[contenteditable="true"][placeholder*="Search" i]',
            '[contenteditable="true"][role="textbox"]',
            'textarea[class*="input" i]',
            '[contenteditable="true"][class*="input" i]',
            'form textarea',
            'form [contenteditable="true"]',
        ];
        
        for (const selector of perplexitySelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const elem of elements) {
                    const rect = elem.getBoundingClientRect();
                    const style = window.getComputedStyle(elem);
                    if (rect.width > 30 && rect.height > 10 && 
                        style.display !== 'none' && 
                        style.visibility !== 'hidden' &&
                        elem.offsetParent !== null) {
                        targetElement = elem;
                        break;
                    }
                }
                if (targetElement) break;
            } catch (e) {
                continue;
            }
        }
    }
    
    // Fallback to generic selector if still not found
    if (!targetElement || !document.body.contains(targetElement)) {
        targetElement = document.querySelector(SELECTORS.PROMPT_INPUT);
    }
    
    if (!targetElement) {
        console.warn('[Prompt Architect] Could not find input element to update');
        return Promise.resolve(false);
    }
    
    
    // Use requestAnimationFrame to ensure DOM is ready for update
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            let updateSuccess = false;
            
            // Handle contenteditable divs (used by some platforms like Gemini and Perplexity)
            if (targetElement.contentEditable === 'true' || targetElement.hasAttribute('contenteditable') || 
                targetElement.getAttribute('contenteditable') === 'true') {
                
                // For Perplexity, completely clear all content first to ensure clean replacement
                if (platform === 'perplexity') {
                    // Focus first to ensure React is aware of the element
                    targetElement.focus();
                    
                    // Step 1: Select all content using Selection API
                    try {
                        const selection = window.getSelection();
                        const range = document.createRange();
                        range.selectNodeContents(targetElement);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } catch (e) {
                        // Selection API failed, continue with other methods
                    }
                    
                    // Step 2: Dispatch beforeinput event with deleteContent type (React recognizes this)
                    const deleteBeforeInput = new InputEvent('beforeinput', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'deleteContent',
                        data: null
                    });
                    targetElement.dispatchEvent(deleteBeforeInput);
                    
                    // Step 3: Clear all content using DOM methods
                    targetElement.innerHTML = '';
                    while (targetElement.firstChild) {
                        targetElement.removeChild(targetElement.firstChild);
                    }
                    targetElement.textContent = '';
                    targetElement.innerText = '';
                    
                    // Step 4: Dispatch input event with deleteContent type (tells React content was deleted)
                    const deleteInput = new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'deleteContent',
                        data: null
                    });
                    targetElement.dispatchEvent(deleteInput);
                    
                    // Step 5: Small delay to let React process the deletion
                    setTimeout(() => {
                        // Verify it's actually empty
                        const currentText = (targetElement.textContent || targetElement.innerText || '').trim();
                        if (currentText) {
                            // Still has content, clear again more aggressively
                            targetElement.innerHTML = '';
                            targetElement.textContent = '';
                            targetElement.innerText = '';
                        }
                        
                        // Step 6: Now set the new text with proper React events
                        const insertBeforeInput = new InputEvent('beforeinput', {
                            bubbles: true,
                            cancelable: true,
                            inputType: 'insertText',
                            data: newText
                        });
                        targetElement.dispatchEvent(insertBeforeInput);
                        
                        // Step 7: Set the actual text
                        targetElement.textContent = newText;
                        
                        // Step 8: Dispatch input event with insertText type
                        const insertInput = new InputEvent('input', {
                            bubbles: true,
                            cancelable: true,
                            inputType: 'insertText',
                            data: newText
                        });
                        targetElement.dispatchEvent(insertInput);
                        
                        // Step 9: Dispatch change event
                        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                    }, 20);
                    
                    // Also set immediately (the setTimeout is for React timing)
                    targetElement.textContent = newText;
                } else {
                    // For other platforms, use standard approach
                    targetElement.textContent = newText;
                    targetElement.innerText = newText;
                }
                
                // For Perplexity, events are dispatched in the setTimeout above, so skip immediate dispatch
                if (platform !== 'perplexity') {
                    // Verify the update
                    const actualText = (targetElement.textContent || targetElement.innerText || '').trim();
                    const expectedText = newText.trim();
                    
                    if (actualText === expectedText || actualText.length > 0) {
                        // Focus first (important for React-based UIs)
                        targetElement.focus();
                        
                        // Trigger input events for contenteditable
                        const inputEvent = new InputEvent('input', { 
                            bubbles: true, 
                            cancelable: true,
                            inputType: 'insertText',
                            data: newText
                        });
                        targetElement.dispatchEvent(inputEvent);
                        
                        // Also dispatch beforeInput for React
                        const beforeInputEvent = new InputEvent('beforeinput', {
                            bubbles: true,
                            cancelable: true,
                            inputType: 'insertText',
                            data: newText
                        });
                        targetElement.dispatchEvent(beforeInputEvent);
                        
                        // Dispatch change event
                        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        updateSuccess = true;
                    }
                } else {
                    // For Perplexity, mark as success (events dispatched in setTimeout above)
                    updateSuccess = true;
                }
            } else if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
                // Handle regular textarea/input (ChatGPT, Claude, etc.)
                // Store original value for verification
                const originalValue = targetElement.value;
                
                // For Perplexity textareas, clear first
                if (platform === 'perplexity') {
                    targetElement.value = '';
                }
                
                // Set the value directly
                targetElement.value = newText;
                
                // Verify the update was successful
                if (targetElement.value === newText || targetElement.value.length === newText.length) {
                    // Focus first
                    targetElement.focus();
                    
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
                    
                    updateSuccess = true;
                } else {
                    // Try alternative method: clear and set
                    targetElement.value = '';
                    targetElement.value = newText;
                    if (targetElement.value === newText) {
                        targetElement.focus();
                        targetElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: newText }));
                        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                        updateSuccess = true;
                    }
                }
            } else {
                // Fallback: try setting textContent for other element types
                if (platform === 'perplexity') {
                    // Clear first for Perplexity
                    targetElement.innerHTML = '';
                }
                targetElement.textContent = newText;
                const actualText = (targetElement.textContent || '').trim();
                if (actualText === newText.trim() || actualText.length > 0) {
                    targetElement.focus();
                    targetElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: newText }));
                    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                    updateSuccess = true;
                }
            }
            
            // Additional verification for Perplexity - check if text actually appears and fix duplication
            if (platform === 'perplexity' && updateSuccess) {
                setTimeout(() => {
                    const verifyText = (targetElement.textContent || targetElement.innerText || targetElement.value || '').trim();
                    const expectedText = newText.trim();
                    
                    // Check if duplication occurred (text is longer than expected or starts with old text)
                    if (verifyText !== expectedText) {
                        // Check if it looks like duplication (contains old text + new text)
                        const isDuplicated = verifyText.length > expectedText.length * 1.2 || 
                                           (verifyText.length > expectedText.length && !verifyText.startsWith(expectedText.substring(0, 20)));
                        
                        if (isDuplicated) {
                            console.warn('[Prompt Architect] Perplexity duplication detected. Expected length:', expectedText.length, 'Got length:', verifyText.length);
                            
                            // More aggressive fix: simulate select all + delete + insert
                            targetElement.focus();
                            
                            // Select all
                            try {
                                const selection = window.getSelection();
                                const range = document.createRange();
                                range.selectNodeContents(targetElement);
                                selection.removeAllRanges();
                                selection.addRange(range);
                            } catch (e) {}
                            
                            // Dispatch delete events
                            targetElement.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'deleteContent', data: null }));
                            targetElement.innerHTML = '';
                            targetElement.textContent = '';
                            targetElement.innerText = '';
                            targetElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent', data: null }));
                            
                            // Wait a bit, then insert new text
                            setTimeout(() => {
                                targetElement.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: newText }));
                                targetElement.textContent = newText;
                                targetElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: newText }));
                                targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                            }, 30);
                        } else if (verifyText !== expectedText) {
                            console.warn('[Prompt Architect] Perplexity update verification failed. Expected:', expectedText.substring(0, 50), 'Got:', verifyText.substring(0, 50));
                        }
                    }
                }, 200);
            }
            
            resolve(updateSuccess);
        });
    });
}

/**
 * Displays a status message in the injected UI with premium styling.
 */
function showStatus(message, color, bgColor) {
    const statusEl = document.querySelector('#prompt-architect-status');
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
    // Persistent container (ChatGPT) may pass null; resolve current input at click time so button never flickers
    if (!inputElement) inputElement = findPlatformSpecificInput();
    // Show loading spinner immediately for the entire process (import, extraction, request, streaming)
    const btnForLoading = document.getElementById('main-enhance-button');
    if (btnForLoading) {
        btnForLoading.disabled = true;
        btnForLoading.style.cursor = 'wait';
        const iconEl = btnForLoading.querySelector('.pa-enhance-button-icon');
        const spinnerEl = btnForLoading.querySelector('.pa-enhance-spinner');
        if (iconEl) iconEl.style.display = 'none';
        if (spinnerEl) spinnerEl.style.display = 'flex';
    }
    // Ensure port is connected so first click works (avoids "Stream not connected" / having to click twice)
    connectEnhanceStreamPagePort();

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
            // Fast path: textContent / innerText (covers most ChatGPT/Gemini cases)
            let text = (element.textContent || '').trim();
            if (text) return text;
            text = (element.innerText || '').trim();
            if (text) return text;
            // Cheap fallbacks before expensive recursive walk
            const nestedContentEditable = element.querySelector('[contenteditable="true"], [contenteditable=""]');
            if (nestedContentEditable && nestedContentEditable !== element) {
                text = (nestedContentEditable.textContent || nestedContentEditable.innerText || '').trim();
                if (text) return text;
            }
            const dataText = element.getAttribute('data-text') || element.getAttribute('data-value') || element.getAttribute('data-content');
            if (dataText) return dataText.trim();
            // Last resort: recursive walk (skip getComputedStyle for script/style to reduce delay)
            const extractFromNodes = (node) => {
                let result = '';
                if (node.nodeType === Node.TEXT_NODE) {
                    result = (node.textContent || '').trim();
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName?.toLowerCase();
                    if (tagName === 'script' || tagName === 'style') return '';
                    const style = window.getComputedStyle(node);
                    if (style.display === 'none' || style.visibility === 'hidden') return '';
                    result = (node.textContent || node.innerText || '').trim();
                    if (!result) {
                        for (const child of node.childNodes) {
                            const childText = extractFromNodes(child);
                            if (childText) result += (result ? ' ' : '') + childText;
                        }
                    }
                }
                return result.trim();
            };
            for (const child of element.childNodes) {
                const childText = extractFromNodes(child);
                if (childText) text = (text ? text + ' ' : '') + childText;
            }
            if (text) return text;
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
    
    const statusEl = document.querySelector('#prompt-architect-status');
    const enhanceButton = document.getElementById('main-enhance-button');
    
    // Store original text to preserve it on error
    let originalText = '';
    if (currentInputElement) {
        if (currentInputElement.tagName === 'TEXTAREA' || currentInputElement.tagName === 'INPUT') {
            originalText = currentInputElement.value || '';
        } else {
            originalText = currentInputElement.textContent || currentInputElement.innerText || '';
        }
    }

    // Special handling for Perplexity: try to get text from the element even if it seems empty
    if (!rawPrompt && inputElement && inputElement.id === 'ask-input') {
        // Perplexity might store text in a specific way - try multiple approaches
        const perplexityText = 
            inputElement.textContent?.trim() ||
            inputElement.innerText?.trim() ||
            Array.from(inputElement.querySelectorAll('*'))
                .map(el => el.textContent?.trim())
                .filter(t => t && t.length > 0)
                .join(' ')
                .trim() ||
            '';
        
        if (perplexityText) {
            rawPrompt = perplexityText;
            currentInputElement = inputElement;
        }
    }
    
    if (!rawPrompt) {
        console.warn('[Prompt Architect] No prompt found after all strategies. Element details:', {
            passedElement: inputElement?.tagName,
            passedElementId: inputElement?.id,
            passedElementClass: inputElement?.className,
            passedElementContentEditable: inputElement?.contentEditable,
            passedElementValue: inputElement?.value?.substring(0, 50),
            passedElementTextContent: inputElement?.textContent?.substring(0, 50)
        });
        
        // Show user-friendly message if no text found and re-enable button
        const statusArea = document.getElementById('prompt-architect-status-area');
        const statusEl = document.querySelector('#prompt-architect-status');
        if (statusArea && statusEl) {
            statusArea.style.display = 'inline-flex';
            statusArea.style.width = 'auto';
            statusEl.textContent = 'No text found. Please type a prompt first.';
            statusEl.style.color = '#f59e0b';
            statusEl.style.background = 'rgba(245, 158, 11, 0.1)';
            statusEl.style.border = '0.5px solid rgba(245, 158, 11, 0.2)';
            statusEl.style.display = 'inline-flex';
            
            setTimeout(() => {
                if (statusArea) statusArea.style.display = 'none';
                if (statusEl) statusEl.style.display = 'none';
            }, 3000);
        }
        if (enhanceButton) {
            enhanceButton.disabled = false;
            enhanceButton.style.cursor = '';
            const iconEl = enhanceButton.querySelector('.pa-enhance-button-icon');
            const spinnerEl = document.getElementById('pa-enhance-button-spinner');
            if (iconEl) iconEl.style.display = '';
            if (spinnerEl) spinnerEl.style.display = 'none';
        }
        return;
    }
    
    // Update inputElement reference for later use
    inputElement = currentInputElement;

    // Use the provided enhancementType directly (no auto-detection)
    let finalEnhancementType = enhancementType;
    let didSucceed = false;

    // 1. Disable controls and show loading with refined visual feedback
    enhanceButton.disabled = true;
    const platform = detectPlatform();
    const design = getPlatformDesign(platform);

    // Inject keyframes once for button animations
    if (!document.getElementById('pa-button-animations')) {
        const style = document.createElement('style');
        style.id = 'pa-button-animations';
        style.textContent = `
            @keyframes pa-loading-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.75; transform: scale(0.96); }
            }
            @keyframes pa-spinner-rotate {
                to { transform: rotate(360deg); }
            }
            @keyframes pa-success-pop {
                0% { transform: scale(1); }
                40% { transform: scale(1.12); }
                70% { transform: scale(0.98); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    // Loading state: keep spinner visible (re-apply in case button was re-created by page)
    enhanceButton.style.background = design.primary;
    enhanceButton.style.transition = 'box-shadow 0.2s ease, background 0.2s ease';
    enhanceButton.style.animation = '';
    enhanceButton.style.cursor = 'wait';
    const iconEl = enhanceButton.querySelector('.pa-enhance-button-icon');
    const spinnerEl = enhanceButton.querySelector('.pa-enhance-spinner');
    if (iconEl) iconEl.style.display = 'none';
    if (spinnerEl) spinnerEl.style.display = 'flex';

    try {
        // 2. Prefer streaming when port is available (ChatGPT, Gemini, etc.)
        let elementToUpdate = currentInputElement;
        if (platform === 'perplexity' && (!elementToUpdate || !document.body.contains(elementToUpdate))) {
            const perplexityInput = findPlatformSpecificInput();
            if (perplexityInput) elementToUpdate = perplexityInput;
        }
        if (enhanceStreamPagePort) {
            streamingContext = {
                currentInputElement,
                elementToUpdate,
                enhanceButton,
                statusEl,
                statusArea: document.getElementById('prompt-architect-status-area'),
                design,
                platform,
                accumulated: ''
            };
            const streamResponse = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'enhancePromptStream',
                    prompt: rawPrompt,
                    enhancementType: finalEnhancementType,
                    forceDefaultStyle: true,
                }, (r) => {
                    if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
                    else resolve(r);
                });
            });
            if (streamResponse?.ok) {
                // Backend TTFB is 8–13s; show status so user knows we're waiting for first chunk
                const area = document.getElementById('prompt-architect-status-area');
                const el = document.querySelector('#prompt-architect-status');
                if (area && el) {
                    area.style.display = 'inline-flex';
                    area.style.width = 'auto';
                    el.textContent = 'Enhancing…';
                    el.style.color = 'inherit';
                    el.style.background = 'rgba(255,255,255,0.08)';
                    el.style.border = '0.5px solid rgba(255,255,255,0.12)';
                    el.style.display = 'inline-flex';
                }
                return; // Chunk/done/error handled by port listener
            }
            streamingContext = null;
        }

        // 3. Non-streaming path (or fallback)
        const response = await chrome.runtime.sendMessage({
            action: 'enhancePrompt',
            prompt: rawPrompt,
            enhancementType: finalEnhancementType,
            forceDefaultStyle: true, // Injected button always uses default style
        });
        
        const improvedPrompt = response?.enhancedPrompt || "Error: Failed to receive improved prompt.";

        // 4. Update the input field using the currentInputElement we found
        if (improvedPrompt.startsWith("Error:")) {
            // Show error in status area, preserve user's original text
            const errorMessage = improvedPrompt.replace("Error: ", "");
            const statusArea = document.getElementById('prompt-architect-status-area');
            
            if (statusArea && statusEl) {
                statusArea.style.display = 'inline-flex';
                statusArea.style.width = 'auto';
                statusArea.style.gap = '8px';
                
                statusEl.textContent = errorMessage;
                statusEl.style.color = '#ef4444';
                statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
                statusEl.style.border = '0.5px solid rgba(239, 68, 68, 0.2)';
                statusEl.style.display = 'inline-flex';
                statusEl.style.alignItems = 'center';
                statusEl.style.opacity = '0';
                statusEl.style.transform = 'translateY(-4px)';
                
                setTimeout(() => {
                    statusEl.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    statusEl.style.opacity = '1';
                    statusEl.style.transform = 'translateY(0)';
                }, 10);
                
                // Auto-hide after 5 seconds
                setTimeout(() => {
                    if (statusEl) {
                        statusEl.style.opacity = '0';
                        setTimeout(() => {
                            if (statusArea) {
                                statusArea.style.display = 'none';
                                statusArea.style.width = '0';
                            }
                            if (statusEl) {
                                statusEl.style.display = 'none';
                            }
                        }, 300);
                    }
                }, 5000);
            }
            
            // Show subtle error feedback on button
            enhanceButton.style.background = '#ef4444';
            enhanceButton.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
            setTimeout(() => {
                if (enhanceButton) {
                    const hex = design.primary.replace('#', '');
                    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                    const glow = `rgba(${r},${g},${b},0.4)`;
                    enhanceButton.style.background = `linear-gradient(180deg, ${design.primaryHover || design.primary} 0%, ${design.primary} 100%)`;
                    enhanceButton.style.boxShadow = `0 2px 10px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.15) inset, 0 0 20px ${glow}`;
                }
            }, 2000);
            
            // Error case - show error feedback
        } else {
            didSucceed = true;
            // Replace user's text with improved prompt
            // For Perplexity, ensure we have the correct input element
            let elementToUpdate = currentInputElement;
            if (platform === 'perplexity' && (!elementToUpdate || !document.body.contains(elementToUpdate))) {
                // Re-find the Perplexity input element
                const perplexityInput = findPlatformSpecificInput();
                if (perplexityInput) {
                    elementToUpdate = perplexityInput;
                }
            }
            
            // updateInputAndDispatch now returns a Promise - this REPLACES the original text
            updateInputAndDispatch(improvedPrompt, elementToUpdate).then(updateSuccess => {
                // Success - the improved prompt in the input field is the feedback
                if (!updateSuccess) {
                    console.error('[Prompt Architect] Update failed');
                    // For Perplexity, try one more time with a fresh element lookup
                    if (platform === 'perplexity') {
                        setTimeout(() => {
                            const freshInput = findPlatformSpecificInput();
                            if (freshInput) {
                                updateInputAndDispatch(improvedPrompt, freshInput).catch(err => {
                                    console.error('[Prompt Architect] Retry update also failed:', err);
                                });
                            }
                        }, 200);
                    }
                } else {
                    // Check if auto-send is enabled
                    chrome.storage.local.get(['autoSendAfterEnhancement'], async (result) => {
                        if (result.autoSendAfterEnhancement) {
                            // Wait a moment for the input to settle
                            await new Promise(resolve => setTimeout(resolve, 300));
                            
                            // Find and click the send button
                            const sendButton = findSendButton(elementToUpdate || currentInputElement);
                            if (sendButton && sendButton.offsetParent !== null) {
                                // Trigger click on the send button
                                sendButton.click();
                            }
                        }
                    });
                }
            }).catch(error => {
                console.error('[Prompt Architect] Error updating input:', error);
            });
        }

    } catch (error) {
        console.error('[Prompt Architect] Communication error:', error);
        // Show error feedback on button
        const platform = detectPlatform();
        const design = getPlatformDesign(platform);
        enhanceButton.style.background = '#ef4444'; // Red for error
        enhanceButton.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
        setTimeout(() => {
            if (enhanceButton) {
                const hex = design.primary.replace('#', '');
                const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                const glow = `rgba(${r},${g},${b},0.4)`;
                enhanceButton.style.background = `linear-gradient(180deg, ${design.primaryHover || design.primary} 0%, ${design.primary} 100%)`;
                enhanceButton.style.boxShadow = `0 2px 10px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.15) inset, 0 0 20px ${glow}`;
            }
        }, 2000);
    } finally {
        // 4. Re-enable controls, show icon and hide loading spinner
        enhanceButton.disabled = false;
        enhanceButton.style.animation = '';
        const iconEl = enhanceButton.querySelector('.pa-enhance-button-icon');
        const spinnerEl = enhanceButton.querySelector('.pa-enhance-spinner');
        if (iconEl) iconEl.style.display = 'flex';
        if (spinnerEl) spinnerEl.style.display = 'none';

        const platform = detectPlatform();
        const design = getPlatformDesign(platform);
        enhanceButton.style.background = `linear-gradient(180deg, ${design.primaryHover || design.primary} 0%, ${design.primary} 100%)`;
        enhanceButton.style.cursor = 'pointer';

        if (didSucceed) {
            // Brief success animation: small pop then settle
            enhanceButton.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.2s ease, background 0.2s ease';
            enhanceButton.style.animation = 'pa-success-pop 0.4s ease-out forwards';
            setTimeout(() => {
                enhanceButton.style.animation = '';
                enhanceButton.style.transition = 'box-shadow 0.2s ease, background 0.2s ease, transform 0.15s ease';
                enhanceButton.style.transform = '';
            }, 420);
        } else {
            enhanceButton.style.transition = 'box-shadow 0.2s ease, background 0.2s ease';
        }

        // Hide status area completely when done (no text messages shown)
        const statusArea = document.getElementById('prompt-architect-status-area');
        if (statusArea) {
            statusArea.style.display = 'none';
            statusArea.style.width = '0';
        }
        if (statusEl) statusEl.style.display = 'none';
    }
}

// --- Listener for Context Menu Results and Keyboard Shortcuts ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'contextMenuResult') {
        const inputElement = document.querySelector(SELECTORS.PROMPT_INPUT);
        const statusContainer = document.querySelector('#prompt-architect-buttons-container');
        const statusEl = statusContainer ? statusContainer.querySelector('#prompt-architect-status') : null;

        if (inputElement) {
            if (request.resultText && !request.resultText.startsWith("Error:")) {
                // updateInputAndDispatch now returns a Promise
                updateInputAndDispatch(request.resultText, inputElement).then(async (updateSuccess) => {
                    // Success - the improved prompt in the input field is the feedback
                    if (!updateSuccess) {
                        console.error('[Prompt Architect] Context menu update failed');
                    } else {
                        // Check if auto-send is enabled for context menu results
                        chrome.storage.local.get(['autoSendAfterEnhancement'], async (result) => {
                            if (result.autoSendAfterEnhancement) {
                                // Wait a moment for the input to settle
                                await new Promise(resolve => setTimeout(resolve, 300));
                                
                                // Find and click the send button
                                const sendButton = findSendButton(inputElement);
                                if (sendButton && sendButton.offsetParent !== null) {
                                    // Trigger click on the send button
                                    sendButton.click();
                                }
                            }
                        });
                    }
                }).catch(error => {
                    console.error('[Prompt Architect] Error updating input from context menu:', error);
                });
            } else {
                // Silent error - logged to console for debugging
                console.error('[Prompt Architect] Context menu error');
            }
        }
        sendResponse({ success: true });
        return true;
    }
    
    // Handle keyboard shortcut
    if (request.action === 'enhance-prompt-shortcut') {
        const enhanceButton = getCachedElement('enhanceButton', () => 
            document.getElementById('main-enhance-button')
        );
        
        if (enhanceButton && !enhanceButton.disabled) {
            // Get current input element
            const inputElement = getCachedElement('currentInput', () => 
                document.querySelector(SELECTORS.PROMPT_INPUT)
            );
            
            if (inputElement) {
                // Always use auto-detection (independent from popup mode)
                const defaultMode = 'TEXT_ENHANCEMENT';
                    const statusContainer = getCachedElement('buttonsContainer', () => 
                        document.getElementById('prompt-architect-buttons-container')
                    );
                    
                    if (statusContainer) {
                    handleButtonClick(inputElement, defaultMode, statusContainer).catch(error => {
                        console.error('[Prompt Architect] Error handling button click:', error);
                });
                }
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

    if (platform === 'chatgpt') {
        // ChatGPT: textarea-based input (chat.openai.com, chatgpt.com)
        const chatgptSelectors = [
            'textarea[placeholder="Message ChatGPT"]',
            'textarea[placeholder*="Message"]',
            'textarea[placeholder*="message"]',
            'textarea[id^="prompt-textarea"]',
            'textarea[id*="prompt"]',
            'textarea[data-id*="composer"]',
            'textarea[aria-label*="Message" i]',
            'textarea[aria-label*="prompt" i]',
            'form textarea:not([readonly])',
            '[data-testid="composer-textarea"]',
            '[contenteditable="true"][data-placeholder*="Message" i]',
            '[contenteditable="true"][aria-label*="Message" i]',
            'textarea',
        ];
        for (const selector of chatgptSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const elem of elements) {
                    const rect = elem.getBoundingClientRect();
                    const style = window.getComputedStyle(elem);
                    if (rect.width > 50 && rect.height > 20 &&
                        style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        elem.offsetParent !== null) {
                        input = elem;
                        break;
                    }
                }
                if (input) break;
            } catch (e) {
                continue;
            }
        }
        // Prefer main composer: avoid sidebar — pick the one closest to viewport center (not the largest, which can be a sidebar)
        if (input && document.querySelectorAll('textarea').length > 1) {
            const textareas = Array.from(document.querySelectorAll('textarea')).filter(t => {
                const r = t.getBoundingClientRect();
                const s = window.getComputedStyle(t);
                return r.width > 50 && r.height > 20 && s.display !== 'none' && t.offsetParent !== null;
            });
            if (textareas.length > 0) {
                const viewportCenterX = window.innerWidth / 2;
                const closestToCenter = textareas.reduce((a, b) => {
                    const ax = a.getBoundingClientRect().left + a.getBoundingClientRect().width / 2;
                    const bx = b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2;
                    return Math.abs(ax - viewportCenterX) <= Math.abs(bx - viewportCenterX) ? a : b;
                });
                input = closestToCenter;
            }
        }
    } else if (platform === 'gemini') {
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
        
        // Fallback 1: find largest visible contenteditable, prefer one in bottom half (chat input area)
        if (!input) {
            const allContentEditables = document.querySelectorAll('[contenteditable="true"]:not([contenteditable="false"])');
            let bestElement = null;
            let bestScore = -1;
            const viewportMid = window.innerHeight * 0.5;

            for (const elem of allContentEditables) {
                const rect = elem.getBoundingClientRect();
                const style = window.getComputedStyle(elem);
                if (rect.width > 20 && rect.height > 5 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    elem.offsetParent !== null &&
                    rect.top >= 0 && rect.left >= 0) {
                    const area = rect.width * rect.height;
                    const isBottomHalf = rect.top >= viewportMid;
                    const score = area * (isBottomHalf ? 2 : 1);
                    if (score > bestScore) {
                        bestScore = score;
                        bestElement = elem;
                    }
                }
            }

            if (bestElement) {
                input = bestElement;
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
        
    } else if (platform === 'claude') {
        // Claude uses contenteditable divs, try multiple strategies
        const claudeSelectors = [
            // Most specific - aria labels and placeholders
            '[contenteditable="true"][aria-label*="Message" i]',
            '[contenteditable="true"][aria-label*="prompt" i]',
            '[contenteditable="true"][aria-label*="Type" i]',
            '[contenteditable="true"][placeholder*="Message" i]',
            '[contenteditable="true"][placeholder*="Ask" i]',
            '[contenteditable="true"][data-placeholder*="Message" i]',
            // Role-based
            '[contenteditable="true"][role="textbox"]',
            '[role="textbox"][contenteditable="true"]',
            // Class-based (Claude-specific patterns)
            '[contenteditable="true"][class*="input" i]',
            '[contenteditable="true"][class*="text" i]',
            '[contenteditable="true"][class*="editor" i]',
            '[contenteditable="true"][class*="composer" i]',
            '[contenteditable="true"][class*="message" i]',
            '[contenteditable="true"][class*="prompt" i]',
            // Search within form containers
            'form [contenteditable="true"]',
            '[class*="input-container"] [contenteditable="true"]',
            '[class*="prompt-container"] [contenteditable="true"]',
            '[class*="composer"] [contenteditable="true"]',
            '[class*="editor"] [contenteditable="true"]',
            // Main area search
            'main [contenteditable="true"]',
            '[role="main"] [contenteditable="true"]',
            // Generic contenteditable fallback
            'div[contenteditable="true"]:not([contenteditable="false"])',
        ];
        
        for (const selector of claudeSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const elem of elements) {
                    const rect = elem.getBoundingClientRect();
                    const style = window.getComputedStyle(elem);
                    // Relaxed visibility checks for Claude
                    if (rect.width > 30 && rect.height > 10 && 
                        style.display !== 'none' && 
                        style.visibility !== 'hidden' &&
                        elem.offsetParent !== null) {
                        input = elem;
                        break;
                    }
                }
                if (input) break;
            } catch (e) {
                continue;
            }
        }
        
        // Fallback 1: find largest visible contenteditable in form
        if (!input) {
            const form = document.querySelector('form');
            if (form) {
                const contentEditables = form.querySelectorAll('[contenteditable="true"]:not([contenteditable="false"])');
                let largestElement = null;
                let largestArea = 0;
                
                for (const elem of contentEditables) {
                    const rect = elem.getBoundingClientRect();
                    const style = window.getComputedStyle(elem);
                    if (rect.width > 30 && rect.height > 10 && 
                        style.display !== 'none' && 
                        style.visibility !== 'hidden' &&
                        elem.offsetParent !== null) {
                        const area = rect.width * rect.height;
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
        
        // Fallback 2: find largest visible contenteditable overall
        if (!input) {
            const allContentEditables = document.querySelectorAll('[contenteditable="true"]:not([contenteditable="false"])');
            let largestElement = null;
            let largestArea = 0;
            
            for (const elem of allContentEditables) {
                const rect = elem.getBoundingClientRect();
                const style = window.getComputedStyle(elem);
                if (rect.width > 30 && rect.height > 10 && 
                    style.display !== 'none' && 
                    style.visibility !== 'hidden' &&
                    elem.offsetParent !== null) {
                    const area = rect.width * rect.height;
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
        
    } else if (platform === 'perplexity') {
        // Perplexity uses textarea or contenteditable - try multiple selectors
        const perplexitySelectors = [
            // Textarea selectors
            'textarea[placeholder*="Ask" i]',
            'textarea[placeholder*="Search" i]',
            'textarea[placeholder*="question" i]',
            'textarea[aria-label*="Ask" i]',
            'textarea[aria-label*="Search" i]',
            'textarea[class*="input" i]',
            'textarea[class*="search" i]',
            'textarea[class*="query" i]',
            // Contenteditable selectors
            '[contenteditable="true"][placeholder*="Ask" i]',
            '[contenteditable="true"][placeholder*="Search" i]',
            '[contenteditable="true"][aria-label*="Ask" i]',
            '[contenteditable="true"][aria-label*="Search" i]',
            '[contenteditable="true"][class*="input" i]',
            '[contenteditable="true"][class*="search" i]',
            '[contenteditable="true"][role="textbox"]',
            // Search within containers
            'form textarea',
            'form [contenteditable="true"]',
            '[class*="input-container"] textarea',
            '[class*="input-container"] [contenteditable="true"]',
            '[class*="search"] textarea',
            '[class*="search"] [contenteditable="true"]',
            'main textarea',
            'main [contenteditable="true"]',
        ];
        
        for (const selector of perplexitySelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const elem of elements) {
                    const rect = elem.getBoundingClientRect();
                    const style = window.getComputedStyle(elem);
                    if (rect.width > 30 && rect.height > 10 && 
                        style.display !== 'none' && 
                        style.visibility !== 'hidden' &&
                        elem.offsetParent !== null) {
                        input = elem;
                        break;
                    }
                }
                if (input) break;
            } catch (e) {
                continue;
            }
        }
        
        // Fallback: find largest visible textarea or contenteditable
        if (!input) {
            const allInputs = document.querySelectorAll('textarea, [contenteditable="true"]');
            let largestElement = null;
            let largestArea = 0;
            
            for (const elem of allInputs) {
                const rect = elem.getBoundingClientRect();
                const style = window.getComputedStyle(elem);
                if (rect.width > 30 && rect.height > 10 && 
                    style.display !== 'none' && 
                    style.visibility !== 'hidden' &&
                    elem.offsetParent !== null) {
                    const area = rect.width * rect.height;
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
        console.warn('[Prompt Architect] No input element found on', window.location.hostname, '- page may still be loading. Try refreshing.');
    }
    return input;
}

/**
 * Uses a MutationObserver to detect when the target chat interface is loaded.
 * Enhanced to stay active for ChatGPT's dynamic interface and prevent excessive re-injections.
 */
let injectionDebounceTimer = null;
let chatgptReinjectInterval = null;
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
        shouldShowEnhanceButton().then((show) => {
            if (!show) {
                if (retryMutationObserver) {
                    retryMutationObserver.disconnect();
                    retryMutationObserver = null;
                }
                retryCount = 0;
                const existingUI = document.getElementById('prompt-architect-buttons-container');
                if (existingUI && document.body.contains(existingUI)) existingUI.remove();
                return;
            }
            
            const existingUI = document.getElementById('prompt-architect-buttons-container');
            if (existingUI && document.body.contains(existingUI)) {
                retryCount = 0;
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
                        console.error('[Prompt Architect] Max retries reached, injection failed');
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

async function observeDOM() {
    if (!(await shouldShowEnhanceButton())) {
        const existingUI = document.getElementById('prompt-architect-buttons-container');
        if (existingUI && document.body.contains(existingUI)) existingUI.remove();
        const wrapper = document.getElementById(CHATGPT_PERSISTENT_WRAPPER_ID);
        if (wrapper) wrapper.style.display = 'none';
        return;
    }
    
    // Inject after a short delay so the composer is stable (avoids button jumping on ChatGPT)
    const initialDelay = detectPlatform() === 'chatgpt' ? 600 : 200;
    const tryInject = () => {
        const input = findPlatformSpecificInput();
        if (input) {
            injectUI(input).then(() => {
                lastInjectedInput = input;
                retryCount = 0; // Reset retry count on success
            }).catch(() => {
                retryInjection(); // Start retry sequence
            });
        } else {
            retryInjection(); // Start retry sequence
        }
    };
    setTimeout(tryInject, initialDelay);

    function mutationRemovedOurUI(mutationsList) {
        for (const mutation of mutationsList) {
            if (mutation.type !== 'childList' || !mutation.removedNodes.length) continue;
            for (const node of mutation.removedNodes) {
                if (node.nodeType !== 1) continue;
                const our = node.id === 'prompt-architect-buttons-container' || node.id === 'main-enhance-button' ||
                    (node.querySelector && (node.querySelector('#prompt-architect-buttons-container') || node.querySelector('#main-enhance-button')));
                if (our) return true;
            }
        }
        return false;
    }

    const observer = new MutationObserver((mutationsList) => {
        if (!mutationRemovedOurUI(mutationsList)) return;
        const container = document.getElementById('prompt-architect-buttons-container');
        if (container && !document.body.contains(container) && reattachContainerToCurrentParent(container)) {
            const currentInput = findPlatformSpecificInput();
            if (currentInput) setupButtonProtection(container, currentInput);
            return;
        }
        if (injectionDebounceTimer) clearTimeout(injectionDebounceTimer);
        // Zero debounce for ChatGPT/Perplexity so button reappears immediately when composer re-renders (no visible disappear)
        const platform = detectPlatform();
        const debounceMs = (platform === 'chatgpt' || platform === 'perplexity') ? 0 : 500;
        injectionDebounceTimer = setTimeout(() => {
            injectionDebounceTimer = null;
            shouldShowEnhanceButton().then(async (show) => {
                if (!show) {
                    const existingUI = document.getElementById('prompt-architect-buttons-container');
                    if (existingUI && document.body.contains(existingUI)) existingUI.remove();
                    const wrapper = document.getElementById(CHATGPT_PERSISTENT_WRAPPER_ID);
                    if (wrapper) wrapper.style.display = 'none';
                    retryCount = 0;
                    return;
                }
                const currentInput = findPlatformSpecificInput();
                if (currentInput) {
                    const existingUI = document.getElementById('prompt-architect-buttons-container');
                    const containerMissing = !existingUI || !document.body.contains(existingUI);
                    if (containerMissing) {
                        lastInjectedInput = currentInput;
                        retryCount = 0;
                        injectUI(currentInput).then(() => { retryCount = 0; }).catch(() => {});
                    }
                } else {
                    const existingUI = document.getElementById('prompt-architect-buttons-container');
                    if ((!existingUI || !document.body.contains(existingUI)) && retryCount < MAX_RETRIES) {
                        retryInjection();
                    }
                }
            });
        }, debounceMs);
    });

    // Observe with comprehensive options for dynamic interfaces
    observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: false,
        attributeOldValue: false
    });

    // ChatGPT: only update position of persistent container (no re-inject = no flicker). Perplexity: re-inject if missing.
    const platform = detectPlatform();
    if (platform === 'chatgpt' || platform === 'perplexity') {
        if (chatgptReinjectInterval) clearInterval(chatgptReinjectInterval);
        chatgptReinjectInterval = setInterval(async () => {
            if (!(await shouldShowEnhanceButton())) {
                const wrapper = document.getElementById(CHATGPT_PERSISTENT_WRAPPER_ID);
                if (wrapper) wrapper.style.display = 'none';
                return;
            }
            if (platform === 'chatgpt') {
                const wrapper = document.getElementById(CHATGPT_PERSISTENT_WRAPPER_ID);
                if (wrapper && wrapper.firstElementChild) {
                    wrapper.style.display = '';
                    updateChatGPTPersistentPosition();
                    return;
                }
            }
            const existingUI = document.getElementById('prompt-architect-buttons-container');
            if (existingUI && document.body.contains(existingUI)) return;
            const input = findPlatformSpecificInput();
            if (input) injectUI(input).catch(() => {});
        }, platform === 'chatgpt' ? 150 : 1500);
    }

    // Keep Improve button visible when typing: re-inject immediately when user focuses or types in composer and button is missing
    let composerReinjectTimer = null;
    let lastComposerCheck = 0;
    const platformForComposer = detectPlatform();
    const COMPOSER_CHECK_THROTTLE_MS = platformForComposer === 'chatgpt' ? 50 : 150;
    const COMPOSER_REINJECT_DELAY_MS = (platformForComposer === 'chatgpt' || platformForComposer === 'perplexity') ? 0 : 80;
    function scheduleComposerReinject() {
        if (composerReinjectTimer) return;
        composerReinjectTimer = setTimeout(async () => {
            composerReinjectTimer = null;
            if (!(await shouldShowEnhanceButton())) return;
            if (platformForComposer === 'chatgpt') {
                const wrapper = document.getElementById(CHATGPT_PERSISTENT_WRAPPER_ID);
                if (wrapper && wrapper.firstElementChild) {
                    updateChatGPTPersistentPosition();
                    return;
                }
            }
            const existingUI = document.getElementById('prompt-architect-buttons-container');
            if (existingUI && document.body.contains(existingUI)) return;
            const input = findPlatformSpecificInput();
            if (input) injectUI(input).catch(() => {});
        }, COMPOSER_REINJECT_DELAY_MS);
    }
    function onComposerInteraction(e) {
        const target = e.target;
        if (!target || !target.closest) return;
        const now = Date.now();
        if (now - lastComposerCheck < COMPOSER_CHECK_THROTTLE_MS) return;
        lastComposerCheck = now;
        const input = findPlatformSpecificInput();
        if (!input) return;
        const isComposer = target === input || input.contains(target);
        if (!isComposer) return;
        scheduleComposerReinject();
    }
    document.addEventListener('focusin', onComposerInteraction, { passive: true, capture: true });
    document.addEventListener('input', onComposerInteraction, { passive: true, capture: true });
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
        
        (async () => {
            if (!(await shouldShowEnhanceButton())) {
                const existingUI = document.getElementById('prompt-architect-buttons-container');
                if (existingUI && document.body.contains(existingUI)) existingUI.remove();
                const wrapper = document.getElementById(CHATGPT_PERSISTENT_WRAPPER_ID);
                if (wrapper) wrapper.style.display = 'none';
                return;
            }
            
            // Start the detection process immediately
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    try {
                        observeDOM();
                    } catch (error) {
                        console.error('[Prompt Architect] Error in observeDOM after DOMContentLoaded:', error);
                    }
                });
            } else {
                // DOM already loaded
                try {
                    observeDOM();
                } catch (error) {
                    console.error('[Prompt Architect] Error in observeDOM (immediate):', error);
                }
            }
            
            // Delayed attempts to catch late-loading composers (ChatGPT/Gemini often load after 2–8s)
            [2000, 5000, 8000, 12000].forEach((delayMs) => {
                setTimeout(async () => {
                    const existingUI = document.getElementById('prompt-architect-buttons-container');
                    if (existingUI && document.body.contains(existingUI)) return;
                    if (!(await shouldShowEnhanceButton())) return;
                    const input = findPlatformSpecificInput();
                    if (input) injectUI(input).catch(() => {});
                }, delayMs);
            });
        })();
        
    } catch (error) {
        console.error('[Prompt Architect] Fatal error during initialization:', error);
        console.error('[Prompt Architect] Stack:', error.stack);
    }
})();