import type { Metadata } from "next";
import { Suspense } from "react";

import { ScanPageClient } from "@/components/scan/scan-page-client";

export const metadata: Metadata = {
  title: "Scan a URL",
  description:
    "Scan a single URL for phishing signals — get a verdict, a confidence score, and a plain-language breakdown of every signal behind it.",
};

export default function ScanPage() {
  return (
    // useSearchParams in the client component requires a Suspense boundary.
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl" aria-busy="true" aria-label="Loading the scanner">
          <div className="flex flex-col items-center">
            <div className="size-12 animate-pulse rounded-2xl bg-muted" />
            <div className="mt-4 h-9 w-64 animate-pulse rounded-lg bg-muted" />
            <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="glass-card mt-8 h-16 animate-pulse" />
          <div className="mt-4 h-4 w-40 animate-pulse rounded bg-muted" />
          <span className="sr-only">Loading the scanner…</span>
        </div>
      }
    >
      <ScanPageClient />
    </Suspense>
  );
}
