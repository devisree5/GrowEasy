import { Request, Response, NextFunction } from 'express';
import { jobRepository, leadRepository, failedRecordRepository } from '../services';
import { convertToCsv } from '../utils/csv-exporter';
import { logger } from '../utils/logger';

export async function getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobs = await jobRepository.findAll();
    // Sort jobs: newest first
    jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(jobs);
  } catch (error) {
    logger.error('Get jobs exception', error);
    next(error);
  }
}

export async function getJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const job = await jobRepository.findById(id);
    if (!job) {
      res.status(404).json({ error: `Job with ID ${id} not found.` });
      return;
    }
    res.json(job);
  } catch (error) {
    logger.error('Get job status exception', error);
    next(error);
  }
}

export async function getJobLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const job = await jobRepository.findById(id);
    if (!job) {
      res.status(404).json({ error: `Job with ID ${id} not found.` });
      return;
    }

    const leads = await leadRepository.findByJobId(id);
    res.json(leads);
  } catch (error) {
    logger.error('Get job leads exception', error);
    next(error);
  }
}

export async function getJobFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const job = await jobRepository.findById(id);
    if (!job) {
      res.status(404).json({ error: `Job with ID ${id} not found.` });
      return;
    }

    const failed = await failedRecordRepository.findByJobId(id);
    res.json(failed);
  } catch (error) {
    logger.error('Get job failed exception', error);
    next(error);
  }
}

export async function downloadLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const job = await jobRepository.findById(id);
    if (!job) {
      res.status(404).json({ error: `Job with ID ${id} not found.` });
      return;
    }

    const leads = await leadRepository.findByJobId(id);
    if (leads.length === 0) {
      res.status(400).json({ error: 'No successful leads to download for this job.' });
      return;
    }

    const csvContent = convertToCsv(leads);
    const safeFilename = `imported_leads_${job.filename.replace(/[^a-zA-Z0-9]/g, '_')}_${id.substring(0, 8)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.status(200).send(csvContent);
  } catch (error) {
    logger.error('Download leads exception', error);
    next(error);
  }
}

export async function downloadFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const job = await jobRepository.findById(id);
    if (!job) {
      res.status(404).json({ error: `Job with ID ${id} not found.` });
      return;
    }

    const failed = await failedRecordRepository.findByJobId(id);
    if (failed.length === 0) {
      res.status(400).json({ error: 'No failed records to download for this job.' });
      return;
    }

    // Flatten failed records to include error messages alongside original CSV data
    const flattenedFailed = failed.map((f) => ({
      'Row Number': f.row_number,
      'Validation Errors': f.errors.join(' | '),
      ...f.raw_data,
    }));

    const csvContent = convertToCsv(flattenedFailed);
    const safeFilename = `failed_records_${job.filename.replace(/[^a-zA-Z0-9]/g, '_')}_${id.substring(0, 8)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.status(200).send(csvContent);
  } catch (error) {
    logger.error('Download failed exception', error);
    next(error);
  }
}
