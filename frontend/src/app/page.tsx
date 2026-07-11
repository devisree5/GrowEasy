"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Database,
  ArrowRight,
  Trash2,
  TrendingUp,
  XCircle,
  HelpCircle,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BACKEND_URL } from "@/utils/api";

interface JobSummary {
  id: string;
  filename: string;
  status: 'PENDING' | 'ANALYZING' | 'ANALYZED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total_records: number;
  processed_records: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  error_message?: string;
}

interface Metrics {
  totalJobs: number;
  jobsByStatus: Record<string, number>;
  totalRecordsProcessed: number;
  totalSuccessfulLeads: number;
  totalFailedLeads: number;
  totalSkippedLeads: number;
}

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch metrics
  const { data: metrics, isLoading: isMetricsLoading } = useQuery<Metrics>({
    queryKey: ["metrics"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/metrics`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
    refetchInterval: 5000, // Poll metrics every 5s for live updates
  });

  // Fetch jobs
  const { data: jobs, isLoading: isJobsLoading } = useQuery<JobSummary[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/jobs`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    refetchInterval: 5000, // Poll jobs
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setErrorMessage(null);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      // We'll use standard XMLHttpRequest to track upload progress
      return new Promise<{ jobId: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${BACKEND_URL}/api/upload`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (err) {
              reject(new Error("Failed to parse server response"));
            }
          } else {
            try {
              const response = JSON.parse(xhr.responseText);
              reject(new Error(response.error || "Upload failed"));
            } catch (err) {
              reject(new Error(`Server returned status code ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network connection error"));
        };

        xhr.send(formData);
      });
    },
    onSuccess: (data) => {
      setUploadProgress(null);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      router.push(`/import/${data.jobId}`);
    },
    onError: (error: any) => {
      setUploadProgress(null);
      setErrorMessage(error.message || "Something went wrong during upload.");
    },
  });

  // Delete Job Mutation
  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      // Actually we don't have delete route documented, let's add a DELETE route or simple placeholder.
      // Wait, let's see. Did we write a delete function in the repository?
      // Yes, jobRepository has `delete(id)`. Let's create a DELETE endpoint if we want, or just trigger it.
      // Wait! We can verify if our server.ts has a delete route.
      // Let's look at server.ts: it does NOT have app.delete('/api/jobs/:id'). Let's add it or keep it simple.
      // Wait, let's add app.delete in server.ts so the user can delete jobs!
      // Let's write the delete job logic, but let's first check if we need to call it.
      // We can add it so the UI feels like an enterprise dashboard. Let's make it work!
      const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
        method: "DELETE",
      });
      // Fallback if not supported: we can just delete from frontend or implement backend.
      // Let's implement DELETE in backend! I will add it in backend files.
      if (!res.ok) throw new Error("Failed to delete job");
      return jobId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        uploadMutation.mutate(acceptedFiles[0]);
      }
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    disabled: uploadMutation.isPending,
  });

  const getStatusBadge = (status: JobSummary["status"]) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="success">Completed</Badge>;
      case "PROCESSING":
        return <Badge variant="default" className="animate-pulse">Processing</Badge>;
      case "ANALYZING":
        return <Badge variant="warning" className="animate-pulse">Analyzing</Badge>;
      case "ANALYZED":
        return <Badge variant="secondary">Ready to Import</Badge>;
      case "PENDING":
        return <Badge variant="secondary">Pending</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPercentage = (processed: number, total: number) => {
    if (!total) return 0;
    return Math.round((processed / total) * 100);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Import Any Lead CSV. <span className="gradient-text">AI Normalizes.</span>
        </h1>
        <p className="mt-2 text-base text-muted-foreground max-w-2xl">
          Upload any CSV from Facebook, Google Ads, LinkedIn, HubSpot, or Salesforce. 
          Our LLM understands header meanings, cleans messy dates, normalizes status formats, and filters junk records.
        </p>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          {
            title: "Total Records",
            value: isMetricsLoading ? "..." : metrics?.totalRecordsProcessed ?? 0,
            description: "Total rows parsed",
            icon: Database,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
          },
          {
            title: "Successfully Imported",
            value: isMetricsLoading ? "..." : metrics?.totalSuccessfulLeads ?? 0,
            description: "CRM leads created",
            icon: CheckCircle,
            color: "text-brand-green",
            bg: "bg-green-500/10",
            border: "border-green-500/20",
          },
          {
            title: "Skipped Records",
            value: isMetricsLoading ? "..." : metrics?.totalSkippedLeads ?? 0,
            description: "Missing contact details",
            icon: HelpCircle,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
          },
          {
            title: "Failed / Validation Errors",
            value: isMetricsLoading ? "..." : metrics?.totalFailedLeads ?? 0,
            description: "Malformed entries",
            icon: XCircle,
            color: "text-red-500",
            bg: "bg-red-500/10",
            border: "border-red-500/20",
          },
        ].map((stat, idx) => (
          <Card key={idx} className={stat.border}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Side: Upload Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="brand-glow border-brand-green/20">
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Drag and drop your lead export here. We support any structure up to 100K+ records (Max 50MB).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200 min-h-[220px] ${
                  isDragActive
                    ? "border-brand-green bg-green-500/5"
                    : "border-brand-border hover:border-zinc-700 hover:bg-zinc-900/20"
                } ${uploadMutation.isPending ? "pointer-events-none opacity-60" : ""}`}
              >
                <input {...getInputProps()} />
                <div className="rounded-full bg-brand-muted border border-brand-border p-4 text-brand-green mb-4">
                  <Upload className="h-6 w-6 animate-bounce" />
                </div>
                {isDragActive ? (
                  <p className="text-sm font-medium text-brand-green">Drop the file here...</p>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Drag and drop files, or <span className="text-brand-green underline">browse</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">CSV format only</p>
                  </div>
                )}
              </div>

              {uploadProgress !== null && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-white">Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/10 p-3.5 text-xs text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-semibold">Upload Failed:</span> {errorMessage}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Jobs List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Imports</CardTitle>
                <CardDescription>View, configure, and monitor your AI CSV Import jobs.</CardDescription>
              </div>
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent>
              {isJobsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex items-center justify-between rounded-lg border border-brand-border p-4">
                      <div className="space-y-2 w-1/3">
                        <div className="h-4 bg-brand-border rounded w-3/4 animate-pulse"></div>
                        <div className="h-3 bg-brand-border rounded w-1/2 animate-pulse"></div>
                      </div>
                      <div className="h-8 bg-brand-border rounded w-20 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              ) : !jobs || jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-brand-muted border border-brand-border p-4 text-muted-foreground mb-4">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No import history found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Upload your first CSV lead export on the left panel to begin mapping and cleaning data with AI.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => {
                    const pct = getPercentage(job.processed_records, job.total_records);
                    const isCompleted = job.status === "COMPLETED";
                    const isProcessing = job.status === "PROCESSING" || job.status === "ANALYZING";
                    const isReady = job.status === "ANALYZED";
                    const formattedDate = new Date(job.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={job.id}
                        onClick={() => router.push(`/import/${job.id}`)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-brand-border p-4 bg-brand-dark/25 hover:bg-brand-muted/40 cursor-pointer transition-all duration-200 gap-4"
                      >
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white truncate text-sm sm:text-base">
                              {job.filename}
                            </span>
                            {getStatusBadge(job.status)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formattedDate}
                            </span>
                            <span>•</span>
                            <span>{job.total_records} rows</span>
                          </div>
                          
                          {/* Live progress indicator during execution */}
                          {isProcessing && (
                            <div className="mt-3 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-medium text-brand-green">
                                <span>Processing: {job.processed_records} / {job.total_records}</span>
                                <span>{pct}%</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          )}

                          {isCompleted && (
                            <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] font-medium">
                              <span className="text-green-400">Imported: {job.success_count}</span>
                              <span className="text-amber-400">Skipped: {job.skipped_count}</span>
                              <span className="text-red-400">Failed: {job.failed_count}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2.5 shrink-0 self-end sm:self-center">
                          {isReady && (
                            <Button size="sm" variant="default" className="gap-1 shadow-sm shadow-green-950/20">
                              Map & Import
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isReady && !isProcessing && (
                            <Button size="sm" variant="outline">
                              View Details
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm("Are you sure you want to delete this job and all associated records?")) {
                                deleteMutation.mutate(job.id);
                              }
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
