import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GrowEasy CRM - AI CSV Importer",
  description: "Intelligently map and import any lead CSV into GrowEasy CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-brand-dark text-foreground">
        <QueryProvider>
          {/* Header */}
          <header className="sticky top-0 z-50 w-full border-b border-brand-border bg-brand-dark/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/30 text-brand-green brand-glow">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                    GrowEasy
                    <span className="rounded bg-brand-green/10 border border-brand-green/20 px-1.5 py-0.5 text-[10px] font-medium text-brand-green">
                      AI Importer
                    </span>
                  </span>
                </div>
              </div>
              
              <nav className="flex items-center gap-6">
                <a
                  href="/"
                  className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                >
                  Dashboard
                </a>
                <a
                  href="/metrics"
                  className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                >
                  Metrics
                </a>
                <a
                  href="/health"
                  className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                >
                  Health Status
                </a>
              </nav>
            </div>
          </header>

          <main className="flex-1 flex flex-col">{children}</main>

          {/* Footer */}
          <footer className="border-t border-brand-border bg-brand-dark py-6 text-center text-xs text-muted-foreground">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              &copy; {new Date().getFullYear()} GrowEasy CRM. All rights reserved. Powered by Advanced AI Mapping.
            </div>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}
