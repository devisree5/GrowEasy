"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeMapping = analyzeMapping;
exports.startImport = startImport;
exports.getImportPreview = getImportPreview;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config/config");
const services_1 = require("../services");
const logger_1 = require("../utils/logger");
/**
 * Triggers the AI model to analyze headers and preview rows to suggest a mapping schema.
 */
async function analyzeMapping(req, res, next) {
    try {
        const { id } = req.params;
        const job = await services_1.jobRepository.findById(id);
        if (!job) {
            res.status(404).json({ error: `Job with ID ${id} not found.` });
            return;
        }
        const filePath = path_1.default.join(config_1.config.storageDir, 'uploads_processed', `${id}.csv`);
        if (!fs_1.default.existsSync(filePath)) {
            res.status(404).json({ error: `Processed CSV file for Job ID ${id} was not found on disk.` });
            return;
        }
        await services_1.jobRepository.update(id, { status: 'ANALYZING' });
        // Parse headers and sample rows to send to AI
        const preview = await services_1.parserService.parsePreviewAndSample(filePath, 100);
        // Extract potential status columns and their unique values to help the AI map statuses
        const uniqueStatusValuesByColumn = {};
        const statusKeywords = ['status', 'state', 'stage', 'outcome', 'progress'];
        // Scan headers and find columns that sound like a status
        const potentialStatusCols = preview.headers.filter(h => statusKeywords.some(keyword => h.toLowerCase().includes(keyword)));
        // Collect up to 10 unique values for each potential status column
        for (const col of potentialStatusCols) {
            const vals = new Set();
            for (const row of preview.sampleRows) {
                if (row[col]) {
                    vals.add(row[col].trim());
                }
            }
            uniqueStatusValuesByColumn[col] = Array.from(vals).slice(0, 15);
        }
        // Call AI Service
        let schema;
        try {
            schema = await services_1.aiService.generateMappingSchema(preview.headers, preview.sampleRows, uniqueStatusValuesByColumn);
        }
        catch (aiErr) {
            logger_1.logger.error(`AI mapping failed for job ${id}`, aiErr);
            await services_1.jobRepository.update(id, { status: 'PENDING' }); // Reset back to PENDING so user can retry
            res.status(502).json({ error: `AI Mapping Engine Error: ${aiErr.message || aiErr}` });
            return;
        }
        await services_1.jobRepository.update(id, { status: 'ANALYZED', mapping_schema: schema });
        res.json({
            jobId: id,
            mappingSchema: schema,
        });
    }
    catch (error) {
        logger_1.logger.error('Analyze mapping exception', error);
        next(error);
    }
}
/**
 * Triggers the actual batch parsing & import in the background.
 */
async function startImport(req, res, next) {
    try {
        const { id } = req.params;
        const mappingSchema = req.body;
        // Validate request body
        if (!mappingSchema || !mappingSchema.mapped_fields) {
            res.status(400).json({ error: 'Missing mapping schema. Mapped fields are required.' });
            return;
        }
        const job = await services_1.jobRepository.findById(id);
        if (!job) {
            res.status(404).json({ error: `Job with ID ${id} not found.` });
            return;
        }
        const filePath = path_1.default.join(config_1.config.storageDir, 'uploads_processed', `${id}.csv`);
        if (!fs_1.default.existsSync(filePath)) {
            res.status(404).json({ error: `Processed CSV file for Job ID ${id} was not found on disk.` });
            return;
        }
        // Trigger processing asynchronously (DO NOT await this promise, let it run in background)
        services_1.importService
            .processJob(id, mappingSchema, filePath)
            .then(() => {
            logger_1.logger.info(`Asynchronous CSV process completed for job: ${id}`);
            // Clean up the processed file once done to conserve disk space
            try {
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                }
            }
            catch (err) {
                logger_1.logger.warn(`Failed to clean up CSV file ${filePath} after import`, err);
            }
        })
            .catch((err) => {
            logger_1.logger.error(`Asynchronous CSV process failed for job: ${id}`, err);
        });
        res.json({
            message: 'Lead import processing has started in the background.',
            jobId: id,
            status: 'PROCESSING',
        });
    }
    catch (error) {
        logger_1.logger.error('Start import controller exception', error);
        next(error);
    }
}
/**
 * Returns raw CSV preview (headers & first 100 rows).
 */
async function getImportPreview(req, res, next) {
    try {
        const { id } = req.params;
        const job = await services_1.jobRepository.findById(id);
        if (!job) {
            res.status(404).json({ error: `Job with ID ${id} not found.` });
            return;
        }
        const filePath = path_1.default.join(config_1.config.storageDir, 'uploads_processed', `${id}.csv`);
        if (!fs_1.default.existsSync(filePath)) {
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
        const preview = await services_1.parserService.parsePreviewAndSample(filePath, 100);
        res.json(preview);
    }
    catch (error) {
        logger_1.logger.error('Get import preview exception', error);
        next(error);
    }
}
