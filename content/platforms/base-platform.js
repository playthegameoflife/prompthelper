/**
 * base-platform.js
 * Base class for all platform implementations.
 * Contains shared logic to eliminate code duplication.
 */

import { findSendButton, findInput, findContainer } from '../core/element-finder.js';
import { extractTextFromElement, updateInputAndDispatch } from '../core/text-extractor.js';
import { InjectionManager } from '../core/injection-manager.js';

/**
 * Base class for platform-specific implementations
 */
export class BasePlatform {
    /**
     * @param {Object} config - Platform configuration
     * @param {string} config.name - Platform name
     * @param {Array<string>} config.inputSelectors - CSS selectors for input elements
     * @param {Array<string>} config.sendButtonSelectors - Platform-specific send button selectors
     * @param {Array<string>} config.containerSelectors - Optional container selectors
     * @param {Object} config.design - Design tokens (colors, styling)
     */
    constructor(config) {
        this.config = config;
        this.name = config.name;
        this.inputSelectors = config.inputSelectors || [];
        this.sendButtonSelectors = config.sendButtonSelectors || [];
        this.containerSelectors = config.containerSelectors || [];
        this.design = config.design || {};
    }

    /**
     * Finds the input element for this platform
     * @returns {HTMLElement|null} The input element
     */
    findInput() {
        return findInput(this.inputSelectors);
    }

    /**
     * Finds the send button for this platform
     * @param {HTMLElement} inputElement - The input element
     * @param {HTMLElement} container - Optional container
     * @returns {HTMLElement|null} The send button
     */
    findSendButton(inputElement, container = null) {
        return findSendButton(inputElement, container, this.sendButtonSelectors);
    }

    /**
     * Finds the container for injection
     * @param {HTMLElement} inputElement - The input element
     * @param {HTMLElement} sendButton - The send button
     * @returns {HTMLElement|null} The container
     */
    findContainer(inputElement, sendButton) {
        return findContainer(inputElement, sendButton, this.containerSelectors);
    }

    /**
     * Main injection method - can be overridden by platforms if needed
     * @param {HTMLElement} inputElement - The input element
     * @returns {Promise<void>}
     */
    async inject(inputElement) {
        if (!inputElement) {
            throw new Error(`${this.name} input element not found`);
        }

        // Find send button
        const sendButton = this.findSendButton(inputElement);
        if (!sendButton || !sendButton.parentElement) {
            throw new Error(`${this.name} send button not found`);
        }

        // Find container
        const container = this.findContainer(inputElement, sendButton);

        // Use injection manager to inject UI
        return InjectionManager.injectButtonNextToSend(
            inputElement,
            sendButton,
            container,
            this.design
        );
    }

    /**
     * Extracts text from the input element
     * @param {HTMLElement} element - The input element
     * @returns {string} The extracted text
     */
    extractText(element) {
        return extractTextFromElement(element);
    }

    /**
     * Updates the input with new text
     * @param {HTMLElement} element - The input element
     * @param {string} text - The text to set
     * @returns {Promise<boolean>} Success status
     */
    updateInput(element, text) {
        return updateInputAndDispatch(element, text);
    }
}









