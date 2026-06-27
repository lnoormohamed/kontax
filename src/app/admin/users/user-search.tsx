"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AD, AdIcon } from "../_components/admin-icons";

// Debounced search that drives the server page via ?q= while preserving any
// active saved view.
export function UserSearch({ initial, view }: { initial: string; view: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = value.trim();
      const params = new URLSearchParams();
      if (view && view !== "all") params.set("view", view);
      if (q) params.set("q", q);
      const next = params.toString();
      router.replace(next ? `/admin/users?${next}` : "/admin/users");
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, view]);

  return (
    <div className="ad-search-bar">
      <AdIcon name="search" size={18} c={AD.mute} />
      <input
        className="ad-search-input"
        placeholder="Search users by email or name…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      {value && (
        <button className="ad-search-clear" onClick={() => setValue("")} aria-label="Clear">
          <AdIcon name="close" size={15} c={AD.mute} />
        </button>
      )}
    </div>
  );
}
