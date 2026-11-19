"use client";

import {
  CircleExclamationPoint,
  RotateCcw,
  ScanSearch,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ScanResultView } from "@/components/scan/scan-result";
import { ScanningView } from "@/components/scan/scanning-view";
import { UrlScanForm } from "@/components/scan/url-scan-form";
import { useScan } from "@/hooks/use-scan";
import { isRateLimitError } from "@/lib/api";
import { defangUrl } from "@/lib/defang";
import { isValidHttpUrl, normalizeUrl } from "@/lib/url";

/** How long the all-steps-complete state shows before the report (ms). */
const RESULT_REVEAL_DELAY_MS = 550;

function isAbortError(error: Error | null): boolean {
  return error?.name === "AbortError";
}

/**
 * Scan page body. Reads ?url= (set by UrlScanForm on submit), pre-fills
 * the form, and runs the scan through the useScan mutation. While the
 * scan runs, ScanningView shows the animated progress (Phase 4); the
 * final step only completes when the response actually arrives.
 * Error state offers Retry and "Scan a different URL"; Cancel aborts
 * the request and returns to the input state.
 */
export function ScanPageClient() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const receivedUrl = searchParams.get("url") ?? "";

  const normalizedUrl = receivedUrl ? normalizeUrl(receivedUrl) : "";
  const urlIsValid = receivedUrl !== "" && isValidHttpUrl(normalizedUrl);

  const { mutate, cancel, reset, data, error, isPending, isError, isSuccess } =
    useScan();
  const lastScannedRef = useRef<string>("");
  const [revealedUrl, setRevealedUrl] = useState<string>("");

  useEffect(() => {
    if (urlIsValid && lastScannedRef.current !== normalizedUrl) {
      lastScannedRef.current = normalizedUrl;
      mutate(normalizedUrl);
    }
  }, [urlIsValid, normalizedUrl, mutate]);

  // Hold the result briefly so the final step can complete on screen —
  // only after the response has arrived, never before.
  useEffect(() => {
    if (!isSuccess || !data) return;
    const url = data.url;
    const timer = setTimeout(() => setRevealedUrl(url), RESULT_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isSuccess, data]);

  const showResult = isSuccess && data != null && revealedUrl === data.url;
  const showScanning = urlIsValid && (isPending || (isSuccess && !showResult));
  const showError = isError && !isAbortError(error);

  // Toast once per distinct scan failure (the error card also stays).
  const lastToastedError = useRef<Error | null>(null);
  useEffect(() => {
    if (showError && error && error !== lastToastedError.current) {
      lastToastedError.current = error;
      toast("That scan failed — see the message below the form.", "error");
    }
    if (!showError) lastToastedError.current = null;
  }, [showError, error, toast]);

  function handleRetry() {
    if (normalizedUrl) mutate(normalizedUrl);
  }

  function backToInput() {
    lastScannedRef.current = "";
    reset();
    router.replace("/scan");
  }

  function handleCancel() {
    cancel();
    toast("Scan cancelled.", "info");
    backToInput();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <ScanSearch className="size-7 shrink-0 text-foreground" aria-hidden />
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          URL Scanner
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          Paste any link and LinkLens will score it with the model and show
          you the signals behind the verdict.
        </p>
      </div>

      <div className="mt-8">
        {/* key remounts the form when a new ?url= arrives, refreshing its default value */}
        <UrlScanForm
          key={receivedUrl}
          initialUrl={receivedUrl}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: /scan is a single-task page whose primary control is this input (same pattern as a search homepage); focus lands on the task the user came for.
          autoFocus={!receivedUrl}
          examplesDimmed={isPending}
        />
      </div>

      <div className="mt-8">
        {receivedUrl !== "" && !urlIsValid && (
          <section
            role="alert"
            className="glass-card border-phishing/50 p-5 text-left sm:p-6"
          >
            <h2 className="flex items-center gap-2 font-semibold text-phishing">
              <CircleExclamationPoint className="size-5" aria-hidden />
              That URL isn&apos;t valid
            </h2>
            <p className="mt-2 break-all font-mono text-sm text-muted-foreground">
              {defangUrl(receivedUrl)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Check it for typos and try again — a full link looks like
              https://example.com/login.
            </p>
          </section>
        )}

        {showScanning && (
          <ScanningView
            url={normalizedUrl}
            finishing={isSuccess}
            onCancel={handleCancel}
          />
        )}

        {showError && (
          <section
            role="alert"
            className="glass-card border-phishing/50 p-5 text-left sm:p-6"
          >
            <h2 className="flex items-center gap-2 font-semibold text-phishing">
              <CircleExclamationPoint className="size-5" aria-hidden />
              The scan couldn&apos;t be completed
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {error?.message ?? "Something went wrong while scanning that URL."}{" "}
              Your link was not opened. You can retry the scan, or start over
              with a different URL.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {showError && isRateLimitError(error) ? (
                <RateLimitedRetry
                  key={error.message}
                  seconds={error.retryAfterSeconds}
                  onRetry={handleRetry}
                />
              ) : (
                <Button onClick={handleRetry}>
                  <RotateCcw aria-hidden />
                  Retry scan
                </Button>
              )}
              <Button variant="outline" onClick={backToInput}>
                <ScanSearch aria-hidden />
                Scan a different URL
              </Button>
            </div>
          </section>
        )}

        {showResult && data && (
          <>
            <p role="status" className="sr-only">
              Scan complete. Verdict: {data.verdict}. Confidence{" "}
              {data.confidence} percent.
            </p>
            <ScanResultView result={data} onScanAnother={backToInput} />
          </>
        )}

        {receivedUrl === "" && (
          <p className="text-center text-sm text-muted-foreground">
            No URL yet — paste one above, or tap one of the example chips to
            see a full scan.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Retry button for HTTP 429 (Phase 11): disabled with a live
 * countdown for the Retry-After window, then re-enables. The tick
 * runs through a timeout callback, matching the page's other timers.
 */
function RateLimitedRetry({
  seconds,
  onRetry,
}: {
  seconds: number;
  onRetry: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  return (
    <Button onClick={onRetry} disabled={left > 0}>
      <RotateCcw aria-hidden />
      {left > 0 ? `Retry in ${left}s` : "Retry scan"}
    </Button>
  );
}
