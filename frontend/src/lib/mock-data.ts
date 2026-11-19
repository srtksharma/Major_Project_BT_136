import { mockScan } from "@/lib/mock-scan";
import type { ScanResult, Verdict } from "@/types/api";

/**
 * Seed history for the mock API (Phase 8): ~50 realistic scans spread
 * over the last 30 days with a believable verdict mix (about 55% safe,
 * 25% suspicious, 20% phishing).
 *
 * Every entry is produced by the same mock engine that scores live
 * scans (lib/mock-scan.ts), so features and confidences are exactly
 * what a real scan of that URL would return — only the timestamps are
 * backdated. The mix is guaranteed by bucketing candidates by the
 * verdict the engine actually gives them.
 *
 * Only the service layer (lib/api.ts) imports this file.
 */

const CANDIDATE_URLS: string[] = [
  // Everyday, legitimate browsing (engine scores these safe)
  "https://www.google.com",
  "https://mail.google.com",
  "https://docs.google.com",
  "https://github.com",
  "https://github.com/srtksharma/genai-bi-churn-dashboard",
  "https://en.wikipedia.org/wiki/Phishing",
  "https://www.wikipedia.org",
  "https://www.youtube.com",
  "https://www.microsoft.com",
  "https://www.apple.com",
  "https://www.amazon.in",
  "https://www.amazon.com",
  "https://www.linkedin.com",
  "https://www.netflix.com",
  "https://openai.com",
  "https://www.mozilla.org",
  "https://stackoverflow.com/questions",
  "https://www.bbc.com/news",
  "https://www.nytimes.com",
  "https://www.flipkart.com",
  "https://www.zomato.com",
  "https://www.swiggy.com",
  "https://www.irctc.co.in/nget/train-search",
  "https://developer.mozilla.org/en-US/docs/Web",
  "https://www.python.org",
  "https://react.dev",
  "https://nextjs.org",
  "https://www.khanacademy.org",
  "https://www.coursera.org",
  "https://www.udemy.com",
  "https://www.reddit.com",
  "https://www.instagram.com",
  "https://www.facebook.com",
  "https://web.whatsapp.com",
  "https://www.spotify.com",
  "https://www.booking.com",
  "https://www.airbnb.co.in",
  "https://www.myntra.com",
  "https://www.ajio.com",
  "https://www.hdfcbank.com",
  "https://www.sbi.co.in",
  "https://paytm.com",
  // Grey-area links (engine scores these suspicious)
  "https://192.168.1.10/login",
  "https://192.168.0.23/admin",
  "https://10.0.0.5/dashboard",
  "https://172.16.8.4/config",
  "https://192.168.1.254/status",
  "http://myaccount-portal.com/login",
  "http://banking-alerts.com/notice",
  "https://free-offer.top/claim",
  "https://bonus-rewards.click/win",
  "https://a.b.c.example.com/login",
  "https://secure.docs.example.net/signin",
  "http://mailbox.example.com/signin",
  "https://promo-deals.xyz/free",
  // Outright phishing attempts (engine scores these phishing)
  "http://secure-login-verify-free-prize.xyz/account/update",
  "http://paypa1-secure.xyz/login",
  "https://accounts.google.com@evil-site.top/confirm/password",
  "http://192.168.1.1/admin",
  "http://login.bankofamerica-secure.top/verify",
  "http://claim-your-prize-now.buzz/winner/free",
  "https://secure-update-required.gq/password/confirm",
  "http://apple-id-verify.suspended-account.click/signin",
  "http://xn--pypl-43d.com/login",
  "https://wallet-restore-seed.top/confirm/credential",
  "http://free-gift-cards-2024.icu/claim",
  "http://192.0.2.44/bank/login/update",
];

/** Target mix out of 50 seeds: 27 safe / 13 suspicious / 10 phishing. */
const TARGET_COUNTS: Record<Verdict, number> = {
  safe: 27,
  suspicious: 13,
  phishing: 10,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic pseudo-random (LCG) so the seed set is stable per load. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function buildSeedHistory(): ScanResult[] {
  const buckets: Record<Verdict, ScanResult[]> = {
    safe: [],
    suspicious: [],
    phishing: [],
  };
  for (const url of CANDIDATE_URLS) {
    const result = mockScan(url);
    buckets[result.verdict].push(result);
  }

  const picked: ScanResult[] = [];
  (Object.keys(TARGET_COUNTS) as Verdict[]).forEach((verdict) => {
    const bucket = buckets[verdict];
    const target = TARGET_COUNTS[verdict];
    for (let i = 0; i < target; i += 1) {
      if (i < bucket.length) {
        picked.push(bucket[i]);
      } else {
        // Bucket ran short: re-scan a variant (tracking-style query added)
        // so the mix still holds with a distinct URL.
        const base = bucket[i % bucket.length];
        const separator = base.url.includes("?") ? "&" : "?";
        picked.push(mockScan(`${base.url}${separator}ref=seed${i}`));
      }
    }
  });

  const random = makeRandom(20261113);
  const now = Date.now();
  return picked
    .map((result) => ({
      ...result,
      // Backdate: somewhere in the last 30 days, at least ~15 minutes ago.
      scannedAt: new Date(
        now - (0.01 + random() * 29.9) * DAY_MS,
      ).toISOString(),
    }))
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
    .map((result, index) => ({
      ...result,
      id: `seed_${String(index + 1).padStart(3, "0")}`,
    }));
}

export const MOCK_HISTORY: ScanResult[] = buildSeedHistory();
