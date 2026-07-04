"use client";

// P40-08: one-time, dismissible "your contacts now live in books" banner for
// existing users after the multi-book migration (design brief P40-DB01 §7).
// New accounts (booksNative) never render this; gating happens on the server.

import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";

import { dismissBooksExplainer } from "~/app/actions/contact-books";

// Belt-and-suspenders: the DB write + JWT re-mint is the source of truth, but a
// localStorage flag hides the banner instantly on this device even if the token
// hasn't propagated yet (or update() failed). Read in an effect, not in render,
// to keep SSR/hydration in agreement.
const DISMISSED_KEY = "kontax:books-explainer-dismissed";

export function BooksMigrationExplainer() {
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();
  const { update } = useSession();

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) setDismissed(true);
    } catch {
      // localStorage unavailable (private mode / SSR) — fall back to server gate.
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true); // optimistic — the server call persists it for next load
    try {
      localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {
      // Non-critical: the server write below is still the source of truth.
    }
    startTransition(async () => {
      try {
        await dismissBooksExplainer();
        // Preferences live in the JWT; re-mint the session token from the DB so
        // the dismissal survives a page refresh (not just this render).
        await update();
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
