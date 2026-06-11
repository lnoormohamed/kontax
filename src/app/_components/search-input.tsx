"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

export function SearchInput({
  initialQuery,
  tab,
  filter,
  sort,
  view,
}: {
  initialQuery: string;
  tab: string;
  filter: string;
  sort: string;
  view: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync if the query changes from outside (e.g. nav, back button).
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  const navigate = (next: string) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("filter", filter);
    params.set("sort", sort);
    params.set("view", view);
    if (next.trim()) {
      params.set("q", next);
    }
    router.replace(`/contacts?${params.toString()}`, { scroll: false });
  };

  const onChange = (next: string) => {
    setValue(next);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => navigate(next), 250);
  };

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    navigate(value);
  };

  const clear = () => {
    setValue("");
    if (timer.current) {
      clearTimeout(timer.current);
    }
    navigate("");
  };

  return (
    <div className="flex min-w-0 flex-1 justify-center">
      <div
        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border bg-white px-3 transition lg:max-w-[560px] ${
          value ? "border-[#4158f4] shadow-[0_0_0_3px_#edf0fe]" : "border-[#d8ddd6]"
        }`}
      >
        <WorkspaceIcon className={value ? "text-[#5c655e]" : "text-[#8b938c]"} name="search" size={18} />
        <input
          className="h-10 w-full bg-transparent text-sm text-[#1d2823] outline-none placeholder:text-[#8b938c]"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              flush();
            }
          }}
          placeholder="Search by name, email, phone, company…"
          type="search"
          value={value}
        />
        {value ? (
          <button
            aria-label="Clear search"
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f2f4f0] text-xs text-[#5c655e] transition hover:bg-[#e9ece7]"
            onClick={clear}
            type="button"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
