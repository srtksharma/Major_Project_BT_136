import Link from "next/link";

import { LogoMark, LogoWordmark } from "@/components/layout/logo";
import { NAV_LINKS } from "@/lib/navigation";

export async function Footer() {
  // Cached at prerender time — Next.js (Cache Components) treats
  // `new Date()` in a static component as unstable without this.
  "use cache";
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/70 bg-background/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="flex items-center gap-2.5 tracking-tight">
              <LogoMark className="size-6 text-foreground" />
              <LogoWordmark />
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Secure phishing website detection using machine learning and URL
              analysis. Every verdict comes with the signals behind it, so you
              can see why a link was flagged — not just that it was.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 text-sm">
            <div>
              <p className="font-semibold text-foreground">Explore</p>
              <ul className="mt-3 space-y-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">Safety practice</p>
              <p className="mt-3 max-w-56 leading-relaxed text-muted-foreground">
                Scanned URLs are always shown defanged — for example
                hxxp://evil[.]com — and are never rendered as clickable links.
              </p>
            </div>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border/60 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} LinkLens — check the link before you click.</p>
          <p>
            Verdicts are model predictions, not guarantees. Verify a site
            through a second channel before entering credentials.
          </p>
        </div>
      </div>
    </footer>
  );
}
