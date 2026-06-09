"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOutAction } from "~/app/actions/auth";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

export function UserMenu({
  initials,
  name,
  email,
}: {
  initials: string;
  name: string;
  email: string;
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

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#17352e] text-xs font-semibold text-[#dff0e7] transition hover:opacity-90"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {initials}
      </button>
      {open ? (
        <div
          className="absolute right-0 top-12 z-40 w-60 overflow-hidden rounded-[0.9rem] border border-[#d8ddd6] bg-white py-1 shadow-[0_14px_40px_rgba(20,30,25,0.18)]"
          role="menu"
        >
          <div className="border-b border-[#e9ece7] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[#1d2823]">{name}</p>
            <p className="truncate text-xs text-[#8b938c]">{email}</p>
          </div>
          <Link
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1d2823] transition hover:bg-[#f2f4f0]"
            href="/settings"
            role="menuitem"
          >
            <WorkspaceIcon className="text-[#5c655e]" name="gear" size={16} />
            Settings
          </Link>
          <form action={signOutAction}>
            <button
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[#1d2823] transition hover:bg-[#f2f4f0]"
              role="menuitem"
              type="submit"
            >
              <WorkspaceIcon className="text-[#5c655e]" name="signout" size={16} />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
