import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const baseStyles =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  const variants = {
    default: "border-transparent bg-brand-green text-white shadow shadow-green-950/20",
    secondary: "border-transparent bg-brand-muted text-foreground border border-brand-border",
    outline: "text-foreground border-brand-border",
    destructive: "border-transparent bg-red-600/20 text-red-400 border border-red-500/25",
    success: "border-transparent bg-green-500/20 text-green-400 border border-green-500/25",
    warning: "border-transparent bg-amber-500/20 text-amber-400 border border-amber-500/25",
  };

  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${className || ""}`}
      {...props}
    />
  );
}
