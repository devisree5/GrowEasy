"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Settings,
  Sparkles,
  Play,
  CheckCircle,
  XCircle,
  HelpCircle,
  FileText,
  Download,
  AlertCircle,
  ArrowRight,
  Search,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BACKEND_URL } from "@/utils/api";
import { CRMStatus, MappingSchema } from "../../../../../shared/types";

interface JobDetail {
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

interface CsvUploadResponse {
  jobId: string;
  filename: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
}

const CRM_FIELDS = [
  { name: "first_name", label: "First Name", required: false, desc: "Lead's first name" },
  { name: "last_name", label: "Last Name", required: false, desc: "Lead's last name / surname" },
  { name: "email", label: "Email Address", required: false, desc: "Primary contact email (required if phone missing)" },
  { name: "mobile", label: "Mobile / Phone", required: false, desc: "Primary phone number (required if email missing)" },
  { name: "company", label: "Company", required: false, desc: "Employer or company name" },
  { name: "city", label: "City", required: false, desc: "Lead city location" },
  { name: "state", label: "State", required: false, desc: "Lead state location" },
  { name: "country", label: "Country", required: false, desc: "Lead country location" },
  { name: "crm_status", label: "Lead Status", required: false, desc: "Status column to normalize" },
  { name: "crm_note", label: "Notes / Comments", required: false, desc: "Additional data columns will merge here" },
  { name: "created_at", label: "Created Date", required: false, desc: "Sign up or lead created date" },
  { name: "source", label: "Lead Source", required: false, desc: "Export origin (e.g. Google, Facebook)" },
];

const ALLOWED_STATUSES: CRMStatus[] = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
];

export default function ImportDetail() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState<"preview" | "mapping" | "leads" | "failed">("preview");
  const [mappedFields, setMappedFields] = useState<Record<string, string>>({});
  const [statusMappings, setStatusMappings] = useState<Record<string, CRMStatus>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([{}]);
  const [selectedDateCol, setSelectedDateCol] = useState<string>("");
  const [selectedSourceCol, setSelectedSourceCol] = useState<string>("");
  
  // Search & Filter state for success / failure tables
  const [leadSearch, setLeadSearch] = useState("");
  const [failedSearch, setFailedSearch] = useState("");

  // Poll job status every 1.5s when processing
  const { data: job, isLoading: isJobLoading } = useQuery<JobDetail>({
    queryKey: ["job", id],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/jobs/${id}`);
      if (!res.ok) throw new Error("Failed to fetch job detail");
      return res.json();
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PROCESSING" || status === "ANALYZING" ? 1500 : false;
    },
  });

  // Fetch results when completed
  const { data: leads, isLoading: isLeadsLoading } = useQuery<any[]>({
    queryKey: ["leads", id],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/jobs/${id}/leads`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    enabled: job?.status === "COMPLETED",
  });

  const { data: failedRecords, isLoading: isFailedLoading } = useQuery<any[]>({
    queryKey: ["failed", id],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/jobs/${id}/failed`);
      if (!res.ok) throw new Error("Failed to fetch failed records");
      return res.json();
    },
    enabled: job?.status === "COMPLETED",
  });

  // Fetch CSV preview (headers and sample rows)
  const { data: previewData, isLoading: isPreviewLoading } = useQuery<CsvUploadResponse>({
    queryKey: ["preview", id],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/import/${id}/preview`);
      if (!res.ok) throw new Error("Failed to fetch CSV preview");
      return res.json();
    },
    enabled: job?.status === "PENDING" || job?.status === "ANALYZED",
  });

  useEffect(() => {
    if (previewData) {
      setHeaders(previewData.headers);
      setSampleRows(previewData.sampleRows);
    }
  }, [previewData]);

  useEffect(() => {
    if (job?.status === "ANALYZED" && job.mapping_schema) {
      const schema = job.mapping_schema;
      const csvHeaders = Object.keys(schema.mapped_fields);
      setHeaders(csvHeaders);
      
      // Initialize map fields state
      const initialFields: Record<string, string> = {};
      for (const [col, field] of Object.entries(schema.mapped_fields)) {
        initialFields[field] = col; // Field -> Col mapping for select box
      }
      setMappedFields(initialFields);
      setStatusMappings(schema.status_mapping);
      setSelectedDateCol(schema.date_column || "");
      setSelectedSourceCol(schema.source_column || "");
      setActiveTab("mapping");
    }
  }, [job]);

  // Trigger AI Mapping Mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/import/${id}/analyze`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "AI Mapping failed");
      }
      return res.json() as Promise<{ jobId: string; mappingSchema: MappingSchema }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      const schema = data.mappingSchema;
      const csvHeaders = Object.keys(schema.mapped_fields);
      setHeaders(csvHeaders);

      const initialFields: Record<string, string> = {};
      for (const [col, field] of Object.entries(schema.mapped_fields)) {
        initialFields[field] = col;
      }
      setMappedFields(initialFields);
      setStatusMappings(schema.status_mapping);
      setSelectedDateCol(schema.date_column || "");
      setSelectedSourceCol(schema.source_column || "");
      setActiveTab("mapping");
    },
  });

  // Confirm Import Mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      // Re-map back from Field -> Col to Col -> Field for backend
      const colToField: Record<string, string> = {};
      for (const [field, col] of Object.entries(mappedFields)) {
        if (col) colToField[col] = field;
      }

      const payload: MappingSchema = {
        mapped_fields: colToField,
        status_mapping: statusMappings,
        date_column: selectedDateCol || undefined,
        source_column: selectedSourceCol || undefined,
        confidence: job?.mapping_schema?.confidence ?? 100,
        reason: "User confirmed mappings.",
      };

      const res = await fetch(`${BACKEND_URL}/api/import/${id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to start import job");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
    },
  });

  if (isJobLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white">Job not found</h2>
        <Button className="mt-4" onClick={() => router.push("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const handleFieldChange = (fieldName: string, value: string) => {
    setMappedFields((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
    
    // Automatically set special helper columns
    if (fieldName === "created_at") setSelectedDateCol(value);
    if (fieldName === "source") setSelectedSourceCol(value);
  };

  const handleStatusChange = (originalValue: string, newCrmStatus: CRMStatus) => {
    setStatusMappings((prev) => ({
      ...prev,
      [originalValue]: newCrmStatus,
    }));
  };

  const getPercentage = (processed: number, total: number) => {
    if (!total) return 0;
    return Math.round((processed / total) * 100);
  };

  const filteredLeads = leads?.filter(lead => {
    const search = leadSearch.toLowerCase();
    return (
      (lead.first_name || "").toLowerCase().includes(search) ||
      (lead.last_name || "").toLowerCase().includes(search) ||
      (lead.email || "").toLowerCase().includes(search) ||
      (lead.mobile || "").toLowerCase().includes(search)
    );
  });

  const filteredFailed = failedRecords?.filter(f => {
    const search = failedSearch.toLowerCase();
    return (
      f.errors.join(" ").toLowerCase().includes(search) ||
      JSON.stringify(f.raw_data).toLowerCase().includes(search)
    );
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb / Back button */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6 group transition-colors"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            {job.filename}
            {job.status === "PROCESSING" && (
              <span className="flex h-2.5 w-2.5 rounded-full bg-brand-green animate-ping" />
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Job ID: <span className="font-mono text-xs">{job.id}</span> • Uploaded on{" "}
            {new Date(job.created_at).toLocaleDateString()}
          </p>
        </div>

        {job.status === "COMPLETED" && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => window.open(`${BACKEND_URL}/api/jobs/${id}/download-leads`)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Cleaned CRM Leads
            </Button>
            {job.failed_count > 0 && (
              <Button
                variant="outline"
                onClick={() => window.open(`${BACKEND_URL}/api/jobs/${id}/download-failed`)}
                className="gap-2 text-red-400 border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
              >
                <Download className="h-4 w-4" />
                Download Failed Records
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Workflow Renderer based on job status */}
      
      {/* 1. Job PENDING State: Trigger Mapping */}
      {job.status === "PENDING" && (
        <div className="space-y-8">
          {/* Raw CSV Preview */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">CSV Raw Data Preview</CardTitle>
                  <CardDescription>
                    Review the first 100 rows of your uploaded file before initiating AI analysis.
                  </CardDescription>
                </div>
                <Badge variant="outline">{job.total_records} Rows In CSV</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-[350px] overflow-y-auto">
              {isPreviewLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : !headers || headers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No preview rows available.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-brand-card z-10 border-b border-brand-border">
                    <tr className="bg-brand-muted/40 text-xs font-semibold text-muted-foreground">
                      <th className="p-3 w-14 text-center border-r border-brand-border/20">Row</th>
                      {headers.map((h, i) => (
                        <th key={i} className="p-3 font-mono text-[11px] min-w-[120px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/40 text-xs">
                    {sampleRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-brand-muted/10 transition-colors">
                        <td className="p-3 text-center text-muted-foreground font-mono font-semibold border-r border-brand-border/20">
                          {rIdx + 2}
                        </td>
                        {headers.map((h, cIdx) => (
                          <td key={cIdx} className="p-3 font-mono text-[10px] text-zinc-300">
                            {row[h] !== undefined && row[h] !== '' ? (
                              row[h]
                            ) : (
                              <span className="text-zinc-600 italic">null</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Trigger Mapping Card */}
          <Card className="brand-glow border-brand-green/20 max-w-2xl mx-auto py-10">
            <CardContent className="flex flex-col items-center justify-center text-center space-y-6">
              <div className="rounded-full bg-green-500/10 border border-green-500/30 p-5 text-brand-green">
                <Sparkles className="h-10 w-10 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">AI Schema Mapping Analysis</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Trigger the AI mapping engine to inspect raw headers and infer column connections to GrowEasy CRM fields.
                </p>
              </div>
              <Button
                size="lg"
                isLoading={analyzeMutation.isPending}
                onClick={() => analyzeMutation.mutate()}
                className="gap-2 shadow-lg shadow-green-500/20"
              >
                Analyze CSV Columns
                <ArrowRight className="h-4 w-4" />
              </Button>

              {analyzeMutation.isError && (
                <div className="w-full max-w-md flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/10 p-3.5 text-xs text-red-400 text-left">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-semibold">AI Analysis Failed:</span> {analyzeMutation.error instanceof Error ? analyzeMutation.error.message : String(analyzeMutation.error)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. Job ANALYZING State: Loading skeleton */}
      {job.status === "ANALYZING" && (
        <Card className="max-w-2xl mx-auto py-12 border-brand-border">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-40"></span>
              <div className="rounded-full bg-green-500/10 border border-green-500/30 p-4 text-brand-green">
                <Settings className="h-6 w-6 animate-spin" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">AI Engine Mapping Columns...</h2>
              <p className="text-xs text-muted-foreground max-w-xs">
                Inferring column meanings, detecting dates, and resolving lead status dictionaries. This takes a few seconds.
              </p>
            </div>
            <div className="w-64 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6 mx-auto" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Job ANALYZED State: Mapping Review & Action */}
      {job.status === "ANALYZED" && (
        <div className="space-y-8">
          <div className="flex border-b border-brand-border gap-6">
            <button
              onClick={() => setActiveTab("mapping")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "mapping" ? "border-brand-green text-brand-green" : "border-transparent text-muted-foreground hover:text-white"
              }`}
            >
              Configure AI Mapping overrides
            </button>
          </div>

          {activeTab === "mapping" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left 2 Columns: Columns & Statuses Config */}
              <div className="lg:col-span-2 space-y-6">
                {/* Column Mappings */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          Column Schema Mapping
                          <Badge variant="default">AI Confidence: {job.mapping_schema?.confidence}%</Badge>
                        </CardTitle>
                        <CardDescription>
                          Verify how columns in your CSV map to standard CRM fields. Override mappings if needed.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 font-semibold text-xs text-muted-foreground pb-2 border-b border-brand-border">
                      <div>CRM Field</div>
                      <div>Mapped CSV Column</div>
                      <div>Description</div>
                    </div>

                    {CRM_FIELDS.map((field) => (
                      <div key={field.name} className="grid grid-cols-3 items-center text-sm py-2 border-b border-brand-border/40 gap-4">
                        <div className="font-medium text-white flex items-center gap-1.5">
                          {field.label}
                          {field.required && <span className="text-red-500 font-bold">*</span>}
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Type CSV column name..."
                            value={mappedFields[field.name] || ""}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-brand-green focus:outline-none"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {field.desc}
                        </div>
                      </div>
                    ))}

                    {/* Available CSV Headers Reference helper */}
                    <div className="mt-6 p-4 bg-brand-dark/45 border border-brand-border rounded-lg text-xs">
                      <span className="font-semibold text-white block mb-2">Available CSV Headers (Click to copy):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {headers.map((h) => (
                          <span
                            key={h}
                            onClick={() => {
                              navigator.clipboard.writeText(h);
                            }}
                            className="bg-zinc-800 border border-brand-border hover:bg-zinc-750 hover:text-white text-zinc-300 px-2 py-1 rounded cursor-pointer transition-colors select-none"
                            title="Click to copy header to clipboard"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground block mt-2">
                        Tip: You can click any header name to copy it, then paste it directly into the mapping fields above.
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Status Mapping */}
                {Object.keys(statusMappings).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Status Vocabulary Mapping</CardTitle>
                      <CardDescription>
                        Normalize messy CRM statuses from your CSV into the four standard GrowEasy Lead Statuses.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 font-semibold text-xs text-muted-foreground pb-2 border-b border-brand-border">
                        <div>CSV Status value</div>
                        <div>CRM Target Status</div>
                      </div>

                      {Object.keys(statusMappings).map((originalVal) => (
                        <div key={originalVal} className="grid grid-cols-2 items-center text-sm py-2 border-b border-brand-border/40 gap-4">
                          <div className="font-mono text-xs text-white bg-zinc-800 px-2.5 py-1.5 rounded-lg border border-brand-border self-start truncate">
                            {originalVal}
                          </div>
                          <div>
                            <select
                              value={statusMappings[originalVal] || ""}
                              onChange={(e) => handleStatusChange(originalVal, e.target.value as CRMStatus)}
                              className="w-full max-w-xs bg-brand-dark border border-brand-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-brand-green focus:outline-none"
                            >
                              {ALLOWED_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column: Execution Side Panel */}
              <div className="lg:col-span-1">
                <Card className="sticky top-20 border-brand-green/20">
                  <CardHeader>
                    <CardTitle className="text-lg">Import Settings</CardTitle>
                    <CardDescription>Launch lead ingestion pipeline.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-1.5 rounded-lg border border-brand-border bg-brand-dark/30 p-4 text-xs text-muted-foreground leading-relaxed">
                      <div className="font-semibold text-white mb-1.5 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-brand-green" />
                        AI Mapping Summary
                      </div>
                      {job.mapping_schema?.reason}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Total records to process:</span>
                        <span className="font-bold text-white">{job.total_records} rows</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Contact validation rules:</span>
                        <span className="text-brand-green font-medium">Email OR Phone required</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => importMutation.mutate()}
                      isLoading={importMutation.isPending}
                      className="w-full gap-2 shadow-lg shadow-green-500/25"
                    >
                      <Play className="h-4 w-4" />
                      Start CRM Import Job
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Job PROCESSING State: Processing Live details */}
      {job.status === "PROCESSING" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="brand-glow border-brand-green/20">
            <CardHeader className="text-center">
              <CardTitle className="text-xl flex items-center justify-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-brand-green animate-ping" />
                Ingesting Leads into GrowEasy CRM
              </CardTitle>
              <CardDescription>
                Streaming CSV file, validating records, and normalising values. Do not close this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-white">Overall Progress</span>
                  <span>{getPercentage(job.processed_records, job.total_records)}% ({job.processed_records} / {job.total_records})</span>
                </div>
                <Progress value={getPercentage(job.processed_records, job.total_records)} className="h-3.5" />
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-4">
                  <div className="text-xl font-bold text-green-400">{job.success_count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Imported</div>
                </div>
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-4">
                  <div className="text-xl font-bold text-amber-400">{job.skipped_count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Skipped</div>
                </div>
                <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-4">
                  <div className="text-xl font-bold text-red-400">{job.failed_count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. Job COMPLETED State: Summary stats & Tables */}
      {job.status === "COMPLETED" && (
        <div className="space-y-8">
          {/* Success Counters Panel */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-brand-green/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Import Completion Status</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-brand-green" />
                <span className="text-lg font-bold text-white">Import Complete</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="text-xs">Successfully Imported</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-green-400">{job.success_count}</span>
                <span className="text-xs text-muted-foreground ml-1.5">leads added</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="text-xs">Skipped (Duplicate / No contacts)</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-amber-400">{job.skipped_count}</span>
                <span className="text-xs text-muted-foreground ml-1.5">leads filtered</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="text-xs">Failed Validation</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-red-400">{job.failed_count}</span>
                <span className="text-xs text-muted-foreground ml-1.5">errors logged</span>
              </CardContent>
            </Card>
          </div>

          {/* Details Tables */}
          <div className="space-y-6">
            <div className="flex border-b border-brand-border gap-6">
              <button
                onClick={() => setActiveTab("leads")}
                className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === "leads" ? "border-brand-green text-brand-green" : "border-transparent text-muted-foreground hover:text-white"
                }`}
              >
                Cleaned Leads ({leads?.length ?? 0})
              </button>
              {job.failed_count > 0 && (
                <button
                  onClick={() => setActiveTab("failed")}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
                    activeTab === "failed" ? "border-brand-green text-brand-green" : "border-transparent text-muted-foreground hover:text-white"
                  }`}
                >
                  Validation Failures ({failedRecords?.length ?? 0})
                </button>
              )}
            </div>

            {/* Cleaned Leads Table */}
            {activeTab === "leads" && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <CardTitle className="text-base">CRM Ingested Records</CardTitle>
                      <CardDescription>These leads were validated, formatted, and added to the CRM.</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search leads..."
                        value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)}
                        className="w-full bg-brand-dark border border-brand-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:ring-1 focus:ring-brand-green focus:outline-none"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {isLeadsLoading ? (
                    <div className="p-6 space-y-3">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : !filteredLeads || filteredLeads.length === 0 ? (
                    <div className="text-center py-10 text-xs text-muted-foreground">
                      No leads match your search criteria.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-brand-border bg-brand-muted/20 text-xs font-semibold text-muted-foreground">
                          <th className="p-4">Name</th>
                          <th className="p-4">Email</th>
                          <th className="p-4">Mobile</th>
                          <th className="p-4">Company</th>
                          <th className="p-4">Location</th>
                          <th className="p-4">CRM Status</th>
                          <th className="p-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border/40 text-xs">
                        {filteredLeads.map((lead: any, idx: number) => (
                          <tr key={idx} className="hover:bg-brand-muted/10 transition-colors">
                            <td className="p-4 font-medium text-white">
                              {lead.first_name || ""} {lead.last_name || ""}
                            </td>
                            <td className="p-4 text-zinc-300 font-mono">{lead.email || "-"}</td>
                            <td className="p-4 text-zinc-300 font-mono">{lead.mobile || "-"}</td>
                            <td className="p-4 text-zinc-300">{lead.company || "-"}</td>
                            <td className="p-4 text-zinc-300">
                              {lead.city || lead.state || lead.country
                                ? [lead.city, lead.state, lead.country].filter(Boolean).join(", ")
                                : "-"}
                            </td>
                            <td className="p-4">
                              <Badge
                                variant={
                                  lead.crm_status === "SALE_DONE"
                                    ? "success"
                                    : lead.crm_status === "BAD_LEAD"
                                    ? "destructive"
                                    : lead.crm_status === "DID_NOT_CONNECT"
                                    ? "destructive"
                                    : "default"
                                }
                              >
                                {lead.crm_status.replace(/_/g, " ")}
                              </Badge>
                            </td>
                            <td className="p-4 text-zinc-400">
                              {new Date(lead.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Validation Failures Table */}
            {activeTab === "failed" && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <CardTitle className="text-base">Failed Validation Records</CardTitle>
                      <CardDescription>
                        Records skipped due to formatting errors or malformed data patterns.
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search failures..."
                        value={failedSearch}
                        onChange={(e) => setFailedSearch(e.target.value)}
                        className="w-full bg-brand-dark border border-brand-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:ring-1 focus:ring-brand-green focus:outline-none"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {isFailedLoading ? (
                    <div className="p-6 space-y-3">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : !filteredFailed || filteredFailed.length === 0 ? (
                    <div className="text-center py-10 text-xs text-muted-foreground">
                      No validation failures match your search criteria.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-brand-border bg-brand-muted/20 text-xs font-semibold text-muted-foreground">
                          <th className="p-4 w-20">Row</th>
                          <th className="p-4 w-1/3">Validation Issues</th>
                          <th className="p-4">Raw Record Data Snippet</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border/40 text-xs">
                        {filteredFailed.map((f: any, idx: number) => (
                          <tr key={idx} className="hover:bg-brand-muted/10 transition-colors">
                            <td className="p-4 font-mono font-bold text-white">{f.row_number}</td>
                            <td className="p-4 font-medium text-red-400">
                              <ul className="list-disc pl-4 space-y-0.5">
                                {f.errors.map((err: string, eIdx: number) => (
                                  <li key={eIdx}>{err}</li>
                                ))}
                              </ul>
                            </td>
                            <td className="p-4 text-zinc-400 font-mono text-[10px] max-w-md truncate">
                              {JSON.stringify(f.raw_data)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 6. Job FAILED State */}
      {job.status === "FAILED" && (
        <Card className="border-red-500/20 max-w-xl mx-auto py-8">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-5">
            <div className="rounded-full bg-red-500/10 border border-red-500/30 p-4 text-red-500">
              <XCircle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">Import Execution Failed</h2>
              <p className="text-sm text-red-400 leading-relaxed max-w-md bg-red-950/20 border border-red-900/30 rounded-lg p-4 font-mono text-left text-xs">
                {job.error_message || "An unexpected error interrupted the lead ingestion stream."}
              </p>
            </div>
            <Button
              onClick={() => {
                // Reset job status to ANALYZED to allow correction
                fetch(`${BACKEND_URL}/api/jobs/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "ANALYZED" }),
                }).then(() => queryClient.invalidateQueries({ queryKey: ["job", id] }));
              }}
            >
              Adjust Settings & Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
