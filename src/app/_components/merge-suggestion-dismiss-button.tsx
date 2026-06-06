"use client";

import { useState } from "react";

type MergeSuggestionDismissButtonProps = {
  suggestionId: string;
};

export function MergeSuggestionDismissButton({
  suggestionId,
}: MergeSuggestionDismissButtonProps) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState("");

  const handleDismiss = async () => {
    setIsDismissing(true);
    setError("");

    const response = await fetch("/api/merge-suggestions/dismiss", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ suggestionId }),
    });

    const data = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setError(data?.message ?? "Dismiss failed.");
      setIsDismissing(false);
      return;
    }

    window.location.reload();
  };

  return (
    <div className="grid gap-2">
      <button
        className="rounded-full border border-amber-300/30 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isDismissing}
        onClick={handleDismiss}
        type="button"
      >
        {isDismissing ? "Dismissing..." : "Dismiss"}
      </button>
      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
