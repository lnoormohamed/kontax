"use client";

import { useState, useTransition } from "react";

import { createBillingPortalSession } from "~/app/actions/billing";

export type CancelPlanDetails = {
  syncConnections: number;
  liveContacts: number;
  totalContacts: number;
  contactLimit: number;
  /** Family owner: members who lose access if the group dissolves. */
  familyMembers: number | null;
};

const WarnIcon = () => (
  <svg className="mt-px h-4 w-4 shrink-0" fill="none" stroke="#bf8526" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" viewBox="0 0 24 24">
    <path d="M10.3 3.3L2 19h20L13.7 3.3a2 2 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const InfoIcon = () => (
  <svg className="mt-px h-4 w-4 shrink-0" fill="none" stroke="#5b78f0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

export function CancelPlanModal({
  details,
  family = false,
  open: controlledOpen,
  onOpenChange,
}: {
  details: CancelPlanDetails;
  family?: boolean;
  /** Controlled mode — omit to render the built-in "Cancel plan" trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    setError(false);
    startTransition(async () => {
      const result = await createBillingPortalSession();
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setError(true);
      }
    });
  };

  const rows: Array<{ tone: "warn" | "info"; text: string }> = [];
  if (details.syncConnections > 0) {
    rows.push({
      tone: "warn",
      text: `${details.syncConnections} sync connection${details.syncConnections === 1 ? "" : "s"} will be paused`,
    });
  }
  if (details.liveContacts > 0) {
    rows.push({
      tone: "warn",
      text: `${details.liveContacts} live-synced contact${details.liveContacts === 1 ? "" : "s"} will become a static copy`,
    });
  }
  rows.push({ tone: "info", text: "Activity log access will be hidden (not deleted)" });
  rows.push({ tone: "info", text: "Imports limited to 3 per month" });

  return (
    <>
      {!isControlled ? (
        <button
          className="h-11 w-full rounded-2xl border border-[#d8ddd6] bg-white px-[18px] text-[13px] font-semibold text-[#8b938c] transition hover:text-[#5c655e] hover:underline md:h-auto md:w-auto md:border-none md:bg-transparent md:p-1"
          onClick={() => setOpen(true)}
          type="button"
        >
          Cancel plan
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[300] grid items-end bg-[rgba(20,30,25,0.42)] p-0 md:place-items-center md:p-5"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[calc(100dvh-18px)] w-full flex-col overflow-hidden rounded-t-[1.4rem] bg-white shadow-[0_24px_60px_rgba(20,30,25,0.32)] md:max-h-[calc(100%-40px)] md:max-w-[400px] md:rounded-[1.4rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-[22px] pb-3.5 pt-[22px]">
              <h2 className="m-0 text-[19px] font-semibold tracking-[-0.01em] text-[#1d2823]">
                Downgrade to Free?
              </h2>
              <button
                aria-label="Close"
                className="-mr-1 -mt-1 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border-none bg-transparent text-[#8b938c] transition hover:bg-[#f2f4f0]"
                onClick={() => setOpen(false)}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-[22px]">
              {family && details.familyMembers ? (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#e7c9bd] bg-[#f9ece7] px-3.5 py-3 text-[13.5px] leading-[1.45] text-[#7a2f1d]">
                  <svg className="mt-px h-[17px] w-[17px] shrink-0" fill="none" stroke="#b5472f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M5.6 5.6l12.8 12.8" />
                  </svg>
                  <span>
                    Your family group will end. {details.familyMembers} member
                    {details.familyMembers === 1 ? "" : "s"} will lose group access and revert to Free.
                  </span>
                </div>
              ) : null}

              <p className="m-0 mb-3.5 text-[14px] font-medium leading-[1.5] text-[#1d2823]">
                Here&rsquo;s what will change when your current period ends:
              </p>

              <ul className="m-0 grid list-none gap-[13px] p-0">
                {rows.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-[1.45] text-[#3a4540]">
                    {r.tone === "warn" ? <WarnIcon /> : <InfoIcon />}
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>

              <div className="mb-1 mt-4 flex items-start gap-2.5 rounded-xl bg-[#edf0fe] px-3.5 py-[13px]">
                <InfoIcon />
                <p className="m-0 text-[12.5px] leading-[1.5] text-[#2c39a0]">
                  Your {details.totalContacts} contacts are safe. You just can&rsquo;t add new ones above the{" "}
                  {details.contactLimit} limit. Upgrade anytime to restore access.
                </p>
              </div>

              {error ? (
                <div className="mt-3 flex items-center gap-2 text-[13px] text-[#9a3a23]">
                  <svg className="h-[15px] w-[15px]" fill="none" stroke="#b5472f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16h.01" />
                  </svg>
                  <span>Something went wrong. Please try again.</span>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2.5 px-[22px] pb-[22px] pt-4">
              <button
                className="inline-flex h-[42px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#d8ddd6] bg-white text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                onClick={() => setOpen(false)}
                type="button"
              >
                Keep my plan
              </button>
              <button
                className="inline-flex h-[42px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#4158f4] text-sm font-semibold text-white transition hover:bg-[#3347d8] disabled:opacity-75"
                disabled={isPending}
                onClick={handleConfirm}
                type="button"
              >
                {isPending ? (
                  <>
                    <span className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-white/45 border-t-white" />
                    Working…
                  </>
                ) : (
                  <>
                    Manage billing
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
                      <path d="M4.5 12h15M13 5.5l6.5 6.5L13 18.5" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
