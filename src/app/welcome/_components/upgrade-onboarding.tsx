"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  completeUpgradeOnboarding,
  type UpgradePlan,
  type WhoCanEdit,
} from "~/app/actions/upgrade-onboarding";

// P26-14 · Family/Teams upgrade onboarding wizard (design P26-DB07 §5).
// Three steps — invite members → set up shared book → done — collected in local
// state and committed in one batch on the final step.

const COPY = {
  FAMILY: {
    welcome: "Welcome to Kontax Family",
    sub: "Let’s get your family set up",
    inviteTitle: "Invite your family members",
    inviteHint: "They’ll get an email invite to join your family group.",
    bookTitle: "Set up your shared address book",
    bookDefault: "Family Contacts",
    restrictedLabel: "Owner only",
    doneTitle: "Your family group is ready!",
  },
  TEAMS: {
    welcome: "Welcome to Kontax Teams",
    sub: "Let’s get your team set up",
    inviteTitle: "Invite your team members",
    inviteHint: "They’ll get an email invite to join your workspace.",
    bookTitle: "Create your first shared book",
    bookDefault: "Team Contacts",
    restrictedLabel: "Admins only",
    doneTitle: "Your team is ready!",
  },
} satisfies Record<UpgradePlan, Record<string, string>>;

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-[5px] flex-1 rounded-[3px] transition-colors ${
            n < step ? "bg-[#1f8a5b]" : n === step ? "bg-[#17352e]" : "bg-[#e9ece7]"
          }`}
        />
      ))}
    </div>
  );
}

const PRIMARY_BTN =
  "inline-flex h-11 items-center justify-center rounded-[10px] bg-[#4158f4] px-5 text-[14px] font-semibold text-white transition hover:bg-[#3347d8] disabled:cursor-not-allowed disabled:opacity-60";
const SKIP_BTN =
  "inline-flex h-11 items-center justify-center rounded-[10px] px-3 text-[14px] font-medium text-[#5c655e] transition hover:bg-[#f2f4f0] disabled:opacity-60";

export function UpgradeOnboarding({ plan }: { plan: UpgradePlan }) {
  const router = useRouter();
  const copy = COPY[plan];
  const [step, setStep] = useState(1);
  const [emails, setEmails] = useState<string[]>(["", ""]);
  const [bookName, setBookName] = useState(copy.bookDefault);
  const [whoCanEdit, setWhoCanEdit] = useState<WhoCanEdit>("everyone");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setEmail = (i: number, v: string) =>
    setEmails((arr) => arr.map((e, j) => (j === i ? v : e)));
  const addEmail = () => setEmails((arr) => [...arr, ""]);

  const finish = () => {
    setError(null);
    startTransition(async () => {
      const res = await completeUpgradeOnboarding({
        plan,
        bookName,
        whoCanEdit,
        emails,
      });
      if (res.ok) {
        setStep(3);
      } else {
        setError(
          res.error === "PLAN_NOT_READY"
            ? "Your upgrade is still finalizing — please refresh in a moment and try again."
            : "Something went wrong. Please try again.",
        );
      }
    });
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#f4f6f2] px-4 py-8">
      <div className="w-full max-w-[460px] rounded-[18px] border border-[#e9ece7] bg-white p-6 shadow-[0_28px_70px_rgba(20,30,25,0.12)] sm:p-7">
        {step === 1 && (
          <>
            <div className="flex items-start gap-3">
              <span className="text-[26px] leading-none" aria-hidden>🎉</span>
              <div className="min-w-0">
                <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[#1d2823]">
                  {copy.welcome}
                </h1>
                <p className="mt-0.5 text-[13px] text-[#8b938c]">
                  {copy.sub} <span className="text-[#5c655e]">· Step 1 of 3</span>
                </p>
              </div>
            </div>
            <div className="mt-4">
              <StepDots step={1} />
            </div>
            <div className="mt-5">
              <h2 className="text-[15px] font-semibold text-[#1d2823]">{copy.inviteTitle}</h2>
              <p className="mt-1 text-[13px] leading-[1.45] text-[#8b938c]">{copy.inviteHint}</p>
              <div className="mt-3.5 grid gap-2.5">
                {emails.map((e, i) => (
                  <div
                    key={i}
                    className="flex h-11 items-center gap-2.5 rounded-[10px] border border-[#d8ddd6] bg-white px-3 focus-within:border-[#4158f4]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b938c" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 6.5h16v11H4z" /><path d="M4.5 7l7.5 6 7.5-6" />
                    </svg>
                    <input
                      className="min-w-0 flex-1 bg-transparent text-[14px] text-[#1d2823] outline-none placeholder:text-[#aeb4ac]"
                      onChange={(ev) => setEmail(i, ev.target.value)}
                      placeholder="email@example.com"
                      type="email"
                      value={e}
                    />
                  </div>
                ))}
              </div>
              <button
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#4158f4] hover:underline"
                onClick={addEmail}
                type="button"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add another email
              </button>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <button className={PRIMARY_BTN} onClick={() => setStep(2)} type="button">
                Continue →
              </button>
              <button className={SKIP_BTN} onClick={() => setStep(2)} type="button">
                Skip for now
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e7efe9]" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#17352e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 4.5h11a2 2 0 012 2V20a1.5 1.5 0 00-1.5-1.5H5z" /><path d="M5 4.5v15.5" /><path d="M5 18.5h13" />
                </svg>
              </span>
              <div className="min-w-0">
                <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[#1d2823]">
                  {copy.bookTitle}
                </h1>
                <p className="mt-0.5 text-[13px] text-[#8b938c]">Step 2 of 3</p>
              </div>
            </div>
            <div className="mt-4">
              <StepDots step={2} />
            </div>
            <div className="mt-5">
              <label className="block text-[12.5px] font-semibold text-[#5c655e]" htmlFor="bookName">
                Shared book name
              </label>
              <input
                className="mt-1.5 h-11 w-full rounded-[10px] border border-[#d8ddd6] bg-white px-3 text-[14px] text-[#1d2823] outline-none focus:border-[#4158f4]"
                id="bookName"
                onChange={(e) => setBookName(e.target.value)}
                value={bookName}
              />

              <p className="mt-[18px] text-[12.5px] font-semibold text-[#5c655e]">Who can edit?</p>
              <div className="mt-2 grid gap-2">
                {(
                  [
                    ["everyone", "Everyone", "recommended"],
                    ["restricted", copy.restrictedLabel, null],
                  ] as const
                ).map(([value, label, tag]) => {
                  const on = whoCanEdit === value;
                  return (
                    <button
                      key={value}
                      className={`flex items-center gap-2.5 rounded-[10px] border px-3.5 py-3 text-left transition ${
                        on ? "border-[#17352e] bg-[#f4f6f2]" : "border-[#d8ddd6] bg-white hover:bg-[#f8f9f6]"
                      }`}
                      onClick={() => setWhoCanEdit(value)}
                      type="button"
                    >
                      <span
                        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.8px] ${
                          on ? "border-[#17352e]" : "border-[#c4ccc4]"
                        }`}
                      >
                        {on ? <span className="h-[9px] w-[9px] rounded-full bg-[#17352e]" /> : null}
                      </span>
                      <span className="text-[14px] font-medium text-[#1d2823]">{label}</span>
                      {tag ? (
                        <span className="ml-auto rounded-md bg-[#e3efe7] px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#1c6b48]">
                          {tag}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            {error ? <p className="mt-4 text-[13px] text-[#b5472f]">{error}</p> : null}
            <div className="mt-6 flex items-center gap-2">
              <button className={PRIMARY_BTN} disabled={pending} onClick={finish} type="button">
                {pending ? "Setting up…" : "Continue →"}
              </button>
              <button className={SKIP_BTN} disabled={pending} onClick={finish} type="button">
                Skip for now
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center py-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1f8a5b]" aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            </span>
            <h1 className="mt-3.5 text-[20px] font-semibold tracking-[-0.01em] text-[#1d2823]">
              {copy.doneTitle}
            </h1>
            <p className="mt-2 max-w-[300px] text-[14px] leading-[1.5] text-[#5c655e]">
              Invites sent · Shared book created · You’re good to go.
            </p>
            <div className="mt-4 w-3/5">
              <StepDots step={4} />
            </div>
            <button
              className={`${PRIMARY_BTN} mt-5`}
              onClick={() => router.push("/contacts")}
              type="button"
            >
              Go to contacts →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
