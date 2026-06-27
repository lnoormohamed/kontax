"use client";

import { ErrorShell } from "./_components/error-shell";

// Root-level error boundary. Only fires when the root layout itself crashes.
// We share the same stale-chunk recovery flow as the route-level boundary.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorShell error={error} reset={reset} root />;
}
