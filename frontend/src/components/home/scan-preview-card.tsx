"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ShieldExclamationPoint } from "lucide-react";

import { NeedleGauge } from "@/components/scan/needle-gauge";
import { defangUrl } from "@/lib/defang";
import { cn } from "@/lib/utils";

/**
 * Floating glass preview of a scan result, shown in the hero.
 * Clearly labelled as a sample — real scans run on the /scan page.
 */

const SAMPLE_URL = "http://paypa1-secure.xyz";
const SAMPLE_CONFIDENCE = 94;

const SAMPLE_FEATURES = [
  { name: "Lookalike domain", detail: "\u201cpaypa1\u201d swaps a letter for a digit", impact: 0.92 },
  { name: "Brand impersonation", detail: "Name copies a well-known payment brand", impact: 0.85 },
  { name: "Suspicious TLD", detail: ".xyz domains are cheap and often short-lived", impact: 0.74 },
] as const;

export function ScanPreviewCard() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="glass-card mx-auto w-full max-w-md p-5 sm:p-6"
      role="img"
      aria-label="Sample scan result: the defanged URL hxxp://paypa1-secure[.]xyz was judged phishing with 94 percent confidence, based on a lookalike domain, brand impersonation, and a suspicious top-level domain."
    >
      <div aria-hidden>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sample scan result
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-phishing/40 bg-phishing/10 px-2.5 py-1 text-xs font-semibold text-phishing">
            <ShieldExclamationPoint className="size-3.5" />
            Phishing
          </span>
        </div>

        <p className="mt-4 break-all font-mono text-sm text-foreground">
          {defangUrl(SAMPLE_URL)}
        </p>

        <div className="mt-2 flex items-end justify-center gap-4">
          <NeedleGauge value={SAMPLE_CONFIDENCE} className="text-phishing" size="sm" />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          model confidence in the phishing verdict
        </p>

        <ul className="mt-5 space-y-3.5">
          {SAMPLE_FEATURES.map((feature, index) => (
            <li key={feature.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <p className="font-medium">{feature.name}</p>
                <p className="font-mono text-xs text-phishing">
                  +{feature.impact.toFixed(2)}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{feature.detail}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={cn("h-full rounded-full bg-phishing")}
                  initial={reduceMotion ? false : { width: 0 }}
                  whileInView={{ width: `${feature.impact * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.3 + index * 0.12, ease: "easeOut" }}
                />
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Sample shown for illustration. Scan a URL above to run a
          real scan.
        </p>
      </div>
    </motion.div>
  );
}
