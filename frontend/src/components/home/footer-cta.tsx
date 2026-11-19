import { ScrollReveal } from "@/components/home/scroll-reveal";
import { UrlScanForm } from "@/components/scan/url-scan-form";

/** Closing call-to-action with a second instance of the scan form. */
export function FooterCta() {
  return (
    <section aria-labelledby="footer-cta-heading" className="mx-auto max-w-3xl">
      <ScrollReveal>
        <div className="glass-card p-6 text-center sm:p-10">
          <div>
            <h2
              id="footer-cta-heading"
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Got a link you don&apos;t trust?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Check it before you click. Paste it here and LinkLens will
              show you the verdict — and the evidence behind it.
            </p>
            <div className="mx-auto mt-6 max-w-xl text-left">
              <UrlScanForm />
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
