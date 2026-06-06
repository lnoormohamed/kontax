import Link from "next/link";

import { auth, signOut } from "~/server/auth";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f6aa5_0%,#0f2a46_35%,#09111d_100%)] text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Kontax</p>
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
              Welcome back{session.user.name ? `, ${session.user.name}` : ""}.
            </h1>
            <p className="max-w-2xl text-lg text-slate-200">
              You&apos;re signed in and ready for the next step. We can build the contact dashboard
              on top of this authenticated foundation next.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-3xl border border-white/15 bg-white/8 p-6">
              <h2 className="text-2xl font-bold">Account</h2>
              <p className="mt-3 text-base text-slate-200">
                Signed in as <span className="font-semibold text-white">{session.user.email}</span>
              </p>
            </section>
            <section className="rounded-3xl border border-white/15 bg-white/8 p-6">
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="w-full rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100">
                  Sign out
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f6aa5_0%,#0f2a46_35%,#09111d_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-12 px-6 py-16">
        <div className="max-w-3xl space-y-5">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Kontax</p>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
            Your people, remembered beautifully.
          </h1>
          <p className="max-w-2xl text-lg text-slate-200">
            Kontax is the place to keep the customers, partners, friends, and leads that matter to
            you most. Sign in to start building your contact home.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:max-w-4xl md:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/15 bg-white/8 p-6">
            <h2 className="text-2xl font-bold">Get started</h2>
            <p className="mt-3 text-base text-slate-200">
              Create your account and start with a clean, secure login flow built for Kontax.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100"
                href="/login"
              >
                Log in
              </Link>
              <Link
                className="rounded-full border border-white/30 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                href="/register"
              >
                Create account
              </Link>
            </div>
          </section>
          <section className="rounded-3xl border border-white/15 bg-white/8 p-6">
            <h2 className="text-2xl font-bold">What&apos;s next</h2>
            <p className="mt-3 text-base text-slate-200">
              Login is now the first-class path into the app. Next we can plug in contact creation,
              search, and personal organization flows.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
