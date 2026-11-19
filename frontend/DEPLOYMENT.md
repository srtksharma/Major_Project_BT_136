# LinkLens — Deployment (Vercel)

Step-by-step deployment of this frontend to Vercel. The demo
deployment runs in mock mode; connecting the real backend later
is an environment-variable change plus a redeploy.

No `vercel.json` is needed: Vercel auto-detects Next.js, and the
security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`) come from
`next.config.ts`, which Vercel applies automatically. Add a
`vercel.json` only if you later need redirects, rewrites or a
pinned region.

## 1. Push the repo to GitHub

```bash
git init          # if not already a repository
git add .
git commit -m "LinkLens frontend"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env*` files are already gitignored (except `.env.example`), so
no local secrets or env files will be pushed. Double-check with
`git status` before the first push.

## 2. Import the repo in Vercel

1. In the Vercel dashboard: **Add New → Project**, and import the
   GitHub repository.
2. Framework preset: **Next.js** (auto-detected). Leave the root
   directory, build command (`next build`) and output settings at
   their defaults.
3. Before the first deploy, add the environment variables below
   (Project → Settings → Environment Variables). `NEXT_PUBLIC_*`
   variables are baked in at build time, so they must exist
   **before** building.
4. Deploy.

## 3. Environment variables for the demo deployment

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCK_API` | `true` | Keeps the demo in mock (simulated) mode. `NEXT_PUBLIC_USE_MOCK` is the canonical name for the same flag — setting either works; use one consistently. |
| `NEXT_PUBLIC_API_URL` | *(leave unset)* | Not used in mock mode. |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` | Optional; makes Open Graph share URLs absolute. |

Verify in Project → Settings → Environment Variables that no
variable contains a secret — everything `NEXT_PUBLIC_*` is
visible to anyone who loads the site.

## 4. Connecting the real backend later

1. Deploy the backend (see INTEGRATION.md for the contract it
   must implement, including CORS for the Vercel origin).
2. In Vercel → Settings → Environment Variables:
   - set `NEXT_PUBLIC_USE_MOCK=false` (canonical flag; if you
     previously set the `NEXT_PUBLIC_USE_MOCK_API` alias, set it
     to `false` too — **either** variable being `"false"` enables
     real mode),
   - set `NEXT_PUBLIC_API_URL=https://<your-api-origin>` (the
     origin only — the frontend appends `/api/scan` and
     `/api/history`; the CSP's `connect-src` picks this origin up
     automatically at build time).
3. **Redeploy** (next step) — environment changes do not apply to
   an already-built deployment.

## 5. Redeploying after an environment change

Vercel dashboard → Deployments → the latest deployment → **⋯ →
Redeploy**. Uncheck "Use existing Build Cache" if the change
doesn't seem to take effect. A new push to `main` also triggers a
fresh deployment with the current variables.

## 6. Post-deploy checklist

- [ ] Open every route and confirm it loads: `/`, `/scan`,
      `/batch`, `/dashboard`, `/about`, and a nonsense path
      (should show the custom 404 page).
- [ ] Open DevTools → **Console** on each route: no
      Content-Security-Policy errors or blocked-resource warnings.
- [ ] Run a **scan** (e.g. `https://www.github.com`): the scanning
      animation completes and a result renders. In the demo
      deployment the result shows the "Demo mode" badge; after
      connecting the backend it must not.
- [ ] Run a **batch** scan with the sample CSV (Batch page →
      Download sample CSV → Scan): all 5 rows complete.
- [ ] Open the **dashboard**: stat cards, charts and history
      render; on a fresh browser the seeded sample history
      appears (mock mode).
- [ ] Toggle **dark mode** and reload: the theme persists and no
      layout breaks.
- [ ] Check the response headers once (DevTools → Network → the
      document request): `Content-Security-Policy`,
      `X-Content-Type-Options: nosniff`,
      `Referrer-Policy: strict-origin-when-cross-origin` and
      `X-Frame-Options: DENY` are present.
- [ ] Run **Lighthouse** (DevTools → Lighthouse, or PageSpeed
      Insights on the deployed URL) for Performance, Accessibility,
      Best Practices and SEO, and note the scores.
- [ ] Test on a phone-sized viewport: navbar menu opens, chips
      wrap, tables become cards.

## Notes

- **Node version:** Vercel builds Next.js 16 on its current LTS
  Node (20+), which matches this project's target. The repo has
  no `engines` field or `.nvmrc`; if you want a pinned version,
  add one of them and set the same version under Project →
  Settings → General → Node.js Version.
- **Missing env variables at build time** do not fail the build:
  with neither mock flag set, the app defaults to mock mode.
- **CSP in production** is the strict policy from
  `next.config.ts` (`'unsafe-eval'` and websocket allowances exist
  only in development). If a future backend origin is added,
  update `NEXT_PUBLIC_API_URL` and redeploy — no code change.
