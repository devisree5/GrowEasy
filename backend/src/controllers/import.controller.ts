import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config';
import { jobRepository, aiService, importService, parserService } from '../services';
import { logger } from '../utils/logger';
import { MappingSchema } from '../types';

/**
 * Triggers the AI model to analyze headers and preview rows to suggest a mapping schema.
 */
export async function analyzeMapping(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const job = await jobRepository.findById(id);
    if (!job) {
      res.status(404).json({ error: `Job with ID ${id} not found.` });
      return;
    }

    const filePath = path.join(config.storageDir, 'uploads_processed', `${id}.csv`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `Processed CSV file for Job ID ${id} was not found on disk.` });
      return;
    }

    await jobRepository.update(id, { status: 'ANALYZING' });

    // Parse headers and sample rows to send to AI
    const preview = await parserService.parsePreviewAndSample(filePath, 100);

    // Extract potential status columns and their unique values to help the AI map statuses
    const uniqueStatusValuesByColumn: Record<string, string[]> = {};
    const statusKeywords = ['status', 'state', 'stage', 'outcome', 'progress'];

    // Scan headers and find columns that sound like a status
    const potentialStatusCols = preview.headers.filter(h =>
      statusKeywords.some(keyword => h.toLowerCase().includes(keyword))
    );

    // Collect up to 10 unique values for each potential status column
    for (const col of potentialStatusCols) {
      const vals = new Set<string>();
      for (const row of preview.sampleRows) {
        if (row[col]) {
          vals.add(row[col].trim());
        }
      }
      uniqueStatusValuesByColumn[col] = Array.from(vals).slice(0, 15);
    }

    // Call AI Service
    let schema: MappingSchema;
    try {
      schema = await aiService.generateMappingSchema(
        preview.headers,
        preview.sampleRows,
        uniqueStatusValuesByColumn
      );
    } catch (aiErr: any) {
      logger.error(`AI mapping failed for job ${id}`, aiErr);
      await jobRepository.update(id, { status: 'PENDING' }); // Reset back to PENDING so user can retry
      res.status(502).json({ error: `AI Mapping Engine Error: ${aiErr.message || aiErr}` });
      return;
    }

    await jobRepository.update(id, { status: 'ANALYZED', mapping_schema: schema });

    res.json({
      jobId: id,
      mappingSchema: schema,
    });
  } catch (error) {
    logger.error('Analyze mapping exception', error);
    next(error);
  }
}

/**
 * Triggers the actual batch parsing & import in the background.
 */
export async function startImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const mappingSchema = req.body as MappingSchema;

    // Validate request body
    if (!mappingSchema || !mappingSchema.mapped_fields) {
      res.status(400).json({ error: 'Missing mapping schema. Mapped fields are required.' });
      return;
    }

    const job = await jobRepository.findById(id);
    if (!job) {
      res.status(404).json({ error: `Job with ID ${id} not found.` });
      return;
    }

    const filePath = path.join(config.storageDir, 'uploads_processed', `${id}.csv`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `Processed CSV file for Job ID ${id} was not found on disk.` });
      return;
    }

    // Trigger processing asynchronously (DO NOT await this promise, let it run in background)
    importService
      .processJob(id, mappingSchema, filePath)
      .then(() => {
        logger.info(`Asynchronous CSV process completed for job: ${id}`);
        // Clean up the processed file once done to conserve disk space
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          logger.warn(`Failed to clean up CSV file ${filePath} after import`, err);
        }
      })
      .catch((err) => {
        logger.error(`Asynchronous CSV process failed for job: ${id}`, err);
      });

    res.json({
      message: 'Lead import processing has started in the background.',
      jobId: id,
      status: 'PROCESSING',
    });
  } catch (error) {
    logger.error('Start import controller exception', error);
    next(error);
  }
}

/**
 * Returns raw CSV preview (headers & first 100 rows).
 */
export async function getImportPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const job = await jobRepository.findById(id);
    if (!job) {
      res.status(404).json({ error: `Job with ID ${id} not found.` });
      return;
    }

    const filePath = path.join(config.storageDir, 'uploads_processed', `${id}.csv`);
    if (!fs.existsSync(filePath)) {
      if (job.status === 'COMPLETED' && job.mapping_schema) {
        res.json({
          headers: Object.keys(job.mapping_schema.mapped_fields),
          sampleRows: [],
          totalRows: job.total_records
        });
        return;
      }
      res.status(404).json({ error: `Processed CSV file for Job ID ${id} was not found on disk.` });
      return;
    }

    const preview = await parserService.parsePreviewAndSample(filePath, 100);
    res.json(preview);
  } catch (error) {
    logger.error('Get import preview exception', error);
    next(error);
  }
}

