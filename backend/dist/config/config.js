"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config();
const getEnvNumber = (key, defaultValue) => {
    const value = process.env[key];
    if (value === undefined)
        return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};
exports.config = {
    port: getEnvNumber('PORT', 5000),
    env: process.env.NODE_ENV || 'development',
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    maxFileSizeMb: getEnvNumber('MAX_FILE_SIZE_MB', 50),
    storageDir: path_1.default.resolve(process.env.STORAGE_DIR || './data'),
};
const validateConfig = () => {
    if (!exports.config.geminiApiKey && !exports.config.openaiApiKey) {
        console.warn('WARNING: Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured. AI mapping will fail.');
    }
};
exports.validateConfig = validateConfig;
