"use client";

import { useEffect, useRef, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

/**
 * A small "⋯" icon button that opens a dropdown positioned to the right.
 * Closes on outside click, Escape, or when focus leaves the menu.
 * Children are rendered as the menu content — pass forms / buttons directly.
 */
export function MoreMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More options"
        className="grid size-[34px] cursor-pointer place-items-center rounded-[8px] border border-transparent text-[#5c655e] transition hover:border-[#d8ddd6] hover:bg-[#f2f4f0]"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <WorkspaceIcon name="more" size={18} />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-1 w-56 rounded-[1rem] border border-[#d8ddd6] bg-white p-1.5 shadow-lg"
          role="menu"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
