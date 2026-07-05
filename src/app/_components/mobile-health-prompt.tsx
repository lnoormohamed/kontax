"use client";

import Link from "next/link";
import { useState } from "react";

import { updatePreferencesAction } from "~/app/actions/preferences";

// P46-10 / P46-DB06 Part B — the contact-health worklist relocated from the
// removed mobile Overview into the People list as a dismissible amber prompt.
// Protective amber (not error red); dismissal stores the current attention
// count so the prompt returns only when the count changes, never at zero.
export function MobileHealthPrompt({ count, href }: { count: number; href: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    void updatePreferencesAction({ healthPromptDismissedCount: count });
  };

  return (
    <div className="px-4 pt-3 lg:hidden">
      <div
        className="flex items-center gap-3 rounded-xl border px-3.5 py-3"
        style={{ backgroundColor: "#f6edd9", borderColor: "#e8d8b0" }}
      >
        <span
          className="grid shrink-0 place-items-center rounded-[9px] bg-white"
          style={{ width: 34, height: 34 }}
          aria-hidden
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8a6a1e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </span>
        <Link href={href} className="min-w-0 flex-1 no-underline">
          <span className="block truncate text-[14px] font-semibold" style={{ color: "#7a5a1a" }}>
            {count.toLocaleString()} contact{count === 1 ? "" : "s"} need{count === 1 ? "s" : ""}{" "}
            attention
          </span>
          <span className="block truncate text-[12.5px]" style={{ color: "#8a6a2a" }}>
            Missing email, context or labels · Review
          </span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss needs-attention prompt"
          className="grid shrink-0 place-items-center"
          style={{ width: 32, height: 32, color: "#8a6a1e" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
