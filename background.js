/**
 * background.js
 * Handles the logic for prompt enhancement actions, now supporting mode-based
 * enhancement (Text, Code, Image) for the main button, and keeping the three
 * sub-actions (Enhance, Expand, Polish) for the context menu.
 */

// --- Constants ---
const STORAGE_KEYS = {
    gemini: 'userGeminiApiKey',
    openai: 'userOpenAIApiKey',
    anthropic: 'userAnthropicApiKey'
};
const STORAGE_PROVIDER = 'selectedProvider';

// API configurations for different providers
const API_CONFIGS = {
    gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
        model: 'gemini-2.0-flash',
        action: ':generateContent',
        storageKey: STORAGE_KEYS.gemini
    },
    openai: {
        baseUrl: 'https://api.openai.com/v1/',
        model: 'gpt-4',
        endpoint: 'chat/completions',
        storageKey: STORAGE_KEYS.openai
    },
    anthropic: {
        baseUrl: 'https://api.anthropic.com/v1/',
        model: 'claude-3-5-sonnet-20241022',
        endpoint: 'messages',
        storageKey: STORAGE_KEYS.anthropic
    }
};

// --- System Instructions for various modes/actions ---

const SYSTEM_INSTRUCTIONS = {
    // Primary modes for the single UI button
    TEXT_ENHANCEMENT: `You are an expert prompt engineer specializing in textual data models. Your task is to rewrite the user's text into a significantly more effective, detailed, and structured prompt. Focus on defining the model's role/persona, setting the tone, specifying the task clearly, and outlining the desired output format (e.g., table, bullet points, essay). Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    CODE_ENHANCEMENT: `You are an expert prompt engineer specializing in code generation models. Your task is to rewrite the user's text into a precise and comprehensive request for a code model. Focus on clearly defining the required programming language, specifying input parameters and expected output structure, and detailing any necessary functions, classes, or error handling. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    IMAGE_ENHANCEMENT: `You are an expert prompt engineer specializing in image generation models (like Midjourney or DALL-E). Your task is to rewrite the user's text into a hyper-detailed, descriptive visual brief. Focus on defining the artistic style (e.g., photorealistic, cinematic, oil painting), composition, perspective, lighting, and emotional mood. Use commas as separators for a strong descriptor list. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,

    // Secondary actions for the context menu
    ENHANCE: `You are an expert prompt engineer. Your task is to rewrite the user's text into a significantly more effective, detailed, and structured prompt suitable for a large language model. Focus on defining the role/persona, setting the tone, specifying the task clearly, and outlining the desired output format. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    EXPAND: `You are an idea generator and detailer. Your task is to take the user's concise text and elaborate on it. Expand the idea into a robust, multi-part request, adding contextual background, relevant examples, and necessary complexity or constraints. Crucially, your output MUST contain ONLY the expanded text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    POLISH: `You are a professional copyeditor. Your task is to review the user's text for grammatical errors, misspellings, and unclear syntax. Rewrite the text to be concise, professional, and unambiguous, structuring sentences for maximum clarity and impact. Preserve the original meaning. Crucially, your output MUST contain ONLY the clean, polished text itself. Do not include any introduction, explanation, or conversational filler.`,
};

// --- Helper Functions (Same as previous version, adapted for multiple modes) ---

/**
 * Retrieves the API key for the specified provider from chrome.storage.local.
 */
const getApiKey = (provider = 'gemini') => {
    return new Promise((resolve) => {
        const config = API_CONFIGS[provider];
        if (!config) {
            console.error(`Unknown provider: ${provider}`);
            resolve(null);
            return;
        }
        
        chrome.storage.local.get([config.storageKey, STORAGE_PROVIDER], (result) => {
            if (chrome.runtime.lastError) {
                console.error("Error retrieving API key in background:", chrome.runtime.lastError);
                resolve(null);
            } else {
                // Use provider from request, or fallback to stored provider, or default to gemini
                const selectedProvider = provider || result[STORAGE_PROVIDER] || 'gemini';
                const storageKey = API_CONFIGS[selectedProvider]?.storageKey;
                resolve(result[storageKey] || null);
            }
        });
    });
};

/**
 * Extracts the improved prompt text from API responses (supports multiple providers).
 */
const extractImprovedPrompt = (data, provider = 'gemini') => {
    try {
        if (data?.error) {
            const errorMsg = data.error.message || 'Unknown error';
            if (errorMsg.includes('API_KEY') || errorMsg.includes('key')) {
                return "Error: Invalid API key. Check your key in the Setup tab.";
            } else if (errorMsg.includes('quota') || errorMsg.includes('limit')) {
                return "Error: API quota exceeded. Try again later or check your API limits.";
            } else if (errorMsg.includes('safety') || errorMsg.includes('blocked')) {
                return "Error: Content was blocked. Try rephrasing your prompt.";
            }
            return `Error: ${errorMsg}`;
        }
        
        if (provider === 'gemini') {
            if (data?.promptFeedback?.blockReason) {
                return `Error: Content was blocked. Try rephrasing your prompt.`;
            }
            const candidate = data.candidates?.[0];
            if (candidate?.content?.parts?.[0]?.text) {
                return candidate.content.parts[0].text.trim();
            }
        } else if (provider === 'openai') {
            const choice = data.choices?.[0];
            if (choice?.message?.content) {
                return choice.message.content.trim();
            }
        } else if (provider === 'anthropic') {
            const content = data.content?.[0];
            if (content?.text) {
                return content.text.trim();
            }
        }
        
        console.warn(`Unexpected ${provider} response structure:`, data);
        return "Error: No response generated. Please try again.";
    } catch (e) {
        console.error(`Error processing ${provider} API response:`, e, data);
        return "Error: Failed to process the API response structure.";
    }
};

/**
 * Structures the request body for different API providers.
 */
const getRequestBody = (prompt, systemInstruction, provider = 'gemini') => {
    const fullInstruction = `${systemInstruction}\n\nUser's raw text:\n"${prompt}"\n\nImproved Output:`;

    if (provider === 'gemini') {
        return JSON.stringify({
            contents: [{
                parts: [{
                    text: fullInstruction
                }]
            }],
            generationConfig: {
                temperature: 0.6,
                maxOutputTokens: 800,
                topP: 0.9,
            }
        });
    } else if (provider === 'openai') {
        return JSON.stringify({
            model: API_CONFIGS.openai.model,
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: `User's raw text:\n"${prompt}"\n\nImproved Output:` }
            ],
            temperature: 0.6,
            max_tokens: 800
        });
    } else if (provider === 'anthropic') {
        return JSON.stringify({
            model: API_CONFIGS.anthropic.model,
            max_tokens: 800,
            system: systemInstruction,
            messages: [
                { role: 'user', content: `User's raw text:\n"${prompt}"\n\nImproved Output:` }
            ]
        });
    }
    
    return null;
};

/**
 * Core function to call the appropriate API from the background worker.
 * @param {string} enhancementType - The key from SYSTEM_INSTRUCTIONS.
 * @param {string} userText - The text selected by the user.
 * @param {string} provider - The API provider ('gemini', 'openai', 'anthropic').
 * @returns {Promise<string>} The enhanced prompt text or an error message.
 */
async function executeEnhancement(enhancementType, userText, provider = 'gemini') {
    const selectedProvider = provider || 'gemini';
    const apiKey = await getApiKey(selectedProvider);
    if (!apiKey) {
        const providerName = selectedProvider === 'gemini' ? 'Google AI' : 
                            selectedProvider === 'openai' ? 'OpenAI' : 'Anthropic';
        return `Error: ${providerName} API Key not found. Please set your key in the Setup tab.`;
    }
    
    const systemInstruction = SYSTEM_INSTRUCTIONS[enhancementType];
    if (!systemInstruction) {
        return `Error: Invalid enhancement type: ${enhancementType}.`;
    }

    const config = API_CONFIGS[selectedProvider];
    if (!config) {
        return `Error: Unknown provider: ${selectedProvider}`;
    }

    const requestBody = getRequestBody(userText, systemInstruction, selectedProvider);
    if (!requestBody) {
        return `Error: Failed to create request body for ${selectedProvider}`;
    }

    // Build API URL and headers based on provider
    let fullApiUrl;
    let requestHeaders = { 'Content-Type': 'application/json' };
    
    if (selectedProvider === 'gemini') {
        fullApiUrl = `${config.baseUrl}${config.model}${config.action}?key=${apiKey}`;
    } else if (selectedProvider === 'openai') {
        fullApiUrl = `${config.baseUrl}${config.endpoint}`;
        requestHeaders['Authorization'] = `Bearer ${apiKey}`;
    } else if (selectedProvider === 'anthropic') {
        fullApiUrl = `${config.baseUrl}${config.endpoint}`;
        requestHeaders['x-api-key'] = apiKey;
        requestHeaders['anthropic-version'] = '2023-06-01';
    }

    console.log(`[${enhancementType}] Calling ${selectedProvider.toUpperCase()} API...`);

    try {
        const response = await fetch(fullApiUrl, {
            method: 'POST',
            headers: requestHeaders,
            body: requestBody,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let errorMsg = `Connection failed (${response.status}).`;
            if (errorData && errorData.error && errorData.error.message) {
                const apiError = errorData.error.message;
                if (apiError.includes('API_KEY') || apiError.includes('key')) {
                    errorMsg = 'Invalid API key. Check your key in Setup tab.';
                } else if (apiError.includes('quota') || apiError.includes('limit')) {
                    errorMsg = 'API quota exceeded. Try again later.';
                } else {
                    errorMsg = apiError;
                }
            }
            throw new Error(`Error: ${errorMsg}`);
        }

        const data = await response.json();
        const improvedPrompt = extractImprovedPrompt(data, selectedProvider);
        return improvedPrompt;

    } catch (error) {
        console.error(`[${enhancementType}] API Call or Processing Error:`, error);
        return error.message || "Error: An unexpected network error occurred.";
    }
}

// --- Message Listener (Communication from content.js) ---
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'enhancePrompt') {
            const enhancementType = request.enhancementType || 'TEXT_ENHANCEMENT';
            const provider = request.provider || 'gemini';
            let promise = executeEnhancement(enhancementType, request.prompt, provider);

            // Handle the promise result and send back to the content script
            promise.then(result => {
                sendResponse({ enhancedPrompt: result });
            }).catch(error => {
                console.error("Error during enhancement processing:", error);
                sendResponse({ enhancedPrompt: `Error: Processing failed in background. (${error.message || 'Unknown error'})` });
            });

            // Return true to indicate that we will send an asynchronous response
            return true;
        }
    });

    // --- Context Menu Initialization (Existing logic maintained) ---
    // The three sub-enhancements (Enhance, Expand, Polish) remain available via right-click
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "ENHANCE",
            title: "✨ Architect: Enhance (General)",
            contexts: ["selection"]
        });

        chrome.contextMenus.create({
            id: "EXPAND",
            title: "📚 Architect: Expand Details",
            contexts: ["selection"]
        });

        chrome.contextMenus.create({
            id: "POLISH",
            title: "✅ Architect: Polish & Correct",
            contexts: ["selection"]
        });
    });


    // Handle clicks on the context menu items
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        const selectedText = info.selectionText;
        const enhancementType = info.menuItemId; // ID is now the enhancement type key
        
        // Use stored provider or default to gemini for context menu
        chrome.storage.local.get([STORAGE_PROVIDER], (result) => {
            const provider = result[STORAGE_PROVIDER] || 'gemini';
            const promise = executeEnhancement(enhancementType, selectedText, provider);

            // Send the result back to the content script via a message to update the input box
            promise.then(result => {
                chrome.tabs.sendMessage(tab.id, { 
                    action: "contextMenuResult", 
                    resultText: result,
                    originalText: selectedText
                });
            }).catch(error => {
                console.error("Context Menu Enhancement Failed:", error);
                chrome.tabs.sendMessage(tab.id, { 
                    action: "contextMenuResult", 
                    resultText: `Error: Failed to process context menu request. ${error.message}`,
                    originalText: selectedText 
                });
            });
        });
    });
}