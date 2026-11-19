/**
 * CSV export safety (Phase 11). Every exported cell goes through
 * safeCsvCell: the value is quoted, and spreadsheet formula injection
 * is neutralised by prefixing an apostrophe when the value starts
 * with =, +, -, @, a tab or a carriage return — the characters
 * spreadsheet apps treat as the start of a formula. Exported URLs are
 * additionally defanged at the call site (see lib/defang.ts), so an
 * export can never contain a live or executable link.
 */
export function safeCsvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}
