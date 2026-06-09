"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SortValue = "name" | "updated";

export function SortMenu({
  current,
  nameHref,
  updatedHref,
}: {
  current: SortValue;
  nameHref: string;
  updatedHref: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const label = current === "name" ? "Name A–Z" : "Recently updated";

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#d8ddd6] bg-white px-2.5 text-[12.5px] text-[#5c655e] transition hover:bg-[#f2f4f0]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="text-[#8b938c]">Sort</span>
        <span className="font-semibold text-[#1d2823]">{label}</span>
        <span className="text-[#8b938c]">▾</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-30 w-48 overflow-hidden rounded-[0.8rem] border border-[#d8ddd6] bg-white py-1 shadow-[0_12px_34px_rgba(20,30,25,0.16)]">
          <Link
            className={`flex items-center justify-between px-3 py-2 text-[13px] transition hover:bg-[#f2f4f0] ${
              current === "name" ? "font-semibold text-[#1d2823]" : "text-[#5c655e]"
            }`}
            href={nameHref}
          >
            Name A–Z
            {current === "name" ? <span className="text-[#17352e]">✓</span> : null}
          </Link>
          <Link
            className={`flex items-center justify-between px-3 py-2 text-[13px] transition hover:bg-[#f2f4f0] ${
              current === "updated" ? "font-semibold text-[#1d2823]" : "text-[#5c655e]"
            }`}
            href={updatedHref}
          >
            Recently updated
            {current === "updated" ? <span className="text-[#17352e]">✓</span> : null}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
