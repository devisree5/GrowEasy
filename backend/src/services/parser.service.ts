import fs from 'fs';
import csvParser from 'csv-parser';
import { logger } from '../utils/logger';

export interface CsvPreviewResult {
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
}

export class ParserService {
  /**
   * Fast line counter using stream to count rows without loading into memory.
   */
  async countRows(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      
      stream.on('data', (chunk: string) => {
        for (let i = 0; i < chunk.length; i++) {
          if (chunk[i] === '\n') {
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
        logger.error(`Error counting lines in ${filePath}`, err);
        reject(err);
      });
    });
  }

  /**
   * Parses the headers and the first N rows for preview and AI mapping.
   */
  async parsePreviewAndSample(filePath: string, sampleSize: number = 100): Promise<CsvPreviewResult> {
    const totalLines = await this.countRows(filePath);
    
    return new Promise((resolve, reject) => {
      const sampleRows: Record<string, string>[] = [];
      let headers: string[] = [];
      let headersParsed = false;
      
      const stream = fs.createReadStream(filePath)
        .pipe(csvParser());
        
      stream.on('headers', (hdrList: string[]) => {
        headers = hdrList.map(h => h.trim());
        headersParsed = true;
      });
      
      stream.on('data', (row: any) => {
        if (sampleRows.length < sampleSize) {
          // Trim whitespace from keys and values
          const cleanedRow: Record<string, string> = {};
          for (const key of Object.keys(row)) {
            const trimmedKey = key.trim();
            cleanedRow[trimmedKey] = (row[key] || '').trim();
          }
          sampleRows.push(cleanedRow);
        } else if (headersParsed && sampleRows.length >= sampleSize) {
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
        logger.error(`Error parsing CSV preview for ${filePath}`, err);
        reject(err);
      });
    });
  }
}
