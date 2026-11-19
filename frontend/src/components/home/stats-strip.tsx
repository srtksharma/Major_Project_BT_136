import { ScrollReveal } from "@/components/home/scroll-reveal";

/**
 * Landing stats — every number is true by design of the product:
 * the API contract, the verdict set, and the defanging rule.
 */
const STATS = [
  {
    value: "3",
    label: "Verdict levels",
    detail: "Safe, Suspicious or Phishing — never a bare yes/no",
  },
  {
    value: "−1 … +1",
    label: "Impact per feature",
    detail: "Every signal is scored, so each verdict can be explained",
  },
  {
    value: "100%",
    label: "URLs shown defanged",
    detail: "Scanned links are displayed as hxxp://…[.]…, never clickable",
  },
  {
    value: "0",
    label: "Visits to the suspect site",
    detail: "The URL is analysed as text — you never have to open it",
  },
] as const;

export function StatsStrip() {
  return (
    <section aria-label="LinkLens by the numbers" className="mx-auto max-w-5xl">
      <dl className="glass-card grid grid-cols-2 gap-x-4 gap-y-8 p-6 sm:p-8 lg:grid-cols-4">
        {STATS.map((stat, index) => (
          <ScrollReveal key={stat.label} delay={index * 0.08}>
            <div className="text-center lg:text-left">
              <dd className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {stat.value}
              </dd>
              <dt className="mt-1.5 text-sm font-semibold">{stat.label}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {stat.detail}
              </dd>
            </div>
          </ScrollReveal>
        ))}
      </dl>
    </section>
  );
}
