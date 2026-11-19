import type { NextConfig } from "next";

/**
 * Security headers (Phase 11), applied to every route.
 *
 * CSP notes — the policy is as tight as this stack allows:
 * - default-src 'self' and object-src 'none': nothing loads from a
 *   third-party origin by default, and no plugins/embeds run.
 * - script-src needs 'unsafe-inline': the App Router emits inline
 *   bootstrap/RSC scripts without a nonce in this setup. Moving to a
 *   nonce-based policy needs middleware that stamps a per-request
 *   nonce — that belongs with the backend/deployment phase. There is
 *   no remote script origin, so injected markup still cannot load or
 *   execute external code.
 * - Development only: React's dev runtime calls eval() (stack
 *   reconstruction / dev warnings) and Turbopack/HMR connects over
 *   websockets, so outside production script-src also allows
 *   'unsafe-eval' and connect-src also allows ws:/wss:. Without them
 *   the dev server shows an "eval() is not supported" overlay.
 *   Production never gets either relaxation (see isDev below).
 * - style-src needs 'unsafe-inline': Tailwind, Recharts and Framer
 *   Motion set inline styles, and Next injects <style> tags. Inline
 *   styles cannot execute script, so this is the standard trade-off.
 * - connect-src is 'self' plus the configured API origin only
 *   (from NEXT_PUBLIC_API_URL), so page JS cannot call out elsewhere.
 * - frame-ancestors 'none' (+ X-Frame-Options DENY) blocks clickjacking.
 */
const apiOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
      : null;
  } catch {
    return null;
  }
})();

// Dev-only CSP relaxations (see the note above): 'unsafe-eval' for
// React's dev runtime, ws:/wss: for Turbopack/HMR. Production builds
// (NODE_ENV=production) keep the strict policy with neither.
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
