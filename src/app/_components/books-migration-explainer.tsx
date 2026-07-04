"use client";

// P40-08: one-time, dismissible "your contacts now live in books" banner for
// existing users after the multi-book migration (design brief P40-DB01 §7).
// New accounts (booksNative) never render this; gating happens on the server
// via a fresh DB read, so once dismissed the server simply stops emitting the
// banner (no flash). This component only handles the optimistic in-place hide
// on click plus persisting the dismissal.

import { useState, useTransition } from "react";

import { dismissBooksExplainer } from "~/app/actions/contact-books";

export function BooksMigrationExplainer() {
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true); // optimistic — hides instantly; the server call persists it
    startTransition(async () => {
      try {
        await dismissBooksExplainer();
      } catch {
        // Non-critical: if it fails the banner simply shows again next load.
      }
    });
  };

  return (
    <div className="flex items-start gap-3 border-b border-[#e3ede6] bg-[#f2f8f4] px-4 py-2.5 text-[13px] text-[#1d2823] lg:px-[18px]">
      <span className="mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#17352e] text-[11px] font-bold text-[#dff0e7]">
        ✦
      </span>
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Your contacts now live in books.</span>{" "}
        Everything you had is in your default book. Create a Work book (or any book) and
        drop contacts into more than one at a time.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-[#17352e] transition hover:bg-[#e3ede6]"
      >
        Got it
      </button>
    </div>
  );
}
