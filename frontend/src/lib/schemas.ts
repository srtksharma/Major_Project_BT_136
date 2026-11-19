import { z } from "zod";

import type { ScanResult } from "@/types/api";

/**
 * Runtime validation for untrusted data (Phase 11): backend
 * responses and localStorage history are both treated as hostile
 * until they parse against these schemas, which mirror the API
 * contract in types/api.ts exactly (same fields, plus sane size
 * caps). Anything malformed or tampered with is dropped or turned
 * into a friendly error — it never reaches the UI as-is.
 */
export const scanFeatureSchema = z.object({
  name: z.string().min(1).max(200),
  value: z.union([z.string().max(500), z.number()]),
  impact: z.number().min(-1).max(1),
  description: z.string().max(1_000),
});

export const scanResultSchema = z.object({
  id: z.string().min(1).max(200),
  url: z.string().min(1).max(8_192),
  verdict: z.enum(["safe", "suspicious", "phishing"]),
  confidence: z.number().min(0).max(100),
  scannedAt: z
    .string()
    .min(1)
    .max(100)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "scannedAt must be a parseable date string",
    }),
  features: z.array(scanFeatureSchema).max(50),
});

export const scanHistorySchema = z.array(scanResultSchema).max(1_000);

/** One result, or null when the payload doesn't match the contract. */
export function parseScanResult(data: unknown): ScanResult | null {
  const parsed = scanResultSchema.safeParse(data);
  return parsed.success ? (parsed.data as ScanResult) : null;
}

/**
 * A history list, tolerantly: valid entries are kept, malformed or
 * tampered entries are dropped. Non-array input yields an empty list.
 */
export function parseScanHistory(data: unknown): ScanResult[] {
  if (!Array.isArray(data)) return [];
  const valid: ScanResult[] = [];
  for (const item of data.slice(0, 1_000)) {
    const parsed = parseScanResult(item);
    if (parsed) valid.push(parsed);
  }
  return valid;
}
