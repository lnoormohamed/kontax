/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// P46-02: avatars are served directly from the configured media host. Keep the
// legacy `media.getkontax.com` literal and add the deploy's own media host
// (`NEXT_PUBLIC_MEDIA_HOST`, e.g. a staging MinIO origin) so Kontax-hosted
// avatars aren't CSP-blocked — must stay in sync with the img-src in
// src/middleware.ts and the host match in src/lib/avatar-src.ts.
const mediaHostOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_MEDIA_HOST
      ? new URL(process.env.NEXT_PUBLIC_MEDIA_HOST).origin
      : null;
  } catch {
    return null;
  }
})();
const imgSrc = [
  "img-src 'self' data: blob: https://media.getkontax.com",
  mediaHostOrigin && mediaHostOrigin !== "https://media.getkontax.com" ? mediaHostOrigin : "",
]
  .filter(Boolean)
  .join(" ");

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Force HTTPS for 2 years, include subdomains
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Limit referrer info sent cross-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser feature APIs
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // CSP — unsafe-inline required for Next.js hydration scripts and Tailwind inline styles
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline for inline hydration scripts
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      // Avatars served from MinIO via the configured media host (P46-02); data:/blob: for image processing
      imgSrc,
      "font-src 'self'",
      "connect-src 'self' https://api.stripe.com https://checkout.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

/** @type {import("next").NextConfig} */
const config = {
  // Allow parallel dev + prod-verification servers in the same checkout
  // (each Claude/terminal session sets its own NEXT_DIST_DIR).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // P46-14 / DB07 §5c: Public card moved under Account.
      {
        source: "/settings/profile/card",
        destination: "/settings/account/card",
        permanent: true,
      },
      {
        source: "/settings/profile",
        destination: "/settings/account",
        permanent: true,
      },
    ];
  },
};

export default withBundleAnalyzer(config);
