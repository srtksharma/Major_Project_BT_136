import { MAX_URL_LENGTH, isValidHttpUrl, normalizeUrl } from "@/lib/url";

/**
 * Batch input parsing (Phase 9): turns pasted text or an uploaded
 * CSV/TXT file into validated, de-duplicated URL rows.
 *
 * Rules: a CSV "url" header column wins, otherwise the first column
 * is used; blank lines are skipped; a missing protocol is fixed with
 * https://; duplicates are removed and counted; invalid rows are
 * kept in the list (flagged with a reason) so the preview can report
 * them — they are never scanned.
 */

export const MAX_BATCH_URLS = 500;
export const MAX_FILE_BYTES = 1_000_000; // 1 MB

export interface ParsedBatchRow {
  id: string;
  /** What the user actually supplied (trimmed). */
  input: string;
  /** Normalised URL that will be scanned (equals input when invalid). */
  url: string;
  valid: boolean;
  /** Why the row cannot be scanned (only when valid === false). */
  reason?: string;
}

export interface ParsedBatch {
  rows: ParsedBatchRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  truncatedCount: number;
}

/** Split one CSV line into cells, honouring double-quoted values. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/** Extract the raw URL strings from pasted text or file contents. */
export function extractRawUrls(text: string, isCsv: boolean): string[] {
  const lines = text.split(/\r?\n/);
  if (!isCsv) {
    return lines.map((line) => line.trim());
  }
  const rows = lines
    .filter((line) => line.trim() !== "")
    .map(splitCsvLine);
  if (rows.length === 0) return [];
  const header = rows[0].map((cell) => cell.toLowerCase());
  const urlColumn = header.indexOf("url");
  if (urlColumn >= 0) {
    return rows.slice(1).map((cells) => (cells[urlColumn] ?? "").trim());
  }
  return rows.map((cells) => (cells[0] ?? "").trim());
}

export function parseBatch(text: string, isCsv: boolean): ParsedBatch {
  const rawUrls = extractRawUrls(text, isCsv);
  const seen = new Set<string>();
  const rows: ParsedBatchRow[] = [];
  let duplicateCount = 0;
  let truncatedCount = 0;

  rawUrls.forEach((raw, index) => {
    if (raw === "") return; // blank line
    const url = normalizeUrl(raw);
    if (url.length > MAX_URL_LENGTH) {
      rows.push({
        id: `row_${rows.length + 1}`,
        input: raw,
        url,
        valid: false,
        reason: `This URL is longer than the ${MAX_URL_LENGTH.toLocaleString("en-US")}-character limit.`,
      });
      return;
    }
    const key = url.toLowerCase();
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }
    seen.add(key);
    if (rows.length >= MAX_BATCH_URLS) {
      truncatedCount += 1;
      return;
    }
    const valid = isValidHttpUrl(url);
    rows.push({
      id: `row_${index}`,
      input: raw,
      url,
      valid,
      reason: valid
        ? undefined
        : "Not a valid http/https URL — check for typos or a missing domain.",
    });
  });

  return {
    rows,
    validCount: rows.filter((row) => row.valid).length,
    invalidCount: rows.filter((row) => !row.valid).length,
    duplicateCount,
    truncatedCount,
  };
}

/** Contents of the downloadable sample CSV. */
export const SAMPLE_CSV = [
  "url",
  "https://www.google.com",
  "https://github.com",
  "en.wikipedia.org/wiki/Phishing",
  "https://192.168.1.10/login",
  "http://secure-login-verify-free-prize.xyz/account/update",
  "",
].join("\n");

// CSV cell safety lives in lib/csv.ts (shared by every export);
// re-exported here for existing imports.
export { safeCsvCell } from "@/lib/csv";

/**
 * Cheap content sniff for uploaded files (Phase 11): the extension
 * check alone is not enough, so reject anything that looks binary —
 * NUL bytes, or a high share of control characters in the first
 * chunk. Real CSV/TXT exports never contain either.
 */
export function isProbablyTextContent(content: string): boolean {
  const sample = content.slice(0, 4096);
  if (sample.includes("\u0000")) return false;
  if (sample.length === 0) return true;
  let control = 0;
  for (const ch of sample) {
    const code = ch.charCodeAt(0);
    if (code < 0x20 && ch !== "\t" && ch !== "\n" && ch !== "\r") control += 1;
  }
  return control / sample.length < 0.02;
}
