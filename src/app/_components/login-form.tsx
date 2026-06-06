"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
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
    <main className="min-h-screen bg-gradient-to-b from-[#042f66] to-[#0b1020] px-4 py-12 text-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 rounded-xl border border-white/20 bg-white/10 p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-sky-200">Kontax</p>
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="text-sm text-slate-200">Sign in to manage your contacts.</p>

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <input
            className="rounded-md border border-white/20 bg-white/10 p-2 text-white placeholder:text-white/70"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="rounded-md border border-white/20 bg-white/10 p-2 text-white placeholder:text-white/70"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            className="rounded-md bg-sky-600 px-4 py-2 font-semibold hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          {message ? <p className="text-sm text-red-200">{message}</p> : null}
        </form>

        <p className="text-sm text-slate-200">
          New here? <Link href="/register">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
