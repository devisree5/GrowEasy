import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config, validateConfig } from './config/config';
import { logger } from './utils/logger';
import { uploadCsv } from './controllers/upload.controller';
import { analyzeMapping, startImport, getImportPreview } from './controllers/import.controller';
import {
  getJobs,
  getJobStatus,
  getJobLeads,
  getJobFailed,
  downloadLeads,
  downloadFailed,
} from './controllers/job.controller';
import { jobRepository, leadRepository, failedRecordRepository } from './services';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// Validate config on startup
validateConfig();

// Setup Uploads Temp Dir
const uploadsTempDir = path.join(config.storageDir, 'temp');
if (!fs.existsSync(uploadsTempDir)) {
  fs.mkdirSync(uploadsTempDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsTempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// 1. CSV Upload
app.post('/api/upload', upload.single('file'), uploadCsv);

// 2. AI Mapping analysis
app.post('/api/import/:id/analyze', analyzeMapping);
app.get('/api/import/:id/preview', getImportPreview);

// 3. Start Lead processing
app.post('/api/import/:id/start', startImport);

// 4. Job Management & Stats
app.get('/api/jobs', getJobs);
app.get('/api/jobs/:id', getJobStatus);
app.get('/api/jobs/:id/leads', getJobLeads);
app.get('/api/jobs/:id/failed', getJobFailed);
app.delete('/api/jobs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await jobRepository.delete(id);
    if (!deleted) {
      res.status(404).json({ error: `Job with ID ${id} not found.` });
      return;
    }
    res.json({ message: 'Job deleted successfully.' });
  } catch (error) {
    next(error);
  }
});
app.patch('/api/jobs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = await jobRepository.update(id, updates);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});


// 5. Download Ends
app.get('/api/jobs/:id/download-leads', downloadLeads);
app.get('/api/jobs/:id/download-failed', downloadFailed);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    providerConfigured: {
      gemini: !!config.geminiApiKey,
      openai: !!config.openaiApiKey,
    },
  });
});

// Metrics Endpoint (System overview)
app.get('/metrics', async (req, res) => {
  try {
    const jobs = await jobRepository.findAll();
    const metrics = {
      totalJobs: jobs.length,
      jobsByStatus: {
        PENDING: jobs.filter(j => j.status === 'PENDING').length,
        ANALYZING: jobs.filter(j => j.status === 'ANALYZING').length,
        ANALYZED: jobs.filter(j => j.status === 'ANALYZED').length,
        PROCESSING: jobs.filter(j => j.status === 'PROCESSING').length,
        COMPLETED: jobs.filter(j => j.status === 'COMPLETED').length,
        FAILED: jobs.filter(j => j.status === 'FAILED').length,
      },
      totalRecordsProcessed: jobs.reduce((acc, j) => acc + j.processed_records, 0),
      totalSuccessfulLeads: jobs.reduce((acc, j) => acc + j.success_count, 0),
      totalFailedLeads: jobs.reduce((acc, j) => acc + j.failed_count, 0),
      totalSkippedLeads: jobs.reduce((acc, j) => acc + j.skipped_count, 0),
    };
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to compile metrics: ${err.message}` });
  }
});

// Error handling Middleware
app.use(errorHandler);

// Start Server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`GrowEasy CSV Importer Backend server running in [${config.env}] mode on port ${PORT}`);
});
