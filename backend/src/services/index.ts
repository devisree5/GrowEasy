import { FileJobRepository, FileLeadRepository, FileFailedRecordRepository } from '../repositories/file.repository';
import { ParserService } from './parser.service';
import { AiService } from './ai.service';
import { ImportService } from './import.service';

export const jobRepository = new FileJobRepository();
export const leadRepository = new FileLeadRepository();
export const failedRecordRepository = new FileFailedRecordRepository();

export const parserService = new ParserService();
export const aiService = new AiService();
export const importService = new ImportService(jobRepository, leadRepository, failedRecordRepository);
