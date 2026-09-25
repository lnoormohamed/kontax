"use client";

import { useEffect, useRef, useState } from "react";

// P49A-09: the rescan runs as a background job. POST answers 202 + jobId, then
// we poll the job until it finishes and reload the duplicates tab.
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

type RefreshStatus = "queued" | "running" | "succeeded" | "failed" | "unknown";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function MergeSuggestionRefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fail = (message: string) => {
    if (!mounted.current) return;
    setError(message);
    setIsRefreshing(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError("");

    let jobId: string;
    try {
      const response = await fetch("/api/merge-suggestions/refresh", { method: "POST" });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; jobId?: string }
        | null;
      if (!response.ok || !data?.jobId) {
        fail(data?.message ?? "Duplicate scan failed.");
        return;
      }
      jobId = data.jobId;
    } catch {
      fail("Duplicate scan failed.");
      return;
    }

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (mounted.current && Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      let status: RefreshStatus | undefined;
      try {
        const response = await fetch(
          `/api/merge-suggestions/refresh?jobId=${encodeURIComponent(jobId)}`,
          { cache: "no-store" },
        );
        const data = (await response.json().catch(() => null)) as { status?: RefreshStatus } | null;
        status = response.ok ? data?.status : undefined;
      } catch {
        // Transient network error: keep polling until the deadline.
        continue;
      }
      if (status === "failed") {
        fail("Duplicate scan failed.");
        return;
      }
      // "unknown": the job finished long enough ago to be forgotten (or the
      // server restarted) — show whatever suggestions are stored now.
      if (status === "succeeded" || status === "unknown") {
        window.location.href = "/contacts?tab=duplicates&mergeSuggestionsRefreshed=1";
        return;
      }
    }

    fail("The duplicate scan is still running. Check back in a few minutes.");
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isRefreshing}
        onClick={handleRefresh}
        type="button"
      >
        {isRefreshing ? (
          <>
            <span className="h-[12px] w-[12px] animate-spin rounded-full border-[2px] border-[#d8ddd6] border-t-[#5c655e]" />
            Scanning…
          </>
        ) : (
          <>
            <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Rescan
          </>
        )}
      </button>
      {error ? <p className="text-[12px] text-[#b5472f]">{error}</p> : null}
    </div>
  );
}
