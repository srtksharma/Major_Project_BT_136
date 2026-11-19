import { MOCK_HISTORY } from "@/lib/mock-data";
import { mockScan } from "@/lib/mock-scan";
import { parseScanHistory, parseScanResult } from "@/lib/schemas";
import type {
  ScanHistoryResponse,
  ScanRequest,
  ScanResult,
} from "@/types/api";

/**
 * Single service layer for every backend call in the app.
 *
 * Mock mode (default): scans are produced by the rule-based mock
 * engine in lib/mock-scan.ts after a realistic 2–3 second delay, and
 * history is seeded by lib/mock-data.ts, then persisted in
 * localStorage so real user scans survive reloads.
 *
 * SECURITY NOTE: the checks in this layer — input validation,
 * response validation, timeouts, retries, client-side throttling —
 * exist for user experience only. Anyone can bypass client-side code,
 * so real rate limiting, bot protection, authentication and input
 * validation MUST be enforced by the backend. Never trust the client.
 *
 * Real mode: set these in .env.local —
 *   NEXT_PUBLIC_USE_MOCK=false
 *   NEXT_PUBLIC_API_URL=https://your-backend.example.com
 * …and the same functions call POST /api/scan and GET /api/history on
 * that backend. No component or hook code changes when switching.
 */
/**
 * True while the app runs on simulated data. Either flag switches to
 * the real backend: NEXT_PUBLIC_USE_MOCK (current) or the legacy
 * NEXT_PUBLIC_USE_MOCK_API name — setting one to "false" is enough.
 * UI uses this to show/hide the "Demo mode" badge on results.
 */
export const IS_MOCK_MODE =
  process.env.NEXT_PUBLIC_USE_MOCK !== "false" &&
  process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";
const USE_MOCK = IS_MOCK_MODE;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Mock scan latency: 2.2s base + up to 0.6s, so 2–3 seconds overall. */
const MOCK_SCAN_DELAY_MS = 2200;
const MOCK_HISTORY_DELAY_MS = 600;

/**
 * Mock history store (Phase 8): seeded once from lib/mock-data.ts,
 * then persisted to localStorage so scans the user actually runs stay
 * in the history (and on the Dashboard) across page reloads. Mock
 * mode only — real mode always asks the backend. Capped at 200
 * entries, most recent first.
 */
const HISTORY_STORAGE_KEY = "linklens-scan-history-v1";
const HISTORY_LIMIT = 200;
let mockHistoryStore: ScanResult[] | null = null;

function loadMockHistory(): ScanResult[] {
  if (mockHistoryStore) return mockHistoryStore;
  let initial: ScanResult[] = [...MOCK_HISTORY];
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        // Stored history is untrusted (anyone can edit localStorage):
        // keep only entries that parse against the API schema, and
        // fall back to the seed set if nothing valid remains.
        const stored = parseScanHistory(JSON.parse(raw));
        if (stored.length > 0) initial = stored;
      }
    } catch {
      // Corrupt or unavailable storage — fall back to the seed set.
    }
  }
  mockHistoryStore = initial.slice(0, HISTORY_LIMIT);
  persistMockHistory();
  return mockHistoryStore;
}

function persistMockHistory() {
  if (typeof window === "undefined" || !mockHistoryStore) return;
  try {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(mockHistoryStore),
    );
  } catch {
    // Storage full or blocked — history simply stays in memory.
  }
}

/** Delay that rejects immediately with an AbortError if the signal fires. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The scan was cancelled.", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("The scan was cancelled.", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/* ------------------------------------------------------------------ */
/* Real-mode HTTP layer (Phase 11 hardening):                          */
/* - 15s timeout via AbortController, composed with the caller's       */
/*   signal so user cancellation still wins instantly.                 */
/* - Up to 2 retries with backoff for NETWORK errors only (a 4xx/5xx   */
/*   answer is a decision, not a transient failure — never retried).   */
/* - HTTP 429 becomes a RateLimitError carrying Retry-After, so the    */
/*   UI can show "try again in N seconds" and pause the Scan button.   */
/* - credentials: "omit" — no cookies are ever sent to the API.        */
/* - Bodies are parsed defensively and validated against the Zod       */
/*   schemas in lib/schemas.ts before anything reaches the UI.         */
/* - Scanned URLs are never logged anywhere in this layer.             */
/* ------------------------------------------------------------------ */
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_NETWORK_RETRIES = 2;
const RETRY_DELAYS_MS = [400, 1_200];

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(
      `Too many requests — the scan service is busy. Please try again in ${retryAfterSeconds} seconds.`,
    );
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

function parseRetryAfter(response: Response): number {
  const header = response.headers.get("Retry-After");
  if (header) {
    const seconds = Number.parseInt(header, 10);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 600);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) {
      return Math.max(1, Math.min(600, Math.ceil((date - Date.now()) / 1000)));
    }
  }
  return 30;
}

async function fetchOnce(
  path: string,
  init: (RequestInit & { callerSignal?: AbortSignal }) | undefined,
): Promise<Response> {
  const { callerSignal, ...rest } = init ?? {};
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new DOMException("The request timed out.", "TimeoutError"),
    );
  }, REQUEST_TIMEOUT_MS);
  const onCallerAbort = () =>
    controller.abort(
      callerSignal?.reason ?? new DOMException("Aborted.", "AbortError"),
    );
  if (callerSignal) {
    if (callerSignal.aborted) onCallerAbort();
    else
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }
  try {
    return await fetch(`${API_BASE}${path}`, {
      credentials: "omit",
      headers: { "Content-Type": "application/json", ...rest.headers },
      ...rest,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}

async function requestJson(
  path: string,
  init?: RequestInit & { callerSignal?: AbortSignal },
): Promise<unknown> {
  let lastNetworkError: unknown = null;
  for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt += 1) {
    if (attempt > 0) {
      await wait(RETRY_DELAYS_MS[attempt - 1], init?.callerSignal);
    }
    let response: Response;
    try {
      response = await fetchOnce(path, init);
    } catch (error) {
      // The user cancelled — surface that immediately, never retry.
      if (init?.callerSignal?.aborted) throw error;
      lastNetworkError = error;
      continue;
    }
    if (response.status === 429) throw new RateLimitError(parseRetryAfter(response));
    if (!response.ok) {
      throw new Error(
        response.status >= 500
          ? `The scan service is having trouble right now (${response.status}). Please try again in a moment.`
          : `The scan service rejected the request (${response.status}). Please check the URL and try again.`,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new Error(
        "The scan service sent a response we couldn't read. Please try again.",
      );
    }
  }
  if (lastNetworkError instanceof DOMException && lastNetworkError.name === "TimeoutError") {
    throw new Error(
      "The scan service took too long to respond. Please try again.",
    );
  }
  throw new Error(
    "Couldn't reach the scan service. Check your connection and try again.",
  );
}

/**
 * POST /api/scan — submit one URL for ML + URL analysis.
 * Pass an AbortSignal to cancel an in-flight scan (rejects with an
 * AbortError; a cancelled scan is never added to history).
 */
export async function scanUrl(
  payload: ScanRequest,
  signal?: AbortSignal,
  options?: { fastMode?: boolean },
): Promise<ScanResult> {
  if (USE_MOCK) {
    // Batch scans (Phase 9) use a short 300–800ms per-URL delay so a
    // batch of 30 finishes in seconds instead of minutes.
    const delay = options?.fastMode
      ? 300 + Math.random() * 500
      : MOCK_SCAN_DELAY_MS + Math.random() * 600;
    await wait(delay, signal);
    // Test hook (Phase 10): any URL containing "error-test" fails in
    // mock mode, so scan/batch error states can be exercised on demand.
    if (payload.url.toLowerCase().includes("error-test")) {
      throw new Error(
        "The scan service could not analyse this URL (simulated failure — this URL contains the error-test marker).",
      );
    }
    const result = mockScan(payload.url);
    mockHistoryStore = [result, ...loadMockHistory()].slice(0, HISTORY_LIMIT);
    persistMockHistory();
    return result;
  }
  const data = await requestJson("/api/scan", {
    method: "POST",
    body: JSON.stringify(payload),
    callerSignal: signal,
  });
  const result = parseScanResult(data);
  if (!result) {
    throw new Error(
      "The scan service sent a result in an unexpected format. Please try again.",
    );
  }
  return result;
}

/** GET /api/history — past scan results, most recent first. */
export async function getHistory(): Promise<ScanHistoryResponse> {
  if (USE_MOCK) {
    await wait(MOCK_HISTORY_DELAY_MS);
    return [...loadMockHistory()];
  }
  const data = await requestJson("/api/history");
  if (!Array.isArray(data)) {
    throw new Error(
      "The scan service sent history in an unexpected format. Please try again.",
    );
  }
  return parseScanHistory(data);
}
