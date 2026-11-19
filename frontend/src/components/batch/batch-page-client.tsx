"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleExclamationPoint,
  Clock,
  Download,
  Eye,
  FileUp,
  Layers,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldExclamationPoint,
  TriangleExclamationPoint,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { VerdictDonut } from "@/components/dashboard/charts";
import { VerdictBadge } from "@/components/dashboard/history-table";
import { ResultDialog } from "@/components/dashboard/result-dialog";
import { SCAN_HISTORY_QUERY_KEY } from "@/hooks/use-history";
import { scanUrl } from "@/lib/api";
import {
  MAX_BATCH_URLS,
  MAX_FILE_BYTES,
  SAMPLE_CSV,
  isProbablyTextContent,
  parseBatch,
  safeCsvCell,
  type ParsedBatch,
} from "@/lib/batch-parse";
import { defangUrl } from "@/lib/defang";
import { cn } from "@/lib/utils";
import type { ScanResult, Verdict } from "@/types/api";

/**
 * Batch Scan page (Phase 9): upload a CSV/TXT or paste URLs, preview
 * the parsed rows, then scan with limited concurrency (3 at a time)
 * through the shared scanUrl service — fast mode in mock, results
 * land in the dashboard history automatically.
 */

const CONCURRENCY = 3;
const RESULT_PAGE_SIZE = 10;

type Stage = "input" | "preview" | "scanning" | "results";
type RowStatus = "queued" | "scanning" | "done" | "failed" | "cancelled";

interface BatchRow {
  id: string;
  url: string;
  status: RowStatus;
  result?: ScanResult;
  error?: string;
}

type ResultFilter = Verdict | "failed" | "all";
type ResultSort = "order" | "confidence-desc" | "confidence-asc";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export function BatchPageClient() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedBatch | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [paused, setPaused] = useState(false);
  const [wasCancelled, setWasCancelled] = useState(false);
  const [selected, setSelected] = useState<ScanResult | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [resultSort, setResultSort] = useState<ResultSort>("order");
  const [resultPage, setResultPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const urlByIdRef = useRef(new Map<string, string>());
  const closeDialog = useCallback(() => setSelected(null), []);

  /* ------------------------- derived counters ------------------------ */
  const counts = useMemo(() => {
    const byVerdict: Record<Verdict, number> = {
      safe: 0,
      suspicious: 0,
      phishing: 0,
    };
    let done = 0;
    let failed = 0;
    let cancelled = 0;
    for (const row of rows) {
      if (row.status === "done" && row.result) {
        done += 1;
        byVerdict[row.result.verdict] += 1;
      } else if (row.status === "failed") failed += 1;
      else if (row.status === "cancelled") cancelled += 1;
    }
    return {
      byVerdict,
      done,
      failed,
      cancelled,
      finished: done + failed + cancelled,
      total: rows.length,
    };
  }, [rows]);
  const progressPct =
    counts.total > 0 ? Math.round((counts.finished / counts.total) * 100) : 0;

  /* --------------------------- side effects -------------------------- */
  // Warn before leaving (refresh/close) while a batch is running.
  useEffect(() => {
    if (stage !== "scanning") return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [stage]);

  // Move focus to the new stage's heading for keyboard/screen-reader users.
  useEffect(() => {
    if (stage === "preview") previewHeadingRef.current?.focus();
    if (stage === "results") resultsHeadingRef.current?.focus();
  }, [stage]);

  /* ------------------------------ input ------------------------------ */
  function looksCsv(content: string): boolean {
    const firstLine = content.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
    return firstLine.includes(",");
  }

  function acceptContent(content: string, isCsv: boolean) {
    const result = parseBatch(content, isCsv);
    if (result.rows.length === 0) {
      setInputError(
        "No URLs found in that input. Paste one URL per line, or upload a CSV with a url column.",
      );
      return;
    }
    setInputError(null);
    setParsed(result);
    setStage("preview");
  }

  async function handleFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".txt")) {
      setInputError(
        `"${file.name}" isn't a .csv or .txt file. Please choose one of those formats.`,
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setInputError(
        `"${file.name}" is ${(file.size / 1_000_000).toFixed(1)} MB — the limit is 1 MB.`,
      );
      return;
    }
    const content = await file.text();
    if (!isProbablyTextContent(content)) {
      setInputError(
        `"${file.name}" looks like a binary file, not text. Re-export it as a plain .csv or .txt and try again.`,
      );
      return;
    }
    setText(content);
    acceptContent(content, name.endsWith(".csv"));
  }

  function handleParseText() {
    if (text.trim() === "") {
      setInputError("Paste at least one URL first — one per line.");
      return;
    }
    if (text.length > MAX_FILE_BYTES) {
      setInputError(
        "That paste is larger than 1 MB of text. Split it into smaller batches (500 URLs at a time).",
      );
      return;
    }
    acceptContent(text, looksCsv(text));
  }

  /* ----------------------------- scanning ---------------------------- */
  function updateRow(id: string, patch: Partial<BatchRow>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  async function runPool(ids: string[]) {
    let next = 0;
    async function worker() {
      for (;;) {
        if (cancelRef.current) return;
        while (pauseRef.current && !cancelRef.current) {
          await sleep(150);
        }
        if (cancelRef.current) return;
        const index = next;
        next += 1;
        if (index >= ids.length) return;
        const id = ids[index];
        const url = urlByIdRef.current.get(id);
        if (!url) continue;
        updateRow(id, { status: "scanning" });
        try {
          const result = await scanUrl(
            { url },
            abortRef.current?.signal,
            { fastMode: true },
          );
          updateRow(id, { status: "done", result, error: undefined });
        } catch (error) {
          if (cancelRef.current || (error as Error)?.name === "AbortError") {
            updateRow(id, { status: "cancelled" });
          } else {
            updateRow(id, {
              status: "failed",
              error:
                error instanceof Error
                  ? error.message
                  : "The scan failed for an unknown reason.",
            });
          }
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker),
    );
  }

  async function executeRun(targetRows: BatchRow[]) {
    cancelRef.current = false;
    pauseRef.current = false;
    setPaused(false);
    setWasCancelled(false);
    abortRef.current = new AbortController();
    urlByIdRef.current = new Map(targetRows.map((row) => [row.id, row.url]));
    setStage("scanning");
    await runPool(targetRows.map((row) => row.id));
    if (cancelRef.current) {
      setWasCancelled(true);
      setRows((prev) =>
        prev.map((row) =>
          row.status === "queued" || row.status === "scanning"
            ? { ...row, status: "cancelled" }
            : row,
        ),
      );
    }
    void queryClient.invalidateQueries({ queryKey: SCAN_HISTORY_QUERY_KEY });
    setResultPage(1);
    setStage("results");
  }

  function startScan() {
    if (!parsed) return;
    const batchRows: BatchRow[] = parsed.rows
      .filter((row) => row.valid)
      .map((row) => ({ id: row.id, url: row.url, status: "queued" }));
    setRows(batchRows);
    void executeRun(batchRows);
  }

  function handlePauseToggle() {
    const next = !paused;
    setPaused(next);
    pauseRef.current = next;
  }

  function handleCancel() {
    cancelRef.current = true;
    abortRef.current?.abort();
    toast("Cancelling batch — finished results will be kept.", "info");
  }

  function retryFailed() {
    const failedRows = rows.filter((row) => row.status === "failed");
    if (failedRows.length === 0) return;
    const reset = failedRows.map((row) => ({
      ...row,
      status: "queued" as RowStatus,
      error: undefined,
    }));
    setRows((prev) =>
      prev.map((row) => reset.find((r) => r.id === row.id) ?? row),
    );
    void executeRun(reset);
  }

  function resetAll() {
    setStage("input");
    setParsed(null);
    setRows([]);
    setText("");
    setInputError(null);
    setWasCancelled(false);
    setResultFilter("all");
    setResultSort("order");
    setResultPage(1);
  }

  /* ------------------------------ results ---------------------------- */
  const visibleResults = useMemo(() => {
    const list = rows.filter((row) => {
      if (resultFilter === "all") return row.status === "done" || row.status === "failed";
      if (resultFilter === "failed") return row.status === "failed";
      return row.status === "done" && row.result?.verdict === resultFilter;
    });
    const sorted = [...list];
    if (resultSort === "confidence-desc") {
      sorted.sort((a, b) => (b.result?.confidence ?? -1) - (a.result?.confidence ?? -1));
    } else if (resultSort === "confidence-asc") {
      sorted.sort((a, b) => (a.result?.confidence ?? -1) - (b.result?.confidence ?? -1));
    }
    return sorted;
  }, [rows, resultFilter, resultSort]);

  const resultTotalPages = Math.max(
    1,
    Math.ceil(visibleResults.length / RESULT_PAGE_SIZE),
  );
  const currentResultPage = Math.min(resultPage, resultTotalPages);
  const pageResults = visibleResults.slice(
    (currentResultPage - 1) * RESULT_PAGE_SIZE,
    currentResultPage * RESULT_PAGE_SIZE,
  );

  function exportResultsCsv() {
    const lines = [
      "scanned_at,verdict,confidence_percent,url_defanged,error",
      ...rows
        .filter((row) => row.status === "done" || row.status === "failed")
        .map((row) =>
          [
            row.result?.scannedAt ?? "",
            row.result?.verdict ?? "failed",
            row.result ? String(row.result.confidence) : "",
            defangUrl(row.url),
            row.error ?? "",
          ]
            .map(safeCsvCell)
            .join(","),
        ),
    ];
    downloadTextFile("linklens-batch-results.csv", lines.join("\n"), "text/csv");
    toast("Batch results exported as CSV.");
  }

  /* -------------------------------- JSX ------------------------------ */
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="text-center sm:text-left">
        <h1 className="flex items-center justify-center gap-2.5 text-3xl font-bold tracking-tight sm:justify-start sm:text-4xl">
          <Layers className="size-7 shrink-0 text-foreground" aria-hidden />
          Batch Scan
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mx-0 sm:text-base">
          Scan up to {MAX_BATCH_URLS} URLs at once — upload a CSV or paste
          a list, preview it, and get a verdict for every link.
        </p>
      </div>

      {/* ------------------------------ INPUT ------------------------------ */}
      {stage === "input" && (
        <div className="mt-8 space-y-5">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a CSV or text file of URLs. Activate to browse, or drop a file here."
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={cn(
              "glass-card cursor-pointer p-8 text-center transition-colors",
              "focus-visible:outline-2 focus-visible:outline-primary",
              dragging && "border-primary/60 bg-primary/5",
            )}
          >
            <Upload className="mx-auto size-8 text-primary" aria-hidden />
            <p className="mt-3 font-medium">
              Drag and drop a .csv or .txt file here
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to browse — maximum 1 MB and {MAX_BATCH_URLS} URLs
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              aria-hidden
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
          </div>

          <div className="glass-card p-5">
            <label
              htmlFor="batch-urls"
              className="text-sm font-semibold"
            >
              Or paste URLs — one per line
            </label>
            <textarea
              id="batch-urls"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              spellCheck={false}
              placeholder={
                "https://www.google.com\nhttps://192.168.1.10/login\nexample.com/some-page"
              }
              className="mt-3 w-full rounded-xl border border-border bg-background/60 p-3 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={handleParseText}>
                <FileUp aria-hidden />
                Preview URLs
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadTextFile("linklens-sample.csv", SAMPLE_CSV, "text/csv")
                }
              >
                <Download aria-hidden />
                Download sample CSV
              </Button>
              <p className="text-xs text-muted-foreground">
                CSV files use the <span className="font-mono">url</span>{" "}
                column when a header is present, otherwise the first column.
              </p>
            </div>
          </div>

          {inputError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-phishing/50 bg-phishing/5 p-4 text-sm text-phishing"
            >
              <CircleExclamationPoint className="mt-0.5 size-4 shrink-0" aria-hidden />
              {inputError}
            </p>
          )}
        </div>
      )}

      {/* ----------------------------- PREVIEW ----------------------------- */}
      {stage === "preview" && parsed && (
        <div className="mt-8">
          <h2
            ref={previewHeadingRef}
            tabIndex={-1}
            className="text-xl font-bold tracking-tight outline-none"
          >
            Preview — {parsed.rows.length} unique URLs
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {parsed.validCount} ready to scan
            {parsed.invalidCount > 0 &&
              ` · ${parsed.invalidCount} invalid (will be skipped and reported)`}
            {parsed.duplicateCount > 0 &&
              ` · ${parsed.duplicateCount} duplicate${parsed.duplicateCount > 1 ? "s" : ""} removed`}
            {parsed.truncatedCount > 0 &&
              ` · ${parsed.truncatedCount} dropped over the ${MAX_BATCH_URLS}-URL limit`}
            . Showing the first {Math.min(10, parsed.rows.length)} rows.
          </p>

          <div className="glass-card mt-5 overflow-x-auto p-5">
            <table className="w-full text-sm">
                    <caption className="sr-only">Batch scan results — use View to open the full result</caption>
              <caption className="sr-only">Preview of parsed URLs before scanning</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">#</th>
                  <th scope="col" className="py-2 pr-3 font-medium">URL (defanged)</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 10).map((row, index) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3 text-muted-foreground">{index + 1}</td>
                    <td className="py-2.5 pr-3">
                      <span className="block max-w-md truncate font-mono text-xs" title={defangUrl(row.url)}>
                        {defangUrl(row.url)}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {row.valid ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-safe">
                          <CircleCheck className="size-4" aria-hidden />
                          Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-start gap-1.5 text-xs font-medium text-phishing">
                          <CircleExclamationPoint className="mt-px size-4 shrink-0" aria-hidden />
                          <span>
                            Invalid
                            <span className="block font-normal text-muted-foreground">
                              {row.reason}
                            </span>
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={startScan} disabled={parsed.validCount === 0}>
              <Play aria-hidden />
              Scan {parsed.validCount} URLs
            </Button>
            <Button variant="outline" onClick={() => setStage("input")}>
              Back to input
            </Button>
          </div>
          {parsed.validCount === 0 && (
            <p role="alert" className="mt-3 text-sm text-phishing">
              None of these rows are valid URLs, so there is nothing to scan.
              Go back and fix the input.
            </p>
          )}
        </div>
      )}

      {/* ---------------------------- SCANNING ----------------------------- */}
      {stage === "scanning" && (
        <div className="mt-8">
          <h2 className="text-xl font-bold tracking-tight">
            {paused ? "Batch paused" : "Scanning batch…"}
          </h2>
          <p role="status" aria-live="polite" className="mt-1.5 text-sm text-muted-foreground">
            Scanned {counts.finished} of {counts.total} — {counts.byVerdict.safe}{" "}
            safe, {counts.byVerdict.suspicious} suspicious,{" "}
            {counts.byVerdict.phishing} phishing, {counts.failed} failed.
          </p>
          <div
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            aria-label="Batch scan progress"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-safe/40 bg-safe/10 px-2.5 py-1 font-medium text-safe">
              <ShieldCheck className="size-3.5" aria-hidden /> Safe {counts.byVerdict.safe}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-suspicious/40 bg-suspicious/10 px-2.5 py-1 font-medium text-suspicious">
              <TriangleExclamationPoint className="size-3.5" aria-hidden /> Suspicious {counts.byVerdict.suspicious}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-phishing/40 bg-phishing/10 px-2.5 py-1 font-medium text-phishing">
              <ShieldExclamationPoint className="size-3.5" aria-hidden /> Phishing {counts.byVerdict.phishing}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 font-medium text-muted-foreground">
              <CircleExclamationPoint className="size-3.5" aria-hidden /> Failed {counts.failed}
            </span>
            <span className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePauseToggle}>
                {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
                {paused ? "Resume" : "Pause"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <Ban aria-hidden />
                Cancel
              </Button>
            </span>
          </div>

          <ul className="glass-card mt-5 max-h-96 space-y-1 overflow-y-auto p-4">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm"
              >
                {row.status === "done" && row.result ? (
                  <VerdictBadge verdict={row.result.verdict} />
                ) : row.status === "scanning" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    Scanning
                  </span>
                ) : row.status === "failed" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-phishing">
                    <CircleExclamationPoint className="size-4" aria-hidden />
                    Failed
                  </span>
                ) : row.status === "cancelled" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Ban className="size-4" aria-hidden />
                    Cancelled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Clock className="size-4" aria-hidden />
                    Queued
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={defangUrl(row.url)}>
                  {defangUrl(row.url)}
                </span>
                {row.status === "done" && row.result && (
                  <span className="font-mono text-xs">{row.result.confidence}%</span>
                )}
                {row.status === "failed" && (
                  <span className="max-w-56 truncate text-xs text-phishing" title={row.error}>
                    {row.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ----------------------------- RESULTS ----------------------------- */}
      {stage === "results" && (
        <div className="mt-8">
          <h2
            ref={resultsHeadingRef}
            tabIndex={-1}
            className="text-xl font-bold tracking-tight outline-none"
          >
            Batch results
          </h2>
          <p role="status" className="mt-1.5 text-sm text-muted-foreground">
            {counts.done} scanned
            {counts.failed > 0 && ` · ${counts.failed} failed`}
            {wasCancelled &&
              ` · cancelled early — ${counts.cancelled} URL${counts.cancelled === 1 ? " was" : "s were"} not scanned`}
            {parsed && parsed.invalidCount > 0 &&
              ` · ${parsed.invalidCount} invalid input row${parsed.invalidCount > 1 ? "s" : ""} skipped`}
            . Completed scans were added to the dashboard history.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {[
              { label: "Scanned", value: counts.done, icon: CircleCheck, classes: "text-foreground" },
              { label: "Safe", value: counts.byVerdict.safe, icon: ShieldCheck, classes: "text-safe" },
              { label: "Suspicious", value: counts.byVerdict.suspicious, icon: TriangleExclamationPoint, classes: "text-suspicious-fill" },
              { label: "Phishing", value: counts.byVerdict.phishing, icon: ShieldExclamationPoint, classes: "text-phishing" },
              { label: "Failed", value: counts.failed, icon: CircleExclamationPoint, classes: "text-muted-foreground" },
            ].map((card) => (
              <section key={card.label} className="glass-card p-4">
                <div className="flex items-center gap-2">
                  <card.icon aria-hidden className={cn("size-4.5", card.classes)} />
                  <h3 className="text-xs font-medium text-muted-foreground">{card.label}</h3>
                </div>
                <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{card.value}</p>
              </section>
            ))}
          </div>

          {counts.done > 0 && (
            <div className="glass-card mt-6 p-4">
              <h3 className="text-base font-semibold tracking-tight">Verdict split</h3>
              <VerdictDonut counts={counts.byVerdict} compact />
            </div>
          )}

          <section className="glass-card mt-6 p-5" aria-label="Batch results table">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="inline-flex flex-wrap rounded-full border border-border bg-muted/40 p-0.5"
                role="group"
                aria-label="Filter results by verdict"
              >
                {(["all", "safe", "suspicious", "phishing", "failed"] as ResultFilter[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={resultFilter === option}
                    onClick={() => {
                      setResultFilter(option);
                      setResultPage(1);
                    }}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                      resultFilter === option
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  Sort
                  <select
                    value={resultSort}
                    onChange={(event) => {
                      setResultSort(event.target.value as ResultSort);
                      setResultPage(1);
                    }}
                    className="h-9 rounded-lg border border-border bg-background/60 px-2 text-xs text-foreground outline-none focus-visible:border-primary"
                  >
                    <option value="order">Completion order</option>
                    <option value="confidence-desc">Confidence: high to low</option>
                    <option value="confidence-asc">Confidence: low to high</option>
                  </select>
                </label>
                {counts.failed > 0 && (
                  <Button variant="outline" size="sm" onClick={retryFailed}>
                    <RotateCcw aria-hidden />
                    Retry failed ({counts.failed})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={exportResultsCsv}>
                  <Download aria-hidden />
                  Export results CSV
                </Button>
                <Button size="sm" onClick={resetAll}>
                  <RotateCcw aria-hidden />
                  Scan another batch
                </Button>
              </div>
            </div>

            {visibleResults.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No results match this filter.
              </p>
            ) : (
              <>
                <div className="mt-4 hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th scope="col" className="py-2.5 pr-3 font-medium">Verdict</th>
                        <th scope="col" className="py-2.5 pr-3 font-medium">URL (defanged)</th>
                        <th scope="col" className="py-2.5 pr-3 font-medium">Confidence</th>
                        <th scope="col" className="py-2.5 font-medium">
                          <span className="sr-only">Details</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageResults.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
                          <td className="py-3 pr-3">
                            {row.status === "done" && row.result ? (
                              <VerdictBadge verdict={row.result.verdict} />
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                <CircleExclamationPoint className="size-3.5" aria-hidden />
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            <span className="block max-w-72 truncate font-mono text-xs" title={defangUrl(row.url)}>
                              {defangUrl(row.url)}
                            </span>
                            {row.status === "failed" && (
                              <span className="mt-0.5 block max-w-72 truncate text-xs text-phishing" title={row.error}>
                                {row.error}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-3 font-mono text-xs">
                            {row.result ? `${row.result.confidence}%` : "—"}
                          </td>
                          <td className="py-3 text-right">
                            {row.status === "done" && row.result && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelected(row.result ?? null)}
                                aria-label={`View full result for ${defangUrl(row.url)}`}
                              >
                                <Eye aria-hidden />
                                View
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="mt-4 space-y-3 md:hidden">
                  {pageResults.map((row) => (
                    <li key={row.id}>
                      {row.status === "done" && row.result ? (
                        <button
                          type="button"
                          onClick={() => setSelected(row.result ?? null)}
                          className="w-full rounded-xl border border-border/60 bg-muted/30 p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
                          aria-label={`View full result: ${row.result.verdict}, ${defangUrl(row.url)}`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <VerdictBadge verdict={row.result.verdict} />
                            <span className="font-mono text-xs">{row.result.confidence}%</span>
                          </span>
                          <span className="mt-2 block break-all font-mono text-xs">{defangUrl(row.url)}</span>
                        </button>
                      ) : (
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-phishing">
                            <CircleExclamationPoint className="size-4" aria-hidden />
                            Failed
                          </span>
                          <span className="mt-2 block break-all font-mono text-xs">{defangUrl(row.url)}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{row.error}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <p>
                    Showing {(currentResultPage - 1) * RESULT_PAGE_SIZE + 1}–
                    {Math.min(currentResultPage * RESULT_PAGE_SIZE, visibleResults.length)} of{" "}
                    {visibleResults.length}
                  </p>
                  <div className="inline-flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResultPage((v) => Math.max(1, v - 1))}
                      disabled={currentResultPage <= 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft aria-hidden />
                    </Button>
                    <span aria-live="polite">
                      Page {currentResultPage} of {resultTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResultPage((v) => Math.min(resultTotalPages, v + 1))}
                      disabled={currentResultPage >= resultTotalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight aria-hidden />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {selected && <ResultDialog result={selected} onClose={closeDialog} />}
    </div>
  );
}
