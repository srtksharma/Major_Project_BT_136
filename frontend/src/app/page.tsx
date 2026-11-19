import {
  BrainCircuit,
  MousePointerClick,
  ShieldCheck,
  ShieldExclamationPoint,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FooterCta } from "@/components/home/footer-cta";
import { ScanPreviewCard } from "@/components/home/scan-preview-card";
import { ScrollReveal } from "@/components/home/scroll-reveal";
import { StatsStrip } from "@/components/home/stats-strip";
import { UrlScanForm } from "@/components/scan/url-scan-form";
import { UrlAnatomy } from "@/components/scan/url-anatomy";
import { defangUrl } from "@/lib/defang";

/** The worked example below uses the same sample link as the hero
 *  preview card, with two of its flagged signals. */
const EXAMPLE_URL = "http://paypa1-secure.xyz";
const EXAMPLE_SIGNALS = [
  {
    part: "The domain — paypa1-secure",
    detail:
      "It swaps the letter l for the digit 1 to imitate a payment brand; the real brand's address is spelled normally.",
    impact: "+0.92",
  },
  {
    part: "The ending — .xyz",
    detail:
      "This domain ending is cheap and disposable, so it is a favourite for short-lived phishing sites.",
    impact: "+0.74",
  },
] as const;

const STEPS = [
  {
    icon: MousePointerClick,
    title: "Paste the URL",
    body: "Drop in any link from a message, email or ad. Nothing is opened or downloaded.",
  },
  {
    icon: BrainCircuit,
    title: "The model analyses it",
    body: "Dozens of lexical and domain signals are extracted and scored by the classifier.",
  },
  {
    icon: ShieldCheck,
    title: "Read the verdict — and the evidence",
    body: "You get a verdict, a confidence score, and the exact features that drove it.",
  },
] as const;

export const metadata: Metadata = {
  title: "LinkLens — Secure Phishing Website Detection",
  description:
    "Paste any link and LinkLens checks it for phishing with machine learning and URL analysis — verdict, confidence, and the reasons, before you click.",
};

export default function HomePage() {
  return (
    <div className="relative flex flex-col gap-20 pb-4">

      {/* ---------- Hero ---------- */}
      <section className="grid items-center gap-12 pt-2 sm:pt-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative">
          <ScrollReveal>
            <p className="text-sm text-muted-foreground">
              Machine learning + URL analysis — with the evidence shown.
            </p>
            <h1 className="mt-4 font-display text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Is this link safe to click?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              LinkLens analyses a URL&apos;s structure and risk signals with
              a machine-learning model, then shows you exactly why it reached
              its verdict — before you open the site.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.12}>
            <div className="mt-8">
              <UrlScanForm />
              <p className="mt-3 text-sm">
                <Link
                  href="#how-it-works"
                  className="font-medium text-brand underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  How it works →
                </Link>
              </p>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.2} className="lg:justify-self-end">
          <ScanPreviewCard />
        </ScrollReveal>
      </section>

      {/* ---------- Stats strip ---------- */}
      <StatsStrip />

      {/* ---------- Worked example ---------- */}
      <section
        aria-labelledby="example-heading"
        className="mx-auto grid w-full max-w-6xl items-start gap-8 lg:grid-cols-[0.85fr_1.15fr]"
      >
        <ScrollReveal>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Worked example
            </p>
            <h2
              id="example-heading"
              className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
            >
              One link, taken apart
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              This link claims to be a payment login. LinkLens never opens
              it — it reads the address itself, and two signals give it
              away before any page loads:
            </p>
            <ol className="mt-6 space-y-4">
              {EXAMPLE_SIGNALS.map((signal, index) => (
                <li key={signal.part} className="flex gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-phishing/40 bg-phishing/10 font-display text-sm font-semibold text-phishing"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="flex flex-wrap items-baseline gap-2 font-semibold">
                      {signal.part}
                      <span className="font-mono text-xs font-medium text-phishing">
                        {signal.impact}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {signal.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Every scan gives you this full breakdown — each part of the
              address labelled, and every signal scored — not just a
              verdict.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.12}>
          <div className="glass-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 truncate font-mono text-sm" title={defangUrl(EXAMPLE_URL)}>
                {defangUrl(EXAMPLE_URL)}
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-phishing/40 bg-phishing/10 px-2.5 py-0.5 text-xs font-semibold text-phishing">
                <ShieldExclamationPoint className="size-3.5" aria-hidden />
                Phishing
              </span>
            </div>
            <div className="mt-2 border-t border-border">
              <UrlAnatomy url={EXAMPLE_URL} />
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto w-full max-w-5xl scroll-mt-24">
        <ScrollReveal>
          <h2 id="how-heading" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
            Three steps between a suspicious link and a decision you can defend.
          </p>
        </ScrollReveal>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <ScrollReveal key={step.title} delay={index * 0.1} className="h-full">
              <li className="glass-card h-full p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-foreground">
                    <step.icon className="size-5.5" aria-hidden />
                  </span>
                  <span aria-hidden className="font-mono text-sm text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            </ScrollReveal>
          ))}
        </ol>
      </section>

      {/* ---------- Footer CTA ---------- */}
      <FooterCta />
    </div>
  );
}
