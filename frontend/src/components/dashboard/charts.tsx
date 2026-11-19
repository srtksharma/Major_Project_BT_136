"use client";

import { useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  ShieldExclamationPoint,
  TriangleExclamationPoint,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import type { Verdict } from "@/types/api";

/**
 * Dashboard charts (Phase 8). All colours come from the verdict
 * design tokens, every chart carries an aria-label plus a visually
 * hidden data table, and legends always pair colour with an icon
 * and a text label.
 */

export const VERDICT_META: Record<
  Verdict,
  { label: string; icon: typeof ShieldCheck; colorVar: string; chipClasses: string }
> = {
  safe: {
    label: "Safe",
    icon: ShieldCheck,
    colorVar: "var(--color-safe)",
    chipClasses: "border-safe/40 bg-safe/10 text-safe",
  },
  suspicious: {
    label: "Suspicious",
    icon: TriangleExclamationPoint,
    colorVar: "var(--color-suspicious-fill)",
    chipClasses: "border-suspicious/40 bg-suspicious/10 text-suspicious",
  },
  phishing: {
    label: "Phishing",
    icon: ShieldExclamationPoint,
    colorVar: "var(--color-phishing)",
    chipClasses: "border-phishing/40 bg-phishing/10 text-phishing",
  },
};

export const VERDICT_ORDER: Verdict[] = ["safe", "suspicious", "phishing"];

export function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="glass-card p-5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function VerdictLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {VERDICT_ORDER.map((verdict) => {
        const meta = VERDICT_META[verdict];
        const Icon = meta.icon;
        return (
          <li key={verdict} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: meta.colorVar }}
            />
            <Icon aria-hidden className="size-3.5" style={{ color: meta.colorVar }} />
            {meta.label}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------- Scans over time ------------------------ */

export interface TimeBucket {
  label: string;
  safe: number;
  suspicious: number;
  phishing: number;
}

function TimeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <p className="text-xs font-semibold">{label}</p>
      <ul className="mt-1.5 space-y-1 text-xs">
        {VERDICT_ORDER.map((verdict) => {
          const entry = payload.find((item) => item.dataKey === verdict);
          const meta = VERDICT_META[verdict];
          return (
            <li key={verdict} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-sm"
                style={{ backgroundColor: meta.colorVar }}
              />
              {meta.label}:{" "}
              <span className="font-mono font-semibold">
                {entry?.value ?? 0}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ScansOverTimeChart({ data }: { data: TimeBucket[] }) {
  const reduceMotion = useReducedMotion();
  const total = data.reduce(
    (sum, bucket) => sum + bucket.safe + bucket.suspicious + bucket.phishing,
    0,
  );
  return (
    <div>
      <VerdictLegend className="mb-3" />
      <div
        role="img"
        aria-label={`Stacked bar chart of scans over time. ${total} scans across ${data.length} periods.`}
      >
        <div aria-hidden="true" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer
              data={data}
              margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
              barCategoryGap="25%"
            >
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<TimeTooltip />} cursor={{ fill: "var(--color-muted)", fillOpacity: 0.35 }} />
              {VERDICT_ORDER.map((verdict) => (
                <Bar
                  key={verdict}
                  dataKey={verdict}
                  stackId="verdicts"
                  name={VERDICT_META[verdict].label}
                  fill={VERDICT_META[verdict].colorVar}
                  radius={verdict === "phishing" ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  isAnimationActive={!reduceMotion}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <table className="sr-only">
        <caption>Scans per period by verdict</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Safe</th>
            <th scope="col">Suspicious</th>
            <th scope="col">Phishing</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((bucket) => (
            <tr key={bucket.label}>
              <td>{bucket.label}</td>
              <td>{bucket.safe}</td>
              <td>{bucket.suspicious}</td>
              <td>{bucket.phishing}</td>
              <td>{bucket.safe + bucket.suspicious + bucket.phishing}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------- Verdict donut -------------------------- */

export function VerdictDonut({
  counts,
  compact = false,
}: {
  counts: Record<Verdict, number>;
  /** Tighter legend spacing (used on the batch results page). */
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const total = VERDICT_ORDER.reduce((sum, v) => sum + counts[v], 0);
  const data = VERDICT_ORDER.map((verdict) => ({
    name: VERDICT_META[verdict].label,
    verdict,
    value: counts[verdict],
  })).filter((entry) => entry.value > 0);

  return (
    <div>
      <div
        className="relative mx-auto w-fit"
        role="img"
        aria-label={`Donut chart of verdict distribution. Out of ${total} scans: ${VERDICT_ORDER.map((v) => `${counts[v]} ${VERDICT_META[v].label}`).join(", ")}.`}
      >
        <div aria-hidden="true" style={{ height: 210, width: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={!reduceMotion}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.verdict}
                    fill={VERDICT_META[entry.verdict].colorVar}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  return (
                    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-card">
                      <span className="font-semibold">{item.name}</span>:{" "}
                      <span className="font-mono">{item.value}</span> scans
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight">{total}</span>
          <span className="text-xs text-muted-foreground">scans</span>
        </div>
      </div>
      <ul className={cn(compact ? "mt-2 space-y-1" : "mt-4 space-y-2", "text-sm")}>
        {VERDICT_ORDER.map((verdict) => {
          const meta = VERDICT_META[verdict];
          const Icon = meta.icon;
          const pct = total > 0 ? Math.round((counts[verdict] / total) * 100) : 0;
          return (
            <li key={verdict} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: meta.colorVar }}
              />
              <Icon aria-hidden className="size-4" style={{ color: meta.colorVar }} />
              <span className="flex-1">{meta.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {counts[verdict]} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
      <table className="sr-only">
        <caption>Verdict distribution</caption>
        <thead>
          <tr>
            <th scope="col">Verdict</th>
            <th scope="col">Scans</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {VERDICT_ORDER.map((verdict) => (
            <tr key={verdict}>
              <td>{VERDICT_META[verdict].label}</td>
              <td>{counts[verdict]}</td>
              <td>{total > 0 ? Math.round((counts[verdict] / total) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------ Top risk signals ------------------------ */

export interface RiskSignalDatum {
  name: string;
  shortName: string;
  count: number;
}

export function RiskSignalsChart({ data }: { data: RiskSignalDatum[] }) {
  const reduceMotion = useReducedMotion();
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No phishing verdicts in this range, so no risk signals to show.
      </p>
    );
  }
  const height = Math.max(170, data.length * 38 + 44);
  return (
    <div>
      <div
        role="img"
        aria-label={`Bar chart of the features that most often appear in phishing verdicts. Most common: ${data[0].name}, in ${data[0].count} phishing scans.`}
      >
        <div aria-hidden="true" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer
              data={data}
              layout="vertical"
              margin={{ top: 2, right: 16, bottom: 0, left: 0 }}
              barCategoryGap="22%"
            >
              <XAxis
                type="number"
                domain={[0, "dataMax"]}
                allowDecimals={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={156}
                tick={{ fill: "var(--color-foreground)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", fillOpacity: 0.35 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const datum = payload[0].payload as RiskSignalDatum;
                  return (
                    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-card">
                      <span className="font-semibold">{datum.name}</span>
                      <br />
                      Seen in <span className="font-mono">{datum.count}</span>{" "}
                      phishing scans
                    </div>
                  );
                }}
              />
              <Bar
                barSize={12}
                dataKey="count"
                fill="var(--color-phishing)"
                radius={3}
                isAnimationActive={!reduceMotion}
                background={{ fill: "var(--color-muted)", fillOpacity: 0.45 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <table className="sr-only">
        <caption>Features most common in phishing verdicts</caption>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Phishing scans</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.name}>
              <td>{datum.name}</td>
              <td>{datum.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
