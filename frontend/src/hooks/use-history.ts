"use client";

import { useQuery } from "@tanstack/react-query";

import { getHistory } from "@/lib/api";
import type { ScanHistoryResponse } from "@/types/api";

/** Shared query key so useScan can invalidate history after a scan. */
export const SCAN_HISTORY_QUERY_KEY = ["scan-history"] as const;

/**
 * useHistory — fetch past scan results (GET /api/history).
 *
 * Usage:
 *   const { data, error, isLoading, isFetching, refetch } = useHistory();
 *
 * States for the UI: isLoading (first load), error (show + retry via
 * refetch), data (ScanResult[], most recent first).
 */
export function useHistory() {
  return useQuery<ScanHistoryResponse, Error>({
    queryKey: SCAN_HISTORY_QUERY_KEY,
    queryFn: getHistory,
  });
}
