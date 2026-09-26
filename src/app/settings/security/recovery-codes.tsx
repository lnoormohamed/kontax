"use client";

import { useEffect, useRef, useState } from "react";

/**
 * P49A-19: the one place recovery codes are shown — used by the enrolment
 * modal's last step and by the "regenerate" dialog. The codes are shown once
 * (they are stored hashed), with copy and download, and the only way out is
 * the "I've saved my codes" button.
 */
export function RecoveryCodesPanel({
  codes,
  onSaved,
}: {
  codes: string[];
  onSaved: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const flashCopy = (state: "copied" | "failed") => {
    setCopyState(state);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2500);
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      flashCopy("copied");
    } catch {
      flashCopy("failed");
    }
  };

  const download = () => {
    try {
      const blob = new Blob([codes.join("\n") + "\n"], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kontax-recovery-codes.txt";
      a.click();
      // Revoking in the same tick can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  };

  return (
    <>
      <div className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-[#e6d3a3] bg-[#f6edd9] px-[15px] py-[13px]">
        <svg fill="none" height="17" stroke="#7c5511" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" style={{ flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" width="17"><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
        <span className="text-[13.5px] leading-[1.5] text-[#7c5511]">
          Save your recovery codes somewhere safe. If you lose your authenticator app, these are the <strong className="font-semibold">only</strong> way to recover your account. They won&apos;t be shown again.
        </span>
      </div>
      <div className="mt-[14px] grid grid-cols-2 gap-2 rounded-[14px] border border-[#e9ece7] bg-[#f8faf8] p-[14px]">
        {codes.map((c) => (
          <span className="select-all rounded-lg border border-[#e9ece7] bg-white py-[7px] text-center font-mono text-[15px] tracking-[0.06em] text-[#1d2823]" key={c}>{c}</span>
        ))}
      </div>
      <div className="mt-[14px] flex flex-wrap gap-2.5">
        <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-[9px] text-[13px] font-semibold text-[#1d2823] hover:bg-[#f2f4f0]" onClick={() => void copyAll()} type="button">
          {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Couldn't copy — select the codes instead" : "Copy all codes"}
        </button>
        <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-[9px] text-[13px] font-semibold text-[#1d2823] hover:bg-[#f2f4f0]" onClick={download} type="button">Download as .txt</button>
      </div>
      <button className="mt-[18px] w-full rounded-[1.2rem] bg-[#17352e] py-3 text-[14px] font-semibold text-white hover:bg-[#20443b]" onClick={onSaved} type="button">I&apos;ve saved my codes →</button>
    </>
  );
}

/**
 * Shown after "Regenerate recovery codes". Clicking the backdrop or pressing
 * Escape does not close it — the old codes no longer work, so the user must
 * confirm they have saved the new ones.
 */
export function RecoveryCodesDialog({ codes, onSaved }: { codes: string[]; onSaved: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid items-end bg-[rgba(20,30,25,0.42)] p-0 md:place-items-center md:p-4">
      <div
        aria-labelledby="recovery-codes-dialog-title"
        aria-modal="true"
        className="st-modal-in max-h-[calc(100dvh-18px)] w-full overflow-y-auto rounded-t-[1.6rem] bg-white p-4 shadow-[0_24px_60px_rgba(20,30,25,0.25)] md:max-w-[460px] md:rounded-[1.6rem] md:p-6"
        role="dialog"
      >
        <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]" id="recovery-codes-dialog-title">Your new recovery codes</h3>
        <p className="mt-[6px] text-[14px] leading-[1.55] text-[#5c655e]">
          Your old recovery codes no longer work. Use these instead — each one works once.
        </p>
        <RecoveryCodesPanel codes={codes} onSaved={onSaved} />
      </div>
    </div>
  );
}
