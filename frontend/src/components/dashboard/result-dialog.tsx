"use client";

import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ScanResultView } from "@/components/scan/scan-result";
import type { ScanResult } from "@/types/api";

/**
 * Scan detail side panel (Phase 8): shows the full stored result with
 * the same ScanResultView used on /scan. Keyboard accessible — focus
 * moves to the close button on open, Tab is trapped inside the panel
 * (Phase 11), Escape closes, focus returns to the element that opened
 * it, and the page behind is scroll-locked while it is open.
 */
export function ResultDialog({
  result,
  onClose,
}: {
  result: ScanResult;
  onClose: () => void;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: keep Tab cycling inside the panel while it is open.
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Return focus to the row/button that opened the panel.
      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus();
      }
    };
  }, [onClose]);

  function scanAgain() {
    onClose();
    router.push(`/scan?url=${encodeURIComponent(result.url)}`);
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Scan details"
        initial={reduceMotion ? false : { x: 72, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-4 shadow-card sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">Scan details</h2>
          <Button
            ref={closeRef}
            variant="outline"
            size="sm"
            onClick={onClose}
            aria-label="Close scan details"
          >
            <X aria-hidden />
            Close
          </Button>
        </div>
        {/* Its "Scan another URL" action doubles as this panel's Scan again */}
        <ScanResultView result={result} onScanAnother={scanAgain} />
      </motion.aside>
    </div>
  );
}
