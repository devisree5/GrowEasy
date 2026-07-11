"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJobs = getJobs;
exports.getJobStatus = getJobStatus;
exports.getJobLeads = getJobLeads;
exports.getJobFailed = getJobFailed;
exports.downloadLeads = downloadLeads;
exports.downloadFailed = downloadFailed;
const services_1 = require("../services");
const csv_exporter_1 = require("../utils/csv-exporter");
const logger_1 = require("../utils/logger");
async function getJobs(req, res, next) {
    try {
        const jobs = await services_1.jobRepository.findAll();
        // Sort jobs: newest first
        jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json(jobs);
    }
    catch (error) {
        logger_1.logger.error('Get jobs exception', error);
        next(error);
    }
}
async function getJobStatus(req, res, next) {
    try {
        const { id } = req.params;
        const job = await services_1.jobRepository.findById(id);
        if (!job) {
            res.status(404).json({ error: `Job with ID ${id} not found.` });
            return;
        }
        res.json(job);
    }
    catch (error) {
        logger_1.logger.error('Get job status exception', error);
        next(error);
    }
}
async function getJobLeads(req, res, next) {
    try {
        const { id } = req.params;
        const job = await services_1.jobRepository.findById(id);
        if (!job) {
            res.status(404).json({ error: `Job with ID ${id} not found.` });
            return;
        }
        const leads = await services_1.leadRepository.findByJobId(id);
        res.json(leads);
    }
    catch (error) {
        logger_1.logger.error('Get job leads exception', error);
        next(error);
    }
}
async function getJobFailed(req, res, next) {
    try {
        const { id } = req.params;
        const job = await services_1.jobRepository.findById(id);
        if (!job) {
            res.status(404).json({ error: `Job with ID ${id} not found.` });
            return;
        }
        const failed = await services_1.failedRecordRepository.findByJobId(id);
        res.json(failed);
    }
    catch (error) {
        logger_1.logger.error('Get job failed exception', error);
        next(error);
    }
}
async function downloadLeads(req, res, next) {
    try {
        const { id } = req.params;
        const job = await services_1.jobRepository.findById(id);
        if (!job) {
            res.status(404).json({ error: `Job with ID ${id} not found.` });
            return;
        }
        const leads = await services_1.leadRepository.findByJobId(id);
        if (leads.length === 0) {
            res.status(400).json({ error: 'No successful leads to download for this job.' });
            return;
        }
        const csvContent = (0, csv_exporter_1.convertToCsv)(leads);
        const safeFilename = `imported_leads_${job.filename.replace(/[^a-zA-Z0-9]/g, '_')}_${id.substring(0, 8)}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.status(200).send(csvContent);
    }
    catch (error) {
        logger_1.logger.error('Download leads exception', error);
        next(error);
    }
}
async function downloadFailed(req, res, next) {
    try {
        const { id } = req.params;
        const job = await services_1.jobRepository.findById(id);
        if (!job) {
            res.status(404).json({ error: `Job with ID ${id} not found.` });
            return;
        }
        const failed = await services_1.failedRecordRepository.findByJobId(id);
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
        const csvContent = (0, csv_exporter_1.convertToCsv)(flattenedFailed);
        const safeFilename = `failed_records_${job.filename.replace(/[^a-zA-Z0-9]/g, '_')}_${id.substring(0, 8)}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.status(200).send(csvContent);
    }
    catch (error) {
        logger_1.logger.error('Download failed exception', error);
        next(error);
    }
}
