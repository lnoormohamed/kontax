"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  completeOnboardingChecklist,
  dismissOnboardingChecklist,
  recordOnboardingExplored,
} from "~/app/actions/onboarding";
import type { OnboardingStep } from "~/server/onboarding";

// P26-04 · first-run onboarding checklist (design P26-DB07 §1).
// Renders above the contacts list; one card per the locked light system.

function TickIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.6 6.6l2.5 2.5L10.4 3.6" />
    </svg>
  );
}

function BigTick() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9.2 9.2a2.8 2.8 0 015.5.8c0 1.9-2.8 2.5-2.8 4" />
      <path d="M12 17.4h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

const DISMISSED_COPY = "You can always find help at the bottom of the contacts page.";

function DismissedBanner() {
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-[#cfe2d6] bg-[#e7efe9] px-4 py-3 text-[13px] font-medium text-[#1c4f3c]">
      <span className="text-[#17352e]">
        <HelpIcon />
      </span>
      <span>{DISMISSED_COPY}</span>
    </div>
  );
}

function ChecklistItem({ step }: { step: OnboardingStep }) {
  return (
    <div className="flex h-[38px] items-center gap-2.5 sm:h-10 sm:gap-3">
      {step.done ? (
        <span aria-hidden className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#1f8a5b]">
          <TickIcon />
        </span>
      ) : (
        <span aria-hidden className="h-[22px] w-[22px] shrink-0 rounded-full border-[1.8px] border-[#d8ddd6] bg-white" />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-[13px] text-[#1d2823] sm:text-[14px] ${
          step.done ? "font-semibold" : "font-medium"
        }`}
      >
        {step.label}
      </span>
      {step.done ? (
        <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-[#e3efe7] px-[9px] text-[11px] font-bold text-[#1c6b48]">
          Done
        </span>
      ) : step.cta && step.href ? (
        <Link
          className="inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap text-[12.5px] font-medium text-[#4158f4] hover:underline sm:text-[14px]"
          href={step.href}
        >
          <span aria-hidden className="text-[13px]">→</span>
          {step.cta}
        </Link>
      ) : null}
    </div>
  );
}

function Checklist({
  steps,
  doneCount,
  total,
  onDismiss,
}: {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  onDismiss: () => void;
}) {
  const pct = Math.round((doneCount / total) * 100);
  const stepNo = Math.min(doneCount + 1, total);

  return (
    <section className="mb-4 rounded-[14px] border border-[#d8ddd6] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] sm:px-6 sm:py-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#1d2823]">
            Welcome to Kontax <span aria-hidden>👋</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-[#5c655e]">Get started in a few steps</p>
        </div>
        <button
          aria-label="Dismiss checklist"
          className="-mr-1.5 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[#8b938c] transition hover:bg-[#f2f4f0]"
          onClick={onDismiss}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mt-3.5 grid">
        {steps.map((s) => (
          <ChecklistItem key={s.id} step={s} />
        ))}
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <span className="block h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[#f2f4f0]">
          <span
            className="block h-full rounded-[3px] bg-[#17352e] transition-[width] duration-500 ease-[cubic-bezier(0.2,0,0.1,1)] motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-[#8b938c]">
          Step {stepNo} of {total}
        </span>
      </div>
    </section>
  );
}

function Completion({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(5);

  useEffect(() => {
    if (count <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, onDone]);

  return (
    <section className="mb-4 flex items-start gap-4 rounded-[14px] border border-[#d8ddd6] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] max-[760px]:flex-col sm:px-6 sm:py-5">
      <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1f8a5b]">
        <BigTick />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#1d2823]">You&rsquo;re all set!</h2>
        <p className="mt-0.5 text-[13px] text-[#5c655e]">
          Your contacts are ready. Here&rsquo;s what you can do next…
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            className="inline-flex h-9 items-center rounded-[10px] bg-[#4158f4] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#3347d8]"
            href="/pricing"
          >
            Explore Pro features
          </Link>
          <button
            className="inline-flex h-9 items-center rounded-[10px] border border-[#d8ddd6] bg-white px-3.5 text-[13px] font-medium text-[#1d2823] transition hover:bg-[#f2f4f0]"
            onClick={onDone}
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
      <span
        className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-[#8b938c]"
        title="Auto-dismisses if no action is taken"
      >
        Auto-dismisses in {count}s
      </span>
    </section>
  );
}

export function OnboardingChecklist({
  steps,
  doneCount,
  total,
  allDone,
  needsExploreRecord,
}: {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  allDone: boolean;
  needsExploreRecord: boolean;
}) {
  // "gone" replaces the card in place with the help banner (dismiss/complete).
  const [gone, setGone] = useState(false);
  const recorded = useRef(false);

  // Persist the visit-with-a-contact "explore" trigger once, in the background.
  useEffect(() => {
    if (needsExploreRecord && !recorded.current) {
      recorded.current = true;
      void recordOnboardingExplored();
    }
  }, [needsExploreRecord]);

  if (gone) return <DismissedBanner />;

  if (allDone) {
    return (
      <Completion
        onDone={() => {
          setGone(true);
          void completeOnboardingChecklist();
        }}
      />
    );
  }

  return (
    <Checklist
      steps={steps}
      doneCount={doneCount}
      total={total}
      onDismiss={() => {
        setGone(true);
        void dismissOnboardingChecklist();
      }}
    />
  );
}
