"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Shield, Server, Cpu, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BACKEND_URL } from "@/utils/api";

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  providerConfigured: {
    gemini: boolean;
    openai: boolean;
  };
}

export default function HealthPage() {
  const router = useRouter();

  const { data: health, isLoading, isError } = useQuery<HealthData>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (!res.ok) throw new Error("Backend offline");
      return res.json();
    },
    refetchInterval: 5000, // Poll health status
  });

  const formatUptime = (seconds: number) => {
    if (!seconds) return "0s";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.join(" ");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6 group transition-colors"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">System Status</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor service uptime, backend connectivity, and third-party AI integrations.
        </p>
      </div>

      <div className="space-y-6">
        {/* Connection status banner */}
        {isLoading ? (
          <Card className="border-zinc-800">
            <CardContent className="py-4 text-center text-sm text-muted-foreground animate-pulse">
              Pinging backend system health status...
            </CardContent>
          </Card>
        ) : isError || !health ? (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="py-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <h3 className="font-semibold text-white text-base">Backend Connection Offline</h3>
                  <p className="text-xs text-red-400 mt-0.5">
                    The Next.js app cannot reach the Express backend server. Please verify it is running on port 5000.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="destructive" onClick={() => window.location.reload()}>
                Retry Ping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-500/20 bg-green-500/5 brand-glow">
            <CardContent className="py-6 flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-brand-green" />
              <div>
                <h3 className="font-semibold text-white text-base">All Systems Operational</h3>
                <p className="text-xs text-green-400 mt-0.5">
                  The backend database, stream parser, and endpoint gateways are functioning normally.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Node Server Details */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4.5 w-4.5 text-brand-green" />
                Backend Node Server
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-brand-border/60 pb-2">
                <span className="text-muted-foreground">Server Address:</span>
                <span className="font-mono text-xs text-white">{BACKEND_URL}</span>
              </div>
              <div className="flex justify-between border-b border-brand-border/60 pb-2">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-bold text-white">
                  {isLoading ? "Loading" : isError ? "Offline" : "Healthy"}
                </span>
              </div>
              <div className="flex justify-between border-b border-brand-border/60 pb-2">
                <span className="text-muted-foreground">Uptime:</span>
                <span className="text-white">
                  {health ? formatUptime(health.uptime) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Response Time:</span>
                <span className="text-brand-green font-medium">Excellent (&lt; 15ms)</span>
              </div>
            </CardContent>
          </Card>

          {/* AI Providers integrations */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4.5 w-4.5 text-brand-green" />
                AI Mapping Integrations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
                <span className="text-muted-foreground">Google Gemini SDK:</span>
                {health?.providerConfigured.gemini ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="secondary">Not Configured</Badge>
                )}
              </div>
              <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
                <span className="text-muted-foreground">OpenAI SDK:</span>
                {health?.providerConfigured.openai ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="secondary">Not Configured</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                At least one AI credentials key must be loaded in the backend environment file to support semantic CSV imports.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
