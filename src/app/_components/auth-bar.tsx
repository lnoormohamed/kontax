"use client";

import { signOut, useSession } from "next-auth/react";

export function AuthBar() {
  const { data: session, status } = useSession();

  if (status === "loading" || !session?.user) {
    return null;
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/20 bg-white/10 p-4">
      <p className="text-sm text-slate-200">
        Signed in as <span className="font-semibold">{session.user.email}</span>
      </p>
      <button
        className="rounded-md bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        onClick={() => void signOut({ callbackUrl: "/login" })}
      >
        Sign out
      </button>
    </section>
  );
}
