import fs from 'fs';
import csvParser from 'csv-parser';
import { IJobRepository, ILeadRepository, IFailedRecordRepository } from '../repositories/base';
import { MappingSchema, CRMStatus, Lead, FailedRecord, ImportJob } from '../../../shared/types';
import { normalizeDate } from '../utils/date';
import { extractEmails, extractPhones, isValidEmail, isValidPhone } from '../utils/validation';
import { logger } from '../utils/logger';

export class ImportService {
  constructor(
    private jobRepo: IJobRepository,
    private leadRepo: ILeadRepository,
    private failedRepo: IFailedRecordRepository
  ) {}

  /**
   * Processes the import job in the background.
   */
  async processJob(jobId: string, mappingSchema: MappingSchema, filePath: string): Promise<void> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      logger.error(`Job ${jobId} not found in repository. Aborting processing.`);
      return;
    }

    try {
      logger.info(`Starting process for job: ${jobId} (${job.filename})`);
      await this.jobRepo.update(jobId, { status: 'PROCESSING', mapping_schema: mappingSchema });

      const leadsBuffer: Lead[] = [];
      const failedBuffer: FailedRecord[] = [];
      
      let processedRecords = 0;
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      let rowNumber = 1; // Row 1 is usually the header row in CSV display, first data is row 2
      
      // Track duplicates within this job to prevent double-inserting
      const seenEmails = new Set<string>();
      const seenMobiles = new Set<string>();

      // Read columns that are mapped to names, emails, phones, etc.
      // This will help us extract values easily.
      const reverseMapping: Record<string, string[]> = {};
      for (const [csvCol, crmField] of Object.entries(mappingSchema.mapped_fields)) {
        if (!reverseMapping[crmField]) {
          reverseMapping[crmField] = [];
        }
        reverseMapping[crmField].push(csvCol);
      }

      const stream = fs.createReadStream(filePath).pipe(csvParser());

      const saveBuffers = async (force = false) => {
        // Save in batches of 100 to avoid large database transactions and out-of-memory errors
        if (leadsBuffer.length >= 100 || (force && leadsBuffer.length > 0)) {
          const currentBatch = [...leadsBuffer];
          leadsBuffer.length = 0;
          await this.leadRepo.createMany(jobId, currentBatch);
        }
        if (failedBuffer.length >= 100 || (force && failedBuffer.length > 0)) {
          const currentBatch = [...failedBuffer];
          failedBuffer.length = 0;
          await this.failedRepo.createMany(jobId, currentBatch);
        }
      };

      const updateJobProgress = async (final = false) => {
        await this.jobRepo.update(jobId, {
          processed_records: processedRecords,
          success_count: successCount,
          failed_count: failedCount,
          skipped_count: skippedCount,
          status: final ? 'COMPLETED' : 'PROCESSING',
          completed_at: final ? new Date().toISOString() : undefined,
        });
      };

      // Periodic progress updates (throttled)
      let lastUpdate = Date.now();

      await new Promise<void>((resolve, reject) => {
        stream.on('data', async (row: any) => {
          rowNumber++;
          processedRecords++;

          // Extract value helper
          const getValuesForField = (crmField: string): string[] => {
            const cols = reverseMapping[crmField] || [];
            const vals: string[] = [];
            for (const col of cols) {
              const val = row[col];
              if (val !== undefined && val !== null) {
                vals.push(val.trim());
              }
            }
            return vals;
          };

          try {
            // 1. Extract Emails
            const rawEmails = getValuesForField('email');
            const allEmails: string[] = [];
            for (const re of rawEmails) {
              allEmails.push(...extractEmails(re));
            }

            // 2. Extract Phone Numbers
            const rawPhones = getValuesForField('mobile');
            const allPhones: string[] = [];
            for (const rp of rawPhones) {
              allPhones.push(...extractPhones(rp));
            }

            // 3. Skip records ONLY IF email missing AND mobile missing
            if (allEmails.length === 0 && allPhones.length === 0) {
              skippedCount++;
              return;
            }

            // Extract other CRM fields
            const firstNames = getValuesForField('first_name');
            const lastNames = getValuesForField('last_name');
            const companyVals = getValuesForField('company');
            const cityVals = getValuesForField('city');
            const stateVals = getValuesForField('state');
            const countryVals = getValuesForField('country');
            const statusVals = getValuesForField('crm_status');
            const noteVals = getValuesForField('crm_note');
            const dateVals = getValuesForField('created_at');
            const sourceVals = getValuesForField('source');

            // Handle Full Name Splitting if no last name was mapped but we have name values
            let firstName = firstNames[0] || '';
            let lastName = lastNames[0] || '';
            
            if (!firstName && !lastName) {
              // Try check if there's a column mapped to a generic "name" field or if first_name has full name
              // Let's assume the LLM mapped it to first_name
              const fullName = firstNames[0] || '';
              if (fullName) {
                const parts = fullName.split(/\s+/);
                firstName = parts[0];
                lastName = parts.slice(1).join(' ');
              }
            } else if (firstName && !lastName) {
              // If only first_name is populated, check if it contains spaces
              const parts = firstName.split(/\s+/);
              if (parts.length > 1) {
                firstName = parts[0];
                lastName = parts.slice(1).join(' ');
              }
            }

            // Construct note additions for overflows
            const noteParts: string[] = [];
            if (noteVals.length > 0) {
              noteParts.push(...noteVals);
            }

            // Overflow Emails
            const primaryEmail = allEmails[0] || undefined;
            if (allEmails.length > 1) {
              noteParts.push(`Additional Emails: ${allEmails.slice(1).join(', ')}`);
            }

            // Overflow Phone Numbers
            const primaryPhone = allPhones[0] || undefined;
            if (allPhones.length > 1) {
              noteParts.push(`Additional Phones: ${allPhones.slice(1).join(', ')}`);
            }

            // Gather all unmapped columns into crm_note for data preservation
            const mappedCols = new Set(Object.keys(mappingSchema.mapped_fields));
            const unmappedData: string[] = [];
            for (const [key, val] of Object.entries(row)) {
              if (!mappedCols.has(key) && val) {
                unmappedData.push(`${key}: ${val}`);
              }
            }
            if (unmappedData.length > 0) {
              noteParts.push(`Other fields: [${unmappedData.join(' | ')}]`);
            }

            // Normalize Date
            let createdAt = new Date().toISOString();
            const rawDate = dateVals[0];
            if (rawDate) {
              const normDate = normalizeDate(rawDate, mappingSchema.date_format);
              if (normDate) {
                createdAt = normDate;
              } else {
                noteParts.push(`Unparseable Created Date: ${rawDate}`);
              }
            }

            // Normalize Status
            let status: CRMStatus = 'GOOD_LEAD_FOLLOW_UP'; // Default fallback
            const rawStatus = statusVals[0];
            if (rawStatus) {
              // Use LLM mapping
              const mapped = mappingSchema.status_mapping[rawStatus];
              if (mapped) {
                status = mapped;
              } else {
                // Heuristic status check
                const lowerStatus = rawStatus.toLowerCase();
                if (lowerStatus.includes('purchased') || lowerStatus.includes('closed') || lowerStatus.includes('won') || lowerStatus.includes('sale') || lowerStatus.includes('paid')) {
                  status = 'SALE_DONE';
                } else if (lowerStatus.includes('fake') || lowerStatus.includes('spam') || lowerStatus.includes('wrong') || lowerStatus.includes('bad')) {
                  status = 'BAD_LEAD';
                } else if (lowerStatus.includes('no answer') || lowerStatus.includes('busy') || lowerStatus.includes('did not connect') || lowerStatus.includes('unreached')) {
                  status = 'DID_NOT_CONNECT';
                } else {
                  status = 'GOOD_LEAD_FOLLOW_UP'; // Fallback
                }
                noteParts.push(`Original Status: ${rawStatus}`);
              }
            }

            // Check duplicate leads (by email or phone in this job)
            let isDuplicate = false;
            if (primaryEmail && seenEmails.has(primaryEmail)) {
              isDuplicate = true;
            }
            if (primaryPhone && seenMobiles.has(primaryPhone)) {
              isDuplicate = true;
            }

            if (isDuplicate) {
              skippedCount++;
              return;
            }

            // Add to sets to track duplicates
            if (primaryEmail) seenEmails.add(primaryEmail);
            if (primaryPhone) seenMobiles.add(primaryPhone);

            // Validation error tracking
            const errors: string[] = [];
            if (primaryEmail && !isValidEmail(primaryEmail)) {
              errors.push(`Invalid email format: ${primaryEmail}`);
            }
            if (primaryPhone && !isValidPhone(primaryPhone)) {
              errors.push(`Invalid phone format: ${primaryPhone}`);
            }

            if (errors.length > 0) {
              failedCount++;
              failedBuffer.push({
                row_number: rowNumber,
                raw_data: row,
                errors,
              });
              await saveBuffers();
              return;
            }

            // Build Lead Object
            const lead: Lead = {
              first_name: firstName || undefined,
              last_name: lastName || undefined,
              email: primaryEmail,
              mobile: primaryPhone,
              company: companyVals[0] || undefined,
              city: cityVals[0] || undefined,
              state: stateVals[0] || undefined,
              country: countryVals[0] || undefined,
              crm_status: status,
              crm_note: noteParts.length > 0 ? noteParts.join(' \n') : undefined,
              created_at: createdAt,
              source: sourceVals[0] || job.filename || 'CSV Import',
            };

            successCount++;
            leadsBuffer.push(lead);
            await saveBuffers();

            // Periodically save progress to DB
            if (Date.now() - lastUpdate > 2000) {
              lastUpdate = Date.now();
              await updateJobProgress();
            }

          } catch (err: any) {
            logger.error(`Error processing row ${rowNumber}`, err);
            failedCount++;
            failedBuffer.push({
              row_number: rowNumber,
              raw_data: row,
              errors: [`Processing Exception: ${err.message || err}`],
            });
            await saveBuffers();
          }
        });

        stream.on('end', async () => {
          try {
            // Save remaining elements
            await saveBuffers(true);
            await updateJobProgress(true);
            logger.info(`Completed job ${jobId}. Success: ${successCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`);
            resolve();
          } catch (err) {
            reject(err);
          }
        });

        stream.on('error', (err) => {
          logger.error(`Streaming error during CSV process for job ${jobId}`, err);
          reject(err);
        });
      });

    } catch (error: any) {
      logger.error(`Failed to process CSV import job: ${jobId}`, error);
      await this.jobRepo.update(jobId, {
        status: 'FAILED',
        error_message: error.message || 'Unknown processing error',
      });
    }
  }
}
