/**
 * background.js
 * Handles the logic for prompt enhancement actions, now supporting mode-based
 * enhancement (Text, Code, Image) for the main button, and keeping the three
 * sub-actions (Enhance, Expand, Polish) for the context menu.
 */

// --- Constants ---

// Debug mode flag - set to false for production
const DEBUG_MODE = false; // Set to true for debugging

// Debug logging utility
const debug = {
    log: (...args) => {
        if (DEBUG_MODE) console.log('[Prompt Architect]', ...args);
    },
    warn: (...args) => {
        if (DEBUG_MODE) console.warn('[Prompt Architect]', ...args);
    },
    error: (...args) => {
        // Always log errors, even in production
        console.error('[Prompt Architect]', ...args);
    }
};
const STORAGE_KEYS = {
    gemini: 'userGeminiApiKey',
    openai: 'userOpenAIApiKey',
    anthropic: 'userAnthropicApiKey'
};
const STORAGE_PROVIDER = 'selectedProvider';
const STORAGE_PROMPT_HISTORY = 'promptHistory';
const MAX_HISTORY_ITEMS = 50;

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Structured error class for better error handling
 */
class EnhancementError extends Error {
    constructor(message, code, recoverable = false, userMessage = null) {
        super(message);
        this.name = 'EnhancementError';
        this.code = code;
        this.recoverable = recoverable;
        this.userMessage = userMessage || message;
    }
}

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES = {
    API_KEY_INVALID: "Your API key appears invalid. Please check it in the Setup tab.",
    API_KEY_MISSING: "API key not found. Please set your API key in the Setup tab first.",
    QUOTA_EXCEEDED: "You've hit your API limit. Try again in a few minutes or check your API usage.",
    NETWORK_ERROR: "Connection failed. Check your internet connection and try again.",
    CONTENT_BLOCKED: "Content was blocked by the AI provider. Try rephrasing your prompt.",
    INVALID_ENHANCEMENT_TYPE: "Invalid enhancement type. Please try again.",
    UNKNOWN_PROVIDER: "Unknown AI provider. Please select a valid provider.",
    TIMEOUT: "Request timed out. The API is taking too long to respond. Please try again.",
    UNEXPECTED_ERROR: "An unexpected error occurred. Please try again.",
};

/**
 * Maps API error codes to user-friendly messages
 */
function getUserFriendlyError(error, provider) {
    const errorMsg = (error.message || error || '').toLowerCase();
    
    if (errorMsg.includes('api_key') || errorMsg.includes('key') || errorMsg.includes('401') || errorMsg.includes('403')) {
        return new EnhancementError(
            ERROR_MESSAGES.API_KEY_INVALID,
            'API_KEY_INVALID',
            true,
            ERROR_MESSAGES.API_KEY_INVALID
        );
    }
    
    if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('429')) {
        return new EnhancementError(
            ERROR_MESSAGES.QUOTA_EXCEEDED,
            'QUOTA_EXCEEDED',
            true,
            ERROR_MESSAGES.QUOTA_EXCEEDED
        );
    }
    
    if (errorMsg.includes('safety') || errorMsg.includes('blocked') || errorMsg.includes('content policy')) {
        return new EnhancementError(
            ERROR_MESSAGES.CONTENT_BLOCKED,
            'CONTENT_BLOCKED',
            true,
            ERROR_MESSAGES.CONTENT_BLOCKED
        );
    }
    
    if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection')) {
        return new EnhancementError(
            ERROR_MESSAGES.NETWORK_ERROR,
            'NETWORK_ERROR',
            true,
            ERROR_MESSAGES.NETWORK_ERROR
        );
    }
    
    if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
        return new EnhancementError(
            ERROR_MESSAGES.TIMEOUT,
            'TIMEOUT',
            true,
            ERROR_MESSAGES.TIMEOUT
        );
    }
    
    return new EnhancementError(
        error.message || ERROR_MESSAGES.UNEXPECTED_ERROR,
        'UNEXPECTED_ERROR',
        false,
        ERROR_MESSAGES.UNEXPECTED_ERROR
    );
}

// ============================================================================
// API REQUEST DEDUPLICATION & CACHING
// ============================================================================

/** Map to track pending requests - prevents duplicate API calls */
const pendingRequests = new Map();

/** Cache for identical prompts (1 hour TTL) */
const promptCache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// ============================================================================
// RATE LIMITING
// ============================================================================

/** Rate limiter to prevent API abuse */
class RateLimiter {
    constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = [];
    }
    
    async waitIfNeeded() {
        const now = Date.now();
        // Remove requests outside the time window
        this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
        
        // If we've hit the limit, wait until the oldest request expires
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (now - oldestRequest);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
                // Clean up again after waiting
                const newNow = Date.now();
                this.requests = this.requests.filter(timestamp => newNow - timestamp < this.windowMs);
            }
        }
        
        // Record this request
        this.requests.push(Date.now());
    }
}

// 10 requests per minute (60000ms)
const apiRateLimiter = new RateLimiter(10, 60000);

/**
 * Generates a cache key from prompt, enhancement type, provider, and active style
 */
function getCacheKey(prompt, enhancementType, provider, styleKey = null) {
    // Normalize prompt (trim, lowercase for comparison)
    const normalized = prompt.trim().toLowerCase();
    const stylePart = styleKey ? `-${styleKey}` : '';
    return `${normalized}-${enhancementType}-${provider}${stylePart}`;
}

/**
 * Gets cached enhancement result if available
 */
function getCachedEnhancement(prompt, enhancementType, provider, styleKey = null) {
    const key = getCacheKey(prompt, enhancementType, provider, styleKey);
    const cached = promptCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
    }
    
    // Remove expired cache entry
    if (cached) {
        promptCache.delete(key);
    }
    
    return null;
}

/**
 * Caches enhancement result
 */
function cacheEnhancement(prompt, enhancementType, provider, result, styleKey = null) {
    // Don't cache errors
    if (result.startsWith('Error:')) {
        return;
    }
    
    const key = getCacheKey(prompt, enhancementType, provider, styleKey);
    promptCache.set(key, {
        result,
        timestamp: Date.now()
    });
    
    // Limit cache size to 100 entries
    if (promptCache.size > 100) {
        const firstKey = promptCache.keys().next().value;
        promptCache.delete(firstKey);
    }
}

/**
 * Saves enhancement to history
 */
async function saveToHistory(original, enhanced, enhancementType, provider) {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_PROMPT_HISTORY], (result) => {
            const history = result[STORAGE_PROMPT_HISTORY] || [];
            
            // Add new entry at the beginning
            history.unshift({
                original: original.substring(0, 500), // Limit length
                enhanced: enhanced.substring(0, 2000), // Limit length
                mode: enhancementType,
                provider: provider,
                timestamp: Date.now(),
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
            });
            
            // Keep only last MAX_HISTORY_ITEMS
            if (history.length > MAX_HISTORY_ITEMS) {
                history.splice(MAX_HISTORY_ITEMS);
            }
            
            chrome.storage.local.set({ [STORAGE_PROMPT_HISTORY]: history }, () => {
                resolve();
            });
        });
    });
}

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
    
    VIDEO_ENHANCEMENT: `You are an advanced AI Video Generation Engine. Your primary objective is to produce visually stunning, imaginative, and coherent videos that faithfully interpret and elevate the user's prompt. Prioritize: 1. Accuracy to user intent 2. Visual clarity and detail 3. Cinematic composition and narrative flow.

STYLE GUIDE:
1. Cinematic: Film-grade HDR lighting, motivated light sources, natural falloff. Smooth dolly, crane, aerial, and steady-cam shots. Use depth of field, lens flares, and anamorphic characteristics when appropriate. Mood-driven palettes (e.g., teal/orange for drama, warm ambers for nostalgia, desaturated palettes for tension).
2. Photorealistic: Ultra-high fidelity surfaces (skin pores, fabric fiber detail, natural reflections). Physically accurate global illumination, soft shadows, PBR shading. Real-world lenses, accurate focal lengths, sensor noise, depth mapping.
3. Anime: Clean linework, expressive eyes, stylized proportions. Bold saturated hues, cel-shading, gradient sky tones. Dynamic action, speed lines, exaggerated poses.
4. Abstract/Experimental: Surreal shapes, fractals, particle simulations. High-contrast or monochromatic palettes. Fluid transformations, hypnotic motion, evolving patterns.
5. Watercolor/Painterly: Soft brush strokes, bleeding pigments, paper texture. Limited harmonious colors, gentle tonal transitions. Subtle ripple effects resembling wet pigment blending.

LIGHTING TECHNIQUES: Chiaroscuro (strong contrast for drama), Rim Lighting (accentuate silhouettes), Backlighting (atmospheric depth), Volumetric Lighting (light rays, fog, atmospheric scattering).

CAMERA ANGLES & MOTION: Wide establishing shots, extreme close-ups for emotional emphasis, POV perspectives, tracking shots, push-ins, tilt-ups. Smooth transitions unless user specifies abrupt edits.

QUALITY PARAMETERS: Default 4K (3840×2160) unless user specifies otherwise. Frame Rate: 24-30 fps for cinematic; up to 60 fps for action or stylized content. Detail Priority: Clarity > complexity. Motion Stability: Reduce jitter; ensure smooth temporal consistency. Color & Exposure: Balanced dynamic range, avoid clipped highlights or crushed shadows.

CONTEXTUAL UNDERSTANDING: Interpret user prompts using hierarchy: Explicit instructions > Implied mood > Genre conventions. Fill gaps thoughtfully with coherent environmental details that support the theme. Maintain user's tone (whimsical, dark, epic, etc.). Resolve ambiguity by choosing the least risky, most aesthetically coherent option.

When prompts are ambiguous or contradictory: Provide the closest feasible interpretation. Preserve user's intent while simplifying physics or animation. If scale is impractical, stylize or metaphorically represent it.

Your task is to rewrite the user's text into a comprehensive video generation prompt that incorporates these principles. The enhanced prompt should specify camera movement, lighting, visual style, motion, scene details, and technical quality while maintaining the user's original intent and mood.

Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,

    // Secondary actions for the context menu
    ENHANCE: `You are an expert prompt engineer. Your task is to rewrite the user's text into a significantly more effective, detailed, and structured prompt suitable for a large language model. Focus on defining the role/persona, setting the tone, specifying the task clearly, and outlining the desired output format. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    EXPAND: `You are an idea generator and detailer. Your task is to take the user's concise text and elaborate on it. Expand the idea into a robust, multi-part request, adding contextual background, relevant examples, and necessary complexity or constraints. Crucially, your output MUST contain ONLY the expanded text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    POLISH: `You are a professional copyeditor. Your task is to review the user's text for grammatical errors, misspellings, and unclear syntax. Rewrite the text to be concise, professional, and unambiguous, structuring sentences for maximum clarity and impact. Preserve the original meaning. Crucially, your output MUST contain ONLY the clean, polished text itself. Do not include any introduction, explanation, or conversational filler.`,
    
    // Ask feature - direct question answering
    ASK_QUESTION: `You are a helpful and knowledgeable assistant. Answer the user's question directly, clearly, and comprehensively. Provide accurate information and be concise yet thorough. If the question is unclear, ask for clarification. Your response should be the direct answer to their question, formatted clearly and naturally.`,
};

// Instruction Templates - Preset variations for each mode
const INSTRUCTION_TEMPLATES = {
    TEXT_ENHANCEMENT: {
        'default': SYSTEM_INSTRUCTIONS.TEXT_ENHANCEMENT,
        'concise': `You are an expert prompt engineer. Rewrite the user's text into a clear, concise, and effective prompt. Focus on brevity while maintaining clarity. Remove unnecessary words. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'detailed': `You are an expert prompt engineer specializing in comprehensive prompt design. Rewrite the user's text into a highly detailed, structured prompt with explicit instructions, examples, constraints, and output format specifications. Include role definition, tone, context, and expected structure. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'creative': `You are an expert prompt engineer specializing in creative writing prompts. Rewrite the user's text into an inspiring, imaginative prompt that encourages creative expression. Focus on evocative language, mood, and narrative elements. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'technical': `You are an expert prompt engineer specializing in technical documentation. Rewrite the user's text into a precise, structured technical prompt with clear specifications, parameters, and requirements. Focus on accuracy, completeness, and technical precision. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    },
    CODE_ENHANCEMENT: {
        'default': SYSTEM_INSTRUCTIONS.CODE_ENHANCEMENT,
        'minimal': `You are an expert prompt engineer for code generation. Rewrite the user's text into a concise code request. Focus on essential requirements only. Specify language and key functions. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'comprehensive': `You are an expert prompt engineer for code generation. Rewrite the user's text into a comprehensive code specification including: programming language, input/output types, error handling, edge cases, performance requirements, code style, and testing approach. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'production-ready': `You are an expert prompt engineer specializing in production-grade code. Rewrite the user's text into a detailed specification for production-ready code including: language, architecture, error handling, logging, security considerations, scalability, documentation requirements, and testing strategy. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    },
    IMAGE_ENHANCEMENT: {
        'default': SYSTEM_INSTRUCTIONS.IMAGE_ENHANCEMENT,
        'minimal': `You are an expert prompt engineer for image generation. Rewrite the user's text into a concise visual description focusing on key visual elements: subject, style, and mood. Use comma-separated descriptors. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'detailed': `You are an expert prompt engineer for image generation. Rewrite the user's text into a hyper-detailed visual brief including: artistic style, composition, perspective, lighting, color palette, mood, textures, fine details, and technical specifications. Use comma-separated descriptors. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'cinematic': `You are an expert prompt engineer specializing in cinematic image generation. Rewrite the user's text into a film-grade visual description with camera angles, lighting setup, depth of field, color grading, and atmospheric details. Focus on cinematic composition and mood. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
    },
    VIDEO_ENHANCEMENT: {
        'default': SYSTEM_INSTRUCTIONS.VIDEO_ENHANCEMENT,
        'concise': `You are an expert prompt engineer for video generation. Rewrite the user's text into a clear video prompt specifying: subject, style, camera movement, and duration. Keep it focused and actionable. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'cinematic': `You are an expert prompt engineer specializing in cinematic video generation. Rewrite the user's text into a film-grade video specification with detailed camera work, lighting, color grading, motion, transitions, and narrative flow. Focus on cinematic quality and storytelling. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
        'ad': `You are an expert prompt engineer specializing in commercial advertisement video generation. Rewrite the user's text into a structured, high-energy commercial video prompt following this format:

Structure the output as a JSON object with these fields:
- "title": A compelling, brand-focused title
- "description": A cinematic, detailed scene description that captures the transformation and energy
- "style": Comma-separated style descriptors that match the user's intent and brand aesthetic
- "camera": Camera movement and framing description
- "lighting": Lighting transitions and color palette appropriate to the scene
- "environment": Setting description and how it evolves
- "elements": Array of key visual elements in the scene
- "motion": Description of continuous motion and transformations
- "ending": Final frame composition
- "text": "none" (unless text overlay is needed)
- "keywords": Array of relevant keywords for the brand/product

The prompt should be high-energy, visually stunning, and emphasize transformation, spectacle, and brand presence. Focus on creating a seamless, cinematic commercial experience. Match the style, setting, and aesthetic to the user's input - do not impose specific themes like "futuristic" or "city" unless the user's prompt explicitly mentions them.

Crucially, your output MUST contain ONLY the improved prompt text itself (as a JSON object). Do not include any introduction, explanation, or conversational filler.`,
    },
};

// Storage keys for custom instructions and named styles
const STORAGE_CUSTOM_INSTRUCTIONS = 'customInstructions'; // Legacy - for backward compatibility
const STORAGE_NAMED_CUSTOM_STYLES = 'namedCustomStyles'; // New: { mode: { "Style Name": "instruction" } }
const STORAGE_ACTIVE_STYLE = 'activeStyle'; // { mode: "styleName" or "template:name" or "default" }

/**
 * Retrieves custom instruction for a given enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @returns {Promise<string|null>} Custom instruction or null if not set
 */
async function getCustomInstruction(enhancementType) {
    try {
        const result = await chrome.storage.local.get(STORAGE_CUSTOM_INSTRUCTIONS);
        const customInstructions = result[STORAGE_CUSTOM_INSTRUCTIONS] || {};
        return customInstructions[enhancementType] || null;
    } catch (error) {
        console.error('[Prompt Architect] Error retrieving custom instruction:', error);
        return null;
    }
}

/**
 * Gets available templates for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @returns {Object} Object with template names and instructions
 */
function getTemplatesForType(enhancementType) {
    const templates = INSTRUCTION_TEMPLATES[enhancementType] || {};
    
    // Add named custom styles for this mode
    return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_NAMED_CUSTOM_STYLES, (result) => {
            const namedStyles = result[STORAGE_NAMED_CUSTOM_STYLES] || {};
            const modeStyles = namedStyles[enhancementType] || {};
            
            // Merge templates with custom styles
            const allTemplates = { ...templates };
            for (const [name, instruction] of Object.entries(modeStyles)) {
                allTemplates[`custom:${name}`] = instruction;
            }
            
            resolve(allTemplates);
        });
    });
}

/**
 * Saves a custom instruction for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @param {string} instruction - The custom instruction text
 * @returns {Promise<void>}
 */
async function saveCustomInstruction(enhancementType, instruction) {
    try {
        const result = await chrome.storage.local.get(STORAGE_CUSTOM_INSTRUCTIONS);
        const customInstructions = result[STORAGE_CUSTOM_INSTRUCTIONS] || {};
        customInstructions[enhancementType] = instruction;
        await chrome.storage.local.set({ [STORAGE_CUSTOM_INSTRUCTIONS]: customInstructions });
    } catch (error) {
        console.error('[Prompt Architect] Error saving custom instruction:', error);
        throw error;
    }
}

/**
 * Deletes a custom instruction for an enhancement type (resets to default)
 * @param {string} enhancementType - The enhancement type key
 * @returns {Promise<void>}
 */
async function deleteCustomInstruction(enhancementType) {
    try {
        const result = await chrome.storage.local.get(STORAGE_CUSTOM_INSTRUCTIONS);
        const customInstructions = result[STORAGE_CUSTOM_INSTRUCTIONS] || {};
        delete customInstructions[enhancementType];
        await chrome.storage.local.set({ [STORAGE_CUSTOM_INSTRUCTIONS]: customInstructions });
        
        // Also clear active style
        const activeResult = await chrome.storage.local.get(STORAGE_ACTIVE_STYLE);
        const activeStyles = activeResult[STORAGE_ACTIVE_STYLE] || {};
        delete activeStyles[enhancementType];
        await chrome.storage.local.set({ [STORAGE_ACTIVE_STYLE]: activeStyles });
    } catch (error) {
        console.error('[Prompt Architect] Error deleting custom instruction:', error);
        throw error;
    }
}

/**
 * Saves a named custom style for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @param {string} styleName - The name of the custom style
 * @param {string} instruction - The custom instruction text
 * @returns {Promise<void>}
 */
async function saveNamedCustomStyle(enhancementType, styleName, instruction) {
    // Validate inputs
    if (!enhancementType || !styleName || !instruction) {
        throw new Error('Missing required parameters: enhancementType, styleName, or instruction');
    }
    
    if (typeof styleName !== 'string' || styleName.trim().length === 0) {
        throw new Error('Style name must be a non-empty string');
    }
    
    if (typeof instruction !== 'string' || instruction.trim().length === 0) {
        throw new Error('Instruction must be a non-empty string');
    }
    
    try {
        const result = await chrome.storage.local.get(STORAGE_NAMED_CUSTOM_STYLES);
        const namedStyles = result[STORAGE_NAMED_CUSTOM_STYLES] || {};
        
        if (!namedStyles[enhancementType]) {
            namedStyles[enhancementType] = {};
        }
        
        const wasEdit = !!namedStyles[enhancementType][styleName];
        namedStyles[enhancementType][styleName] = instruction.trim();
        
        await chrome.storage.local.set({ [STORAGE_NAMED_CUSTOM_STYLES]: namedStyles });
        
        return { wasEdit };
    } catch (error) {
        console.error('[Prompt Architect] Error saving named custom style:', error);
        throw error;
    }
}

/**
 * Gets all named custom styles for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @returns {Promise<Object>} Object with style names and instructions
 */
async function getNamedCustomStyles(enhancementType) {
    try {
        const result = await chrome.storage.local.get(STORAGE_NAMED_CUSTOM_STYLES);
        const namedStyles = result[STORAGE_NAMED_CUSTOM_STYLES] || {};
        return namedStyles[enhancementType] || {};
    } catch (error) {
        console.error('[Prompt Architect] Error retrieving named custom styles:', error);
        return {};
    }
}

/**
 * Deletes a named custom style
 * @param {string} enhancementType - The enhancement type key
 * @param {string} styleName - The name of the style to delete
 * @returns {Promise<void>}
 */
async function deleteNamedCustomStyle(enhancementType, styleName) {
    try {
        const result = await chrome.storage.local.get(STORAGE_NAMED_CUSTOM_STYLES);
        const namedStyles = result[STORAGE_NAMED_CUSTOM_STYLES] || {};
        
        if (namedStyles[enhancementType]) {
            delete namedStyles[enhancementType][styleName];
            await chrome.storage.local.set({ [STORAGE_NAMED_CUSTOM_STYLES]: namedStyles });
        }
        
        // If this was the active style, clear it
        const activeResult = await chrome.storage.local.get(STORAGE_ACTIVE_STYLE);
        const activeStyles = activeResult[STORAGE_ACTIVE_STYLE] || {};
        if (activeStyles[enhancementType] === `custom:${styleName}`) {
            delete activeStyles[enhancementType];
            await chrome.storage.local.set({ [STORAGE_ACTIVE_STYLE]: activeStyles });
        }
    } catch (error) {
        console.error('[Prompt Architect] Error deleting named custom style:', error);
        throw error;
    }
}

/**
 * Sets the active style for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @param {string} styleKey - The style key (e.g., "default", "template:concise", "custom:My Style")
 * @returns {Promise<void>}
 */
async function setActiveStyle(enhancementType, styleKey) {
    try {
        const result = await chrome.storage.local.get(STORAGE_ACTIVE_STYLE);
        const activeStyles = result[STORAGE_ACTIVE_STYLE] || {};
        activeStyles[enhancementType] = styleKey;
        await chrome.storage.local.set({ [STORAGE_ACTIVE_STYLE]: activeStyles });
    } catch (error) {
        console.error('[Prompt Architect] Error setting active style:', error);
        throw error;
    }
}

/**
 * Gets the active style for an enhancement type
 * @param {string} enhancementType - The enhancement type key
 * @returns {Promise<string|null>} The active style key or null
 */
async function getActiveStyle(enhancementType) {
    try {
        const result = await chrome.storage.local.get(STORAGE_ACTIVE_STYLE);
        const activeStyles = result[STORAGE_ACTIVE_STYLE] || {};
        const styleKey = activeStyles[enhancementType] || null;
        if (styleKey) {
            debug.log(`Active style for ${enhancementType}: ${styleKey}`);
        }
        return styleKey;
    } catch (error) {
        console.error('[Prompt Architect] Error getting active style:', error);
        return null;
    }
}

// --- Helper Functions (Same as previous version, adapted for multiple modes) ---

/**
 * Retrieves the API key for the specified provider from chrome.storage.local.
 */
const getApiKey = (provider = 'gemini') => {
    return new Promise((resolve) => {
        const config = API_CONFIGS[provider];
        if (!config) {
            debug.error(`Unknown provider: ${provider}`);
            resolve(null);
            return;
        }
        
        chrome.storage.local.get([config.storageKey, STORAGE_PROVIDER], (result) => {
            if (chrome.runtime.lastError) {
                debug.error("Error retrieving API key in background:", chrome.runtime.lastError);
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
        // Check for error structure first
        if (data?.error) {
            const errorMsg = (data.error.message || data.error || 'Unknown error').toString().toLowerCase();
            debug.warn('API returned error:', errorMsg);
            if (errorMsg.includes('api_key') || errorMsg.includes('key') || errorMsg.includes('authentication')) {
                return "Error: Invalid API key. Check your key in the Setup tab.";
            } else if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('429') || errorMsg.includes('rate')) {
                return "Error: API quota exceeded. Try again later or check your API limits.";
            } else if (errorMsg.includes('safety') || errorMsg.includes('blocked') || errorMsg.includes('content policy')) {
                return "Error: Content was blocked. Try rephrasing your prompt.";
            }
            return `Error: ${data.error.message || data.error || 'Unknown error'}`;
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
        
        debug.warn(`Unexpected ${provider} response structure:`, data);
        return "Error: No response generated. Please try again.";
    } catch (e) {
        debug.error(`Error processing ${provider} API response:`, e, data);
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
                maxOutputTokens: 8000,
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
            max_tokens: 8000
        });
    } else if (provider === 'anthropic') {
        return JSON.stringify({
            model: API_CONFIGS.anthropic.model,
            max_tokens: 8000,
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
 * Now includes request deduplication and caching.
 * @param {string} enhancementType - The key from SYSTEM_INSTRUCTIONS.
 * @param {string} userText - The text selected by the user.
 * @param {string} provider - The API provider ('gemini', 'openai', 'anthropic').
 * @param {boolean} forceDefaultStyle - If true, always use default style (ignores activeStyle). Used by injected button.
 * @returns {Promise<string>} The enhanced prompt text or an error message.
 */
async function executeEnhancement(enhancementType, userText, provider = 'gemini', forceDefaultStyle = false) {
    const selectedProvider = provider || 'gemini';
    
    // Get active style key first
    // If forceDefaultStyle is true, always use 'default' (injected button always uses default)
    const activeStyleKey = forceDefaultStyle ? null : await getActiveStyle(enhancementType);
    const styleKeyForCache = forceDefaultStyle ? 'default' : (activeStyleKey || 'default');
    
    // Caching disabled - always make fresh API calls
    // const cached = getCachedEnhancement(userText, enhancementType, selectedProvider, styleKeyForCache);
    // if (cached) {
    //     debug.log('Returning cached result');
    //     return cached;
    // }
    
    // Make each request unique by adding timestamp - ensures fresh API calls even for same prompt
    const timestamp = Date.now();
    const requestKey = `${userText}-${enhancementType}-${selectedProvider}-${styleKeyForCache}-${timestamp}`;
    // Disabled duplicate request prevention to allow fresh responses for same prompts
    // if (pendingRequests.has(requestKey)) {
    //     debug.log('Duplicate request detected, returning existing promise');
    //     return pendingRequests.get(requestKey);
    // }
    
    // Create the enhancement promise
    const enhancementPromise = (async () => {
        try {
            const apiKey = await getApiKey(selectedProvider);
            if (!apiKey) {
                const providerName = selectedProvider === 'gemini' ? 'Google AI' : 
                                    selectedProvider === 'openai' ? 'OpenAI' : 'Anthropic';
                throw new EnhancementError(
                    ERROR_MESSAGES.API_KEY_MISSING,
                    'API_KEY_MISSING',
                    true,
                    `${providerName} API Key not found. Please set your key in the Setup tab.`
                );
            }
            
            // Check for active style first, then fall back to legacy custom instruction, then default
            // If forceDefaultStyle is true, skip all style lookups and go straight to default
            let systemInstruction = null;
            
            if (!forceDefaultStyle) {
                // Popup mode: Use active style if set
                if (activeStyleKey) {
                    if (activeStyleKey === 'default') {
                        systemInstruction = SYSTEM_INSTRUCTIONS[enhancementType];
                    } else if (activeStyleKey.startsWith('template:')) {
                        const templateKey = activeStyleKey.replace('template:', '');
                        const templates = INSTRUCTION_TEMPLATES[enhancementType] || {};
                        systemInstruction = templates[templateKey] || SYSTEM_INSTRUCTIONS[enhancementType];
                    } else if (activeStyleKey.startsWith('custom:')) {
                        const styleName = activeStyleKey.replace('custom:', '');
                        const namedStyles = await getNamedCustomStyles(enhancementType);
                        systemInstruction = namedStyles[styleName] || null;
                        if (!systemInstruction) {
                            debug.warn(`Custom style "${styleName}" not found for ${enhancementType}, falling back to default`);
                        } else {
                            debug.log(`Using custom style "${styleName}" for ${enhancementType}`);
                        }
                    }
                }
                
                // Fallback to legacy custom instruction
                if (!systemInstruction) {
                    systemInstruction = await getCustomInstruction(enhancementType);
                }
            }
            
            // Final fallback to default (always used for injected button, or if no style found for popup)
            if (!systemInstruction) {
                systemInstruction = SYSTEM_INSTRUCTIONS[enhancementType];
            }
            
            if (!systemInstruction) {
                throw new EnhancementError(
                    ERROR_MESSAGES.INVALID_ENHANCEMENT_TYPE,
                    'INVALID_ENHANCEMENT_TYPE',
                    false,
                    `Invalid enhancement type: ${enhancementType}.`
                );
            }

            const config = API_CONFIGS[selectedProvider];
            if (!config) {
                throw new EnhancementError(
                    ERROR_MESSAGES.UNKNOWN_PROVIDER,
                    'UNKNOWN_PROVIDER',
                    false,
                    `Unknown provider: ${selectedProvider}`
                );
            }

            const requestBody = getRequestBody(userText, systemInstruction, selectedProvider);
            if (!requestBody) {
                throw new EnhancementError(
                    ERROR_MESSAGES.UNEXPECTED_ERROR,
                    'REQUEST_BODY_FAILED',
                    false,
                    `Failed to create request body for ${selectedProvider}`
                );
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
            } else {
                throw new EnhancementError(
                    ERROR_MESSAGES.UNKNOWN_PROVIDER,
                    'UNSUPPORTED_PROVIDER',
                    false,
                    `Unsupported provider: ${selectedProvider}`
                );
            }

            // Validate URL was constructed
            if (!fullApiUrl) {
                throw new EnhancementError(
                    ERROR_MESSAGES.UNEXPECTED_ERROR,
                    'URL_CONSTRUCTION_FAILED',
                    false,
                    `Failed to construct API URL for ${selectedProvider}`
                );
            }

            // Apply rate limiting
            await apiRateLimiter.waitIfNeeded();
            
            // Set up timeout (30 seconds)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 30000); // 30 second timeout
            
            let response;
            try {
                response = await fetch(fullApiUrl, {
                    method: 'POST',
                    headers: requestHeaders,
                    body: requestBody,
                    signal: controller.signal
                });
            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    throw new EnhancementError(
                        'Request timed out after 30 seconds. Please try again.',
                        'TIMEOUT',
                        true,
                        'Request timed out. The API is taking too long to respond. Please try again.'
                    );
                }
                throw error;
            }
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData?.error?.message || `Connection failed (${response.status}).`);
                throw getUserFriendlyError(error, selectedProvider);
            }

            const data = await response.json();
            const improvedPrompt = extractImprovedPrompt(data, selectedProvider);
            
            // Cache successful results (now includes style in key)
            if (!improvedPrompt.startsWith('Error:')) {
                // Caching disabled - don't cache results
                // cacheEnhancement(userText, enhancementType, selectedProvider, improvedPrompt, styleKeyForCache);
                
                // Save to history
                saveToHistory(userText, improvedPrompt, enhancementType, selectedProvider);
            }
            
            return improvedPrompt;

        } catch (error) {
            debug.error(`[${enhancementType}] API Call or Processing Error:`, error);
            
            // Return user-friendly error message
            if (error instanceof EnhancementError) {
                return `Error: ${error.userMessage}`;
            }
            
            const friendlyError = getUserFriendlyError(error, selectedProvider);
            return `Error: ${friendlyError.userMessage}`;
        } finally {
            // Remove from pending requests
            pendingRequests.delete(requestKey);
        }
    })();
    
    // Store pending request
    pendingRequests.set(requestKey, enhancementPromise);
    
    return enhancementPromise;
}

/**
 * Executes a question-answering request (Ask feature)
 * @param {string} question - The user's question
 * @param {string} provider - The API provider ('gemini', 'openai', 'anthropic')
 * @returns {Promise<string>} The answer text or an error message
 */
async function executeAskQuestion(question, provider = 'gemini') {
    const selectedProvider = provider || 'gemini';
    
    // Caching disabled - always make fresh API calls for unique responses
    // const cached = getCachedEnhancement(question, 'ASK_QUESTION', selectedProvider);
    // if (cached) {
    //     debug.log('Returning cached answer');
    //     return cached;
    // }
    
    // Make each request unique by adding timestamp - ensures fresh API calls even for same question
    const timestamp = Date.now();
    const requestKey = `${question}-ASK_QUESTION-${selectedProvider}-${timestamp}`;
    // Disabled duplicate request prevention to allow fresh responses for same questions
    // if (pendingRequests.has(requestKey)) {
    //     debug.log('Duplicate question request detected, returning existing promise');
    //     return pendingRequests.get(requestKey);
    // }
    
    // Create the question-answering promise
    const questionPromise = (async () => {
        try {
            const apiKey = await getApiKey(selectedProvider);
            if (!apiKey) {
                const providerName = selectedProvider === 'gemini' ? 'Google AI' : 
                                    selectedProvider === 'openai' ? 'OpenAI' : 'Anthropic';
                throw new EnhancementError(
                    ERROR_MESSAGES.API_KEY_MISSING,
                    'API_KEY_MISSING',
                    true,
                    `${providerName} API Key not found. Please set your key in the Setup tab.`
                );
            }
            
            // Use ASK_QUESTION system instruction
            const systemInstruction = SYSTEM_INSTRUCTIONS.ASK_QUESTION;
            
            // Get provider configuration
            const config = API_CONFIGS[selectedProvider];
            if (!config) {
                throw new EnhancementError(
                    ERROR_MESSAGES.UNKNOWN_PROVIDER,
                    'UNKNOWN_PROVIDER',
                    false,
                    `Unsupported provider: ${selectedProvider}`
                );
            }
            
            // Build request body for Ask (different format than enhancement)
            let requestBody;
            if (selectedProvider === 'gemini') {
                requestBody = JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `${systemInstruction}\n\nQuestion: ${question}\n\nAnswer:`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8000,
                        topP: 0.9,
                    }
                });
            } else if (selectedProvider === 'openai') {
                requestBody = JSON.stringify({
                    model: API_CONFIGS.openai.model,
                    messages: [
                        { role: 'system', content: systemInstruction },
                        { role: 'user', content: question }
                    ],
                    temperature: 0.7,
                    max_tokens: 8000
                });
            } else if (selectedProvider === 'anthropic') {
                requestBody = JSON.stringify({
                    model: API_CONFIGS.anthropic.model,
                    max_tokens: 8000,
                    system: systemInstruction,
                    messages: [
                        { role: 'user', content: question }
                    ]
                });
            } else {
                throw new EnhancementError(
                    ERROR_MESSAGES.UNKNOWN_PROVIDER,
                    'UNSUPPORTED_PROVIDER',
                    false,
                    `Unsupported provider: ${selectedProvider}`
                );
            }
            
            // Build API URL and headers
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
            } else {
                throw new EnhancementError(
                    ERROR_MESSAGES.UNKNOWN_PROVIDER,
                    'UNSUPPORTED_PROVIDER',
                    false,
                    `Unsupported provider: ${selectedProvider}`
                );
            }
            
            // Apply rate limiting
            await apiRateLimiter.waitIfNeeded();
            
            // Make API request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            try {
                const response = await fetch(fullApiUrl, {
                    method: 'POST',
                    headers: requestHeaders,
                    body: requestBody,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('[Prompt Architect] Ask API error response:', {
                        status: response.status,
                        statusText: response.statusText,
                        errorData: errorData
                    });
                    const errorMessage = errorData?.error?.message || errorData?.message || `Connection failed (${response.status}).`;
                    const error = new Error(errorMessage);
                    throw getUserFriendlyError(error, selectedProvider);
                }
                
                const data = await response.json();
                debug.log('Ask API response data:', data);
                const answer = extractImprovedPrompt(data, selectedProvider);
                debug.log('Extracted answer (first 100 chars):', answer.substring(0, 100));
                
                // Cache successful results
                if (!answer.startsWith('Error:')) {
                    // Caching disabled - don't cache results
                    // cacheEnhancement(question, 'ASK_QUESTION', selectedProvider, answer, 'ask');
                    
                    // Save to history (questions history)
                    saveToHistory(question, answer, 'ASK_QUESTION', selectedProvider);
                }
                
                return answer;
            } catch (fetchError) {
                clearTimeout(timeoutId);
                console.error('[Prompt Architect] Fetch error in executeAskQuestion:', fetchError);
                if (fetchError.name === 'AbortError') {
                    throw new EnhancementError(
                        ERROR_MESSAGES.TIMEOUT,
                        'TIMEOUT',
                        true,
                        ERROR_MESSAGES.TIMEOUT
                    );
                }
                throw fetchError;
            }
        } catch (error) {
            console.error("[Prompt Architect] Error in executeAskQuestion:", error);
            
            if (error instanceof EnhancementError) {
                return error.userMessage;
            }
            
            const friendlyError = getUserFriendlyError(error, selectedProvider);
            return `Error: ${friendlyError.userMessage}`;
        } finally {
            // Remove from pending requests
            pendingRequests.delete(requestKey);
        }
    })();
    
    // Store pending request
    pendingRequests.set(requestKey, questionPromise);
    
    return questionPromise;
}

// --- Message Listener (Communication from content.js) ---
if (typeof chrome !== 'undefined' && chrome.runtime) {
    // Handle template and custom instruction requests
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // Log for debugging
        debug.log('Received message:', request.action);
        
        if (request.action === 'getTemplates') {
            getTemplatesForType(request.enhancementType)
                .then(templates => {
                    sendResponse({ success: true, templates });
                })
                .catch(error => {
                    console.error('[Prompt Architect] Error in getTemplates:', error);
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Keep channel open for async response
        }
        
        if (request.action === 'saveNamedCustomStyle') {
            // Validate request
            if (!request.enhancementType || !request.styleName || !request.instruction) {
                const errorMsg = 'Missing required fields: enhancementType, styleName, or instruction';
                console.error('[Prompt Architect]', errorMsg, request);
                sendResponse({ 
                    success: false, 
                    error: errorMsg
                });
                return true;
            }
            
            debug.log('Saving named custom style:', {
                enhancementType: request.enhancementType,
                styleName: request.styleName,
                instructionLength: request.instruction.length
            });
            
            saveNamedCustomStyle(request.enhancementType, request.styleName, request.instruction)
                .then(result => {
                    debug.log('Style saved successfully:', result);
                    try {
                        sendResponse({ success: true, ...(result || {}) });
                    } catch (e) {
                        console.error('[Prompt Architect] Error sending response:', e);
                        // Try to send error response
                        try {
                            sendResponse({ success: false, error: 'Failed to send response' });
                        } catch (e2) {
                            console.error('[Prompt Architect] Failed to send error response:', e2);
                        }
                    }
                })
                .catch(error => {
                    console.error('[Prompt Architect] Error saving named custom style:', error);
                    try {
                        sendResponse({ 
                            success: false, 
                            error: error?.message || 'Unknown error saving style' 
                        });
                    } catch (e) {
                        console.error('[Prompt Architect] Error sending error response:', e);
                    }
                });
            return true; // Keep channel open for async response
        }
        
        if (request.action === 'getNamedCustomStyles') {
            getNamedCustomStyles(request.enhancementType)
                .then(styles => sendResponse({ success: true, styles }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'deleteNamedCustomStyle') {
            deleteNamedCustomStyle(request.enhancementType, request.styleName)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'setActiveStyle') {
            setActiveStyle(request.enhancementType, request.styleKey)
                .then(() => {
                    debug.log(`Active style set: ${request.enhancementType} -> ${request.styleKey}`);
                    sendResponse({ success: true });
                })
                .catch(error => {
                    debug.warn(`Error setting active style: ${error.message}`);
                    sendResponse({ success: false, error: error.message });
                });
            return true;
        }
        
        if (request.action === 'getActiveStyle') {
            getActiveStyle(request.enhancementType)
                .then(styleKey => sendResponse({ success: true, styleKey }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'saveCustomInstruction') {
            saveCustomInstruction(request.enhancementType, request.instruction)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'getCustomInstruction') {
            getCustomInstruction(request.enhancementType)
                .then(instruction => sendResponse({ success: true, instruction }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'deleteCustomInstruction') {
            deleteCustomInstruction(request.enhancementType)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'enhancePrompt') {
            const enhancementType = request.enhancementType || 'TEXT_ENHANCEMENT';
            const provider = request.provider || 'gemini';
            const forceDefaultStyle = request.forceDefaultStyle || false; // Injected button always uses default
            let promise = executeEnhancement(enhancementType, request.prompt, provider, forceDefaultStyle);

            // Handle the promise result and send back to the content script
            promise.then(result => {
                sendResponse({ enhancedPrompt: result });
            }).catch(error => {
                debug.error("Error during enhancement processing:", error);
                sendResponse({ enhancedPrompt: `Error: Processing failed in background. (${error.message || 'Unknown error'})` });
            });

            // Return true to indicate that we will send an asynchronous response
            return true;
        }
        
        if (request.action === 'askQuestion') {
            const provider = request.provider || 'gemini';
            let promise = executeAskQuestion(request.question, provider);

            // Handle the promise result and send back
            promise.then(result => {
                sendResponse({ answer: result });
            }).catch(error => {
                debug.error("Error during question processing:", error);
                sendResponse({ answer: `Error: Processing failed in background. (${error.message || 'Unknown error'})` });
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
            title: "Architect: Enhance (General)",
            contexts: ["selection"]
        });

        chrome.contextMenus.create({
            id: "EXPAND",
            title: "Architect: Expand Details",
            contexts: ["selection"]
        });

        chrome.contextMenus.create({
            id: "POLISH",
            title: "Architect: Polish & Correct",
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
                debug.error("Context Menu Enhancement Failed:", error);
                chrome.tabs.sendMessage(tab.id, { 
                    action: "contextMenuResult", 
                    resultText: `Error: Failed to process context menu request. ${error.message}`,
                    originalText: selectedText 
                });
            });
        });
    });
    
    // --- Keyboard Shortcut Handler ---
    chrome.commands.onCommand.addListener((command) => {
        if (command === 'enhance-prompt') {
            // Get the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    // Send message to content script to trigger enhancement
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'enhance-prompt-shortcut'
                    }).catch(err => {
                        // Tab might not have content script loaded yet, or not on supported page
                        debug.log('Keyboard shortcut: Tab not ready or unsupported page');
                    });
                }
            });
        }
    });
}