"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const mapping_prompt_1 = require("../prompts/mapping.prompt");
class AiService {
    geminiClient;
    openaiClient;
    constructor() {
        this.initClients();
    }
    initClients() {
        if (config_1.config.geminiApiKey) {
            logger_1.logger.info('Initializing Google Gemini client...');
            try {
                this.geminiClient = new generative_ai_1.GoogleGenerativeAI(config_1.config.geminiApiKey);
            }
            catch (err) {
                logger_1.logger.error('Failed to initialize Gemini Client', err);
            }
        }
        if (config_1.config.openaiApiKey) {
            logger_1.logger.info('Initializing OpenAI client...');
            try {
                this.openaiClient = new openai_1.default({ apiKey: config_1.config.openaiApiKey });
            }
            catch (err) {
                logger_1.logger.error('Failed to initialize OpenAI Client', err);
            }
        }
    }
    /**
     * Helper to wait for a specific duration (exponential backoff)
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Query the selected AI provider to get the mapping schema.
     */
    async generateMappingSchema(headers, sampleRows, uniqueStatusValuesByColumn) {
        const maxRetries = 3;
        let attempt = 0;
        let baseDelay = 1000; // 1s
        const userPrompt = JSON.stringify({
            headers,
            sampleRows,
            uniqueStatusValuesByColumn,
        }, null, 2);
        while (attempt < maxRetries) {
            attempt++;
            try {
                logger_1.logger.info(`Analyzing CSV schema with AI (Attempt ${attempt}/${maxRetries})...`);
                let jsonText = '';
                if (config_1.config.geminiApiKey && this.geminiClient) {
                    jsonText = await this.callGemini(userPrompt);
                }
                else if (config_1.config.openaiApiKey && this.openaiClient) {
                    jsonText = await this.callOpenai(userPrompt);
                }
                else {
                    throw new Error('No LLM provider keys (Gemini or OpenAI) are configured in env.');
                }
                // Clean JSON text (sometimes models add markdown formatting despite instructions)
                const cleanedText = this.cleanJsonText(jsonText);
                const schema = JSON.parse(cleanedText);
                // Basic validation of the parsed schema
                if (!schema.mapped_fields || typeof schema.mapped_fields !== 'object') {
                    throw new Error('LLM response missing "mapped_fields" object.');
                }
                if (!schema.status_mapping || typeof schema.status_mapping !== 'object') {
                    throw new Error('LLM response missing "status_mapping" object.');
                }
                logger_1.logger.info('Successfully generated and validated mapping schema via LLM.');
                return schema;
            }
            catch (error) {
                logger_1.logger.warn(`AI schema generation attempt ${attempt} failed: ${error.message}`);
                if (attempt >= maxRetries) {
                    logger_1.logger.error('AI schema generation failed after max retries.');
                    throw error;
                }
                const waitTime = baseDelay * Math.pow(2, attempt);
                logger_1.logger.info(`Retrying in ${waitTime}ms...`);
                await this.delay(waitTime);
            }
        }
        throw new Error('AI Mapping Service encountered an unexpected error.');
    }
    async callGemini(userPrompt) {
        logger_1.logger.info('Calling Google Gemini (gemini-2.5-flash)...');
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized.');
        }
        const aiModel = this.geminiClient.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: mapping_prompt_1.GEMINI_RESPONSE_SCHEMA,
                temperature: 0.2,
            },
        });
        const prompt = `${mapping_prompt_1.MAPPING_SYSTEM_PROMPT}\n\n${mapping_prompt_1.MAPPING_DEVELOPER_PROMPT}\n\nCSV Data:\n${userPrompt}`;
        const result = await aiModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const responseText = result.response.text();
        if (!responseText) {
            throw new Error('Empty response received from Gemini.');
        }
        return responseText;
    }
    async callOpenai(userPrompt) {
        logger_1.logger.info('Calling OpenAI (gpt-4o-mini)...');
        if (!this.openaiClient)
            throw new Error('OpenAI client not initialized.');
        const prompt = `${mapping_prompt_1.MAPPING_DEVELOPER_PROMPT}\n\nCSV Data:\n${userPrompt}`;
        const completion = await this.openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: mapping_prompt_1.MAPPING_SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
        });
        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
            throw new Error('Empty response received from OpenAI.');
        }
        return responseText;
    }
    cleanJsonText(text) {
        let clean = text.trim();
        // Remove markdown codeblock syntax if present
        if (clean.startsWith('```json')) {
            clean = clean.substring(7);
        }
        else if (clean.startsWith('```')) {
            clean = clean.substring(3);
        }
        if (clean.endsWith('```')) {
            clean = clean.substring(0, clean.length - 3);
        }
        return clean.trim();
    }
}
exports.AiService = AiService;
