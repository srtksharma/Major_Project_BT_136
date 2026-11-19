"use client";

import {
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Ban,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Eye,
  Flag,
  Globe,
  Info,
  Lock,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldExclamationPoint,
  TrendingDown,
  TrendingUp,
  TriangleExclamationPoint,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { UrlAnatomy } from "@/components/scan/url-anatomy";
import { NeedleGauge } from "@/components/scan/needle-gauge";
import { IS_MOCK_MODE } from "@/lib/api";
import { defangUrl } from "@/lib/defang";
import { cn } from "@/lib/utils";
import type { ScanFeature, ScanResult, Verdict } from "@/types/api";

interface NextStep {
  icon: typeof ShieldCheck;
  text: string;
}

const VERDICT_CONFIG: Record<
  Verdict,
  {
    label: string;
    icon: typeof ShieldCheck;
    chipClasses: string;
    bannerClasses: string;
    iconClasses: string;
    gaugeClass: string;
    heading: string;
    steps: NextStep[];
  }
> = {
  safe: {
    label: "Safe",
    icon: ShieldCheck,
    chipClasses: "border-safe/40 bg-safe/10 text-safe",
    bannerClasses: "border-safe/25 bg-safe/5",
    iconClasses: "border-safe/40 bg-safe/15 text-safe",
    gaugeClass: "text-safe",
    heading: "No strong phishing signals found",
    steps: [
      {
        icon: Globe,
        text: "Open the site normally — it shows no strong phishing signals.",
      },
      {
        icon: Eye,
        text: "Stay alert anyway: before typing a password or OTP, check the address in the browser bar is exactly the service you expect.",
      },
      {
        icon: Bookmark,
        text: "For banking and email, prefer your bookmark or the official app over links in messages.",
      },
    ],
  },
  suspicious: {
    label: "Suspicious",
    icon: TriangleExclamationPoint,
    chipClasses: "border-suspicious/40 bg-suspicious/10 text-suspicious",
    bannerClasses: "border-suspicious/25 bg-suspicious/5",
    iconClasses: "border-suspicious/40 bg-suspicious/15 text-suspicious",
    gaugeClass: "text-suspicious-fill",
    heading: "Some risk signals were found",
    steps: [
      {
        icon: Eye,
        text: "Do not enter passwords, OTPs or payment details on this site.",
      },
      {
        icon: Search,
        text: "Reach the service yourself instead — type its address or open its official app.",
      },
      {
        icon: Flag,
        text: "If the link arrived in a message or email, report it on that platform and delete it.",
      },
    ],
  },
  phishing: {
    label: "Phishing",
    icon: ShieldExclamationPoint,
    chipClasses: "border-phishing/40 bg-phishing/10 text-phishing",
    bannerClasses: "border-phishing/25 bg-phishing/5",
    iconClasses: "border-phishing/40 bg-phishing/15 text-phishing",
    gaugeClass: "text-phishing",
    heading: "Strong phishing signals found",
    steps: [
      {
        icon: Ban,
        text: "Do not open this link, and do not download anything it offers.",
      },
      {
        icon: Flag,
        text: "Report the message or email as phishing and delete it.",
      },
      {
        icon: Lock,
        text: "If you already entered a password on it, change that password now on the real site and turn on two-factor authentication.",
      },
    ],
  },
};

/** Copy button for the defanged URL — copies the safe, non-clickable form. */
function CopyDefangedButton({ url }: { url: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const defanged = defangUrl(url);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(defanged);
      setState("copied");
      toast("Defanged URL copied to clipboard.");
    } catch {
      setState("failed");
      toast("Copy failed — your browser blocked clipboard access.", "error");
    }
    window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="shrink-0"
      aria-label={`Copy defanged URL: ${defanged}`}
    >
      {state === "copied" ? (
        <Check aria-hidden className="text-safe" />
      ) : (
        <Copy aria-hidden />
      )}
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy defanged URL"}
    </Button>
  );
}

function downloadReport(result: ScanResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `linklens-report-${result.id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * Opens a clean, printable report in a new tab (falls back to
 * printing this page).
 *
 * Output-safety note (Phase 11 audit): this is the app's only
 * document.write. It is safe by construction — the template is a
 * static string authored here, and EVERY interpolated value passes
 * through escapeHtml above; URLs are additionally defanged and
 * rendered as plain text, never as an anchor, image or script.
 * Result data itself is Zod-validated at the service layer before
 * it can reach this function (lib/schemas.ts).
 */
function printReport(result: ScanResult, verdictLabel: string) {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) {
    window.print();
    return;
  }
  const featureRows = result.features
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.name)}</td><td>${escapeHtml(String(f.value))}</td><td>${f.impact > 0 ? "+" : "−"}${Math.abs(f.impact).toFixed(2)}</td><td>${escapeHtml(f.description)}</td></tr>`,
    )
    .join("");
  win.document.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>LinkLens scan report</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 40px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #444; font-size: 13px; margin-bottom: 20px; word-break: break-all; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
</style></head><body>
<h1>LinkLens — Scan report</h1>
<p class="meta">
  Verdict: <strong>${escapeHtml(verdictLabel)}</strong> · Confidence: ${result.confidence}%<br>
  URL (defanged): ${escapeHtml(defangUrl(result.url))}<br>
  Original URL as submitted: ${escapeHtml(result.url)}<br>
  Scanned at: ${escapeHtml(new Date(result.scannedAt).toLocaleString())}
  ${IS_MOCK_MODE ? "<br>Demo mode — simulated result." : ""}
</p>
<table><thead><tr><th>Feature</th><th>Value</th><th>Impact</th><th>Explanation</th></tr></thead>
<tbody>${featureRows}</tbody></table>
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

/* ------------------------------------------------------------------ */
/* Explainability section (Phase 6): top drivers, impact chart,        */
/* Simple/Technical explanations grouped by risk direction.            */
/* ------------------------------------------------------------------ */

type ExplainMode = "simple" | "technical";

const EXPLAIN_MODE_KEY = "linklens-explain-mode";

/** The Simple/Technical choice is kept in sessionStorage, so it is
 * remembered across result views for as long as the user stays on the
 * site (this tab), without surviving a new session. */
function readSavedExplainMode(): ExplainMode {
  if (typeof window === "undefined") return "simple";
  try {
    return window.sessionStorage.getItem(EXPLAIN_MODE_KEY) === "technical"
      ? "technical"
      : "simple";
  } catch {
    return "simple";
  }
}

function saveExplainMode(mode: ExplainMode) {
  try {
    window.sessionStorage.setItem(EXPLAIN_MODE_KEY, mode);
  } catch {
    // Storage unavailable (private mode etc.) — the toggle still works
    // for the current result view via component state.
  }
}

function formatImpact(impact: number): string {
  if (impact > 0) return `+${impact.toFixed(2)}`;
  if (impact < 0) return `−${Math.abs(impact).toFixed(2)}`;
  return "0.00";
}

interface ChartDatum {
  name: string;
  shortName: string;
  value: string;
  impact: number;
  description: string;
}

function FeatureChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: ChartDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  const risky = datum.impact > 0;
  return (
    <div className="max-w-xs rounded-xl border border-border bg-card p-3 shadow-card">
      <p className="text-sm font-semibold">{datum.name}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        value: {datum.value} · impact:{" "}
        <span className={risky ? "text-phishing" : "text-safe"}>
          {formatImpact(datum.impact)}
        </span>{" "}
        ({risky ? "increases risk" : "reduces risk"})
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {datum.description}
      </p>
    </div>
  );
}

function ExplainabilitySection({ features }: { features: ScanFeature[] }) {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<ExplainMode>(readSavedExplainMode);
  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const sorted = [...features].sort(
    (a, b) => Math.abs(b.impact) - Math.abs(a.impact),
  );
  const topDrivers = sorted.slice(0, 3);
  const chartData: ChartDatum[] = sorted.map((feature) => ({
    name: feature.name,
    shortName:
      feature.name.length > 24
        ? `${feature.name.slice(0, 23)}…`
        : feature.name,
    value: String(feature.value),
    impact: feature.impact,
    description: feature.description,
  }));
  const chartHeight = Math.max(190, chartData.length * 44 + 56);
  const chartLabel = `Bar chart of feature impacts, strongest first. Strongest driver: ${topDrivers[0]?.name ?? "none"} at ${topDrivers[0] ? formatImpact(topDrivers[0].impact) : "0"}. Bars to the right increase risk; bars to the left reduce it.`;

  const groups = [
    {
      key: "risk",
      title: "Increases risk",
      icon: TrendingUp,
      headingClasses: "text-phishing",
      items: sorted.filter((feature) => feature.impact > 0),
    },
    {
      key: "protective",
      title: "Reduces risk",
      icon: TrendingDown,
      headingClasses: "text-safe",
      items: sorted.filter((feature) => feature.impact <= 0),
    },
  ];
  const collapsible = features.length > 5;
  let remaining = expanded || !collapsible ? Number.POSITIVE_INFINITY : 5;
  const visibleGroups = groups.map((group) => {
    const visibleItems = group.items.slice(0, remaining);
    remaining -= visibleItems.length;
    return { ...group, visibleItems };
  });

  function chooseMode(next: ExplainMode) {
    saveExplainMode(next);
    setMode(next);
  }

  return (
    <div className="mt-6 border-t border-border/60 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Why this verdict — feature breakdown
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label="How to read the impact chart"
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen((open) => !open)}
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Info className="size-4" aria-hidden />
            </button>
            <span
              role="tooltip"
              className={cn(
                "absolute left-0 top-7 z-20 w-72 max-w-[78vw] rounded-xl border border-border bg-card p-3 text-left font-sans text-xs font-normal normal-case leading-relaxed tracking-normal text-foreground shadow-card max-[560px]:left-auto max-[560px]:right-0",
                infoOpen
                  ? "block"
                  : "hidden group-hover:block group-focus-within:block",
              )}
            >
              Each bar is one signal the model checked. Impact runs from
              −1 to +1: bars to the right (red) push the verdict toward
              phishing, bars to the left (green) pull it toward safe. The
              longer the bar, the more that signal influenced the verdict.
            </span>
          </span>
        </h3>
        <div
          className="inline-flex rounded-full border border-border bg-muted/40 p-0.5"
          role="group"
          aria-label="Explanation detail level"
        >
          {(["simple", "technical"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => chooseMode(option)}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                mode === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Top drivers */}
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Top drivers
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {topDrivers.map((feature) => (
          <li
            key={feature.name}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
          >
            {feature.name}
            <span
              className={cn(
                "font-mono font-semibold",
                feature.impact > 0 ? "text-phishing" : "text-safe",
              )}
            >
              {formatImpact(feature.impact)}
            </span>
          </li>
        ))}
      </ul>

      {/* Legend — colour plus icon and label */}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-phishing" />
          <TrendingUp aria-hidden className="size-3.5 text-phishing" />
          Increases risk
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-safe" />
          <TrendingDown aria-hidden className="size-3.5 text-safe" />
          Reduces risk
        </span>
      </div>

      {/* Impact chart */}
      <div role="img" aria-label={chartLabel} className="mt-2">
        <div aria-hidden="true" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
              barCategoryGap="24%"
            >
              <XAxis
                type="number"
                domain={[-1, 1]}
                ticks={[-1, -0.5, 0, 0.5, 1]}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
                height={42}
              >
                <Label
                  value="Impact score (−1 safer · +1 riskier)"
                  position="insideBottom"
                  offset={-2}
                  fill="var(--color-muted-foreground)"
                  fontSize={11}
                />
              </XAxis>
              <YAxis
                type="category"
                dataKey="shortName"
                width={148}
                tick={{ fill: "var(--color-foreground)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine x={0} stroke="var(--color-border)" />
              <Tooltip
                content={<FeatureChartTooltip />}
                cursor={{ fill: "var(--color-muted)", fillOpacity: 0.35 }}
              />
              <Bar
                dataKey="impact"
                barSize={10}
                radius={3}
                isAnimationActive={!reduceMotion}
                animationDuration={700}
                background={{ fill: "var(--color-muted)", fillOpacity: 0.45 }}
              >
                {chartData.map((datum) => (
                  <Cell
                    key={datum.name}
                    fill={
                      datum.impact > 0
                        ? "var(--color-phishing)"
                        : "var(--color-safe)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Screen-reader data table fallback for the chart */}
      <table className="sr-only">
        <caption>Feature impacts for this scan</caption>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Value</th>
            <th scope="col">Impact</th>
            <th scope="col">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((feature) => (
            <tr key={feature.name}>
              <td>{feature.name}</td>
              <td>{String(feature.value)}</td>
              <td>{formatImpact(feature.impact)}</td>
              <td>{feature.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Grouped explanations */}
      {visibleGroups.map(
        (group) =>
          group.visibleItems.length > 0 && (
            <div key={group.key} className="mt-6">
              <h4
                className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest",
                  group.headingClasses,
                )}
              >
                <group.icon className="size-4" aria-hidden />
                {group.title}
                <span className="font-normal normal-case tracking-normal text-muted-foreground">
                  ({group.items.length})
                </span>
              </h4>
              <ul className="mt-3 space-y-3.5">
                {group.visibleItems.map((feature) =>
                  mode === "simple" ? (
                    <li key={feature.name}>
                      <p className="text-sm leading-relaxed">
                        {feature.description}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {feature.name} ·{" "}
                        <span
                          className={
                            feature.impact > 0 ? "text-phishing" : "text-safe"
                          }
                        >
                          {feature.impact > 0 ? "increases risk" : "reduces risk"}
                        </span>
                      </p>
                    </li>
                  ) : (
                    <li key={feature.name} className="font-mono text-[13px] leading-relaxed">
                      <span className="font-semibold">{feature.name}</span>{" "}
                      <span className="text-muted-foreground">value=</span>
                      {String(feature.value)}{" "}
                      <span className="text-muted-foreground">impact=</span>
                      <span
                        className={
                          feature.impact > 0 ? "text-phishing" : "text-safe"
                        }
                      >
                        {formatImpact(feature.impact)}
                      </span>
                      <span className="mt-0.5 block font-sans text-xs leading-relaxed text-muted-foreground">
                        {feature.description}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ),
      )}

      {collapsible && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-4"
        >
          {expanded ? (
            <ChevronUp aria-hidden />
          ) : (
            <ChevronDown aria-hidden />
          )}
          {expanded
            ? "Show fewer features"
            : `Show all ${features.length} features`}
        </Button>
      )}
    </div>
  );
}

interface ScanResultViewProps {
  result: ScanResult;
  /** Clears the scan and returns focus to the (emptied) URL input. */
  onScanAnother: () => void;
}

/** Full result view for one scan: verdict banner, confidence, features, next steps, actions. */
export function ScanResultView({ result, onScanAnother }: ScanResultViewProps) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const config = VERDICT_CONFIG[result.verdict];
  const VerdictIcon = config.icon;
  const scannedAt = new Date(result.scannedAt);

  // Bring the result into view as it replaces the scanning view.
  useEffect(() => {
    sectionRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [reduceMotion]);

  return (
    <motion.section
      ref={sectionRef}
      aria-labelledby="scan-result-heading"
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass-card scroll-mt-28 overflow-hidden text-left"
    >
      {/* Verdict banner */}
      <div className={cn("border-b p-5 sm:p-6", config.bannerClasses)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
                config.iconClasses,
              )}
            >
              <VerdictIcon className="size-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold",
                    config.chipClasses,
                  )}
                >
                  <VerdictIcon className="size-4" aria-hidden />
                  {config.label}
                </span>
                {IS_MOCK_MODE && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
                    Demo mode · simulated result
                  </span>
                )}
              </div>
              <h2 id="scan-result-heading" className="mt-2.5 text-xl font-bold tracking-tight sm:text-2xl">
                {config.heading}
              </h2>
            </div>
          </div>
          <div className="text-center">
            <NeedleGauge value={result.confidence} className={config.gaugeClass} />
            <p className="mt-1 text-xs text-muted-foreground">model confidence</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {/* Scanned URL (defanged, never a link) + timestamp */}
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 break-all font-mono text-sm">
            {defangUrl(result.url)}
          </p>
          <CopyDefangedButton url={result.url} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          Scanned{" "}
          <time dateTime={result.scannedAt}>
            {scannedAt.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </p>

        {/* URL anatomy — structural parts of the scanned link (Phase 7) */}
        <UrlAnatomy url={result.url} />

        {/* Feature breakdown — explainability (chart + grouped detail) */}
        <ExplainabilitySection features={result.features} />

        {/* Recommended next steps */}
        <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Recommended next steps
          </h3>
          <ul className="mt-3.5 space-y-3">
            {config.steps.map((step) => {
              const StepIcon = step.icon;
              return (
                <li key={step.text} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border",
                      config.iconClasses,
                    )}
                  >
                    <StepIcon className="size-3.5" />
                  </span>
                  {step.text}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border/60 pt-5">
          <Button onClick={onScanAnother}>
            <RotateCcw aria-hidden />
            Scan another URL
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              downloadReport(result);
              toast("Report downloaded as JSON.");
            }}
          >
            <Download aria-hidden />
            Download report
          </Button>
          <Button variant="outline" onClick={() => printReport(result, config.label)}>
            <Printer aria-hidden />
            Print report
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
