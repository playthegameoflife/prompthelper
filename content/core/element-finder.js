/**
 * element-finder.js
 * Core utility for finding DOM elements across different platforms.
 * Provides unified element finding logic to eliminate duplication.
 */

/**
 * Finds the send button using multiple strategies
 * @param {HTMLElement} inputElement - The input element
 * @param {HTMLElement} container - Optional container to search within
 * @param {Array<string>} platformSelectors - Platform-specific selectors to try first
 * @returns {HTMLElement|null} The send button element or null
 */
export function findSendButton(inputElement, container = null, platformSelectors = []) {
    const sendButtonSelectors = [
        ...platformSelectors,
        // Standard submit buttons
        'button[type="submit"]',
        // ChatGPT/OpenAI patterns
        'button[aria-label*="Send" i]',
        'button[data-testid*="send" i]',
        'button[title*="Send" i]',
        // Claude patterns
        'button[aria-label*="Send message" i]',
        'button[class*="send"]',
        // Gemini patterns
        'button[aria-label*="Submit" i]',
        'button[data-testid*="submit" i]',
        'button[data-testid*="send" i]',
        'button[class*="send-button"]',
        '[class*="composer"] button[type="submit"]',
        '[class*="input-container"] button',
        '[data-testid*="composer"] button',
        'button[data-id*="send"]',
        'button[jsname*="send"]',
        // Grok/X patterns
        'button[data-testid="tweetButton"]',
        'button[data-testid*="tweetButton"]',
        'button[aria-label*="Post" i]',
        'button[aria-label*="Tweet" i]',
        // Perplexity patterns
        'button[type="submit"][class*="search"]',
        'button[aria-label*="Search" i]',
        // Generic patterns
        'button svg[viewBox*="0 0"]',
    ];
    
    // Strategy 1: Search in container
    const searchContainer = container || inputElement.parentElement;
    if (searchContainer) {
        for (const selector of sendButtonSelectors) {
            try {
                const button = searchContainer.querySelector(selector);
                if (button && button.offsetParent !== null) {
                    return button;
                }
            } catch (e) {
                // Continue if selector fails
            }
        }
    }
    
    // Strategy 2: Search in parent hierarchy
    let current = inputElement.parentElement;
    let attempts = 0;
    while (current && attempts < 20) {
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
    
    // Strategy 3: Search entire document for buttons near input
    const inputRect = inputElement.getBoundingClientRect();
    const allButtons = document.querySelectorAll('button');
    let closestButton = null;
    let closestDistance = Infinity;
    
    for (const button of allButtons) {
        if (button.offsetParent === null) continue;
        
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
    
    // Strategy 4: Look for buttons with common send button patterns
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
 * Finds the input element using platform-specific selectors
 * @param {Array<string>} selectors - Array of CSS selectors to try
 * @param {HTMLElement} container - Optional container to search within
 * @returns {HTMLElement|null} The input element or null
 */
export function findInput(selectors, container = document) {
    for (const selector of selectors) {
        try {
            const elements = container.querySelectorAll(selector);
            for (const element of elements) {
                // Check if element is visible
                if (element.offsetParent !== null && 
                    !element.hasAttribute('readonly') && 
                    !element.disabled) {
                    return element;
                }
            }
        } catch (e) {
            // Continue if selector fails
        }
    }
    return null;
}

/**
 * Finds the container for injection
 * @param {HTMLElement} inputElement - The input element
 * @param {HTMLElement} sendButton - The send button
 * @param {Array<string>} containerSelectors - Optional container selectors
 * @returns {HTMLElement|null} The container element or null
 */
export function findContainer(inputElement, sendButton, containerSelectors = []) {
    // Strategy 1: Use send button's parent
    if (sendButton && sendButton.parentElement) {
        return sendButton.parentElement;
    }
    
    // Strategy 2: Try container selectors
    for (const selector of containerSelectors) {
        try {
            const container = inputElement.closest(selector);
            if (container) return container;
        } catch (e) {
            // Continue
        }
    }
    
    // Strategy 3: Find form
    const form = inputElement.closest('form');
    if (form) return form;
    
    // Strategy 4: Use input's parent
    return inputElement.parentElement;
}




