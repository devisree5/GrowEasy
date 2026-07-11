import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { MappingSchema } from '../../../shared/types';
import {
  MAPPING_SYSTEM_PROMPT,
  MAPPING_DEVELOPER_PROMPT,
  GEMINI_RESPONSE_SCHEMA,
} from '../prompts/mapping.prompt';

export class AiService {
  private geminiClient?: GoogleGenerativeAI;
  private openaiClient?: OpenAI;

  constructor() {
    this.initClients();
  }

  private initClients(): void {
    if (config.geminiApiKey) {
      logger.info('Initializing Google Gemini client...');
      try {
        this.geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
      } catch (err) {
        logger.error('Failed to initialize Gemini Client', err);
      }
    }
    
    if (config.openaiApiKey) {
      logger.info('Initializing OpenAI client...');
      try {
        this.openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
      } catch (err) {
        logger.error('Failed to initialize OpenAI Client', err);
      }
    }
  }

  /**
   * Helper to wait for a specific duration (exponential backoff)
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Query the selected AI provider to get the mapping schema.
   */
  async generateMappingSchema(
    headers: string[],
    sampleRows: Record<string, string>[],
    uniqueStatusValuesByColumn: Record<string, string[]>
  ): Promise<MappingSchema> {
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
        logger.info(`Analyzing CSV schema with AI (Attempt ${attempt}/${maxRetries})...`);
        
        let jsonText = '';

        if (config.geminiApiKey && this.geminiClient) {
          jsonText = await this.callGemini(userPrompt);
        } else if (config.openaiApiKey && this.openaiClient) {
          jsonText = await this.callOpenai(userPrompt);
        } else {
          throw new Error('No LLM provider keys (Gemini or OpenAI) are configured in env.');
        }

        // Clean JSON text (sometimes models add markdown formatting despite instructions)
        const cleanedText = this.cleanJsonText(jsonText);
        const schema = JSON.parse(cleanedText) as MappingSchema;
        
        // Basic validation of the parsed schema
        if (!schema.mapped_fields || typeof schema.mapped_fields !== 'object') {
          throw new Error('LLM response missing "mapped_fields" object.');
        }
        if (!schema.status_mapping || typeof schema.status_mapping !== 'object') {
          throw new Error('LLM response missing "status_mapping" object.');
        }
        
        logger.info('Successfully generated and validated mapping schema via LLM.');
        return schema;

      } catch (error: any) {
        logger.warn(`AI schema generation attempt ${attempt} failed: ${error.message}`);
        if (attempt >= maxRetries) {
          logger.error('AI schema generation failed after max retries.');
          throw error;
        }
        const waitTime = baseDelay * Math.pow(2, attempt);
        logger.info(`Retrying in ${waitTime}ms...`);
        await this.delay(waitTime);
      }
    }

    throw new Error('AI Mapping Service encountered an unexpected error.');
  }

  private async callGemini(userPrompt: string): Promise<string> {
    logger.info('Calling Google Gemini (gemini-2.5-flash)...');
    const aiModel = this.geminiClient.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    const prompt = `${MAPPING_SYSTEM_PROMPT}\n\n${MAPPING_DEVELOPER_PROMPT}\n\nCSV Data:\n${userPrompt}`;
    const result = await aiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Empty response received from Gemini.');
    }
    return responseText;
  }

  private async callOpenai(userPrompt: string): Promise<string> {
    logger.info('Calling OpenAI (gpt-4o-mini)...');
    if (!this.openaiClient) throw new Error('OpenAI client not initialized.');

    const prompt = `${MAPPING_DEVELOPER_PROMPT}\n\nCSV Data:\n${userPrompt}`;

    const completion = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: MAPPING_SYSTEM_PROMPT },
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

  private cleanJsonText(text: string): string {
    let clean = text.trim();
    // Remove markdown codeblock syntax if present
    if (clean.startsWith('```json')) {
      clean = clean.substring(7);
    } else if (clean.startsWith('```')) {
      clean = clean.substring(3);
    }
    if (clean.endsWith('```')) {
      clean = clean.substring(0, clean.length - 3);
    }
    return clean.trim();
  }
}
