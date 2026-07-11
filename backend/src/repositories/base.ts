import { ImportJob, Lead, FailedRecord } from '../../../shared/types';

export interface IJobRepository {
  create(job: ImportJob): Promise<ImportJob>;
  findById(id: string): Promise<ImportJob | null>;
  update(id: string, updates: Partial<ImportJob>): Promise<ImportJob>;
  findAll(): Promise<ImportJob[]>;
  delete(id: string): Promise<boolean>;
}

export interface ILeadRepository {
  createMany(jobId: string, leads: Lead[]): Promise<void>;
  findByJobId(jobId: string): Promise<Lead[]>;
  countByJobId(jobId: string): Promise<number>;
  deleteByJobId(jobId: string): Promise<void>;
}

export interface IFailedRecordRepository {
  createMany(jobId: string, failedRecords: FailedRecord[]): Promise<void>;
  findByJobId(jobId: string): Promise<FailedRecord[]>;
  countByJobId(jobId: string): Promise<number>;
  deleteByJobId(jobId: string): Promise<void>;
}
