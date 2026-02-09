/**
 * injection-manager.js
 * Manages UI injection and button creation.
 * Handles the creation and injection of the enhance button and related UI.
 */

/**
 * Injection Manager - handles UI creation and injection
 */
export class InjectionManager {
    /**
     * Checks if any API key is configured
     * @returns {Promise<boolean>}
     */
    static async hasApiKey() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['userGeminiApiKey', 'defaultGeminiApiKey'], (result) => {
                const hasKey = !!(result.userGeminiApiKey || result.defaultGeminiApiKey);
                resolve(hasKey);
            });
        });
    }

    /**
     * Checks if injected button is enabled by user preference
     * @returns {Promise<boolean>}
     */
    static async isInjectButtonEnabled() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['injectButtonEnabled'], (result) => {
                // Default to true for backward compatibility
                resolve(result.injectButtonEnabled !== false);
            });
        });
    }

    /**
     * Injects the enhance button next to the send button
     * @param {HTMLElement} inputElement - The input element
     * @param {HTMLElement} sendButton - The send button
     * @param {HTMLElement} container - Optional container
     * @param {Object} design - Design tokens
     * @returns {Promise<void>}
     */
    static async injectButtonNextToSend(inputElement, sendButton, container = null, design = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                // Check if button injection is enabled by user preference
                const buttonEnabled = await this.isInjectButtonEnabled();
                if (!buttonEnabled) {
                    resolve(); // Resolve silently - button shouldn't be shown
                    return;
                }

                // Check if API key is set - don't show button if no API key
                const apiKeyExists = await this.hasApiKey();
                if (!apiKeyExists) {
                    resolve(); // Resolve silently - button shouldn't be shown
                    return;
                }

                // Check if already injected
                const existingContainer = document.getElementById('prompt-architect-buttons-container');
                if (existingContainer && document.body.contains(existingContainer)) {
                    resolve();
                    return;
                }

                // Find the correct container
                let targetContainer = container || sendButton.parentElement;
                
                // Verify the send button is actually in this container
                if (targetContainer && !targetContainer.contains(sendButton)) {
                    targetContainer = sendButton.parentElement;
                }
                
                if (!targetContainer) {
                    reject(new Error('No container found'));
                    return;
                }

                // Create UI elements
                const enhancerDiv = this.createButtonsContainer();
                const statusArea = this.createStatusArea();
                const enhanceButton = this.createEnhanceButton(inputElement, enhancerDiv, design);

                enhancerDiv.appendChild(statusArea);
                enhancerDiv.appendChild(enhanceButton);

                // Use send button's direct parent so enhance is always directly left of send (never above/below)
                const insertParent = sendButton.parentElement;
                if (!insertParent || !insertParent.contains(sendButton)) {
                    reject(new Error('Send button is not in the target container'));
                    return;
                }

                // Force horizontal row so enhance button stays directly to the left of send
                insertParent.style.setProperty('display', 'flex', 'important');
                insertParent.style.setProperty('flex-direction', 'row', 'important');
                insertParent.style.setProperty('align-items', 'center', 'important');
                insertParent.style.setProperty('flex-wrap', 'nowrap', 'important');
                if (!insertParent.style.gap) insertParent.style.gap = '6px';

                // Insert before send button
                insertParent.insertBefore(enhancerDiv, sendButton);

                // Preload handler so first click doesn't wait for dynamic import
                import('../content.js').catch(() => {});

                // Verify and set up protection
                setTimeout(() => {
                    const injectedButton = document.getElementById('main-enhance-button');
                    if (injectedButton) {
                        this.setupButtonProtection(enhancerDiv, inputElement);
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

    /**
     * Creates the buttons container
     * @returns {HTMLElement} The container element
     */
    static createButtonsContainer() {
        const enhancerDiv = document.createElement('div');
        enhancerDiv.id = 'prompt-architect-buttons-container';
        enhancerDiv.className = 'flex items-center';
        enhancerDiv.style.setProperty('display', 'inline-flex', 'important');
        enhancerDiv.style.setProperty('align-items', 'center', 'important');
        enhancerDiv.style.setProperty('gap', '6px', 'important');
        enhancerDiv.style.setProperty('margin-right', '6px', 'important');
        enhancerDiv.style.setProperty('z-index', '999999', 'important');
        enhancerDiv.style.setProperty('visibility', 'visible', 'important');
        enhancerDiv.style.setProperty('opacity', '1', 'important');
        // Keep button in the same row as send button on all sites (no wrap, no shrink)
        enhancerDiv.style.setProperty('flex-shrink', '0', 'important');
        enhancerDiv.style.setProperty('position', 'relative', 'important');
        enhancerDiv.style.setProperty('align-self', 'center', 'important');
        return enhancerDiv;
    }

    /**
     * Creates the status area
     * @returns {HTMLElement} The status area element
     */
    static createStatusArea() {
        const statusArea = document.createElement('div');
        statusArea.id = 'prompt-architect-status-area';
        statusArea.style.cssText = `
            height: 36px; 
            display: none;
            align-items: center;
            width: 0;
            overflow: hidden;
        `;
        
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
        return statusArea;
    }

    /**
     * Creates the enhance button
     * @param {HTMLElement} inputElement - The input element
     * @param {HTMLElement} enhancerDiv - The container div
     * @param {Object} design - Design tokens
     * @returns {HTMLElement} The button element
     */
    static createEnhanceButton(inputElement, enhancerDiv, design = {}) {
        const defaultDesign = {
            primary: '#007AFF',
            primaryHover: '#0051D5',
            borderRadius: '6px',
            height: '32px',
            fontSize: '14px',
            fontWeight: '500'
        };
        
        const finalDesign = { ...defaultDesign, ...design };
        
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'main-enhance-button';
        // Detect platform for keyboard shortcut hint
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        button.title = isMac 
          ? 'Improve prompt with AI (Cmd+Shift+E)' 
          : 'Improve prompt with AI (Ctrl+Shift+E)';
        
        const size = 40;
        const hex = (finalDesign.primary || '#1a73e8').replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
        const glow = `rgba(${r},${g},${b},0.35)`;
        const glowHover = `rgba(${r},${g},${b},0.5)`;

        const sparkleSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg>`;
        const iconWrap = document.createElement('span');
        iconWrap.className = 'pa-enhance-button-icon';
        iconWrap.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;';
        iconWrap.innerHTML = sparkleSvg;
        button.appendChild(iconWrap);

        const spinner = document.createElement('span');
        spinner.id = 'pa-enhance-button-spinner';
        spinner.className = 'pa-enhance-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        spinner.style.cssText = 'position:absolute;inset:0;margin:auto;display:none;align-items:center;justify-content:center;width:20px;height:20px;pointer-events:none;border:2px solid rgba(255,255,255,0.35);border-top-color:white;border-radius:50%;animation:pa-spinner-rotate 0.7s linear infinite;';
        button.appendChild(spinner);

        if (!document.getElementById('pa-button-animations')) {
            const style = document.createElement('style');
            style.id = 'pa-button-animations';
            style.textContent = `
                @keyframes pa-spinner-rotate { to { transform: rotate(360deg); } }
                @keyframes pa-loading-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.75; transform: scale(0.96); } }
                @keyframes pa-success-pop { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 70% { transform: scale(0.98); } 100% { transform: scale(1); } }
            `;
            (document.head || document.documentElement).appendChild(style);
        }

        button.style.setProperty('position', 'relative', 'important');
        button.className = 'text-white text-sm';
        button.style.setProperty('width', size + 'px', 'important');
        button.style.setProperty('height', size + 'px', 'important');
        button.style.setProperty('padding', '0', 'important');
        button.style.setProperty('min-width', size + 'px', 'important');
        button.style.setProperty('background', finalDesign.primary, 'important');
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
        button.style.borderRadius = '50%';
        button.style.boxShadow = `0 2px 8px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.12) inset, 0 4px 16px ${glow}`;
        button.style.transition = 'box-shadow 0.25s ease, background 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1)';

        button.dataset.originalColor = finalDesign.primary;
        button.dataset.originalHover = finalDesign.primaryHover;

        button.onmouseenter = () => {
            button.style.background = finalDesign.primaryHover;
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = `0 6px 20px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.18) inset, 0 8px 24px ${glowHover}`;
        };
        button.onmouseleave = () => {
            button.style.background = finalDesign.primary;
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = `0 2px 8px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.12) inset, 0 4px 16px ${glow}`;
        };
        
        // Prevent form submission
        const parentForm = button.closest('form');
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
            // Immediate feedback so user doesn't feel delay before loading state
            button.disabled = true;
            button.style.cursor = 'wait';
            const iconEl = button.querySelector('.pa-enhance-button-icon');
            const spinnerEl = button.querySelector('.pa-enhance-spinner');
            if (iconEl) iconEl.style.display = 'none';
            if (spinnerEl) spinnerEl.style.display = 'flex';
            try {
                const { handleButtonClick } = await import('../content.js');
                await handleButtonClick(inputElement, 'TEXT_ENHANCEMENT', enhancerDiv);
            } catch (err) {
                if (typeof console !== 'undefined' && console.warn) console.warn('[Prompt Architect] Enhance click error:', err);
                button.disabled = false;
                button.style.cursor = '';
                if (iconEl) iconEl.style.display = '';
                if (spinnerEl) spinnerEl.style.display = 'none';
            }
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
     * Sets up MutationObserver to protect the button from removal
     * @param {HTMLElement} enhancerDiv - The container div
     * @param {HTMLElement} inputElement - The input element
     */
    static setupButtonProtection(enhancerDiv, inputElement) {
        // This will be implemented to match the existing protection logic
        // For now, we'll keep it simple and can enhance later
        const enforceVisibility = () => {
            const button = document.getElementById('main-enhance-button');
            const container = document.getElementById('prompt-architect-buttons-container');
            
            if (button) {
                button.style.setProperty('display', 'flex', 'important');
                button.style.setProperty('visibility', 'visible', 'important');
                button.style.setProperty('opacity', '1', 'important');
            }
            
            if (container) {
                container.style.setProperty('display', 'inline-flex', 'important');
                container.style.setProperty('visibility', 'visible', 'important');
                container.style.setProperty('opacity', '1', 'important');
            }
        };
        
        // Set up MutationObserver
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.removedNodes) {
                        if (node === enhancerDiv || (node.nodeType === 1 && node.contains && node.contains(enhancerDiv))) {
                            console.warn('[Prompt Architect] Button container was removed! Re-injecting...');
                            observer.disconnect();
                            setTimeout(() => {
                                if (inputElement && document.body.contains(inputElement)) {
                                    // Re-inject logic would go here
                                }
                            }, 100);
                            return;
                        }
                    }
                }
            }
            enforceVisibility();
        });
        
        if (enhancerDiv.parentElement) {
            observer.observe(enhancerDiv.parentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
        
        // Periodically enforce visibility
        const visibilityInterval = setInterval(() => {
            if (!document.body.contains(enhancerDiv)) {
                clearInterval(visibilityInterval);
                observer.disconnect();
                return;
            }
            enforceVisibility();
        }, 2000);
    }
}


