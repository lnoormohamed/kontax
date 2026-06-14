# P34D-20 — Pre-Production Performance Checklist

## Purpose

Run Lighthouse and manual performance checks against the production environment to
confirm the app meets minimum performance standards before going live. Document
actual scores and identify any regressions that must be fixed before launch.

## Background

Performance directly affects SEO (Core Web Vitals are a Google ranking signal) and
user retention (pages that load in >3 seconds see significantly higher bounce rates).
Kontax is a Next.js 15 app — the framework provides good defaults, but individual
routes, images, and large JS chunks can still cause LCP or CLS regressions.

This checklist runs on `getkontax.com` from a clean browser profile. DevTools
throttling is not used for the baseline run — performance should be measured at full
production network speed from the test machine. Note the connection type in results.

## Scope

**In scope**
- Lighthouse audits on marketing homepage and a post-login page
- LCP, CLS, FCP thresholds (Core Web Vitals)
- Contact list render time with realistic data volume (400+ contacts)
- Search API response time
- Next.js build output: JS chunk sizes
- Image format and dimension checks on marketing pages

**Out of scope**
- Load testing (concurrent users) — separate phase
- Server-side APM (Datadog, New Relic) — future monitoring phase
- Bundle analysis (webpack-bundle-analyzer deep dive) — only check build output table

## Design / Implementation Spec

### Lighthouse setup

1. Open Chrome (or Chromium) in a new incognito window with no extensions.
2. Navigate to `https://getkontax.com` (marketing homepage — unauthenticated).
3. Open DevTools → Lighthouse tab.
4. Settings: Mode "Navigation", Device "Desktop", Categories: Performance, Best
   Practices, SEO.
5. Click "Analyze page load".
6. Record all scores and individual metric values.
7. Repeat on Mobile device preset.

For the authenticated page check:
1. Log in to a test account on `getkontax.com`.
2. Navigate to `/contacts` (with at least 400 contacts seeded or imported).
3. Run Lighthouse → Navigation on the `/contacts` URL while logged in (ensure Lighthouse
   can access the page — it makes a fresh request, which may not carry the session).
   Alternatively, use WebPageTest or manual timing instead of Lighthouse for authed pages.

### Manual timing for /contacts

Use the browser's Performance panel:
1. Log in. Navigate away from /contacts. Open DevTools Performance tab, start
   recording. Navigate to /contacts.
2. Stop recording when the page is interactive (contact list visible and clickable).
3. Note the "Time to Interactive" from the recording.

### Search API timing

```bash
# Measure search API response time
time curl -s \
  -H "Cookie: next-auth.session-token=<your-prod-session-token>" \
  "https://getkontax.com/api/contacts/search?q=john" \
  -o /dev/null

# Expected: real time < 0.5s
```

Or use curl's built-in timing:
```bash
curl -w "Total: %{time_total}s\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\n" \
  -s -o /dev/null \
  -H "Cookie: next-auth.session-token=<token>" \
  "https://getkontax.com/api/contacts/search?q=john"
```

### JS chunk size check

After running `next build` locally (with production env vars), look at the build
output table printed to stdout. It lists all routes and their JavaScript payload
sizes. Any individual First Load JS entry above 500 kB is a concern.

Alternatively, run the build and check:
```bash
cd /path/to/kontax
npm run build 2>&1 | grep -E "kB|MB" | sort -k1 -n
```

Flag any route showing > 500 kB.

### Image checks

On the marketing homepage, open DevTools → Network → filter by "Img". For each
image:
- Format: should be `webp` or `avif` (not `png` or `jpeg`)
- `width` and `height` attributes: must be explicit (prevents CLS)
- Lazy loading: images below the fold should have `loading="lazy"`

## Checklist

| # | Check | Method | Target | Actual | Pass/Fail |
|---|-------|--------|--------|--------|-----------|
| P-01 | Homepage LCP (Desktop) | Lighthouse | < 2.5s | | |
| P-02 | Homepage CLS (Desktop) | Lighthouse | < 0.1 | | |
| P-03 | Homepage FCP (Desktop) | Lighthouse | < 1.8s | | |
| P-04 | Homepage Performance score (Desktop) | Lighthouse | ≥ 90 | | |
| P-05 | Homepage Performance score (Mobile) | Lighthouse Mobile | ≥ 70 | | |
| P-06 | Homepage LCP (Mobile) | Lighthouse Mobile | < 4.0s | | |
| P-07 | /contacts page interactive with 400+ contacts | Manual timing (Performance panel) | < 2s | | |
| P-08 | Search API response time | curl timing | < 0.5s | | |
| P-09 | No JS chunk > 500 kB | next build output | No entry > 500 kB | | |
| P-10 | Marketing images are WebP or AVIF | DevTools Network | All hero/feature images in modern format | | |
| P-11 | Marketing images have explicit width+height | DevTools Elements | No `<img>` without width/height or aspect-ratio CSS | | |
| P-12 | Lighthouse Best Practices score | Lighthouse | ≥ 90 | | |

## Acceptance Criteria

- P-01 through P-04 must pass (Core Web Vitals desktop). These are P0 for launch.
- P-05 and P-06 are P1 (mobile performance can be improved post-launch but should
  be tracked).
- P-07 (contact list interactive time) is P0 — if it exceeds 5s with 400 contacts,
  the virtualization (expected from P28) may have regressed.
- P-08 (search API < 0.5s) is P0 — slow search is the top user-facing quality issue.
- P-09 (no chunk > 500 kB) is P1.
- P-10, P-11 are P2 (affects SEO and CLS but not blocking).
- All results recorded in `roadmap/runbooks/smoke-test-results-v1.md` → Performance.

## Risks / Open Questions

- **Lighthouse on authenticated pages**: Lighthouse cannot authenticate (no session
  cookie). Use manual timing for the `/contacts` page and document the method.
- **Cold start vs warm**: the first request to the production server may be slower
  (Node cold start, DB query plan cache cold). Run Lighthouse twice and take the
  second score if the first is anomalously low.
- **Test machine bandwidth**: if the test machine has slow upload, P-08 will be
  inflated. Note the tester's connection type in the results.
- **CLS from fonts**: Next.js font optimization (next/font) should prevent FOUT/CLS
  from web fonts. If CLS is high, check whether custom fonts are loaded with
  `display: swap` without size adjustment.

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — /developers: no changes needed
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: Performance section
- [ ] Internal · engineering — docs/: if a chunk > 500 kB is found, open a follow-up
      ticket for bundle splitting
