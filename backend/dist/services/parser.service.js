"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserService = void 0;
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const logger_1 = require("../utils/logger");
class ParserService {
    /**
     * Fast line counter using stream to count rows without loading into memory.
     */
    async countRows(filePath) {
        return new Promise((resolve, reject) => {
            let count = 0;
            const stream = fs_1.default.createReadStream(filePath, { encoding: 'utf8' });
            stream.on('data', (chunk) => {
                const text = chunk.toString();
                for (let i = 0; i < text.length; i++) {
                    if (text[i] === '\n') {
                        count++;
                    }
                }
            });
            stream.on('end', () => {
                // Adjust if last line doesn't end with a newline, but usually we just want total data records.
                // If the CSV has headers, total records will be count (which includes header row) - 1.
                // We will return the raw lines count first and adjust for headers in the service.
                resolve(count);
            });
            stream.on('error', (err) => {
                logger_1.logger.error(`Error counting lines in ${filePath}`, err);
                reject(err);
            });
        });
    }
    /**
     * Parses the headers and the first N rows for preview and AI mapping.
     */
    async parsePreviewAndSample(filePath, sampleSize = 100) {
        const totalLines = await this.countRows(filePath);
        return new Promise((resolve, reject) => {
            const sampleRows = [];
            let headers = [];
            let headersParsed = false;
            const stream = fs_1.default.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)());
            stream.on('headers', (hdrList) => {
                headers = hdrList.map(h => h.trim());
                headersParsed = true;
            });
            stream.on('data', (row) => {
                if (sampleRows.length < sampleSize) {
                    // Trim whitespace from keys and values
                    const cleanedRow = {};
                    for (const key of Object.keys(row)) {
                        const trimmedKey = key.trim();
                        cleanedRow[trimmedKey] = (row[key] || '').trim();
                    }
                    sampleRows.push(cleanedRow);
                }
                else if (headersParsed && sampleRows.length >= sampleSize) {
                    // If we gathered enough samples, we don't need to continue reading the rest of the stream.
                    // Destroy the stream to save resources.
                    stream.destroy();
                    // Adjust count: total lines minus header row (approximate)
                    // If file is empty, totalRows is 0
                    const totalRows = Math.max(0, totalLines - 1);
                    resolve({ headers, sampleRows, totalRows });
                }
            });
            stream.on('end', () => {
                const totalRows = Math.max(0, totalLines - 1);
                resolve({ headers, sampleRows, totalRows });
            });
            stream.on('error', (err) => {
                logger_1.logger.error(`Error parsing CSV preview for ${filePath}`, err);
                reject(err);
            });
        });
    }
}
exports.ParserService = ParserService;
