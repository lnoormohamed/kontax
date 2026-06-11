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
    <div className="mt-4 grid gap-2">
      <button
        className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isRefreshing}
        onClick={handleRefresh}
        type="button"
      >
        {isRefreshing ? "Refreshing suggestions..." : "Refresh duplicate scan"}
      </button>
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
    </div>
  );
}
