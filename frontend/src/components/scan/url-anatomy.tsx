"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, MapPin, TriangleExclamationPoint } from "lucide-react";
import { useId, useState } from "react";

import { defangUrl } from "@/lib/defang";
import { cn } from "@/lib/utils";

/**
 * URL Anatomy (Phase 7): breaks a scanned URL into its structural
 * parts — protocol, credentials, subdomains, domain, TLD, port, path,
 * query, fragment — shown as labelled chips. Suspicious parts are
 * flagged with an icon and a text label (never colour alone), and
 * every chip explains itself in an accessible tooltip.
 *
 * Everything displayed is defanged plain text; nothing is a link.
 */

const RISKY_TLDS = new Set([
  "xyz", "top", "tk", "click", "buzz", "club", "gq", "ml", "cf",
  "work", "zip", "mov", "icu", "rest", "quest", "best", "fun",
]);

const SUSPICIOUS_KEYWORDS = [
  "login", "verify", "secure", "update", "free", "prize",
];

/** Two-label public suffixes where the registrable domain is 3 labels. */
const TWO_LEVEL_SUFFIXES = new Set([
  "co.in", "com.in", "org.in", "net.in", "ac.in", "gov.in",
  "co.uk", "org.uk", "com.au", "co.nz", "com.br", "co.jp",
]);

const IPV4_HOST = /^(\d{1,3}\.){3}\d{1,3}$/;

interface UrlPart {
  key: string;
  label: string;
  /** Defanged display text. */
  display: string;
  /** What this part is, in plain language. */
  info: string;
  flag?: { label: string; reason: string };
  /** True for the part that is the actual destination host. */
  destination?: boolean;
}

interface ParsedAnatomy {
  parts: UrlPart[];
  summary: string;
}

function defangText(text: string): string {
  return text.replace(/\./g, "[.]");
}

function findKeyword(text: string): string | undefined {
  const lower = text.toLowerCase();
  return SUSPICIOUS_KEYWORDS.find((word) => lower.includes(word));
}

/** Digits woven into a word-like label, e.g. "paypa1" or "g00gle". */
function looksLikeLookalike(label: string): boolean {
  return (
    label.length >= 4 &&
    /[a-z]/i.test(label) &&
    /\d/.test(label) &&
    /(?:[a-z]\d)|(?:\d[a-z])/i.test(label)
  );
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function parseAnatomy(rawUrl: string): ParsedAnatomy {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      parts: [
        {
          key: "url",
          label: "URL",
          display: defangUrl(rawUrl),
          info: "This input could not be broken into URL parts, so it is shown whole — still defanged and never clickable.",
        },
      ],
      summary: "The real destination of this link could not be determined.",
    };
  }

  const parts: UrlPart[] = [];
  const isHttps = url.protocol === "https:";
  const schemeName = url.protocol.replace(":", "");
  parts.push({
    key: "protocol",
    label: "Protocol",
    display:
      schemeName === "https"
        ? "hxxps://"
        : schemeName === "http"
          ? "hxxp://"
          : `${schemeName}[://]`,
    info: "How your browser talks to the site. HTTPS encrypts the connection; plain HTTP sends everything — including passwords — in the open.",
    flag: isHttps
      ? undefined
      : {
          label: "No HTTPS",
          reason:
            "This link uses plain HTTP, so anything typed on the page travels unencrypted.",
        },
  });

  const hasCredentials = url.username !== "";
  if (hasCredentials) {
    parts.push({
      key: "credentials",
      label: "Credentials",
      display: `${defangText(safeDecode(url.username))}${url.password ? ":••••••" : ""}@`,
      info: "Everything before the '@' is treated as login details — and ignored as an address. Scammers put a trusted name here to hide the real destination after the '@'.",
      flag: {
        label: "'@' trick",
        reason:
          "Your browser ignores everything before the '@'. The real destination is the host that follows it.",
      },
    });
  }

  const host = url.hostname.toLowerCase();
  const isIp = IPV4_HOST.test(host) || host.includes(":");
  let domainLabel = host;
  let tld = "";
  let subdomains: string[] = [];

  if (!isIp) {
    const labels = host.split(".");
    const lastTwo = labels.slice(-2).join(".");
    const suffixLabels = TWO_LEVEL_SUFFIXES.has(lastTwo) ? 2 : 1;
    tld = labels.slice(-suffixLabels).join(".");
    domainLabel = labels[labels.length - suffixLabels - 1] ?? host;
    subdomains = labels.slice(0, labels.length - suffixLabels - 1);
  }
  const destination = isIp ? defangText(host) : `${domainLabel}[.]${defangText(tld)}`;

  if (subdomains.length > 0) {
    const joined = subdomains.join(".");
    const keyword = findKeyword(joined);
    parts.push({
      key: "subdomains",
      label: subdomains.length > 1 ? "Subdomains" : "Subdomain",
      display: `${defangText(joined)}.`,
      info: "Subdomains sit in front of the real domain and are controlled by the domain's owner. A familiar brand name here can be part of someone else's domain.",
      flag:
        subdomains.length > 3
          ? {
              label: "Many subdomains",
              reason: `${subdomains.length} subdomains are stacked in front of the domain — a common way to bury the real destination.`,
            }
          : keyword
            ? {
                label: "Suspicious keyword",
                reason: `The subdomain contains "${keyword}", a word phishing URLs often use to look official.`,
              }
            : undefined,
    });
  }

  if (isIp) {
    parts.push({
      key: "domain",
      label: "Host (IP address)",
      display: defangText(host),
      info: "The site is addressed by a raw IP number instead of a name, so there is no registered domain to check ownership against.",
      destination: true,
      flag: {
        label: "IP address host",
        reason:
          "Legitimate services use domain names. A raw IP hides who operates the site.",
      },
    });
  } else {
    const keyword = findKeyword(domainLabel);
    parts.push({
      key: "domain",
      label: "Domain",
      display: `${domainLabel}.`,
      info: "The registered name of the site — this, with the TLD, is the real destination. Everything before it is decoration controlled by the owner.",
      destination: true,
      flag: looksLikeLookalike(domainLabel)
        ? {
            label: "Lookalike characters",
            reason: `Digits are woven into "${domainLabel}" — a classic trick to mimic a well-known brand name at a glance.`,
          }
        : keyword
          ? {
              label: "Suspicious keyword",
              reason: `The domain contains "${keyword}", a word phishing URLs often use to look official.`,
            }
          : undefined,
    });
    parts.push({
      key: "tld",
      label: "TLD",
      display: defangText(tld),
      info: "The top-level domain — the ending of the address. Some endings are very cheap, so they are popular for throwaway sites.",
      flag: RISKY_TLDS.has(tld)
        ? {
            label: "Risky TLD",
            reason: `.${tld} domains are extremely cheap and disproportionately used by short-lived phishing sites.`,
          }
        : undefined,
    });
  }

  if (url.port) {
    parts.push({
      key: "port",
      label: "Port",
      display: `:${url.port}`,
      info: "The network port the site answers on. Normal websites use the standard ports (80/443), which never need to be written in the address.",
      flag: {
        label: "Non-standard port",
        reason:
          "An explicit unusual port is uncommon for established services and can be used to dodge filters.",
      },
    });
  }

  if (url.pathname && url.pathname !== "/") {
    const segments = url.pathname.split("/").filter(Boolean).length;
    const keyword = findKeyword(url.pathname);
    parts.push({
      key: "path",
      label: "Path",
      display: defangText(url.pathname),
      info: "The page or folder on the site, after the domain. Long paths can bury the meaningful part of an address.",
      flag:
        url.pathname.length > 40 || segments >= 4
          ? {
              label: "Very long path",
              reason: `This path is ${url.pathname.length} characters across ${segments} segments — long paths are often used to pad and disguise a link.`,
            }
          : keyword
            ? {
                label: "Suspicious keyword",
                reason: `The path contains "${keyword}", a word phishing URLs often use to look official.`,
              }
            : undefined,
    });
  }

  if (url.search) {
    parts.push({
      key: "query",
      label: "Query",
      display: defangText(url.search),
      info: "Extra data sent to the page after the '?', usually search terms or tracking codes. It does not change which site you land on.",
    });
  }

  if (url.hash) {
    parts.push({
      key: "fragment",
      label: "Fragment",
      display: defangText(url.hash),
      info: "A jump-to-section marker after '#'. It is handled inside your browser and never sent to the server.",
    });
  }

  const summary = hasCredentials
    ? `The real destination of this link is ${destination} — everything before the "@" is ignored by your browser.`
    : isIp
      ? `This link goes straight to an IP address (${destination}) instead of a named website.`
      : `The real destination of this link is ${destination}.`;

  return { parts, summary };
}

export function UrlAnatomy({ url }: { url: string }) {
  const reduceMotion = useReducedMotion();
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [open, setOpen] = useState<boolean>(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 640px)").matches,
  );
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);
  const { parts, summary } = parseAnatomy(url);

  return (
    <section
      aria-labelledby={`anatomy-heading-${reactId}`}
      className="mt-6 border-t border-border/60 pt-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id={`anatomy-heading-${reactId}`}
          className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
        >
          URL anatomy
        </h3>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {open ? (
            <ChevronUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden />
          )}
          {open ? "Collapse" : "Expand"}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-4 flex flex-wrap gap-x-2.5 gap-y-4">
            {parts.map((part, index) => {
              const tooltipId = `anatomy-tip-${reactId}-${part.key}`;
              const isOpen = openTooltip === part.key;
              return (
                <motion.div
                  key={part.key}
                  className="group relative flex flex-col"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.3,
                    delay: reduceMotion ? 0 : index * 0.06,
                  }}
                >
                  <span className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {part.label}
                  </span>
                  <button
                    type="button"
                    aria-describedby={tooltipId}
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenTooltip(isOpen ? null : part.key)
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 break-all rounded-lg border px-2.5 py-1.5 text-left font-mono text-xs sm:text-[13px]",
                      "focus-visible:outline-2 focus-visible:outline-primary",
                      part.flag
                        ? "border-phishing/50 bg-phishing/10"
                        : "border-border bg-muted/40",
                    )}
                  >
                    {part.display}
                    {part.flag && (
                      <TriangleExclamationPoint
                        className="size-3.5 shrink-0 text-phishing"
                        aria-hidden
                      />
                    )}
                  </button>
                  {part.flag && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-phishing">
                      <TriangleExclamationPoint
                        className="size-3 shrink-0"
                        aria-hidden
                      />
                      {part.flag.label}
                    </span>
                  )}
                  {part.destination && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                      <MapPin className="size-3 shrink-0" aria-hidden />
                      Real destination
                    </span>
                  )}
                  <span
                    role="tooltip"
                    id={tooltipId}
                    className={cn(
                      "absolute left-1/2 top-full z-20 mt-2 w-64 max-w-[78vw] -translate-x-1/2 rounded-xl border border-border bg-card p-3 font-sans text-xs leading-relaxed text-foreground shadow-card sm:left-0 sm:translate-x-0",
                      isOpen
                        ? "block"
                        : "hidden group-hover:block group-focus-within:block",
                    )}
                  >
                    {part.info}
                    {part.flag && (
                      <>
                        {" "}
                        <strong className="font-semibold text-phishing">
                          Flagged:
                        </strong>{" "}
                        {part.flag.reason}
                      </>
                    )}
                  </span>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>
        </>
      )}
    </section>
  );
}
