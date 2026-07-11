import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { parserService, jobRepository } from '../services';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export async function uploadCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded. Please upload a valid CSV file.' });
      return;
    }

    // Basic file type validation
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'Invalid file type. Only CSV files are supported.' });
      return;
    }

    const jobId = crypto.randomUUID();
    logger.info(`File uploaded successfully. Filename: ${file.originalname}, Size: ${file.size} bytes. Job ID created: ${jobId}`);

    // Parse preview and count lines
    let preview;
    try {
      preview = await parserService.parsePreviewAndSample(file.path, 100);
    } catch (parseErr: any) {
      fs.unlinkSync(file.path);
      logger.error('Failed to parse uploaded CSV preview', parseErr);
      res.status(400).json({ error: `Failed to parse CSV file: ${parseErr.message || parseErr}` });
      return;
    }

    // Keep track of the original file path within the job metadata.
    // We will save this file inside config.storageDir/uploads_processed/<jobId>.csv for processing.
    const uploadsDir = path.join(config.storageDir, 'uploads_processed');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const processedFilePath = path.join(uploadsDir, `${jobId}.csv`);
    fs.renameSync(file.path, processedFilePath);

    // Save job configuration
    const job = await jobRepository.create({
      id: jobId,
      filename: file.originalname,
      status: 'PENDING',
      total_records: preview.totalRows,
      processed_records: 0,
      success_count: 0,
      failed_count: 0,
      skipped_count: 0,
      created_at: new Date().toISOString(),
    });

    res.status(201).json({
      message: 'CSV file uploaded and parsed successfully.',
      jobId,
      filename: job.filename,
      headers: preview.headers,
      sampleRows: preview.sampleRows,
      totalRows: preview.totalRows,
    });
  } catch (error: any) {
    logger.error('Upload controller exception', error);
    next(error);
  }
}
