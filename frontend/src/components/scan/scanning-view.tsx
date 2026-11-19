"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { defangUrl } from "@/lib/defang";
import { cn } from "@/lib/utils";

export const SCAN_STEPS = [
  "Analyzing URL structure",
  "Checking domain signals",
  "Running ML model",
  "Generating report",
] as const;

/**
 * When each of the first three steps completes (ms since scan start).
 * The last step never completes on a timer — it holds until the real
 * response arrives and the parent passes `finishing`, so the UI never
 * claims "complete" early.
 */
const STEP_COMPLETE_AT_MS = [550, 1300, 2100] as const;

interface ScanningViewProps {
  /** Raw URL being scanned — always displayed defanged, never as a link. */
  url: string;
  /** True once the response has arrived; completes the final step. */
  finishing: boolean;
  onCancel: () => void;
}

/**
 * The full scanning experience for /scan (Phase 4): a scanner visual —
 * the defanged URL in a glass card under a sweeping scan line — plus a
 * four-step progress indicator with animated checkmarks and a pulsing
 * active step. Step changes are announced via aria-live, and all
 * motion is disabled under prefers-reduced-motion.
 */
export function ScanningView({ url, finishing, onCancel }: ScanningViewProps) {
  const reduceMotion = useReducedMotion();
  const [timerStep, setTimerStep] = useState(0);

  useEffect(() => {
    const timers = STEP_COMPLETE_AT_MS.map((at, index) =>
      setTimeout(() => setTimerStep(index + 1), at),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const completedCount = finishing ? SCAN_STEPS.length : timerStep;
  const activeStep = Math.min(completedCount, SCAN_STEPS.length - 1);
  const progressPercent = finishing
    ? 100
    : ((completedCount + 0.5) / SCAN_STEPS.length) * 100;

  return (
    <section aria-label="Scanning in progress" className="glass-card p-5 text-left sm:p-6">
      {/* Screen-reader announcements for step changes */}
      <p role="status" aria-live="polite" className="sr-only">
        {finishing
          ? "Scan complete. Preparing your report."
          : `Scanning. Step ${activeStep + 1} of ${SCAN_STEPS.length}: ${SCAN_STEPS[activeStep]}.`}
      </p>

      {/* Scanner visual */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/30 px-5 py-8">
        {/* Radar pulse rings behind the URL */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {[0, 1].map((ring) => (
            <motion.span
              key={ring}
              className="absolute size-24 rounded-full border border-primary/25"
              initial={false}
              animate={
                reduceMotion
                  ? { scale: 1.6, opacity: 0.15 }
                  : { scale: [0.5, 2.1], opacity: [0.4, 0] }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 2.8, repeat: Infinity, delay: ring * 1.4, ease: "easeOut" }
              }
            />
          ))}
        </div>
        {/* Sweeping scan line */}
        {!reduceMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-foreground/10 to-transparent"
            initial={false}
            animate={{ top: ["-15%", "100%", "-15%"] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="absolute inset-x-0 top-1/2 h-px bg-foreground/50" />
          </motion.div>
        )}
        <p className="relative text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Scanning URL
        </p>
        <p className="relative mt-2 break-all text-center font-mono text-sm sm:text-base">
          {defangUrl(url)}
        </p>
        <p className="relative mt-3 text-center text-xs text-muted-foreground">
          Analysed as text only — LinkLens never opens the link.
        </p>
      </div>

      {/* Step progress */}
      <ol className="mt-6 space-y-3.5">
        {SCAN_STEPS.map((step, index) => {
          const isDone = index < completedCount;
          const isActive = !finishing && index === completedCount;
          return (
            <li key={step} className="flex items-center gap-3" aria-current={isActive ? "step" : undefined}>
              <span
                aria-hidden
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  isDone && "border-safe/50 bg-safe/15 text-safe",
                  isActive && "border-primary/60 bg-primary/10 text-primary",
                  !isDone && !isActive && "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {isActive && !reduceMotion && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
                )}
                {isDone ? (
                  <motion.span
                    initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="relative flex"
                  >
                    <Check className="size-3.5" />
                  </motion.span>
                ) : (
                  <span className="relative">{index + 1}</span>
                )}
              </span>
              <span
                className={cn(
                  "text-sm",
                  isDone && "text-muted-foreground",
                  isActive && "font-medium",
                  !isDone && !isActive && "text-muted-foreground/70",
                )}
              >
                {step}
                {isDone && <span className="sr-only"> (complete)</span>}
                {isActive && <span className="sr-only"> (in progress)</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Overall progress bar */}
      <div
        className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        aria-label="Overall scan progress"
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${progressPercent}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {!finishing && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Mock scan — results take 2–3 seconds while the ML backend is being connected.
          </p>
          <Button variant="outline" onClick={onCancel} className="shrink-0">
            <X aria-hidden />
            Cancel scan
          </Button>
        </div>
      )}
    </section>
  );
}
