import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export interface Config {
  port: number;
  env: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  maxFileSizeMb: number;
  storageDir: string;
}

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const config: Config = {
  port: getEnvNumber('PORT', 5000),
  env: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  openaiApiKey: process.env.OPENAI_API_KEY || undefined,
  maxFileSizeMb: getEnvNumber('MAX_FILE_SIZE_MB', 50),
  storageDir: path.resolve(process.env.STORAGE_DIR || './data'),
};

export const validateConfig = (): void => {
  if (!config.geminiApiKey && !config.openaiApiKey) {
    console.warn(
      'WARNING: Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured. AI mapping will fail.'
    );
  }
};
