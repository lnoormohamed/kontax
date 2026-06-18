"use client";

import { useState } from "react";

export function MergeSuggestionRefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError("");

    const response = await fetch("/api/merge-suggestions/refresh", {
      method: "POST",
    });

    const data = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setError(data?.message ?? "Duplicate scan failed.");
      setIsRefreshing(false);
      return;
    }

    window.location.href = "/contacts?mergeSuggestionsRefreshed=1";
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
