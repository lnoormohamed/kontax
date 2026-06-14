"use client";

import { useState } from "react";
import { dismissMergeSuggestion } from "~/app/actions/merge";

type Props = {
  suggestionId: string;
  contactAId: string;
  contactBId: string;
  /** When true the parent handles animated removal; button just calls the action. */
  onDismissed?: () => void;
};

export function MergeSuggestionDismissButton({
  suggestionId,
  contactAId,
  contactBId,
  onDismissed,
}: Props) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState("");

  const handleDismiss = async () => {
    setIsDismissing(true);
    setError("");

    try {
      await Promise.all([
        fetch("/api/merge-suggestions/dismiss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId }),
        }).then((r) => {
          if (!r.ok) throw new Error("Dismiss failed.");
        }),
        dismissMergeSuggestion(contactAId, contactBId),
      ]);
      onDismissed?.();
      if (!onDismissed) window.location.reload();
    } catch {
      setError("Couldn't dismiss — try again");
      setIsDismissing(false);
    }
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
