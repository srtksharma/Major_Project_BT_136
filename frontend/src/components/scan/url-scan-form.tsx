"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  CircleCheck,
  CircleExclamationPoint,
  ClipboardPaste,
  Link2,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  ShieldExclamationPoint,
  TriangleExclamationPoint,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defangUrl } from "@/lib/defang";
import {
  normalizeUrl,
  scanFormSchema,
  type ScanFormInput,
  type ScanFormValues,
} from "@/lib/url";
import { cn } from "@/lib/utils";
import type { Verdict } from "@/types/api";

/**
 * Demo URLs — one per verdict. `url` is the exact value scanned;
 * `display` is its shortened form for the chip (hostname plus a
 * short path, protocol omitted) — the full defanged URL is in the
 * chip's title and aria-label, so what is shown always matches
 * what is scanned.
 */
export const EXAMPLE_URLS: { verdict: Verdict; url: string; display: string }[] = [
  { verdict: "safe", url: "https://www.google.com", display: "www.google.com" },
  {
    verdict: "suspicious",
    url: "https://192.168.1.10/login",
    display: "192.168.1.10/login",
  },
  {
    verdict: "phishing",
    url: "http://secure-login-verify-free-prize.xyz/account/update",
    display: "secure-login-verify-free-prize.xyz/account",
  },
];

const VERDICT_CHIP: Record<
  Verdict,
  { label: string; icon: typeof ShieldCheck; classes: string }
> = {
  safe: {
    label: "Safe example",
    icon: ShieldCheck,
    classes:
      "border-safe/40 bg-safe/10 text-safe hover:bg-safe/20 focus-visible:outline-safe",
  },
  suspicious: {
    label: "Suspicious example",
    icon: TriangleExclamationPoint,
    classes:
      "border-suspicious/40 bg-suspicious/10 text-suspicious hover:bg-suspicious/20 focus-visible:outline-suspicious",
  },
  phishing: {
    label: "Phishing example",
    icon: ShieldExclamationPoint,
    classes:
      "border-phishing/40 bg-phishing/10 text-phishing hover:bg-phishing/20 focus-visible:outline-phishing",
  },
};

interface UrlScanFormProps {
  /** Pre-fill the input (e.g. from the ?url= query param on /scan). */
  initialUrl?: string;
  autoFocus?: boolean;
  /** Visually dim + disable the example chips (e.g. while a scan runs). */
  examplesDimmed?: boolean;
}

type ClipboardNote = { kind: "success" | "error"; text: string };

/**
 * Reusable URL scan form (React Hook Form + Zod).
 *
 * On submit it navigates to /scan?url=<encoded>; the scan page then
 * runs the scan via the useScan hook (see hooks/use-scan.ts).
 */
export function UrlScanForm({ initialUrl = "", autoFocus = false, examplesDimmed = false }: UrlScanFormProps) {
  const router = useRouter();
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const inputId = `scan-url-${reactId}`;
  const hintId = `scan-hint-${reactId}`;
  const errorId = `scan-error-${reactId}`;
  const clipboardId = `scan-clipboard-${reactId}`;

  const [clipboardNote, setClipboardNote] = useState<ClipboardNote | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ScanFormInput, unknown, ScanFormValues>({
    resolver: zodResolver(scanFormSchema),
    defaultValues: { url: initialUrl },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const error = errors.url;

  async function onSubmit(values: ScanFormValues) {
    // Brief pause so the loading state is perceptible before navigation.
    await new Promise((resolve) => setTimeout(resolve, 450));
    router.push(`/scan?url=${encodeURIComponent(values.url)}`);
  }

  async function handlePaste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setClipboardNote({
          kind: "error",
          text: "Your clipboard is empty — copy a link first, or paste with Ctrl+V (Cmd+V on Mac).",
        });
        return;
      }
      setValue("url", text, { shouldValidate: true, shouldDirty: true });
      setClipboardNote({ kind: "success", text: "Link pasted from your clipboard." });
    } catch {
      setClipboardNote({
        kind: "error",
        text: "Couldn't read your clipboard — your browser blocked it. Paste with Ctrl+V (Cmd+V on Mac) instead.",
      });
    }
  }

  function handleExample(url: string) {
    setClipboardNote(null);
    setValue("url", url, { shouldValidate: false, shouldDirty: true });
    // Navigate directly with the chip's own URL. Filling the form and
    // submitting it in the same tick can race React Hook Form's state
    // update and carry a stale (previously entered) value instead —
    // the chip must scan exactly the URL it displays.
    router.push(`/scan?url=${encodeURIComponent(normalizeUrl(url))}`);
  }

  const describedBy = [hintId, error ? errorId : null, clipboardNote ? clipboardId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div
          className={cn(
            "glass-card flex flex-col gap-2 p-2 transition-shadow duration-300 sm:flex-row sm:items-center",
            "focus-within:border-foreground/50",
            error && "border-phishing/60 focus-within:border-phishing/60",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
            <Link2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <label htmlFor={inputId} className="sr-only">
              Website URL to scan
            </label>
            <Input
              id={inputId}
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- caller-controlled and deliberate: only set on the dedicated /scan page (single-task focus) and after "Scan another URL", where returning focus to the input is the requested action.
              autoFocus={autoFocus}
              placeholder="Paste a URL…"
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className="h-11 border-0 bg-transparent font-mono shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
              {...register("url")}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handlePaste}
              aria-label="Paste URL from clipboard"
              title="Paste URL from clipboard"
              className="size-11 shrink-0 rounded-xl"
            >
              <ClipboardPaste className="size-5" aria-hidden />
            </Button>
            <motion.div whileTap={isSubmitting ? undefined : { scale: 0.97 }} className="flex-1 sm:flex-none">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                aria-busy={isSubmitting || undefined}
                className="h-11 w-full rounded-xl px-6 sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="animate-spin" aria-hidden />
                    Loading scanner…
                  </>
                ) : (
                  <>
                    <ScanSearch aria-hidden />
                    Scan URL
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </div>

        <p id={hintId} className="mt-2.5 text-left text-xs text-muted-foreground">
          Analysed as text only — LinkLens never opens the link, and results
          always show it defanged.
        </p>

        <div className="min-h-7">
        <AnimatePresence>
          {error && (
            <motion.p
              key="url-error"
              id={errorId}
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="mt-2 flex items-start gap-1.5 text-left text-sm font-medium text-phishing"
            >
              <CircleExclamationPoint className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error.message}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {clipboardNote && (
            <motion.p
              key="clipboard-note"
              id={clipboardId}
              role={clipboardNote.kind === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "mt-2 flex items-start gap-1.5 text-left text-sm",
                clipboardNote.kind === "error" ? "font-medium text-phishing" : "text-muted-foreground",
              )}
            >
              {clipboardNote.kind === "success" ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-safe" aria-hidden />
              ) : (
                <CircleExclamationPoint className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              {clipboardNote.text}
            </motion.p>
          )}
        </AnimatePresence>
        </div>
      </form>

      <div
        className={cn(
          "mt-4 transition-opacity duration-300",
          examplesDimmed && "pointer-events-none opacity-40 saturate-50",
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Try an example:</span>
        {EXAMPLE_URLS.map((example) => {
          const chip = VERDICT_CHIP[example.verdict];
          const ChipIcon = chip.icon;
          return (
            <button
              key={example.url}
              type="button"
              onClick={() => handleExample(example.url)}
              disabled={isSubmitting}
              aria-label={`${chip.label}: scan ${example.url}`}
              title={defangUrl(example.url)}
              className={cn(
                "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] leading-tight font-medium transition-colors duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
                chip.classes,
              )}
            >
              <ChipIcon className="size-3.5 shrink-0" aria-hidden />
              {/* Small screens show the verdict word instead of the URL */}
              <span className="capitalize md:hidden">{example.verdict}</span>
              <span className="hidden truncate font-mono text-[10px] font-normal opacity-80 md:inline">
                {defangUrl(example.display)}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
