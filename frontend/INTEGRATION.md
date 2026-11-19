# LinkLens — Backend Integration Guide

How to connect the real backend to this frontend. **If your backend
matches the contract in §3, no frontend code changes are needed** —
only environment variables (§2) and a rebuild.

## 1. Overview

LinkLens is a Next.js (App Router) + TypeScript frontend that scans a
URL and shows a verdict (Safe / Suspicious / Phishing), a confidence
score, the signals behind the verdict, a per-part URL breakdown, a
dashboard with scan history, and a batch-scan page.

All backend access goes through one service layer,
`src/lib/api.ts`, used via the React Query hooks
`src/hooks/use-scan.ts` and `src/hooks/use-history.ts`. No component
calls `fetch` directly.

Today the app runs entirely on **mock data**:

- `src/lib/mock-scan.ts` — a deterministic rule-based engine that
  scores URLs locally (it is *not* the real ML model).
- `src/lib/mock-data.ts` — 50 seeded history entries (27 safe /
  13 suspicious / 10 phishing, spread over the last 30 days) that
  populate the dashboard before the user scans anything.
- Mock latency is simulated: 2.2–2.8 s per scan (300–800 ms per URL
  in batch mode).

## 2. Environment variables

All variables are `NEXT_PUBLIC_*`, i.e. **public** — they are inlined
into the browser bundle at build time. Never put secrets in them;
changing any of them requires a rebuild/redeploy.

| Variable | Purpose | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCK` | `"true"` (or unset) = mock mode. `"false"` = call the real backend. | `false` |
| `NEXT_PUBLIC_USE_MOCK_API` | Legacy alias of the flag above. Setting **either** variable to `"false"` enables real mode. Prefer the canonical name. | — |
| `NEXT_PUBLIC_API_URL` | Base URL of the backend. The frontend appends `/api/scan` and `/api/history` to it, so give the origin/root, **without** a trailing `/api`. Only used in real mode. | `http://localhost:8000` or `https://api.example.com` |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the deployed frontend; used only to build absolute Open Graph share URLs. Optional locally. | `https://linklens.example.com` |

See `.env.example` for the template (copy it to `.env.local`).

**Switching to real mode:**

```bash
# .env.local
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_URL=https://api.example.com
```

Then rebuild/restart the frontend (`npm run build && npm run start`,
or `npm run dev`). The "Demo mode · simulated result" badge on scan
results and the dashboard's demo note disappear automatically —
they are driven by the same flag (`IS_MOCK_MODE` in
`src/lib/api.ts`). The About page's demo wording is static text;
see §9.

## 3. API contract

Source of truth: `src/types/api.ts`. Responses are additionally
validated at runtime against the Zod schemas in
`src/lib/schemas.ts`; a response that violates the ranges/caps below
is rejected or dropped (see §4), so treat the caps as part of the
contract.

### `POST /api/scan`

Request body (`application/json`):

```json
{ "url": "https://example.com/some/page" }
```

The frontend only ever sends URLs it has already normalised to
`http://` or `https://` and capped at 2048 characters — but the
backend must validate again server-side.

Response: one `ScanResult`.

```ts
interface ScanRequest { url: string }

interface ScanFeature {
  name: string;              // 1–200 chars
  value: string | number;    // string ≤ 500 chars, or a number
  impact: number;            // -1 to 1: negative = protective, positive = risky
  description: string;       // ≤ 1000 chars, plain-language explanation
}

interface ScanResult {
  id: string;                // 1–200 chars, unique per scan
  url: string;               // the scanned URL, echoed back (≤ 8192 chars)
  verdict: "safe" | "suspicious" | "phishing";
  confidence: number;        // 0–100 (percentage)
  scannedAt: string;         // ISO 8601 timestamp, e.g. "2026-11-19T09:30:00.000Z"
  features: ScanFeature[];   // at most 50; may be empty
}
```

Full examples:

Safe:

```json
{
  "id": "scan_9f2c1a",
  "url": "https://www.google.com",
  "verdict": "safe",
  "confidence": 98,
  "scannedAt": "2026-11-19T09:30:00.000Z",
  "features": [
    {
      "name": "Established domain",
      "value": "google.com",
      "impact": -0.85,
      "description": "The domain is a well-known, long-established site."
    },
    {
      "name": "Uses HTTPS",
      "value": "https",
      "impact": -0.3,
      "description": "The connection is encrypted, which is expected for a legitimate site."
    }
  ]
}
```

Suspicious:

```json
{
  "id": "scan_9f2c1b",
  "url": "https://192.168.1.10/login",
  "verdict": "suspicious",
  "confidence": 79,
  "scannedAt": "2026-11-19T09:31:12.000Z",
  "features": [
    {
      "name": "IP address host",
      "value": "192.168.1.10",
      "impact": 0.85,
      "description": "The address uses a raw IP instead of a domain name, which legitimate login pages rarely do."
    },
    {
      "name": "Suspicious keywords",
      "value": "login",
      "impact": 0.44,
      "description": "The path contains words often used on credential-harvesting pages."
    }
  ]
}
```

Phishing:

```json
{
  "id": "scan_9f2c1c",
  "url": "http://secure-login-verify-free-prize.xyz/account/update",
  "verdict": "phishing",
  "confidence": 96,
  "scannedAt": "2026-11-19T09:32:45.000Z",
  "features": [
    {
      "name": "Top-level domain",
      "value": ".xyz",
      "impact": 0.66,
      "description": "The .xyz ending is cheap and disposable, so it is often used for short-lived phishing sites."
    },
    {
      "name": "Suspicious keywords",
      "value": "secure, login, verify, free, prize",
      "impact": 0.74,
      "description": "Several words commonly used to pressure or lure victims appear in the address."
    },
    {
      "name": "No HTTPS",
      "value": "http",
      "impact": 0.62,
      "description": "The page asks for account details over an unencrypted connection."
    }
  ]
}
```

Notes:

- `features` order does not matter; the UI sorts by impact.
- `confidence` is the model's confidence **in the stated verdict**,
  not a risk score.
- The frontend never renders `url` as a clickable link — it is
  displayed defanged (`hxxp://…[.]…`) — but return the real URL.

### `GET /api/history`

Response: a JSON array of `ScanResult` (same shape as above),
**most recent first**. No query parameters are sent. The frontend
keeps at most the first 1000 valid entries; entries that fail
validation are silently dropped, valid ones are shown.

### Batch scans

There is **no batch endpoint**. The batch page calls
`POST /api/scan` once per URL with a client-side concurrency of 3,
up to 500 URLs per batch. Expect bursts of up to 3 concurrent scan
requests from one user.

## 4. Error handling

The frontend's HTTP layer (`requestJson` in `src/lib/api.ts`)
behaves as follows — this is what your backend will experience and
what it should return:

| Situation | Frontend behaviour |
| --- | --- |
| Timeout | Each attempt times out after **15 s**. Treated as a network error (retried, see below), then the user sees "The scan service took too long to respond." |
| Network failure (DNS, connection refused, CORS block) | Retried up to **2 times** (3 attempts total) with 400 ms / 1200 ms backoff, then a "Couldn't reach the scan service" message. |
| `429 Too Many Requests` | **Not retried.** The UI reads the `Retry-After` header (seconds or HTTP date; clamped to 1–600 s; defaults to 30 s when absent), shows "Too many requests — try again in N seconds", and disables the Scan button with a live countdown until it elapses. **Send `Retry-After` on 429s.** |
| Other `4xx` | Not retried. Generic "rejected the request (status)" message. |
| `5xx` | Not retried. Generic "service is having trouble (status)" message. |
| `200` with non-JSON body | "The scan service sent a response we couldn't read." |
| `200` with JSON that fails the contract (§3) | Scan: "…result in an unexpected format" error. History: invalid entries dropped; a non-array body is an error. |

**Error bodies are not read.** The UI derives its messages from the
status code alone, so your error body format is free; returning
`{ "message": "..." }` (the `ApiError` shape in
`src/types/api.ts`) is a sensible convention for the future, but
nothing currently displays it.

Other client behaviour to know about:

- Requests are sent with `Content-Type: application/json` and
  `credentials: "omit"` — **no cookies and no auth headers**. If the
  API needs authentication, that requires a frontend change; do not
  rely on cookie auth.
- The user can cancel an in-flight scan; the frontend aborts the
  request. A cancelled scan is discarded.
- The scan form throttles repeat submissions (1.2 s cooldown) and
  validates URLs client-side. This is UX only — **the backend must
  enforce its own rate limiting, validation and abuse protection.**

## 5. Files to touch

For a contract-matching backend: **none** — configuration only (§2).

Where the mock lives, if you ever retire or change it:

| File | Role | Action |
| --- | --- | --- |
| `src/lib/api.ts` | Service layer; contains the mock/real switch (`IS_MOCK_MODE`), the mock branches of `scanUrl`/`getHistory`, and the real HTTP layer. | Keep. The real-mode code path is already written. Mock branches can be deleted only if mock mode is retired for good. |
| `src/lib/mock-scan.ts` | Rule-based mock scoring engine. | Mock only; removable with mock mode. |
| `src/lib/mock-data.ts` | 50 seeded history entries for the dashboard. | Mock only; removable with mock mode. |
| `src/lib/schemas.ts` | Runtime validation mirroring the contract. | **Keep as-is** — it is the contract's enforcement on the client. If the contract ever changes, update it together with `src/types/api.ts`. |
| `src/types/api.ts` | The contract types. | **Keep in sync with the backend.** |
| `src/hooks/use-scan.ts`, `src/hooks/use-history.ts` | React Query wrappers (caching, cancellation, history invalidation). | No changes needed. |
| `.env.example` | Documents every variable. | Update if variables change. |

## 6. History

**Today (mock mode):** history lives in the browser. On first load
it is seeded from `src/lib/mock-data.ts`, then persisted to
`localStorage` under the key `linklens-scan-history-v1` (cap 200,
most recent first). Every completed scan — single or batch — is
prepended. Stored data is validated on load; corrupt entries fall
back to the seed set. Nothing is shared between browsers or users.

**Real mode:** `getHistory()` calls `GET /api/history` (§3) and the
localStorage store is not used at all. Scans are **not** posted to a
history endpoint — the frontend assumes the backend records each
`POST /api/scan` itself and returns it from `GET /api/history`
afterwards (the scan mutation invalidates the cached history, so a
fresh `GET` follows each scan). If the backend is stateless, the
dashboard will simply show whatever `GET /api/history` returns
(e.g. an empty array — the dashboard has an empty state for that).

To change history behaviour (accounts, server-side persistence,
pagination), change `getHistory()` in `src/lib/api.ts` and the
contract in `src/types/api.ts` / `src/lib/schemas.ts` together.

## 7. CORS and CSP

**CORS — the backend must:**

- Allow the frontend's origin: `Access-Control-Allow-Origin:
  <frontend origin>` (an exact origin, not `*`, if you later add
  credentials — today none are sent).
- Handle the `OPTIONS` preflight: the frontend sends
  `Content-Type: application/json`, which triggers a preflight for
  cross-origin calls. Allow methods `POST, GET, OPTIONS` and header
  `Content-Type`.
- Expose the `Retry-After` header on 429 responses (it is readable
  by default as a CORS-safelisted response header; no
  `Access-Control-Expose-Headers` needed for it).

**CSP — the frontend side is already handled:** `next.config.ts`
sets a Content-Security-Policy whose `connect-src` is `'self'` plus
the **origin of `NEXT_PUBLIC_API_URL`**, derived automatically at
build time. So:

- Set `NEXT_PUBLIC_API_URL` correctly *before* building/deploying
  the frontend, or the browser will block API calls.
- If the API is ever served from a different origin than
  `NEXT_PUBLIC_API_URL` (redirects, a CDN in front), update the env
  var — and note that `fetch` follows redirects cross-origin only
  with matching CORS headers, so prefer serving the API directly at
  the configured origin.

## 8. Integration checklist

1. Implement `POST /api/scan` and `GET /api/history` per §3,
   including the field ranges and caps.
2. Add CORS handling per §7, including `OPTIONS` preflights.
3. Add rate limiting that returns `429` + `Retry-After`.
4. Create `.env.local` from `.env.example`; set
   `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_URL=<backend>`.
5. Rebuild and restart the frontend.
6. Confirm the "Demo mode" badge no longer appears on scan results.
7. Run the manual tests below.

**Manual tests afterwards:**

- **Safe URL** — scan `https://www.google.com`: Safe verdict,
  gauge, feature list, and the scan appears on the dashboard.
- **Suspicious URL** — scan a URL your backend scores suspicious:
  amber verdict everywhere (result, history table, dashboard).
- **Phishing URL** — same check for a phishing verdict.
- **Invalid URL** — type `not a url` in the form: the frontend
  rejects it before any request (check the Network tab — no call).
- **Timeout** — make the backend sleep > 15 s: the UI retries
  (watch for up to 3 requests) and then shows the timeout message.
- **429** — have the backend return `429` with
  `Retry-After: 20`: the UI shows the countdown and disables Scan
  until it elapses.
- **Offline / backend down** — stop the backend and scan: after the
  retries, a "Couldn't reach the scan service" message; restart it
  and confirm Retry recovers.
- **Malformed response** — return `{}` from `POST /api/scan`: the
  UI shows the "unexpected format" error, not a crash.
- **Batch** — run a batch of ~10 URLs on `/batch`: at most 3
  concurrent requests, results land in the dashboard history.
- **History** — reload the dashboard: history comes from
  `GET /api/history` only (clear `localStorage` — nothing changes).

## 9. Known limitations and assumptions

- **The mock engine is not the product.** `mock-scan.ts` scores with
  hand-written lexical rules. Verdicts in mock mode are for demo and
  development only; the real model lives behind the API.
- **Seeded dashboard data is fake.** The 50 seed entries exist only
  in mock mode. In real mode the dashboard shows exactly what
  `GET /api/history` returns — expect it to be empty at first.
- **"Demo mode" badge** appears on every result while
  `IS_MOCK_MODE` is true (either flag unset or not `"false"`), and
  the dashboard's demo note follows the same flag; both disappear in
  real mode with no code change. One exception: the About page's
  explanatory copy about the demo (its limitations section and FAQ)
  is static text — update `src/app/about/page.tsx` by hand when the
  real backend goes live, or it will keep describing the demo build.
- **Mock-only test hook:** in mock mode, any URL containing
  `error-test` deliberately fails, to exercise error states. This
  does not exist in real mode — the equivalent test needs the real
  backend to fail.
- **No authentication or user accounts.** History is global
  (whatever the endpoint returns) or per-browser (mock
  localStorage). Per-user history needs backend auth plus a
  frontend change (§4).
- **No request signing or API key.** The frontend sends no key; if
  the backend requires one, it cannot be a secret — anything in
  `NEXT_PUBLIC_*` is public. Protect the API with rate limits and
  server-side checks instead.
- **History size:** the frontend displays at most 1000 history
  entries and sends no pagination parameters. Very large histories
  should be trimmed server-side.
- **URL length:** the form caps input at 2048 characters; the
  response schema accepts `url` up to 8192. Keep backend limits at
  or above what the frontend sends.
