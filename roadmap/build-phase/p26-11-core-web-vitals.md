# P26-11 — Core Web Vitals Monitoring

## Purpose

Integrate `@vercel/speed-insights` to measure real-user Core Web Vitals on public pages, establish baseline targets (LCP < 2.5s, CLS < 0.1, INP < 200ms), and surface regressions in CI before they reach production. Performance degradation on public pages directly impacts SEO rankings and conversion.

## Background

The landing page and login/register pages are the critical path for new user acquisition. A slow landing page reduces SEO ranking (Google uses Core Web Vitals as a ranking signal) and increases bounce rate. `@vercel/speed-insights` reports real-user measurements from the Vercel edge network with zero additional latency — it's a script inject with no blocking behaviour.

## Scope

**In scope:**
- `@vercel/speed-insights` integration in the root layout
- Baseline performance targets documented and tracked
- Lighthouse CI configuration for the landing page and login page (run on every pull request)
- Performance budget: P26-01 landing page LCP < 2.5s, CLS < 0.1, INP < 200ms; TTI < 3.5s
- Fix any existing regressions identified during integration

**Out of scope:**
- Real User Monitoring dashboard (Vercel provides this out of the box)
- Synthetic monitoring (separate tool — deferred)
- Performance optimisation beyond the scope of existing regressions

---

## Design / Implementation Spec

### `@vercel/speed-insights` integration

```bash
npm install @vercel/speed-insights
```

In `src/app/layout.tsx`:
```tsx
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

`SpeedInsights` is a client component that measures Web Vitals and reports to the Vercel dashboard. It adds ~1.5kb to the page weight and does not block rendering.

### Lighthouse CI configuration

`.github/workflows/lighthouse.yml`:

```yaml
name: Lighthouse CI
on:
  pull_request:
    paths:
      - "src/app/(public)/**"
      - "src/app/layout.tsx"

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run build
      - run: npx lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

`lighthouserc.js`:
```javascript
module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/login",
      ],
      startServerCommand: "npm run start",
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.85 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 2000 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
```

The CI run asserts on LCP and CLS (hard failures on regression) and warns on FCP and TBT.

### Baseline measurement

Before shipping P26-01, run Lighthouse on the current `/login` page to establish a pre-P26 baseline. After P26-01 ships, run again and document the delta. Target values:

| Metric | Target | Failure threshold |
|---|---|---|
| LCP | < 2.0s | > 2.5s |
| CLS | < 0.05 | > 0.1 |
| INP | < 100ms | > 200ms |
| FCP | < 1.5s | > 2.0s |
| TBT | < 200ms | > 300ms |

---

## Acceptance Criteria

- `@vercel/speed-insights` is installed and reporting data in the Vercel dashboard after 24 hours of traffic.
- Lighthouse CI runs on every PR that touches public page files.
- The CI asserts on LCP < 2.5s and CLS < 0.1; PRs that regress these metrics fail the check.
- The landing page (P26-01) achieves LCP < 2.5s in Lighthouse on a simulated slow 4G connection.
- Performance budget targets are documented in `CLAUDE.md` or a `PERFORMANCE.md` file.

---

## Risks and Open Questions

- **Lighthouse CI in GitHub Actions:** running a full Next.js build + Lighthouse in CI adds ~5 minutes to the PR check. To reduce friction, scope the CI run to only fire when `src/app/(public)/**` files change (already in the `paths` filter above). If this is still too slow, run Lighthouse on the deployed preview URL (via Vercel deployment webhooks) rather than a local build.
