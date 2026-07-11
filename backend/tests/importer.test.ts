import { normalizeDate } from '../src/utils/date';
import { extractEmails, extractPhones, isValidEmail, isValidPhone } from '../src/utils/validation';
import { convertToCsv } from '../src/utils/csv-exporter';

describe('GrowEasy Importer Core Utilities', () => {
  
  describe('Date Normalization', () => {
    test('should parse standard YYYY/MM/DD', () => {
      const result = normalizeDate('2025/01/05');
      expect(result).not.toBeNull();
      const d = new Date(result!);
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(0); // Jan is 0
      expect(d.getDate()).toBe(5);
    });

    test('should parse ambiguous two digit years', () => {
      const result = normalizeDate('05-01-25', 'DD-MM-YYYY');
      expect(result).not.toBeNull();
      const d = new Date(result!);
      expect(d.getFullYear()).toBe(2025);
    });

    test('should parse word month names', () => {
      const result1 = normalizeDate('Jan 5 2025');
      const result2 = normalizeDate('5 January 2025');
      
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      const d1 = new Date(result1!);
      const d2 = new Date(result2!);
      expect(d1.getFullYear()).toBe(2025);
      expect(d2.getFullYear()).toBe(2025);
    });

    test('should parse dot separated dates', () => {
      const result = normalizeDate('2025.01.05');
      expect(result).not.toBeNull();
      const d = new Date(result!);
      expect(d.getFullYear()).toBe(2025);
    });

    test('should return null for invalid date formats', () => {
      expect(normalizeDate('not-a-date')).toBeNull();
      expect(normalizeDate('')).toBeNull();
    });
  });

  describe('Validation & Multi-value extraction', () => {
    test('extractEmails should retrieve all valid emails from text', () => {
      const text = 'Primary: abc@gmail.com, Secondary: xyz@gmail.com, Invalid: plain_text';
      const result = extractEmails(text);
      expect(result).toHaveLength(2);
      expect(result).toContain('abc@gmail.com');
      expect(result).toContain('xyz@gmail.com');
    });

    test('extractPhones should clean and extract valid phone numbers', () => {
      const text = 'Primary: +1 (234) 567-8901; Secondary: 9876543210';
      const result = extractPhones(text);
      expect(result).toHaveLength(2);
      expect(result).toContain('+12345678901');
      expect(result).toContain('9876543210');
    });

    test('isValidEmail and isValidPhone formatting rules', () => {
      expect(isValidEmail('test@groweasy.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);

      expect(isValidPhone('+12345678901')).toBe(true);
      expect(isValidPhone('12345')).toBe(false); // too short
    });
  });

  describe('CSV Exporter', () => {
    test('should serialize lists of records correctly', () => {
      const records = [
        { first_name: 'John', email: 'john@gmail.com', city: 'Dallas, TX' },
        { first_name: 'Jane', email: 'jane@gmail.com', city: 'Austin' }
      ];
      const csv = convertToCsv(records);
      expect(csv).toContain('first_name,email,city');
      expect(csv).toContain('John,john@gmail.com,"Dallas, TX"');
      expect(csv).toContain('Jane,jane@gmail.com,Austin');
    });
  });
});
