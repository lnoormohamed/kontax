import { redirect } from "next/navigation";

import { RegisterForm } from "~/app/_components/register-form";
import { auth } from "~/server/auth";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const rawNext = params?.next;
  const nextParam = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  const next = nextParam?.startsWith("/") ? nextParam : undefined;

  if (session?.user) {
    redirect(next ?? "/");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#154d79_0%,#0d2137_40%,#07101b_100%)] px-6 py-16 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="max-w-xl space-y-6">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Kontax</p>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
            Start your contact home with a single secure account.
          </h1>
          <p className="text-lg text-slate-200">
            Create your login and we&apos;ll use it as the foundation for your personal dashboard,
            saved people, and future contact tools.
          </p>
        </section>
        <RegisterForm next={next} />
      </div>
    </main>
  );
}
