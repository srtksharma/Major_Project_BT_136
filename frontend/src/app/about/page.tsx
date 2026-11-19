import {
  ChevronDown,
  CircleCheck,
  ListChecks,
  ScanSearch,
  ShieldCheck,
  ShieldExclamationPoint,
  TriangleExclamationPoint,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "How LinkLens works: the features the model analyses, what Safe, Suspicious and Phishing mean, the limitations, and answers to common questions.",
};

/** The signals described mirror the scan engine's feature set. */
const FEATURES: Array<{ name: string; blurb: string }> = [
  {
    name: "HTTPS",
    blurb:
      "Whether the link uses encrypted HTTPS. Its absence on a page asking for logins or payments is a classic warning sign.",
  },
  {
    name: "IP address as host",
    blurb:
      "Links that point at a raw IP number instead of a domain name hide who actually owns the destination.",
  },
  {
    name: "'@' symbol in URL",
    blurb:
      "Everything before an '@' is ignored by the browser as credentials, so 'bank.com@evil.com' really opens evil.com.",
  },
  {
    name: "Suspicious keywords",
    blurb:
      "Words like login, verify, secure, update, free and prize — pressure and bait language phishing pages rely on.",
  },
  {
    name: "Top-level domain",
    blurb:
      "Cheap, disposable endings such as .xyz, .top and .tk are heavily over-represented in phishing campaigns.",
  },
  {
    name: "Subdomain depth",
    blurb:
      "Long chains like login.bank.secure.example.com bury the real domain at the end, where few people look.",
  },
  {
    name: "URL length & path depth",
    blurb:
      "Very long links and deep paths give attackers room to hide the true destination behind clutter.",
  },
  {
    name: "Hyphens & digits in domain",
    blurb:
      "secure-login-verify-2024 style names are generated cheaply and mimic brands with small character swaps (paypa1).",
  },
  {
    name: "Punycode & non-standard ports",
    blurb:
      "Encoded lookalike characters and unusual ports are rare on legitimate sites and common on throwaway phishing hosts.",
  },
  {
    name: "Established domain",
    blurb:
      "A well-known, long-standing domain is a protective signal that pulls the score back toward Safe.",
  },
];

const VERDICTS = [
  {
    icon: ShieldCheck,
    label: "Safe",
    classes: "border-safe/40 bg-safe/10 text-safe",
    meaning:
      "No meaningful risk signals were found. The link looks like what it claims to be — normal care still applies.",
  },
  {
    icon: TriangleExclamationPoint,
    label: "Suspicious",
    classes: "border-suspicious/40 bg-suspicious/10 text-suspicious",
    meaning:
      "Some signals point the wrong way, but not enough for a phishing call. Don't enter credentials; reach the site another way and compare.",
  },
  {
    icon: ShieldExclamationPoint,
    label: "Phishing",
    classes: "border-phishing/40 bg-phishing/10 text-phishing",
    meaning:
      "Strong signs this link imitates a trusted service to steal logins or payment details. Don't open it, and report it where you received it.",
  },
] as const;

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Does LinkLens open or visit the link I paste?",
    a: "No. The URL is analysed as text — its structure and signals — and is never fetched or opened. That's also why scanned links are always displayed defanged (hxxps instead of https, dots written as [.]) and never rendered as clickable links.",
  },
  {
    q: "What does the confidence percentage mean?",
    a: "It's the model's confidence in the verdict it gave — how strongly the combined signals point that way. 98% on a Safe verdict means the signals overwhelmingly look legitimate; it is not a guarantee that a page can never be harmful.",
  },
  {
    q: "A link I trust got flagged. Can the model be wrong?",
    a: "Yes. New legitimate sites, URL shorteners and freshly registered domains can share signals with phishing pages, and clever phishing pages can look clean. Treat a verdict as strong evidence, not proof — when it matters, verify through a second channel.",
  },
  {
    q: "What happens to the URLs I scan?",
    a: "In this demo build, your scan history is stored only in your own browser (local storage) and powers the Dashboard. Clearing your browser data removes it. Nothing is uploaded anywhere by the demo's simulated engine.",
  },
  {
    q: "Why does the result say “Demo mode · simulated result”?",
    a: "This build's interface is complete, but verdicts currently come from a built-in simulation of the model so the experience can be reviewed end to end. When the machine-learning backend is connected, the same screens show live model verdicts and the badge disappears.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        About LinkLens
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Phishing pages imitate trusted brands to steal credentials, and
        they often stay online for only a few hours — too short a window
        for blocklists alone. LinkLens scores the URL itself with machine
        learning and URL analysis, so a link can be judged before it is
        ever opened — and every verdict shows the signals behind it.
      </p>

      <section aria-labelledby="how-heading" className="glass-card mt-8 p-6">
        <h2 id="how-heading" className="flex items-center gap-2 text-lg font-semibold">
          <ScanSearch className="size-5 text-primary" aria-hidden />
          How the model works
        </h2>
        <ol className="mt-4 space-y-3.5 text-sm leading-relaxed text-muted-foreground">
          <li className="flex gap-3">
            <span className="font-mono font-semibold text-primary">1.</span>
            <span>
              <strong className="text-foreground">You paste a link.</strong>{" "}
              It is treated purely as text — normalised, defanged, and never
              visited.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-semibold text-primary">2.</span>
            <span>
              <strong className="text-foreground">Features are extracted.</strong>{" "}
              The URL is broken into measurable signals — the features
              listed below — each scored from −1 (points to safe) to +1
              (points to phishing).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-semibold text-primary">3.</span>
            <span>
              <strong className="text-foreground">The model weighs them.</strong>{" "}
              A machine-learning model combines the signals into one risk
              score; strong impersonation signals outweigh cosmetic ones.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-semibold text-primary">4.</span>
            <span>
              <strong className="text-foreground">You get a verdict.</strong>{" "}
              The score becomes Safe, Suspicious or Phishing with a
              confidence percentage — and the full feature breakdown, so
              you can judge for yourself.
            </span>
          </li>
        </ol>
      </section>

      <section aria-labelledby="features-heading" className="glass-card mt-4 p-6">
        <h2 id="features-heading" className="flex items-center gap-2 text-lg font-semibold">
          <ListChecks className="size-5 text-primary" aria-hidden />
          Features the model analyses
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li
              key={feature.name}
              className="rounded-xl border border-border/60 bg-muted/30 p-3.5"
            >
              <p className="text-sm font-semibold">{feature.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {feature.blurb}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="verdicts-heading" className="glass-card mt-4 p-6">
        <h2 id="verdicts-heading" className="text-lg font-semibold">
          What the verdicts mean
        </h2>
        <ul className="mt-4 space-y-3">
          {VERDICTS.map((verdict) => (
            <li
              key={verdict.label}
              className="flex gap-3.5 rounded-xl border border-border/60 bg-muted/30 p-4"
            >
              <span
                aria-hidden
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${verdict.classes}`}
              >
                <verdict.icon className="size-5" />
              </span>
              <div>
                <p className="font-semibold">{verdict.label}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {verdict.meaning}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="limits-heading" className="glass-card mt-4 p-6">
        <h2 id="limits-heading" className="text-lg font-semibold">
          Limitations &amp; honest disclaimer
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            LinkLens analyses the URL, not the page behind it — a page can
            be swapped after a link is scanned, and a clean URL can still
            lead somewhere harmful.
          </li>
          <li>
            Verdicts are model predictions, not guarantees. A Safe result
            lowers the risk; it never removes it.
          </li>
          <li>
            Brand-new domains and shortened links carry little history to
            judge by, so borderline cases land on Suspicious by design.
          </li>
          <li>
            This demo build returns simulated results from a built-in
            model of the scoring logic, clearly labelled on every result.
            The live machine-learning backend connects through the same
            interface without changing these screens.
          </li>
        </ul>
        <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-safe" aria-hidden />
          Safety by design: scanned URLs are always shown defanged and are
          never rendered as clickable links, and verdicts always pair an
          icon and a label with their colour — never colour alone.
        </p>
      </section>

      <section aria-labelledby="faq-heading" className="glass-card mt-4 p-6">
        <h2 id="faq-heading" className="text-lg font-semibold">
          Frequently asked questions
        </h2>
        <div className="mt-2 divide-y divide-border/60">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 font-medium marker:hidden focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="pb-3 text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
