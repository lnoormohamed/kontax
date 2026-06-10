"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setError("");
    setIsPending(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("We couldn't sign you in with those details.");
      setIsPending(false);
      return;
    }

    router.push(next ?? "/");
    router.refresh();
  };

  return (
    <section className="w-full max-w-md rounded-[2rem] border border-white/15 bg-[#07101b]/80 p-8 text-white shadow-[0_30px_120px_rgba(3,10,20,0.45)] backdrop-blur">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Kontax</p>
        <h1 className="text-4xl font-bold tracking-tight">Log in</h1>
        <p className="text-sm text-slate-300">
          Step back into your contact space and pick up where you left off.
        </p>
      </div>

      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm text-slate-200">
          <span>Email</span>
          <input
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="grid gap-2 text-sm text-slate-200">
          <span>Password</span>
          <input
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <button
          className="mt-2 rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-300">
        New to Kontax?{" "}
        <Link
          className="font-semibold text-cyan-200 hover:text-cyan-100"
          href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
        >
          Create an account
        </Link>
      </p>
    </section>
  );
}
