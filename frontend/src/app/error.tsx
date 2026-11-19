"use client";

import { CircleExclamationPoint, Home, RotateCcw, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Route error boundary (Phase 10): friendly recovery screen for any
 * unexpected render/data error, with a retry and links back to the
 * main flows.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-phishing/10 text-phishing">
        <CircleExclamationPoint className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
        Something went wrong
      </h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        An unexpected error stopped this page from loading. Your scan
        history is stored safely in your browser and hasn&apos;t been
        lost — try again, or head back to a main page.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline">
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
