# LinkLens — 6-minute demo script

A rehearsal script for presenting LinkLens in mock (demo) mode.
All expected results below were checked against the actual mock
engine (`src/lib/mock-scan.ts`) — what is written here is what the
screen will show.

**Total running time: 6:00** (30 + 30 + 45 + 60 + 60 + 60 + 45 + 30
seconds).

## Pre-demo checklist

- [ ] Run the **production build**, not the dev server:
      `npm run build` then `npm run start`, and open
      `http://localhost:3000`.
- [ ] Make sure you are in **mock mode** (default): `.env.local`
      either has no `NEXT_PUBLIC_USE_MOCK` line or sets it to
      `true`. Results should carry the "Demo mode · simulated
      result" badge — that is expected and honest for this demo.
- [ ] **Reset demo data:** there is no reset button. For a clean
      dashboard, either use a fresh browser profile, or clear the
      history by opening DevTools → Application → Local Storage
      and deleting the key `linklens-scan-history-v1`, then reload
      (the dashboard re-seeds its 50 sample entries). Your demo
      scans will be added on top of the seeds — that is fine, they
      appear at the top of the history.
- [ ] Browser: a clean window (no extensions visible), **100%
      zoom**, light mode to start.
- [ ] Keep the URLs file ready: `public/sample-urls.txt` (the four
      demo URLs, one per line) and `public/sample.csv` for the
      batch step. Both are also in this repo if you need them on
      the day.
- [ ] Do one full rehearsal run so the timings below are familiar.

## Run sheet

### 1. Home — 0:00–0:30

- **Show:** the home page. Point at the scan box, the sample result
  card on the right (needle gauge, "Phishing 94%"), and scroll just
  enough to show the "One link, taken apart" worked example.
- **Say:** "LinkLens answers one question — is this link safe to
  click? You paste the address as text; it never opens the site.
  It returns a verdict, a confidence score, and the evidence."

### 2. A safe URL — 0:30–1:00

- **Paste:** `https://www.github.com`
- **Screen shows:** the four-step scanning animation (~2–3 s), then
  **Safe, 98%** — green badge, needle near the top, top signals
  "Established domain −0.85" and "HTTPS −0.30", and a "Demo mode"
  badge.
- **Say:** "A well-known domain over HTTPS. The protective signals
  pull the score down, so the verdict is Safe with 98% confidence.
  Every result also gets saved to the history — we'll see it on
  the dashboard at the end."

### 3. The IP-address URL — 1:00–1:45

- **Paste:** `http://192.168.1.10/login`
- **Screen shows:** **Phishing, 94%** — top signals "IP address as
  host +0.85", "No HTTPS +0.62", "Suspicious keywords +0.30".
  Scroll to the **URL Anatomy** section: the host is one flagged
  chip labelled as the real destination.
- **Say:** "A login page on a raw IP address, over plain HTTP. Two
  strong signals — an IP host and no encryption — push this past
  Suspicious into Phishing. Note the anatomy view: it reads the
  address part by part and flags the host itself."
- **Presenter note:** over `https://` this same address scores
  **Suspicious, 79%** (that is the version on the example chips).
  If an examiner asks "why not Suspicious?", the honest answer is
  the missing HTTPS — be ready for it.

### 4. The "@" trick — 1:45–2:45

- **Paste:** `https://google.com@evil-site.xyz/login`
- **Screen shows:** **Phishing, 95%** — top signal "'@' symbol in
  URL +0.78", plus the `.xyz` TLD. In **URL Anatomy**, the
  `google.com` part is labelled **Credentials**, `evil-site.xyz`
  carries the **"Real destination"** label, and the summary line
  states the browser would really go to `evil-site[.]xyz`.
- **Say:** "This is the classic trick: everything before the @ is
  ignored by the browser — it's treated as credentials. The link
  looks like Google but actually lands on evil-site dot xyz.
  LinkLens names the real destination explicitly, which is the
  part a person skimming the link would miss."

### 5. A full phishing result — 2:45–3:45

- **Paste:** `http://secure-login-verify-free-prize.xyz/account/update`
- **Screen shows:** **Phishing, 96%**. Walk the result top to
  bottom: the **needle gauge**, the verdict banner, the defanged
  URL with its copy button, then the **feature-impact chart**.
  Toggle **Simple → Technical** (Technical shows each feature's
  raw value and impact; the choice is remembered for the session).
  Point at the top drivers: "Suspicious keywords +0.92",
  "Top-level domain +0.66", "No HTTPS +0.62". Finish on the
  **Recommended next steps** panel.
- **Say:** "The chart shows exactly which signals drove the
  verdict and by how much — nothing hides behind a single number.
  Simple view explains it in plain words; Technical view is for
  someone who wants the raw values. And the URL is always shown
  defanged, so it can never be clicked by accident."

### 6. Batch scan — 3:45–4:45

- **Show:** open **Batch** in the navbar. Click **Download sample
  CSV** (or upload `public/sample.csv`), show the preview table
  (5 valid rows), click **Scan 5 URLs**.
- **Screen shows:** the progress bar with live Safe / Suspicious /
  Phishing counters; it finishes in a few seconds. Results:
  **3 Safe (98%), 1 Suspicious (79% — the IP login), 1 Phishing
  (96%)**, summary cards, the verdict donut, and the results
  table. Mention Pause/Cancel and **Export results CSV**.
- **Say:** "For a whole list — say, links pulled from reported
  emails — batch mode scans three at a time, keeps going if one
  fails, and every result lands in the same history. The export
  is defanged and protected against spreadsheet formula
  injection."

### 7. Dashboard — 4:45–5:30

- **Show:** open **Dashboard**. Point at the stat cards, the
  stacked **Scans over time** chart, the verdict donut and **Top
  risk signals**. Use the search box to find `evil-site`, open
  that row to show the full result in the side panel, close it.
  Switch the range between 7 / 30 / 90 days.
- **Say:** "Everything scanned — in this session and the seeded
  sample history — is searchable here. The dashboard is also
  where patterns show up: which signals keep recurring across
  phishing results. In the demo build this history lives in the
  browser; with the real backend it comes from the API."

### 8. Closing — 5:30–6:00

- **Show:** back on the result page or home.
- **Say:** "So: paste a link, get a verdict you can defend —
  the score, the signals, and the real destination, without ever
  visiting the site. The frontend is complete; connecting the
  trained model is an environment-variable change, which the
  integration guide documents. Happy to take questions."

## Fallbacks

- **A scan seems to hang:** in mock mode a scan takes 2–3 s by
  design. If it runs much longer, the app is probably pointed at
  a backend that isn't responding — it will time out after 15 s
  and offer Retry. Use the **Cancel** button, check the mode
  (below), and re-run.
- **A page shows an error state:** stay calm, use the **Retry**
  button on the card — it recovers in mock mode. If a full error
  page appears, reload once; the production build is stable.
- **The network fails / the venue Wi-Fi drops:** the demo needs
  no network in mock mode — the engine runs in the browser.
  Just keep going; if the dev origin is unreachable, serve the
  production build locally (`npm run start`) on the same machine.
- **Switching to mock mode on the spot:** set
  `NEXT_PUBLIC_USE_MOCK=true` in `.env.local` (or delete the
  `=false` line), then restart — `npm run build && npm run start`
  for production, or restart `npm run dev`. Env variables are
  read at build/start time, not per click.
- **A URL with `error-test` in it fails on purpose:** that is a
  built-in mock test hook for demonstrating error states. Don't
  use such a URL by accident in the main flow.

## Likely Q&A

**How is the real model connected?**
Through one service layer (`src/lib/api.ts`). Setting
`NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_URL=<backend>`
switches every call to `POST /api/scan` and `GET /api/history` —
no component changes. The contract is documented in
INTEGRATION.md.

**What is simulated right now, and what is real?**
The verdicts are simulated by a transparent rule-based engine
(`src/lib/mock-scan.ts`) and the dashboard's 50 history entries
are seeded samples — both are labelled "Demo mode" in the UI.
Everything else is real: the UI, validation, history storage,
batch processing, charts, exports and error handling.

**Why are URLs defanged everywhere?**
So a phishing link can never be clicked, copied live, or rendered
as an image/link anywhere — results, tables, toasts, CSV exports
and the print view all show `hxxp://…[.]…`. The copy button copies
the defanged form too.

**How are inputs and CSV files validated?**
URLs are validated and length-capped (2048 chars) in the form;
batch input is capped at 1 MB and 500 URLs, accepts only `.csv` /
`.txt`, and files are content-checked (binary files are rejected
even with a text extension). Every API response and the stored
history are validated against a schema before use — malformed
data becomes a friendly error, never a crash.

**How are rate limits and timeouts handled?**
Requests time out after 15 seconds; network failures retry twice
with backoff; a `429` response shows "try again in N seconds"
(from the `Retry-After` header) and disables the Scan button
until the countdown ends. Those are client-side behaviours — the
real rate limiting must be enforced by the backend.

**How was accessibility handled?**
Verdicts are always icon + text, never colour alone; full
keyboard support with visible focus rings; scanning progress and
completion are announced to screen readers; every chart has a
screen-reader data table; contrast was measured to WCAG AA in
both themes; and animations respect `prefers-reduced-motion`.

**Can it scan a page's content, not just the URL?**
Not in this build — the analysis is deliberately URL-only, which
is also why it is safe: the suspect site is never visited. The
API contract leaves room for the backend to add content signals
later without changing the response shape.
