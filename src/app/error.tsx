"use client";

import { ErrorShell } from "./_components/error-shell";

// App-level error boundary (Next.js App Router). Catches runtime errors including
// stale chunk failures after deploys. We now attempt one automatic recovery
// before leaving the user on the fallback screen.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorShell error={error} reset={reset} />;
}
