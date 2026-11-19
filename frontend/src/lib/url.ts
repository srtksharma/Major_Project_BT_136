import { z } from "zod";

/**
 * URL normalisation + validation shared by the scan form.
 *
 * Rules:
 * - Surrounding whitespace is trimmed.
 * - A missing protocol is fixed by prepending https://
 *   ("example.com/login" -> "https://example.com/login").
 * - Only http/https URLs with a real host (a dotted domain, an IP
 *   address, or localhost) are accepted.
 */

/** Maximum accepted URL length (browsers cap URLs around 2,083). */
export const MAX_URL_LENGTH = 2048;

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

const IPV4_HOST = /^(\d{1,3}\.){3}\d{1,3}$/;

export function isValidHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  const host = parsed.hostname;
  return host.includes(".") || IPV4_HOST.test(host) || host === "localhost";
}

/** Zod schema for the scan form — validates and normalises in one step. */
export const scanFormSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Paste or type a URL first — for example, https://example.com.")
    .max(MAX_URL_LENGTH, "That URL is unusually long. Check you pasted a single link.")
    .transform((value) => normalizeUrl(value))
    .refine(isValidHttpUrl, {
      message:
        "That doesn't look like a valid URL. Check for typos — it should look like https://example.com/login.",
    }),
});

export type ScanFormInput = z.input<typeof scanFormSchema>;
export type ScanFormValues = z.output<typeof scanFormSchema>;
