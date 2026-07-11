import * as React from "react";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded bg-brand-muted border border-brand-border/50 ${className || ""}`}
      {...props}
    />
  );
}
