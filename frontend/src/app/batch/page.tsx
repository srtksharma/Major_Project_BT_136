import type { Metadata } from "next";

import { BatchPageClient } from "@/components/batch/batch-page-client";

export const metadata: Metadata = {
  title: "Batch Scan",
  description:
    "Scan up to 500 URLs at once from a CSV or pasted list, with a preview, live progress, and an exportable results table.",
};

export default function BatchPage() {
  return <BatchPageClient />;
}
