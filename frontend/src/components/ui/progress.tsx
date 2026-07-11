import * as React from "react";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0 to 100
}

export function Progress({ className, value = 0, ...props }: ProgressProps) {
  const percentage = Math.min(Math.max(value, 0), 100);

  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-brand-muted border border-brand-border ${className || ""}`}
      {...props}
    >
      <div
        className="h-full bg-brand-green transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
