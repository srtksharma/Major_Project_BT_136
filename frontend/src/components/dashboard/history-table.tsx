"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { VERDICT_META, VERDICT_ORDER } from "@/components/dashboard/charts";
import { safeCsvCell } from "@/lib/csv";
import { defangUrl } from "@/lib/defang";
import { cn } from "@/lib/utils";
import type { ScanResult, Verdict } from "@/types/api";

/**
 * Scan history table (Phase 8): search, verdict filter, sorting and
 * pagination (10 per page) over the range-filtered rows. On mobile it
 * becomes stacked cards. URLs are always defanged text — never links.
 * Export CSV downloads the currently filtered rows.
 */

const PAGE_SIZE = 10;

type SortKey = "newest" | "oldest" | "confidence-desc" | "confidence-asc";
type VerdictFilter = Verdict | "all";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "confidence-desc", label: "Confidence: high to low" },
  { value: "confidence-asc", label: "Confidence: low to high" },
];

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const meta = VERDICT_META[verdict];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        meta.chipClasses,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}



function exportCsv(rows: ScanResult[]) {
  const lines = [
    "scanned_at,verdict,confidence_percent,url_defanged",
    ...rows.map((row) =>
      [
        row.scannedAt,
        row.verdict,
        String(row.confidence),
        defangUrl(row.url),
      ]
        .map(safeCsvCell)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "linklens-history.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

interface HistoryTableProps {
  /** Rows already filtered to the selected date range. */
  rows: ScanResult[];
  onSelect: (result: ScanResult) => void;
}

export function HistoryTable({ rows, onSelect }: HistoryTableProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = rows.filter((row) => {
      if (verdictFilter !== "all" && row.verdict !== verdictFilter) {
        return false;
      }
      if (query && !row.url.toLowerCase().includes(query)) return false;
      return true;
    });
    const sorted = [...matched];
    switch (sort) {
      case "oldest":
        sorted.sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
        break;
      case "confidence-desc":
        sorted.sort((a, b) => b.confidence - a.confidence);
        break;
      case "confidence-asc":
        sorted.sort((a, b) => a.confidence - b.confidence);
        break;
      default:
        sorted.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
    }
    return sorted;
  }, [rows, search, verdictFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function clearFilters() {
    setSearch("");
    setVerdictFilter("all");
    setPage(1);
  }

  return (
    <section className="glass-card p-5" aria-labelledby="history-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-heading" className="text-base font-semibold tracking-tight">
          Scan history{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({filtered.length} of {rows.length})
          </span>
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            exportCsv(filtered);
            toast(`Exported ${filtered.length} scans to CSV.`);
          }}
          disabled={filtered.length === 0}
        >
          <Download aria-hidden />
          Export CSV
        </Button>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search by URL</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by URL text…"
            className="h-10 w-full rounded-xl border border-border bg-background/60 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary"
          />
        </label>
        <div
          className="inline-flex flex-wrap rounded-full border border-border bg-muted/40 p-0.5"
          role="group"
          aria-label="Filter by verdict"
        >
          {(["all", ...VERDICT_ORDER] as VerdictFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={verdictFilter === option}
              onClick={() => {
                setVerdictFilter(option);
                setPage(1);
              }}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                verdictFilter === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "all" ? "All" : VERDICT_META[option].label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          Sort
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-background/60 px-2 text-xs text-foreground outline-none focus-visible:border-primary"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No scans in this date range.
        </p>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-medium">No matches</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            No scans match that search and filter combination. Try a
            different URL fragment or verdict.
          </p>
          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
            Clear search and filters
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
            <caption className="sr-only">Scan history — activate a row to see the full result</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="py-2.5 pr-3 font-medium">Verdict</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">URL (defanged)</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Confidence</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Date</th>
                  <th scope="col" className="py-2.5 font-medium">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const defanged = defangUrl(row.url);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onSelect(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(row);
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <td className="py-3 pr-3">
                        <VerdictBadge verdict={row.verdict} />
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className="block max-w-72 truncate font-mono text-xs"
                          title={defanged}
                        >
                          {defanged}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">
                        {row.confidence}%
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(row.scannedAt)}
                      </td>
                      <td className="py-3 text-right">
                        <ChevronRight
                          className="ml-auto size-4 text-muted-foreground"
                          aria-hidden
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <ul className="mt-4 space-y-3 md:hidden">
            {pageRows.map((row) => {
              const defanged = defangUrl(row.url);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className="w-full rounded-xl border border-border/60 bg-muted/30 p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={`View scan details: ${VERDICT_META[row.verdict].label}, ${defanged}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <VerdictBadge verdict={row.verdict} />
                      <span className="font-mono text-xs">{row.confidence}%</span>
                    </span>
                    <span className="mt-2 block break-all font-mono text-xs">
                      {defanged}
                    </span>
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      {formatDate(row.scannedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>
              <span aria-live="polite">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length} scans
              </span>
            </p>
            <div className="inline-flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft aria-hidden />
              </Button>
              <span aria-live="polite">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
