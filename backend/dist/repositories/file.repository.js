"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileFailedRecordRepository = exports.FileLeadRepository = exports.FileJobRepository = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
class FileJobRepository {
    jobsFilePath;
    constructor() {
        this.jobsFilePath = path_1.default.join(config_1.config.storageDir, 'jobs.json');
        this.ensureStorageDir();
    }
    ensureStorageDir() {
        if (!(0, fs_1.existsSync)(config_1.config.storageDir)) {
            (0, fs_1.mkdirSync)(config_1.config.storageDir, { recursive: true });
        }
    }
    async readJobs() {
        try {
            if (!(0, fs_1.existsSync)(this.jobsFilePath)) {
                await promises_1.default.writeFile(this.jobsFilePath, JSON.stringify([]));
                return [];
            }
            const data = await promises_1.default.readFile(this.jobsFilePath, 'utf-8');
            return JSON.parse(data || '[]');
        }
        catch (error) {
            logger_1.logger.error('Failed to read jobs file', error);
            return [];
        }
    }
    async writeJobs(jobs) {
        try {
            this.ensureStorageDir();
            await promises_1.default.writeFile(this.jobsFilePath, JSON.stringify(jobs, null, 2), 'utf-8');
        }
        catch (error) {
            logger_1.logger.error('Failed to write jobs file', error);
            throw error;
        }
    }
    async create(job) {
        const jobs = await this.readJobs();
        jobs.push(job);
        await this.writeJobs(jobs);
        return job;
    }
    async findById(id) {
        const jobs = await this.readJobs();
        return jobs.find((job) => job.id === id) || null;
    }
    async update(id, updates) {
        const jobs = await this.readJobs();
        const index = jobs.findIndex((job) => job.id === id);
        if (index === -1) {
            throw new Error(`Job with ID ${id} not found`);
        }
        const updatedJob = { ...jobs[index], ...updates };
        jobs[index] = updatedJob;
        await this.writeJobs(jobs);
        return updatedJob;
    }
    async findAll() {
        return this.readJobs();
    }
    async delete(id) {
        const jobs = await this.readJobs();
        const filteredJobs = jobs.filter((job) => job.id !== id);
        if (filteredJobs.length === jobs.length) {
            return false;
        }
        await this.writeJobs(filteredJobs);
        // Clean up associated leads and failed files asynchronously
        const leadsFile = path_1.default.join(config_1.config.storageDir, `leads_${id}.json`);
        const failedFile = path_1.default.join(config_1.config.storageDir, `failed_${id}.json`);
        try {
            if ((0, fs_1.existsSync)(leadsFile))
                await promises_1.default.unlink(leadsFile);
            if ((0, fs_1.existsSync)(failedFile))
                await promises_1.default.unlink(failedFile);
        }
        catch (err) {
            logger_1.logger.warn(`Failed to clean files for deleted job ${id}`, err);
        }
        return true;
    }
}
exports.FileJobRepository = FileJobRepository;
class FileLeadRepository {
    getFilePath(jobId) {
        return path_1.default.join(config_1.config.storageDir, `leads_${jobId}.json`);
    }
    async createMany(jobId, leads) {
        try {
            const filePath = this.getFilePath(jobId);
            let existingLeads = [];
            if ((0, fs_1.existsSync)(filePath)) {
                const data = await promises_1.default.readFile(filePath, 'utf-8');
                existingLeads = JSON.parse(data || '[]');
            }
            existingLeads.push(...leads);
            await promises_1.default.writeFile(filePath, JSON.stringify(existingLeads, null, 2), 'utf-8');
        }
        catch (error) {
            logger_1.logger.error(`Failed to write leads for job ${jobId}`, error);
            throw error;
        }
    }
    async findByJobId(jobId) {
        try {
            const filePath = this.getFilePath(jobId);
            if (!(0, fs_1.existsSync)(filePath))
                return [];
            const data = await promises_1.default.readFile(filePath, 'utf-8');
            return JSON.parse(data || '[]');
        }
        catch (error) {
            logger_1.logger.error(`Failed to read leads for job ${jobId}`, error);
            return [];
        }
    }
    async countByJobId(jobId) {
        const leads = await this.findByJobId(jobId);
        return leads.length;
    }
    async deleteByJobId(jobId) {
        const filePath = this.getFilePath(jobId);
        if ((0, fs_1.existsSync)(filePath)) {
            await promises_1.default.unlink(filePath);
        }
    }
}
exports.FileLeadRepository = FileLeadRepository;
class FileFailedRecordRepository {
    getFilePath(jobId) {
        return path_1.default.join(config_1.config.storageDir, `failed_${jobId}.json`);
    }
    async createMany(jobId, failedRecords) {
        try {
            const filePath = this.getFilePath(jobId);
            let existingFailed = [];
            if ((0, fs_1.existsSync)(filePath)) {
                const data = await promises_1.default.readFile(filePath, 'utf-8');
                existingFailed = JSON.parse(data || '[]');
            }
            existingFailed.push(...failedRecords);
            await promises_1.default.writeFile(filePath, JSON.stringify(existingFailed, null, 2), 'utf-8');
        }
        catch (error) {
            logger_1.logger.error(`Failed to write failed records for job ${jobId}`, error);
            throw error;
        }
    }
    async findByJobId(jobId) {
        try {
            const filePath = this.getFilePath(jobId);
            if (!(0, fs_1.existsSync)(filePath))
                return [];
            const data = await promises_1.default.readFile(filePath, 'utf-8');
            return JSON.parse(data || '[]');
        }
        catch (error) {
            logger_1.logger.error(`Failed to read failed records for job ${jobId}`, error);
            return [];
        }
    }
    async countByJobId(jobId) {
        const failed = await this.findByJobId(jobId);
        return failed.length;
    }
    async deleteByJobId(jobId) {
        const filePath = this.getFilePath(jobId);
        if ((0, fs_1.existsSync)(filePath)) {
            await promises_1.default.unlink(filePath);
        }
    }
}
exports.FileFailedRecordRepository = FileFailedRecordRepository;
