"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import {
  CircleExclamationPoint,
  Gauge,
  LayoutDashboard,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  ShieldExclamationPoint,
  TrendingDown,
  TrendingUp,
  TriangleExclamationPoint,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ChartCard,
  RiskSignalsChart,
  ScansOverTimeChart,
  VerdictDonut,
  type RiskSignalDatum,
  type TimeBucket,
} from "@/components/dashboard/charts";
import { HistoryTable } from "@/components/dashboard/history-table";
import { ResultDialog } from "@/components/dashboard/result-dialog";
import { useHistory } from "@/hooks/use-history";
import { IS_MOCK_MODE } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ScanResult, Verdict } from "@/types/api";

/**
 * Dashboard (Phase 8): summary stats with trends vs the previous
 * period, scans-over-time / verdict donut / top risk signal charts,
 * and the full scan history table — all driven by useHistory and a
 * 7 / 30 / 90 day range selector.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = [7, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];

function countByVerdict(rows: ScanResult[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = {
    safe: 0,
    suspicious: 0,
    phishing: 0,
  };
  for (const row of rows) counts[row.verdict] += 1;
  return counts;
}

function detectionRate(counts: Record<Verdict, number>, total: number): number {
  if (total === 0) return 0;
  return ((counts.suspicious + counts.phishing) / total) * 100;
}

/** "+23% vs previous 30 days" / "−4 pts" / neutral fallbacks. */
function TrendNote({
  current,
  previous,
  range,
  points = false,
}: {
  current: number;
  previous: number;
  range: RangeDays;
  points?: boolean;
}) {
  if (previous === 0 && current === 0) {
    return <span className="text-muted-foreground">No change vs previous {range} days</span>;
  }
  if (previous === 0) {
    return <span className="text-muted-foreground">No data in previous {range} days</span>;
  }
  const diff = points ? current - previous : ((current - previous) / previous) * 100;
  const rounded = Math.round(diff);
  if (rounded === 0) {
    return <span className="text-muted-foreground">No change vs previous {range} days</span>;
  }
  const up = rounded > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Icon aria-hidden className="size-3.5" />
      {up ? "+" : "−"}
      {Math.abs(rounded)}
      {points ? " pts" : "%"} vs previous {range} days
    </span>
  );
}

function CountUp({
  value,
  format = (v: number) => `${Math.round(v)}`,
}: {
  value: number;
  format?: (v: number) => string;
}) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const text = useTransform(motionValue, format);
  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 0.8,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [motionValue, value, reduceMotion]);
  return <motion.span>{text}</motion.span>;
}

function buildTimeBuckets(rows: ScanResult[], range: RangeDays, now: number): TimeBucket[] {
  const bucketCount = range === 90 ? 13 : range;
  const bucketMs = range === 90 ? 7 * DAY_MS : DAY_MS;
  const start = now - bucketCount * bucketMs;
  const buckets: TimeBucket[] = [];
  for (let i = 0; i < bucketCount; i += 1) {
    const bucketStart = new Date(start + i * bucketMs);
    const label =
      range === 7
        ? bucketStart.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
          })
        : bucketStart.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
    buckets.push({ label, safe: 0, suspicious: 0, phishing: 0 });
  }
  for (const row of rows) {
    const t = new Date(row.scannedAt).getTime();
    const index = Math.floor((t - start) / bucketMs);
    if (index >= 0 && index < bucketCount) {
      buckets[index][row.verdict] += 1;
    }
  }
  return buckets;
}

function buildRiskSignals(rows: ScanResult[]): RiskSignalDatum[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.verdict !== "phishing") continue;
    for (const feature of row.features) {
      // Risk signals are only the features that pushed TOWARD the
      // phishing verdict — protective features (negative impact,
      // e.g. "HTTPS present") must not be counted here.
      if (feature.impact <= 0) continue;
      counts.set(feature.name, (counts.get(feature.name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      shortName: name.length > 26 ? `${name.slice(0, 25)}…` : name,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-2xl bg-muted/60", className)} />;
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <SkeletonBlock className="h-80 xl:col-span-2" />
        <SkeletonBlock className="h-80" />
      </div>
      <SkeletonBlock className="h-96" />
    </div>
  );
}

export function DashboardClient() {
  const { data, error, isLoading, isError, refetch } = useHistory();
  const [range, setRange] = useState<RangeDays>(30);
  const [selected, setSelected] = useState<ScanResult | null>(null);
  const closeDialog = useCallback(() => setSelected(null), []);
  // One fixed "now" per dashboard visit, so ranges stay stable while open.
  const [now] = useState(() => Date.now());

  const allRows = useMemo(() => data ?? [], [data]);
  const currentRows = useMemo(
    () =>
      allRows.filter(
        (row) => now - new Date(row.scannedAt).getTime() <= range * DAY_MS,
      ),
    [allRows, now, range],
  );
  const previousRows = useMemo(
    () =>
      allRows.filter((row) => {
        const age = now - new Date(row.scannedAt).getTime();
        return age > range * DAY_MS && age <= 2 * range * DAY_MS;
      }),
    [allRows, now, range],
  );

  const counts = useMemo(() => countByVerdict(currentRows), [currentRows]);
  const prevCounts = useMemo(() => countByVerdict(previousRows), [previousRows]);
  const rate = detectionRate(counts, currentRows.length);
  const prevRate = detectionRate(prevCounts, previousRows.length);
  const buckets = useMemo(
    () => buildTimeBuckets(currentRows, range, now),
    [currentRows, range, now],
  );
  const riskSignals = useMemo(
    () => buildRiskSignals(currentRows),
    [currentRows],
  );

  const statCards = [
    {
      label: "Total scans",
      icon: ScanSearch,
      iconClasses: "text-foreground",
      value: currentRows.length,
      format: undefined,
      trend: { current: currentRows.length, previous: previousRows.length, points: false },
    },
    {
      label: "Phishing detected",
      icon: ShieldExclamationPoint,
      iconClasses: "text-phishing",
      value: counts.phishing,
      format: undefined,
      trend: { current: counts.phishing, previous: prevCounts.phishing, points: false },
    },
    {
      label: "Suspicious",
      icon: TriangleExclamationPoint,
      iconClasses: "text-suspicious-fill",
      value: counts.suspicious,
      format: undefined,
      trend: { current: counts.suspicious, previous: prevCounts.suspicious, points: false },
    },
    {
      label: "Safe",
      icon: ShieldCheck,
      iconClasses: "text-safe",
      value: counts.safe,
      format: undefined,
      trend: { current: counts.safe, previous: prevCounts.safe, points: false },
    },
    {
      label: "Detection rate",
      icon: Gauge,
      iconClasses: "text-foreground",
      value: rate,
      format: (v: number) => `${Math.round(v)}%`,
      trend: { current: rate, previous: prevRate, points: true },
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight sm:text-4xl">
            <LayoutDashboard className="size-7 shrink-0 text-foreground" aria-hidden />
            Scan Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every scan LinkLens has run — verdict trends, the signals
            driving them, and the full history.
            {IS_MOCK_MODE &&
              " Demo mode: seeded sample history plus your own scans, saved in this browser."}
          </p>
        </div>
        <div
          className="inline-flex rounded-full border border-border bg-muted/40 p-0.5"
          role="group"
          aria-label="Date range"
        >
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={range === option}
              onClick={() => setRange(option)}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                range === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {isLoading && <DashboardSkeleton />}

        {isError && (
          <section
            role="alert"
            className="glass-card border-phishing/50 p-6 text-center"
          >
            <h2 className="flex items-center justify-center gap-2 font-semibold text-phishing">
              <CircleExclamationPoint className="size-5" aria-hidden />
              The dashboard couldn&apos;t be loaded
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {error?.message ?? "Something went wrong while loading scan history."}
            </p>
            <Button onClick={() => void refetch()} className="mt-4">
              <RotateCcw aria-hidden />
              Retry
            </Button>
          </section>
        )}

        {!isLoading && !isError && allRows.length === 0 && (
          <section className="glass-card p-10 text-center">
            <h2 className="text-lg font-semibold">No scans yet</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Once you scan a few URLs, this dashboard fills with verdict
              trends, top risk signals and your full history.
            </p>
            <Button asChild className="mt-5">
              <Link href="/scan">
                <ScanSearch aria-hidden />
                Scan a URL
              </Link>
            </Button>
          </section>
        )}

        {!isLoading && !isError && allRows.length > 0 && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <section key={card.label} className="glass-card p-4">
                    <div className="flex items-center gap-2">
                      <Icon aria-hidden className={cn("size-4.5", card.iconClasses)} />
                      <h2 className="text-xs font-medium text-muted-foreground">
                        {card.label}
                      </h2>
                    </div>
                    <p className="mt-3 font-display text-3xl font-semibold tracking-tight">
                      <CountUp value={card.value} format={card.format} />
                    </p>
                    {previousRows.length > 0 && (
                      <p className="mt-1.5 text-[11px] leading-snug">
                        <TrendNote
                          current={card.trend.current}
                          previous={card.trend.previous}
                          range={range}
                          points={card.trend.points}
                        />
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
            <div className="-mt-3 space-y-1 text-xs text-muted-foreground">
              {previousRows.length === 0 && (
                <p>Trends appear once there is data from an earlier period.</p>
              )}
              <p>Detection rate = share of scans flagged suspicious or phishing.</p>
            </div>

            {/* Charts */}
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <ChartCard
                  title="Scans over time"
                  description={`Per ${range === 90 ? "week" : "day"}, split by verdict`}
                >
                  <ScansOverTimeChart data={buckets} />
                </ChartCard>
              </div>
              <ChartCard title="Verdict distribution" description="Share of scans by verdict">
                <VerdictDonut counts={counts} />
              </ChartCard>
            </div>
            <ChartCard
              title="Top risk signals"
              description="Features that most often appear in phishing verdicts"
            >
              <RiskSignalsChart data={riskSignals} />
            </ChartCard>

            {/* History */}
            <HistoryTable rows={currentRows} onSelect={setSelected} />
          </div>
        )}
      </div>

      {selected && <ResultDialog result={selected} onClose={closeDialog} />}
    </div>
  );
}
