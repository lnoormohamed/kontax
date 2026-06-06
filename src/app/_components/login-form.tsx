"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const queryError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(queryError ? "Unable to sign in. Please try again." : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setMessage("Unable to sign in. Check your email and password.");
      setIsSubmitting(false);
      return;
    }

    router.push(callbackUrl);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#042f66] to-[#0b1020] p-4 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center">
        <section className="w-full rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-sm">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-sky-200">Kontax</p>
            <h1 className="text-4xl font-bold">Welcome back</h1>
            <p className="text-sm text-slate-200">
              Sign in to save and manage your customers, clients, and partners.
            </p>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm">
              <span>Email</span>
              <input
                className="rounded-md border border-white/20 bg-white/5 p-3 text-white placeholder:text-white/70 focus:border-sky-300 focus:outline-none"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Password</span>
              <input
                className="rounded-md border border-white/20 bg-white/5 p-3 text-white placeholder:text-white/70 focus:border-sky-300 focus:outline-none"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </label>

            <button
              className="rounded-md bg-sky-600 px-4 py-3 font-semibold transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
            {message ? <p className="text-sm text-red-200">{message}</p> : null}
          </form>

          <p className="mt-6 text-sm text-slate-200">
            New here? <Link href="/register">Create an account</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
