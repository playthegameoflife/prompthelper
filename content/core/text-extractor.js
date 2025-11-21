/**
 * text-extractor.js
 * Core utility for extracting text from various input element types.
 * Handles textarea, contenteditable divs, and other input types.
 */

/**
 * Extracts text from an element using multiple strategies
 * @param {HTMLElement} element - The element to extract text from
 * @returns {string} The extracted text
 */
export function extractTextFromElement(element) {
    if (!element) return '';
    
    // Strategy 1: Check if it's a textarea with value
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
        
        // Extract from all child nodes recursively
        text = extractFromNodes(element);
        if (text) {
            return text;
        }
        
        // Last resort: try getting text from data attributes
        const dataText = element.getAttribute('data-text') || 
                       element.getAttribute('data-value') ||
                       element.getAttribute('data-content');
        if (dataText) {
            return dataText.trim();
        }
    }
    
    // Strategy 3: Try textContent (works for most elements)
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
}

/**
 * Recursively extracts text from child nodes
 * @param {Node} node - The node to extract from
 * @returns {string} The extracted text
 */
function extractFromNodes(node) {
    let result = '';
    if (node.nodeType === Node.TEXT_NODE) {
        result = (node.textContent || '').trim();
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip script, style, and hidden elements
        const tagName = node.tagName?.toLowerCase();
        const style = window.getComputedStyle(node);
        if (tagName !== 'script' && tagName !== 'style' && 
            style.display !== 'none' && style.visibility !== 'hidden') {
            // Get direct text content
            result = (node.textContent || node.innerText || '').trim();
            // If no direct text, check children
            if (!result) {
                for (const child of node.childNodes) {
                    const childText = extractFromNodes(child);
                    if (childText) {
                        result += (result ? ' ' : '') + childText;
                    }
                }
            }
        }
    }
    return result.trim();
}

/**
 * Updates the input field value and triggers synthetic events
 * Handles both textarea and contenteditable divs
 * @param {HTMLElement} element - The input element to update
 * @param {string} newText - The text to insert
 * @returns {Promise<boolean>} Success status
 */
export function updateInputAndDispatch(element, newText) {
    if (!element || !document.body.contains(element)) {
        return Promise.resolve(false);
    }
    
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            let updateSuccess = false;
            
            // Handle contenteditable divs
            if (element.contentEditable === 'true' || element.hasAttribute('contenteditable') || 
                element.getAttribute('contenteditable') === 'true') {
                element.textContent = newText;
                element.innerText = newText;
                
                const actualText = (element.textContent || element.innerText || '').trim();
                if (actualText === newText.trim() || actualText.length > 0) {
                    const inputEvent = new InputEvent('input', { 
                        bubbles: true, 
                        cancelable: true,
                        inputType: 'insertText',
                        data: newText
                    });
                    element.dispatchEvent(inputEvent);
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    element.focus();
                    updateSuccess = true;
                }
            } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
                // Handle regular textarea/input
                const originalValue = element.value;
                element.value = newText;
                
                if (element.value === newText || element.value.length === newText.length) {
                    const inputEvent = new InputEvent('input', { 
                        bubbles: true, 
                        cancelable: true,
                        inputType: 'insertText',
                        data: newText
                    });
                    element.dispatchEvent(inputEvent);
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    element.focus();
                    updateSuccess = true;
                } else {
                    // Try alternative method
                    element.value = '';
                    element.value = newText;
                    if (element.value === newText) {
                        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: newText }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        updateSuccess = true;
                    }
                }
            } else {
                // Fallback: try setting textContent
                element.textContent = newText;
                const actualText = (element.textContent || '').trim();
                if (actualText === newText.trim() || actualText.length > 0) {
                    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: newText }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    element.focus();
                    updateSuccess = true;
                }
            }
            
            resolve(updateSuccess);
        });
    });
}




