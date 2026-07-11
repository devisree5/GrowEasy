/**
 * Validates and extracts emails from a string.
 * Supports strings containing multiple emails separated by commas, semicolons, or spaces.
 */
export function extractEmails(emailStr: string): string[] {
  if (!emailStr) return [];
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
export function extractPhones(phoneStr: string): string[] {
  if (!phoneStr) return [];
  // Split by delimiters
  const parts = phoneStr.split(/[,;\n]+/);
  // Phone digits and optional leading plus: e.g. +1 (234) 567-8901 -> +12345678901
  const cleanPhone = (str: string) => {
    const isPlus = str.includes('+');
    const digits = str.replace(/\D/g, '');
    if (!digits) return '';
    return isPlus ? `+${digits}` : digits;
  };

  return parts
    .map(p => cleanPhone(p))
    .filter(p => p.length >= 7 && p.length <= 15); // standard international length range
}

/**
 * Validates email format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates phone format.
 */
export function isValidPhone(phone: string): boolean {
  // Check if string contains only digits and optional leading '+'
  const phoneRegex = /^\+?[0-9]{7,15}$/;
  return phoneRegex.test(phone);
}
