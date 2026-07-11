"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Database, CheckSquare, AlertTriangle, RefreshCw, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BACKEND_URL } from "@/utils/api";
import { Progress } from "@/components/ui/progress";

interface MetricsData {
  totalJobs: number;
  jobsByStatus: {
    PENDING: number;
    ANALYZING: number;
    ANALYZED: number;
    PROCESSING: number;
    COMPLETED: number;
    FAILED: number;
  };
  totalRecordsProcessed: number;
  totalSuccessfulLeads: number;
  totalFailedLeads: number;
  totalSkippedLeads: number;
}

export default function MetricsPage() {
  const router = useRouter();

  const { data: metrics, isLoading, isError, refetch, isRefetching } = useQuery<MetricsData>({
    queryKey: ["metricsPage"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/metrics`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
  });

  const getPercentageOfTotal = (value: number) => {
    if (!metrics || !metrics.totalRecordsProcessed) return 0;
    return Math.round((value / metrics.totalRecordsProcessed) * 100);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white group transition-colors"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white disabled:opacity-50 transition-colors bg-brand-muted/80 border border-brand-border px-3 py-1.5 rounded-lg"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh Stats
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">System Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detailed metrics showing performance, processing workloads, and ingestion ratios.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 bg-brand-muted rounded-xl animate-pulse border border-brand-border" />
            ))}
          </div>
          <div className="h-64 bg-brand-muted rounded-xl animate-pulse border border-brand-border" />
        </div>
      ) : isError || !metrics ? (
        <Card className="border-red-500/20 bg-red-500/5 py-12 text-center text-sm text-red-400">
          Failed to load telemetry metrics. Please ensure the backend connection is active.
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Top Level Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Total Imports Executed</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Database className="h-6 w-6 text-blue-400" />
                <span className="text-3xl font-extrabold text-white">{metrics.totalJobs}</span>
                <span className="text-xs text-muted-foreground self-end mb-1">jobs</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Processed CSV Data Rows</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Layers className="h-6 w-6 text-brand-green" />
                <span className="text-3xl font-extrabold text-white">
                  {metrics.totalRecordsProcessed.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground self-end mb-1">records</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Overall CRM Ingestion Rate</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-purple-400" />
                <span className="text-3xl font-extrabold text-white">
                  {getPercentageOfTotal(metrics.totalSuccessfulLeads)}%
                </span>
                <span className="text-xs text-muted-foreground self-end mb-1">conversion</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lead Breakdown Ratios */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ingestion Breakdown</CardTitle>
                <CardDescription>Ratios of clean, skipped, and validation failures across all jobs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Successful leads */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-white">Clean CRM Leads ({metrics.totalSuccessfulLeads.toLocaleString()})</span>
                    <span>{getPercentageOfTotal(metrics.totalSuccessfulLeads)}%</span>
                  </div>
                  <Progress value={getPercentageOfTotal(metrics.totalSuccessfulLeads)} className="h-2" />
                </div>

                {/* Skipped */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-white">Skipped / Duplicates ({metrics.totalSkippedLeads.toLocaleString()})</span>
                    <span>{getPercentageOfTotal(metrics.totalSkippedLeads)}%</span>
                  </div>
                  <Progress value={getPercentageOfTotal(metrics.totalSkippedLeads)} className="h-2" />
                </div>

                {/* Failed */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-white">Validation Errors ({metrics.totalFailedLeads.toLocaleString()})</span>
                    <span>{getPercentageOfTotal(metrics.totalFailedLeads)}%</span>
                  </div>
                  <Progress value={getPercentageOfTotal(metrics.totalFailedLeads)} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Jobs Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import Workloads</CardTitle>
                <CardDescription>Overview of job states in the scheduler queue.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm font-medium">
                {[
                  { label: "Completed", count: metrics.jobsByStatus.COMPLETED, color: "text-green-400" },
                  { label: "Processing", count: metrics.jobsByStatus.PROCESSING, color: "text-blue-400 animate-pulse" },
                  { label: "Analyzing", count: metrics.jobsByStatus.ANALYZING, color: "text-amber-400" },
                  { label: "Analyzed (Pending)", count: metrics.jobsByStatus.ANALYZED, color: "text-zinc-400" },
                  { label: "Pending Upload", count: metrics.jobsByStatus.PENDING, color: "text-zinc-500" },
                  { label: "Failed Pipeline", count: metrics.jobsByStatus.FAILED, color: "text-red-400" },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center rounded-lg border border-brand-border/60 bg-brand-dark/20 p-3">
                    <span className="text-muted-foreground text-xs">{item.label}</span>
                    <span className={`font-bold ${item.color}`}>{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
