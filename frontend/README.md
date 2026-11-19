# LinkLens — Secure Phishing Website Detection

LinkLens checks whether a link is safe to click: paste a URL and it
returns a Safe, Suspicious or Phishing verdict with a confidence
score and the signals behind it.

## What it does

You paste a URL as text — **LinkLens never opens or visits the
site**. It analyses the address itself (structure, host, domain
signals and lexical patterns) and reports:

- a **verdict** — Safe, Suspicious or Phishing — with a
  **confidence score** (0–100),
- the **signals** that drove the verdict, each with an impact score
  from −1 (protective) to +1 (risky) and a plain-language
  explanation,
- a **breakdown of the URL** into its parts (protocol, credentials,
  subdomains, domain, TLD, port, path), with risky parts flagged.

## Features

- **Single scan** with an animated, cancellable scanning progress
  view (four analysis steps).
- **Result page** with a needle gauge, a per-feature impact chart
  with **Simple and Technical views**, a URL Anatomy breakdown,
  recommended next steps, and downloadable/printable reports.
- **Batch scan** — upload a CSV (or paste a list, one URL per line)
  and scan up to 500 URLs with progress, pause/resume/cancel,
  per-URL results, filtering, sorting and CSV export.
- **Dashboard** — scan history with stat cards and trends, a
  stacked verdict chart, a verdict-distribution donut, top risk
  signals, full-text search, verdict filters and CSV export.
- **Light and dark mode** (light-first design, toggle in the
  navbar).
- **Accessibility** — keyboard support and visible focus rings,
  verdicts always shown as icon + text (never colour alone),
  screen-reader announcements and data tables for charts,
  `prefers-reduced-motion` support, WCAG AA contrast.
- **Security measures** — scanned URLs are always displayed
  **defanged** (`hxxp://evil[.]com`) and never rendered as links;
  Content-Security-Policy and security headers on every route;
  client-side input validation (URL format, length caps, file type
  and content checks); CSV exports protected against
  formula injection.

## Tech stack

Versions from `package.json`:

| Area | Technology |
| --- | --- |
| Framework | Next.js 16.4.6 (App Router), React 19.3.0 |
| Language | TypeScript ^5 |
| Styling | Tailwind CSS 4.3.3, shadcn/ui (Radix), tw-animate-css 1.4.0 |
| Animation | Framer Motion ^14.12.0 |
| Charts | Recharts ^3.10.1 |
| Data fetching | TanStack Query ^5.107.1 |
| Forms & validation | React Hook Form ^7.92.0, Zod ^4.6.7, @hookform/resolvers ^7.0.6 |
| Theming | next-themes ^0.4.6 |
| Icons | lucide-react ^1.72.0 |
| Tests & lint | Vitest ^3.2.7, ESLint ^9 (eslint-config-next 16.4.6, eslint-plugin-jsx-a11y ^6.10.2) |

## Getting started

**Prerequisites:** Node.js 20 or later (the project targets Node 20;
there is no `.nvmrc` or `engines` field yet) and npm.

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:3000
```

Production:

```bash
npm run build        # production build
npm run start        # serve the build
```

Checks (these are the scripts that exist in `package.json`, plus
the typecheck command — there is no `typecheck` script):

```bash
npm run lint         # ESLint
npx tsc --noEmit     # TypeScript typecheck
npm test             # Vitest (unit tests for parsing, validation, CSV safety)
```

## Environment variables

Copy `.env.example` to `.env.local`. All variables are
`NEXT_PUBLIC_*` — public, inlined at build time; never put secrets
in them. Changing one requires a rebuild.

| Variable | Purpose | Default | Example |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCK` | Mock mode on/off. `"false"` switches to the real backend. | `true` | `false` |
| `NEXT_PUBLIC_USE_MOCK_API` | Legacy alias of the flag above; setting either to `"false"` enables real mode. | *(unset)* | `false` |
| `NEXT_PUBLIC_API_URL` | Base URL of the backend (the frontend appends `/api/scan` and `/api/history`). Real mode only. | *(empty)* | `http://localhost:8000` |
| `NEXT_PUBLIC_SITE_URL` | Public URL of this site, used for Open Graph share URLs. | *(unset)* | `https://your-deployment-url` |

## Mock mode vs real backend

By default the app runs in **mock mode**: a rule-based engine in
`src/lib/mock-scan.ts` produces scans locally, and the dashboard is
seeded with 50 sample entries. Results carry a "Demo mode ·
simulated result" badge.

To use the real backend, set `NEXT_PUBLIC_USE_MOCK=false` (the
legacy name `NEXT_PUBLIC_USE_MOCK_API=false` works identically)
and `NEXT_PUBLIC_API_URL` to the backend's base URL, then rebuild.
No code changes are needed. The full API contract, error-handling
behaviour and integration steps are in
[INTEGRATION.md](INTEGRATION.md).

Demo assets in `public/`: `sample-urls.txt` (the demo URLs, one
per line — also accepted by the batch page) and `sample.csv`
(matching the batch page's built-in sample download). See
[DEMO.md](DEMO.md) for a timed demo script and
[DEPLOYMENT.md](DEPLOYMENT.md) for Vercel deployment steps.

## Project structure

```text
src/
  app/            Routes: home (/), /scan, /batch, /dashboard,
                  /about, plus 404/error pages, favicon and the
                  Open Graph image
  components/
    layout/       Navbar, footer, logo, theme toggle
    providers/    Theme and React Query providers
    scan/         Scan form, scanning view, result view, needle
                  gauge, URL anatomy, explainability chart
    batch/        Batch scan page (upload, preview, progress,
                  results)
    dashboard/    Stat cards, charts, history table, result dialog
    home/         Landing sections (sample card, stats, CTA)
    ui/           Button, input, toast primitives
  hooks/          use-scan, use-history (React Query wrappers)
  lib/            api.ts (single service layer), mock-scan.ts
                  (mock engine), mock-data.ts (seed history),
                  schemas.ts (response validation), url.ts,
                  batch-parse.ts, csv.ts, defang.ts
  types/          api.ts — the API contract types
docs/
  screenshots/    Screenshots for this README (see its README)
public/           Static files, incl. demo sample-urls.txt / sample.csv
```

## Security notes

Client-side checks in this repo — input validation, response
validation, request timeouts and retries, a submission cooldown —
exist for user experience only. Anyone can bypass browser code, so
**real rate limiting, bot protection, authentication and input
validation must be enforced by the backend**. The frontend sends no
cookies or credentials to the API. Details in
[INTEGRATION.md](INTEGRATION.md) §4 and §7.

## Known limitations

- **Demo results are simulated.** In mock mode (the default) the
  verdicts come from a built-in rule-based engine, not the ML
  model, and are labelled "Demo mode".
- **History is stored in the browser** in mock mode (localStorage,
  seeded with sample data). In real mode it comes from the
  backend's `GET /api/history`.
- **The model is not part of this repository.** This repo is the
  frontend only; the ML backend is a separate service (see
  INTEGRATION.md).

## Screenshots

_Placeholder — add the images listed in
[docs/screenshots/](docs/screenshots/README.md)._

- Home — `docs/screenshots/home.png`
- Scan result — `docs/screenshots/scan-result.png`
- URL anatomy — `docs/screenshots/url-anatomy.png`
- Batch scan — `docs/screenshots/batch.png`
- Dashboard — `docs/screenshots/dashboard.png`
- Dark mode — `docs/screenshots/dark-mode.png`
