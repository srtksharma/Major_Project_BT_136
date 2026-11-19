import { Home, ScanSearch, ShieldExclamationPoint } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-phishing/10 text-phishing">
        <ShieldExclamationPoint className="size-7" aria-hidden />
      </span>
      <p className="mt-5 font-mono text-sm font-semibold tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        The address may have been mistyped, or the page has moved. Unlike
        a phishing link, this one is harmless — just a dead end.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">
            <Home aria-hidden />
            Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/scan">
            <ScanSearch aria-hidden />
            Scan a URL
          </Link>
        </Button>
      </div>
    </div>
  );
}
