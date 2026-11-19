/**
 * Shared API types — the contract the backend team will match.
 *
 * POST /api/scan
 *   Request:  ScanRequest
 *   Response: ScanResult
 * GET /api/history
 *   Response: ScanResult[]
 */

/** The model's verdict for a scanned URL. */
export type Verdict = "safe" | "suspicious" | "phishing";

/** Body sent to POST /api/scan. */
export interface ScanRequest {
  url: string;
}

/**
 * One analysed signal behind a verdict.
 * `impact` runs from -1 (strongly protective) to +1 (strongly risky).
 */
export interface ScanFeature {
  name: string;
  value: string | number;
  impact: number; // -1 to 1
  description: string;
}

/** A single scan result, as returned by POST /api/scan and GET /api/history. */
export interface ScanResult {
  id: string;
  url: string;
  verdict: Verdict;
  /** Model confidence, 0–100 (percentage). */
  confidence: number;
  /** ISO 8601 timestamp of when the scan ran. */
  scannedAt: string;
  features: ScanFeature[];
}

/** Response of GET /api/history — past scans, most recent first. */
export type ScanHistoryResponse = ScanResult[];

/** Error shape the UI expects when a request fails. */
export interface ApiError {
  message: string;
  status?: number;
}
