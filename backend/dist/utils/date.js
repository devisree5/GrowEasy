"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDate = normalizeDate;
const logger_1 = require("./logger");
/**
 * Normalizes a date string into an ISO string.
 * Supports formats like:
 * - 2025/01/05
 * - 05-01-25
 * - Jan 5 2025
 * - 5 January 2025
 * - 01-05-2025
 * - 2025.01.05
 * Returns an ISO date string (YYYY-MM-DDTHH:mm:ss.sssZ) or null if invalid.
 */
function normalizeDate(dateStr, inferredFormat) {
    if (!dateStr)
        return null;
    const cleanStr = dateStr.trim();
    if (cleanStr === '')
        return null;
    // Try parsing directly using Javascript Date.
    // Standard formats like "Jan 5 2025", "5 January 2025", "2025/01/05" are natively parsed by new Date()
    let parsedDate = new Date(cleanStr);
    if (!isNaN(parsedDate.getTime())) {
        // If it's a valid date, let's make sure it parsed the year correctly (e.g. 25 -> 2025)
        let year = parsedDate.getFullYear();
        if (year < 100) {
            year += 2000;
            parsedDate.setFullYear(year);
        }
        return parsedDate.toISOString();
    }
    // Try replacing dots and spaces with dashes/slashes for standard parsing
    // E.g. "2025.01.05" -> "2025-01-05"
    const dottedDate = cleanStr.replace(/\./g, '-');
    parsedDate = new Date(dottedDate);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
    }
    // Handle common custom formats like "DD-MM-YYYY", "DD/MM/YYYY", "MM-DD-YYYY", "MM/DD/YYYY"
    // Let's parse components manually if we match digit patterns
    const match = cleanStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (match) {
        const part1 = parseInt(match[1], 10);
        const part2 = parseInt(match[2], 10);
        let year = parseInt(match[3], 10);
        if (year < 100) {
            year += 2000; // Assume 21st century
        }
        // How to disambiguate Day vs Month?
        // If inferredFormat suggests DD-MM-YYYY, or if part1 > 12 (must be day)
        let day = part1;
        let month = part2 - 1; // 0-indexed in JS
        if (inferredFormat && inferredFormat.toUpperCase().startsWith('MM')) {
            day = part2;
            month = part1 - 1;
        }
        else if (part1 > 12) {
            // Must be DD-MM-YYYY
            day = part1;
            month = part2 - 1;
        }
        else if (part2 > 12) {
            // Must be MM-DD-YYYY
            day = part2;
            month = part1 - 1;
        }
        const testDate = new Date(year, month, day);
        if (!isNaN(testDate.getTime())) {
            return testDate.toISOString();
        }
    }
    // Handle "YYYY-MM-DD" or similar if they have time
    try {
        const timestamp = Date.parse(cleanStr);
        if (!isNaN(timestamp)) {
            return new Date(timestamp).toISOString();
        }
    }
    catch (err) {
        logger_1.logger.debug(`Failed parsing date raw: ${cleanStr}`);
    }
    return null;
}
