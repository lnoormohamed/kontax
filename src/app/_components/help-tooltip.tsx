"use client";

import { useEffect, useId, useRef, useState } from "react";

// P26-12 · HelpTooltip (design P26-DB07 §3).
// A "?" trigger that reveals a dark popover on hover (desktop) / tap (mobile),
// dismissing on outside click. `place="bottom"` opens below the trigger for use
// near the top of a viewport. `learnHref` adds a "Learn more →" deep link
// (e.g. "/help#carddav").
export function HelpTooltip({
  children,
  learnHref,
  place = "top",
  label = "More information",
}: {
  children: React.ReactNode;
  learnHref?: string;
  place?: "top" | "bottom";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? popId : undefined}
        className={`grid h-[18px] w-[18px] place-items-center rounded-full border text-[11px] font-bold leading-none transition ${
          open
            ? "border-[#cdd4cc] bg-[#e9ece7] text-[#5c655e]"
            : "border-[#d8ddd6] bg-[#f2f4f0] text-[#8b938c] hover:bg-[#e9ece7] hover:text-[#5c655e]"
        }`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        ?
      </button>
      {open ? (
        <span
          id={popId}
          role="tooltip"
          className={`absolute left-1/2 z-50 w-max max-w-[240px] -translate-x-1/2 rounded-[10px] bg-[#1d2823] px-3.5 py-3 text-left text-[13px] font-normal leading-[1.5] text-white shadow-[0_14px_34px_rgba(20,30,25,0.28)] ${
            place === "bottom" ? "top-[calc(100%+9px)]" : "bottom-[calc(100%+9px)]"
          }`}
        >
          {children}
          {learnHref ? (
            <a
              className="mt-2 inline-block font-medium text-[#dff0e7] underline"
              href={learnHref}
            >
              Learn more →
            </a>
          ) : null}
          {/* arrow */}
          <span
            className={`absolute left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-x-transparent ${
              place === "bottom"
                ? "bottom-full border-b-[5px] border-b-[#1d2823]"
                : "top-full border-t-[5px] border-t-[#1d2823]"
            }`}
          />
        </span>
      ) : null}
    </span>
  );
}
