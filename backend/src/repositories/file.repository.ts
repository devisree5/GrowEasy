import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { config } from '../config/config';
import { IJobRepository, ILeadRepository, IFailedRecordRepository } from './base';
import { ImportJob, Lead, FailedRecord } from '../types';
import { logger } from '../utils/logger';

export class FileJobRepository implements IJobRepository {
  private jobsFilePath: string;

  constructor() {
    this.jobsFilePath = path.join(config.storageDir, 'jobs.json');
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!existsSync(config.storageDir)) {
      mkdirSync(config.storageDir, { recursive: true });
    }
  }

  private async readJobs(): Promise<ImportJob[]> {
    try {
      if (!existsSync(this.jobsFilePath)) {
        await fs.writeFile(this.jobsFilePath, JSON.stringify([]));
        return [];
      }
      const data = await fs.readFile(this.jobsFilePath, 'utf-8');
      return JSON.parse(data || '[]');
    } catch (error) {
      logger.error('Failed to read jobs file', error);
      return [];
    }
  }

  private async writeJobs(jobs: ImportJob[]): Promise<void> {
    try {
      this.ensureStorageDir();
      await fs.writeFile(this.jobsFilePath, JSON.stringify(jobs, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to write jobs file', error);
      throw error;
    }
  }

  async create(job: ImportJob): Promise<ImportJob> {
    const jobs = await this.readJobs();
    jobs.push(job);
    await this.writeJobs(jobs);
    return job;
  }

  async findById(id: string): Promise<ImportJob | null> {
    const jobs = await this.readJobs();
    return jobs.find((job) => job.id === id) || null;
  }

  async update(id: string, updates: Partial<ImportJob>): Promise<ImportJob> {
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

  async findAll(): Promise<ImportJob[]> {
    return this.readJobs();
  }

  async delete(id: string): Promise<boolean> {
    const jobs = await this.readJobs();
    const filteredJobs = jobs.filter((job) => job.id !== id);
    if (filteredJobs.length === jobs.length) {
      return false;
    }
    await this.writeJobs(filteredJobs);
    
    // Clean up associated leads and failed files asynchronously
    const leadsFile = path.join(config.storageDir, `leads_${id}.json`);
    const failedFile = path.join(config.storageDir, `failed_${id}.json`);
    try {
      if (existsSync(leadsFile)) await fs.unlink(leadsFile);
      if (existsSync(failedFile)) await fs.unlink(failedFile);
    } catch (err) {
      logger.warn(`Failed to clean files for deleted job ${id}`, err);
    }
    return true;
  }
}

export class FileLeadRepository implements ILeadRepository {
  private getFilePath(jobId: string): string {
    return path.join(config.storageDir, `leads_${jobId}.json`);
  }

  async createMany(jobId: string, leads: Lead[]): Promise<void> {
    try {
      const filePath = this.getFilePath(jobId);
      let existingLeads: Lead[] = [];
      if (existsSync(filePath)) {
        const data = await fs.readFile(filePath, 'utf-8');
        existingLeads = JSON.parse(data || '[]');
      }
      existingLeads.push(...leads);
      await fs.writeFile(filePath, JSON.stringify(existingLeads, null, 2), 'utf-8');
    } catch (error) {
      logger.error(`Failed to write leads for job ${jobId}`, error);
      throw error;
    }
  }

  async findByJobId(jobId: string): Promise<Lead[]> {
    try {
      const filePath = this.getFilePath(jobId);
      if (!existsSync(filePath)) return [];
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data || '[]');
    } catch (error) {
      logger.error(`Failed to read leads for job ${jobId}`, error);
      return [];
    }
  }

  async countByJobId(jobId: string): Promise<number> {
    const leads = await this.findByJobId(jobId);
    return leads.length;
  }

  async deleteByJobId(jobId: string): Promise<void> {
    const filePath = this.getFilePath(jobId);
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
  }
}

export class FileFailedRecordRepository implements IFailedRecordRepository {
  private getFilePath(jobId: string): string {
    return path.join(config.storageDir, `failed_${jobId}.json`);
  }

  async createMany(jobId: string, failedRecords: FailedRecord[]): Promise<void> {
    try {
      const filePath = this.getFilePath(jobId);
      let existingFailed: FailedRecord[] = [];
      if (existsSync(filePath)) {
        const data = await fs.readFile(filePath, 'utf-8');
        existingFailed = JSON.parse(data || '[]');
      }
      existingFailed.push(...failedRecords);
      await fs.writeFile(filePath, JSON.stringify(existingFailed, null, 2), 'utf-8');
    } catch (error) {
      logger.error(`Failed to write failed records for job ${jobId}`, error);
      throw error;
    }
  }

  async findByJobId(jobId: string): Promise<FailedRecord[]> {
    try {
      const filePath = this.getFilePath(jobId);
      if (!existsSync(filePath)) return [];
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data || '[]');
    } catch (error) {
      logger.error(`Failed to read failed records for job ${jobId}`, error);
      return [];
    }
  }

  async countByJobId(jobId: string): Promise<number> {
    const failed = await this.findByJobId(jobId);
    return failed.length;
  }

  async deleteByJobId(jobId: string): Promise<void> {
    const filePath = this.getFilePath(jobId);
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
  }
}
