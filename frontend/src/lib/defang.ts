/**
 * Defang a URL so it can be displayed safely as plain text —
 * e.g. "http://evil.com/login" -> "hxxp://evil[.]com/login".
 *
 * Scanned URLs must NEVER be rendered as clickable links anywhere
 * in this app; always pass them through this helper for display.
 * The raw URL from the API stays untouched in data/state.
 */
export function defangUrl(url: string): string {
  return url
    .replace(/^http/i, "hxxp") // http -> hxxp, https -> hxxps
    .replace(/\./g, "[.]");
}
