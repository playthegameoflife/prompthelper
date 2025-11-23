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

                // Ensure container is flex
                const containerStyle = window.getComputedStyle(targetContainer);
                if (!containerStyle.display.includes('flex')) {
                    targetContainer.style.display = 'flex';
                    targetContainer.style.alignItems = 'center';
                    targetContainer.style.gap = '6px';
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
        
        // Add spin animation if not already present
        if (!document.getElementById('pa-spin-animation')) {
            const style = document.createElement('style');
            style.id = 'pa-spin-animation';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
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
        
        statusArea.appendChild(loadingSpinner);
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
        
        // Create button content container
        const buttonContent = document.createElement('div');
        buttonContent.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        
        const buttonText = document.createElement('span');
        buttonText.textContent = 'Improve';
        buttonContent.appendChild(buttonText);
        
        // Create mode icon (tiny icon on the button)
        const modeIcon = document.createElement('span');
        modeIcon.id = 'pa-mode-icon';
        modeIcon.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            font-size: 12px;
            cursor: pointer;
            border-radius: 3px;
            transition: background-color 0.2s;
            user-select: none;
        `;
        modeIcon.title = 'Click to change mode';
        
        // Define modes in order for cycling
        const modes = [
            { value: 'TEXT_ENHANCEMENT', icon: '📝' },
            { value: 'CODE_ENHANCEMENT', icon: '💻' },
            { value: 'IMAGE_ENHANCEMENT', icon: '🎨' },
            { value: 'VIDEO_ENHANCEMENT', icon: '🎬' }
        ];
        
        // Function to update icon based on current mode
        const updateModeIcon = (mode) => {
            const modeData = modes.find(m => m.value === mode);
            if (modeData) {
                modeIcon.textContent = modeData.icon;
            }
        };
        
        // Load current mode and set icon
        chrome.storage.local.get(['buttonEnhancementMode'], (result) => {
            const currentMode = result.buttonEnhancementMode || 'TEXT_ENHANCEMENT';
            updateModeIcon(currentMode);
        });
        
        // Hover effect for icon
        modeIcon.onmouseenter = () => {
            modeIcon.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        };
        modeIcon.onmouseleave = () => {
            modeIcon.style.backgroundColor = 'transparent';
        };
        
        buttonContent.appendChild(modeIcon);
        button.appendChild(buttonContent);
        
        // Cycle through modes on icon click
        modeIcon.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            chrome.storage.local.get(['buttonEnhancementMode'], (result) => {
                const currentMode = result.buttonEnhancementMode || 'TEXT_ENHANCEMENT';
                const currentIndex = modes.findIndex(m => m.value === currentMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                const nextMode = modes[nextIndex];
                
                chrome.storage.local.set({ buttonEnhancementMode: nextMode.value }, () => {
                    updateModeIcon(nextMode.value);
                });
            });
        };
        
        // Apply styling
        button.className = 'text-white font-semibold text-sm';
        button.style.setProperty('height', finalDesign.height, 'important');
        button.style.setProperty('padding', '0 14px', 'important');
        button.style.setProperty('background', finalDesign.primary, 'important');
        button.style.setProperty('border', 'none', 'important');
        button.style.setProperty('white-space', 'nowrap', 'important');
        button.style.setProperty('font-family', '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 'important');
        button.style.setProperty('font-size', finalDesign.fontSize, 'important');
        button.style.setProperty('font-weight', finalDesign.fontWeight, 'important');
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
        button.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
        button.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        button.style.borderRadius = finalDesign.borderRadius;
        
        // Store original colors
        button.dataset.originalColor = finalDesign.primary;
        button.dataset.originalHover = finalDesign.primaryHover;
        
        // Hover effect
        button.onmouseenter = () => {
            button.style.background = finalDesign.primaryHover;
            button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)';
        };
        
        button.onmouseleave = () => {
            button.style.background = finalDesign.primary;
            button.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
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
        
        // Button click handler - use stored button mode (no auto-detection)
        button.onclick = async (event) => {
            // Don't trigger if clicking the mode icon
            if (event.target === modeIcon || modeIcon.contains(event.target)) {
                return;
            }
            
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            
            // Get stored button mode
            chrome.storage.local.get(['buttonEnhancementMode'], async (result) => {
                const buttonMode = result.buttonEnhancementMode || 'TEXT_ENHANCEMENT';
                
                // Import and call handleButtonClick
                const { handleButtonClick } = await import('../content.js');
                handleButtonClick(inputElement, buttonMode, enhancerDiv);
            });
            
            return false;
        };
        
        button.onmousedown = (event) => {
            // Don't prevent default for mode icon clicks
            if (event.target === modeIcon || modeIcon.contains(event.target)) {
                return;
            }
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


