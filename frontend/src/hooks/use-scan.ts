"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { scanUrl } from "@/lib/api";
import { SCAN_HISTORY_QUERY_KEY } from "@/hooks/use-history";
import type { ScanResult } from "@/types/api";

/**
 * useScan — run one URL scan (POST /api/scan via the service layer).
 *
 * Usage:
 *   const { mutate, cancel, data, error, isPending, reset } = useScan();
 *   mutate("https://example.com/login");
 *   cancel(); // aborts the in-flight request (AbortController)
 *
 * States for the UI: isPending (scanning), error (show + retry via
 * mutate again), data (the ScanResult). Cancelling rejects the
 * mutation with an AbortError — callers that offer Cancel should also
 * call reset() and treat an AbortError as "back to input", not failure.
 * A successful scan invalidates the history query so the Dashboard
 * picks it up automatically.
 *
 * Client-side throttling (Phase 11): scans started less than
 * SCAN_COOLDOWN_MS after the previous one are delayed until the
 * cooldown elapses, which absorbs double-clicks and retry spam. This
 * is a UX convenience only — the backend must enforce real rate
 * limits (see the security note in lib/api.ts). Batch scans call
 * scanUrl directly and are capped by their own concurrency limit.
 */
const SCAN_COOLDOWN_MS = 1_200;

export function useScan() {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);
  const lastStartRef = useRef(0);
  const cooldownTimerRef = useRef<number | null>(null);

  const mutation = useMutation<ScanResult, Error, string>({
    mutationFn: (url: string) => {
      // A new scan supersedes any scan still in flight.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      return scanUrl({ url }, controller.signal);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCAN_HISTORY_QUERY_KEY });
    },
    onSettled: () => {
      controllerRef.current = null;
    },
  });

  const rawMutate = mutation.mutate;
  const mutate = useCallback(
    (url: string) => {
      if (cooldownTimerRef.current) {
        window.clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      const waitMs = Math.max(
        0,
        SCAN_COOLDOWN_MS - (Date.now() - lastStartRef.current),
      );
      if (waitMs === 0) {
        lastStartRef.current = Date.now();
        rawMutate(url);
      } else {
        cooldownTimerRef.current = window.setTimeout(() => {
          cooldownTimerRef.current = null;
          lastStartRef.current = Date.now();
          rawMutate(url);
        }, waitMs);
      }
    },
    [rawMutate],
  );

  const cancel = useCallback(() => {
    if (cooldownTimerRef.current) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    controllerRef.current?.abort();
  }, []);

  return { ...mutation, mutate, cancel };
}
