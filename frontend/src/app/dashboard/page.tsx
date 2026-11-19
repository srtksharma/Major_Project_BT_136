import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your LinkLens scan history and statistics: verdict trends over time, top risk signals, and every past scan with its full report.",
};

export default function DashboardPage() {
  return (
    // Suspense defers the client dashboard (which reads the current
    // time for its date ranges) past prerendering.
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="Loading the dashboard">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card h-28 animate-pulse" />
            ))}
          </div>
          <div className="glass-card mt-6 h-72 animate-pulse" />
          <span className="sr-only">Loading the dashboard…</span>
        </div>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
