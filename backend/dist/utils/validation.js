"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractEmails = extractEmails;
exports.extractPhones = extractPhones;
exports.isValidEmail = isValidEmail;
exports.isValidPhone = isValidPhone;
/**
 * Validates and extracts emails from a string.
 * Supports strings containing multiple emails separated by commas, semicolons, or spaces.
 */
function extractEmails(emailStr) {
    if (!emailStr)
        return [];
    // Split by common delimiters
    const parts = emailStr.split(/[,;\s]+/);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return parts
        .map(p => p.trim())
        .filter(p => emailRegex.test(p));
}
/**
 * Validates and extracts phone numbers from a string.
 * Supports strings containing multiple phone numbers separated by commas or semicolons.
 */
function extractPhones(phoneStr) {
    if (!phoneStr)
        return [];
    // Split by delimiters
    const parts = phoneStr.split(/[,;\n]+/);
    // Phone digits and optional leading plus: e.g. +1 (234) 567-8901 -> +12345678901
    const cleanPhone = (str) => {
        const isPlus = str.includes('+');
        const digits = str.replace(/\D/g, '');
        if (!digits)
            return '';
        return isPlus ? `+${digits}` : digits;
    };
    return parts
        .map(p => cleanPhone(p))
        .filter(p => p.length >= 7 && p.length <= 15); // standard international length range
}
/**
 * Validates email format.
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * Validates phone format.
 */
function isValidPhone(phone) {
    // Check if string contains only digits and optional leading '+'
    const phoneRegex = /^\+?[0-9]{7,15}$/;
    return phoneRegex.test(phone);
}
