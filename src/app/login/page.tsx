import { redirect } from "next/navigation";

import { LoginForm } from "~/app/_components/login-form";
import { auth } from "~/server/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const rawNext = params?.next;
  const nextParam = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  // Only allow same-app relative paths as a return target.
  const next = nextParam?.startsWith("/") ? nextParam : undefined;

  if (session?.user) {
    redirect(next ?? "/");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#1b5a89_0%,#0d2137_40%,#07101b_100%)] px-6 py-16 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="max-w-xl space-y-6">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Kontax</p>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
            Every relationship deserves a better memory.
          </h1>
          <p className="text-lg text-slate-200">
            Sign in to your clean contact workspace and keep the people that matter close,
            organized, and easy to find.
          </p>
        </section>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
