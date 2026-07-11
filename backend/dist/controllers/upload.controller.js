"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCsv = uploadCsv;
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const services_1 = require("../services");
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
async function uploadCsv(req, res, next) {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: 'No file uploaded. Please upload a valid CSV file.' });
            return;
        }
        // Basic file type validation
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (ext !== '.csv') {
            // Clean up uploaded file
            fs_1.default.unlinkSync(file.path);
            res.status(400).json({ error: 'Invalid file type. Only CSV files are supported.' });
            return;
        }
        const jobId = crypto_1.default.randomUUID();
        logger_1.logger.info(`File uploaded successfully. Filename: ${file.originalname}, Size: ${file.size} bytes. Job ID created: ${jobId}`);
        // Parse preview and count lines
        let preview;
        try {
            preview = await services_1.parserService.parsePreviewAndSample(file.path, 100);
        }
        catch (parseErr) {
            fs_1.default.unlinkSync(file.path);
            logger_1.logger.error('Failed to parse uploaded CSV preview', parseErr);
            res.status(400).json({ error: `Failed to parse CSV file: ${parseErr.message || parseErr}` });
            return;
        }
        // Keep track of the original file path within the job metadata.
        // We will save this file inside config.storageDir/uploads_processed/<jobId>.csv for processing.
        const uploadsDir = path_1.default.join(config_1.config.storageDir, 'uploads_processed');
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        const processedFilePath = path_1.default.join(uploadsDir, `${jobId}.csv`);
        fs_1.default.renameSync(file.path, processedFilePath);
        // Save job configuration
        const job = await services_1.jobRepository.create({
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
    }
    catch (error) {
        logger_1.logger.error('Upload controller exception', error);
        next(error);
    }
}
