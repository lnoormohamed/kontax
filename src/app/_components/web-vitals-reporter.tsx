"use client";

import { useReportWebVitals } from "next/web-vitals";

// P26-11: Core Web Vitals monitoring (RUM). Next-native via useReportWebVitals —
// portable, no Vercel dependency. Collects the field metrics and flags any that
// exceed the "good" targets below. In dev it logs to the console (breaches marked);
// in production it's a no-op by default to avoid spamming end-user consoles — wire
// a collector at the marked extension point to enable real RUM.
//
// Targets (Core Web Vitals "good" thresholds), primarily for public pages:
//   LCP < 2500ms · CLS < 0.1 · INP < 200ms   (FCP/TTFB tracked as supporting).
const TARGETS: Record<string, number> = {
  LCP: 2500,
  CLS: 0.1,
  INP: 200,
  FCP: 1800,
  TTFB: 800,
};

// Structural subset of next/web-vitals' compiled `Metric` (whose type doesn't
// resolve cleanly for the linter); the real metric is assignable to this.
type WebVitalMetric = { name: string; value: number; rating: string; id: string };

export function WebVitalsReporter() {
  useReportWebVitals((metric: WebVitalMetric) => {
    const target = TARGETS[metric.name];
    const overTarget = target !== undefined && metric.value > target;

    if (process.env.NODE_ENV !== "production") {
      const value = metric.name === "CLS" ? metric.value.toFixed(3) : `${Math.round(metric.value)}ms`;
      console.log(
        `[web-vitals] ${metric.name}=${value} (${metric.rating})${overTarget ? " ⚠️ over target" : ""}`,
      );
      return;
    }

    // Production RUM sink — forward `metric` (and `overTarget`) to a collector
    // here (e.g. navigator.sendBeacon to an analytics endpoint) once one exists.
  });

  return null;
}
