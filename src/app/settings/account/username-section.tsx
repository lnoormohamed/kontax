"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { checkUsernameAvailability, claimUsername } from "~/app/actions/username";

type Status = "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";

function Spinner() {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 14, height: 14,
        border: "2px solid rgba(23,53,46,.15)",
        borderTopColor: "#17352e",
        animation: "stSpin .7s linear infinite",
      }}
    />
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1c6b48" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}

function XIcon({ color = "#9a3a23" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a6a1e" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ── Change-URL confirm modal ──────────────────────────────────────────────────
function ChangeUrlModal({
  from,
  to,
  onConfirm,
  onCancel,
  isPending,
}: {
  from: string;
  to: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 md:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={ref}
        className="st-modal-in w-full max-w-[440px] overflow-hidden rounded-t-[1.6rem] bg-white shadow-[0_24px_60px_rgba(20,30,25,0.25)] md:rounded-[1.6rem]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Change card URL"
      >
        {/* header */}
        <div className="flex items-center gap-3 border-b border-[#e9ece7] px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-amber-50">
            <WarnIcon />
          </span>
          <span className="text-[15px] font-semibold text-[#1d2823]">Change your card URL?</span>
        </div>

        <div className="px-5 py-4">
          {/* old → new */}
          <div className="flex items-center gap-2 rounded-xl border border-[#e9ece7] bg-[#f6f7f4] px-3.5 py-2.5 text-[13px]">
            <span className="font-mono text-[#8b938c]">u/{from}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4ccc4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="font-mono font-semibold text-[#1d2823]">u/{to}</span>
          </div>

          {/* warning */}
          <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <WarnIcon />
            <p className="text-[12.5px] leading-[1.55] text-amber-800">
              Links and QR codes pointing to{" "}
              <b className="font-semibold">kontax.app/u/{from}</b> will break immediately — there&apos;s no redirect. Your old handle is held for 30 days before anyone else can claim it.
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-[#e9ece7] px-5 py-4">
          <button
            className="flex-1 rounded-[14px] border border-[#d8ddd6] bg-white py-2.5 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4] disabled:opacity-50"
            onClick={onCancel}
            disabled={isPending}
            type="button"
          >
            Keep current URL
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#4158f4] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#3347d8] disabled:opacity-50"
            onClick={onConfirm}
            disabled={isPending}
            type="button"
          >
            {isPending ? <><Spinner />Saving…</> : "Change URL"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function UsernameSection({ initialUsername }: { initialUsername: string | null }) {
  const [value, setValue] = useState(initialUsername ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [savedUsername, setSavedUsername] = useState(initialUsername);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isChanging = !!savedUsername && value !== savedUsername;
  const isSameAsCurrent = value === savedUsername;
  const canSave = status === "available" && !isPending;

  // Debounced availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || isSameAsCurrent) { setStatus("idle"); return; }

    setStatus("checking");
    debounceRef.current = setTimeout(() => {
      void checkUsernameAvailability(value).then(setStatus);
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, isSameAsCurrent]);

  const doSave = () => {
    setSaveErr("");
    startTransition(async () => {
      const result = await claimUsername(value);
      setShowConfirm(false);
      if ("success" in result) {
        setSavedUsername(value);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      } else {
        const msgs: Record<string, string> = {
          TAKEN: "That username was just taken. Try another.",
          RESERVED: "That username is reserved.",
          INVALID: "Username must be 3–30 characters: letters, numbers, hyphens, underscores.",
          COOLDOWN: "You can only change your card URL once every 30 days.",
          UNAUTHORIZED: "Please sign in again.",
        };
        setSaveErr(msgs[result.error] ?? "Something went wrong.");
      }
    });
  };

  const handleSave = () => {
    if (!canSave) return;
    if (isChanging) { setShowConfirm(true); return; }
    doSave();
  };

  // Ring colour on the input box
  const ringClass =
    status === "available" ? "border-[#9cc9ad] ring-2 ring-[#e7efe9]"
    : status === "taken" || status === "reserved" || status === "invalid"
      ? "border-[#dcae9f] ring-2 ring-[#f3e1da]"
    : "border-[#d8ddd6]";

  return (
    <>
      <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] md:p-6">
        <p className="mb-[6px] text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">
          Public card URL
        </p>
        <p className="mb-4 text-[13px] leading-[1.5] text-[#5c655e]">
          Your permanent public contact card. Share the link — anyone with it can view the fields you&apos;ve made public.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* prefix + input */}
          <div
            className={`flex h-11 flex-1 items-center overflow-hidden rounded-xl border bg-white transition ${ringClass}`}
            style={{ minWidth: 240 }}
          >
            <span className="select-none whitespace-nowrap pl-3.5 pr-1 text-[13.5px] text-[#8b938c]">
              kontax.app/u/
            </span>
            <input
              className="min-w-0 flex-1 border-none bg-transparent py-0 pr-3 text-[14px] font-semibold text-[#1d2823] outline-none"
              value={value}
              onChange={(e) => {
                setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                setSaveErr("");
                setJustSaved(false);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              maxLength={30}
              placeholder="yourname"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {/* save button */}
          <button
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d8ddd6] bg-white px-4 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4] disabled:cursor-default disabled:opacity-40"
            onClick={handleSave}
            disabled={!canSave}
            type="button"
          >
            Save
          </button>
        </div>

        {/* status hint */}
        <div className="mt-2 min-h-[20px]">
          {status === "checking" && (
            <span className="flex items-center gap-1.5 text-[13px] text-[#8b938c]">
              <Spinner />Checking…
            </span>
          )}
          {status === "idle" && !savedUsername && (
            <span className="text-[12.5px] text-[#8b938c]">3–30 characters · letters, numbers, hyphens, underscores</span>
          )}
          {status === "idle" && savedUsername && isSameAsCurrent && (
            <a
              href={`/u/${savedUsername}`}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-medium text-[#4158f4] hover:underline"
            >
              kontax.app/u/{savedUsername} ↗
            </a>
          )}
          {status === "available" && (
            <span className="flex items-center gap-1.5 text-[13px] text-[#1c6b48]">
              <CheckIcon />kontax.app/u/{value} is available
            </span>
          )}
          {status === "taken" && (
            <span className="flex items-center gap-1.5 text-[13px] text-[#9a3a23]">
              <XIcon />This username is taken. Try {value}2.
            </span>
          )}
          {status === "reserved" && (
            <span className="flex items-center gap-1.5 text-[13px] text-[#9a3a23]">
              <XIcon />This username is reserved.
            </span>
          )}
          {status === "invalid" && value.length > 0 && (
            <span className="flex items-center gap-1.5 text-[13px] text-[#9a3a23]">
              <XIcon />3–30 characters · letters, numbers, hyphens, underscores.
            </span>
          )}
          {saveErr && (
            <span className="flex items-center gap-1.5 text-[13px] text-[#9a3a23]">
              <XIcon />{saveErr}
            </span>
          )}
          {justSaved && (
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#17352e]">
              <CheckIcon />Saved — your card is live at kontax.app/u/{savedUsername}
            </span>
          )}
        </div>
      </section>

      {showConfirm && savedUsername && (
        <ChangeUrlModal
          from={savedUsername}
          to={value}
          onConfirm={doSave}
          onCancel={() => setShowConfirm(false)}
          isPending={isPending}
        />
      )}
    </>
  );
}
