# P50-07 — Accessibility, performance and cross-device QA

**Phase:** 50 · **Priority:** P1 · **Effort:** S · **Depends on:** P50-03..06

## Checks
- **WCAG 2.2 AA:** contrast of every token pair in use; focus visible everywhere; 44px touch
  targets; headings in order; signature diagram has one text alternative; reduced motion
  removes all animation.
- **Performance (mobile, throttled):** LCP < 2.0 s, CLS < 0.05, fonts ≤ 2 families
  self-hosted and subset, no layout shift from font swap; homepage JS limited to the
  signature script and the existing hero search demo.
- **Devices/browsers:** Safari iOS, Chrome Android, Safari/Chrome/Firefox desktop; widths 375,
  768, 1024, 1440; signed-in and signed-out headers.
- **Honesty:** grep all marketing copy against the P50-DB01 fact list (no Outlook, Android sync,
  uptime, users, testimonials, webhooks or backup-encryption claims).

## Acceptance
- A short QA report in the PR with Lighthouse/axe results and screenshots per breakpoint.
