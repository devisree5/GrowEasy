export type CRMStatus = 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE';

export interface Lead {
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile?: string;
  company?: string;
  city?: string;
  state?: string;
  country?: string;
  crm_status?: CRMStatus;
  crm_note?: string;
  created_at?: string; // ISO string
  source?: string;
}

export interface MappingSchema {
  mapped_fields: Record<string, string>; // CSV Header -> Lead Field Name
  status_mapping: Record<string, CRMStatus>; // CSV Status Value -> CRM Status
  source_column?: string;
  date_column?: string;
  date_format?: string;
  confidence: number;
  reason?: string;
}

export interface ImportJob {
  id: string;
  filename: string;
  status: 'PENDING' | 'ANALYZING' | 'ANALYZED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total_records: number;
  processed_records: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  completed_at?: string;
  mapping_schema?: MappingSchema;
  error_message?: string;
}

export interface FailedRecord {
  row_number: number;
  raw_data: Record<string, string>;
  errors: string[];
}
