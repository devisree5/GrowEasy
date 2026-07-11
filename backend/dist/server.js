"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("./config/config");
const logger_1 = require("./utils/logger");
const upload_controller_1 = require("./controllers/upload.controller");
const import_controller_1 = require("./controllers/import.controller");
const job_controller_1 = require("./controllers/job.controller");
const services_1 = require("./services");
const error_middleware_1 = require("./middleware/error.middleware");
const app = (0, express_1.default)();
// Validate config on startup
(0, config_1.validateConfig)();
// Setup Uploads Temp Dir
const uploadsTempDir = path_1.default.join(config_1.config.storageDir, 'temp');
if (!fs_1.default.existsSync(uploadsTempDir)) {
    fs_1.default.mkdirSync(uploadsTempDir, { recursive: true });
}
// Multer Config
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsTempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: config_1.config.maxFileSizeMb * 1024 * 1024,
    },
});
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
// 1. CSV Upload
app.post('/api/upload', upload.single('file'), upload_controller_1.uploadCsv);
// 2. AI Mapping analysis
app.post('/api/import/:id/analyze', import_controller_1.analyzeMapping);
app.get('/api/import/:id/preview', import_controller_1.getImportPreview);
// 3. Start Lead processing
app.post('/api/import/:id/start', import_controller_1.startImport);
// 4. Job Management & Stats
app.get('/api/jobs', job_controller_1.getJobs);
app.get('/api/jobs/:id', job_controller_1.getJobStatus);
app.get('/api/jobs/:id/leads', job_controller_1.getJobLeads);
app.get('/api/jobs/:id/failed', job_controller_1.getJobFailed);
app.delete('/api/jobs/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const deleted = await services_1.jobRepository.delete(id);
        if (!deleted) {
            res.status(404).json({ error: `Job with ID ${id} not found.` });
            return;
        }
        res.json({ message: 'Job deleted successfully.' });
    }
    catch (error) {
        next(error);
    }
});
app.patch('/api/jobs/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const updated = await services_1.jobRepository.update(id, updates);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
// 5. Download Ends
app.get('/api/jobs/:id/download-leads', job_controller_1.downloadLeads);
app.get('/api/jobs/:id/download-failed', job_controller_1.downloadFailed);
// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        providerConfigured: {
            gemini: !!config_1.config.geminiApiKey,
            openai: !!config_1.config.openaiApiKey,
        },
    });
});
// Metrics Endpoint (System overview)
app.get('/metrics', async (req, res) => {
    try {
        const jobs = await services_1.jobRepository.findAll();
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
    }
    catch (err) {
        res.status(500).json({ error: `Failed to compile metrics: ${err.message}` });
    }
});
// Error handling Middleware
app.use(error_middleware_1.errorHandler);
// Start Server
const PORT = config_1.config.port;
app.listen(PORT, () => {
    logger_1.logger.info(`GrowEasy CSV Importer Backend server running in [${config_1.config.env}] mode on port ${PORT}`);
});
