import type { ScanFeature, ScanResult, Verdict } from "@/types/api";

/**
 * Deterministic mock scan engine (Phase 3).
 *
 * This is NOT the ML model — it is a transparent rule-based stand-in
 * that scores the same URL patterns the real model uses, so the UI
 * behaves realistically until the backend is connected:
 * IP-address hosts, missing HTTPS, "@" symbols, URL length, subdomain
 * depth, hyphens/digits in the host, suspicious keywords and TLDs,
 * punycode, non-standard ports and lookalike structure.
 *
 * Same URL in -> same verdict out (no randomness in scoring).
 */

const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "click", "buzz", "club", "gq", "tk", "ml", "cf",
  "work", "zip", "mov", "icu", "rest", "quest", "best", "fun",
]);

const SUSPICIOUS_KEYWORDS = [
  "secure", "login", "signin", "verify", "free", "prize", "account",
  "update", "confirm", "bank", "wallet", "bonus", "claim", "password",
  "credential", "suspended", "urgent", "winner",
];

/** Widely recognised, long-lived domains — treated as established. */
const ESTABLISHED_DOMAINS = [
  "google.com", "microsoft.com", "apple.com", "amazon.com",
  "amazon.in", "github.com", "wikipedia.org", "youtube.com",
  "linkedin.com", "netflix.com", "openai.com", "mozilla.org",
];

const IPV4_HOST = /^(\d{1,3}\.){3}\d{1,3}$/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface ScoredSignal {
  feature: ScanFeature;
}

function analyse(rawUrl: string): { features: ScanFeature[]; risk: number } {
  const parsed = new URL(rawUrl);
  const host = parsed.hostname.toLowerCase();
  const urlLower = rawUrl.toLowerCase();
  const signals: ScoredSignal[] = [];
  const add = (feature: ScanFeature) => signals.push({ feature });

  const isIpHost = IPV4_HOST.test(host);
  const hostLabels = host.split(".");
  const tld = isIpHost ? "" : (hostLabels[hostLabels.length - 1] ?? "");
  const subdomainCount = isIpHost ? 0 : Math.max(0, hostLabels.length - 2);
  const hyphenCount = (host.match(/-/g) ?? []).length;
  const digitCount = (host.match(/\d/g) ?? []).length;
  const pathSegments = parsed.pathname.split("/").filter(Boolean).length;
  const established = ESTABLISHED_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );

  if (established) {
    add({
      name: "Established domain",
      value: host,
      impact: -0.85,
      description:
        "The domain is widely recognised and long-lived, and it matches the brand it claims to be.",
    });
  }

  if (isIpHost) {
    add({
      name: "IP address as host",
      value: host,
      impact: 0.85,
      description:
        "Legitimate services almost always use a domain name. A raw IP host hides who operates the site.",
    });
  }

  if (parsed.protocol === "https:") {
    add({
      name: "HTTPS",
      value: "Present",
      impact: -0.3,
      description:
        "The connection is encrypted. That protects data in transit, but says nothing about who owns the site.",
    });
  } else {
    add({
      name: "HTTPS",
      value: "Not present (plain HTTP)",
      impact: 0.62,
      description:
        "Anything typed on this page — including passwords — travels unencrypted. A strong risk signal.",
    });
  }

  if (rawUrl.includes("@")) {
    add({
      name: "'@' symbol in URL",
      value: "Present",
      impact: 0.78,
      description:
        "Browsers ignore everything before '@', so the real destination is whatever follows it — a classic way to disguise a link's true host.",
    });
  }

  const foundKeywords = SUSPICIOUS_KEYWORDS.filter((word) =>
    urlLower.includes(word),
  );
  if (foundKeywords.length >= 3) {
    add({
      name: "Suspicious keywords",
      value: foundKeywords.slice(0, 5).join(", "),
      impact: 0.92,
      description:
        "Multiple urgency and credential-harvesting keywords — a pattern typical of phishing campaigns rather than real service URLs.",
    });
  } else if (foundKeywords.length > 0) {
    add({
      name: "Suspicious keywords",
      value: foundKeywords.join(", "),
      impact: foundKeywords.length === 2 ? 0.55 : 0.3,
      description:
        "Words like these are common in phishing URLs that imitate account and login flows.",
    });
  }

  if (tld && SUSPICIOUS_TLDS.has(tld)) {
    add({
      name: "Top-level domain",
      value: `.${tld}`,
      impact: 0.66,
      description:
        "Very cheap TLDs are disproportionately used for short-lived phishing sites that are abandoned within hours.",
    });
  }

  if (rawUrl.length > 75) {
    add({
      name: "URL length",
      value: rawUrl.length,
      impact: 0.55,
      description:
        "Unusually long URLs are often used to bury the real destination under misleading words and sub-paths.",
    });
  } else if (rawUrl.length > 54) {
    add({
      name: "URL length",
      value: rawUrl.length,
      impact: 0.35,
      description:
        "Longer than a typical service URL — length is often used to hide the real destination.",
    });
  } else if (rawUrl.length < 30) {
    add({
      name: "URL length",
      value: rawUrl.length,
      impact: -0.18,
      description: "A short, clean URL with no room for obfuscation tricks.",
    });
  }

  if (!isIpHost && subdomainCount >= 3) {
    add({
      name: "Subdomain depth",
      value: subdomainCount,
      impact: 0.5,
      description:
        "Deep subdomains let a lookalike name (for example a brand name) appear inside an unrelated domain.",
    });
  } else if (!isIpHost && subdomainCount === 2) {
    add({
      name: "Subdomain depth",
      value: subdomainCount,
      impact: 0.25,
      description: "More subdomains than a typical service URL uses.",
    });
  } else if (!isIpHost && subdomainCount <= 1) {
    add({
      name: "Subdomain depth",
      value: subdomainCount,
      impact: -0.12,
      description: "A simple host structure, like most established services.",
    });
  }

  if (hyphenCount >= 3) {
    add({
      name: "Hyphens in domain",
      value: hyphenCount,
      impact: 0.45,
      description:
        "Chains of hyphenated words are a common way to stuff brand and urgency keywords into a domain name.",
    });
  } else if (hyphenCount > 0) {
    add({
      name: "Hyphens in domain",
      value: hyphenCount,
      impact: 0.18,
      description: "Some hyphens are normal, but they are also used to build lookalike domains.",
    });
  }

  if (digitCount >= 4 && !isIpHost) {
    add({
      name: "Digits in domain",
      value: digitCount,
      impact: 0.4,
      description:
        "Heavy digit use in a domain often signals a generated or lookalike name (for example swapping a letter for a digit).",
    });
  }

  if (host.includes("xn--")) {
    add({
      name: "Punycode domain",
      value: "xn-- present",
      impact: 0.5,
      description:
        "Punycode can render characters that look identical to a trusted brand's letters while being a different domain.",
    });
  }

  if (parsed.port) {
    add({
      name: "Non-standard port",
      value: parsed.port,
      impact: 0.45,
      description:
        "Established services use the standard web ports. An explicit unusual port is a common evasion signal.",
    });
  }

  if (pathSegments >= 3) {
    add({
      name: "Path depth",
      value: pathSegments,
      impact: 0.2,
      description: "A deep path can bury the meaningful part of the address under filler folders.",
    });
  }

  const positive = signals
    .map((s) => s.feature.impact)
    .filter((impact) => impact > 0)
    .reduce((sum, impact) => sum + impact, 0);
  const negative = signals
    .map((s) => s.feature.impact)
    .filter((impact) => impact < 0)
    .reduce((sum, impact) => sum + impact, 0);

  const risk = clamp(Math.round(10 + positive * 48 + negative * 22), 2, 98);

  const features = signals
    .map((s) => s.feature)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 7);

  return { features, risk };
}

function verdictForRisk(risk: number): Verdict {
  if (risk >= 65) return "phishing";
  if (risk >= 35) return "suspicious";
  return "safe";
}

function confidenceFor(verdict: Verdict, risk: number): number {
  if (verdict === "phishing") {
    return clamp(Math.round(86 + ((risk - 65) / 35) * 11), 86, 97);
  }
  if (verdict === "suspicious") {
    return clamp(Math.round(82 - Math.abs(risk - 50) * 0.6), 68, 84);
  }
  return clamp(Math.round(90 + ((35 - risk) / 35) * 8), 88, 98);
}

/** Analyse a URL with the mock engine and return a contract-shaped result. */
export function mockScan(rawUrl: string): ScanResult {
  const { features, risk } = analyse(rawUrl);
  const verdict = verdictForRisk(risk);
  return {
    id: `scan_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    url: rawUrl,
    verdict,
    confidence: confidenceFor(verdict, risk),
    scannedAt: new Date().toISOString(),
    features,
  };
}
