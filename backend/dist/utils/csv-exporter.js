"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToCsv = convertToCsv;
/**
 * Utility to convert an array of objects to a CSV string.
 * Handles escaping quotes and special characters.
 */
function convertToCsv(data) {
    if (!data || data.length === 0) {
        return '';
    }
    // Extract all unique headers/keys
    const headers = Array.from(new Set(data.flatMap((item) => Object.keys(item))));
    const escapeValue = (val) => {
        if (val === undefined || val === null) {
            return '';
        }
        const str = String(val);
        // Replace inner double quotes with double-double quotes, escape everything inside double quotes if it contains comma, newline, or quote
        if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    const csvRows = [];
    // Header row
    csvRows.push(headers.map(h => escapeValue(h)).join(','));
    // Data rows
    for (const item of data) {
        const row = headers.map((header) => escapeValue(item[header]));
        csvRows.push(row.join(','));
    }
    return csvRows.join('\n');
}
