import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f6aa5_0%,#0f2a46_35%,#09111d_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-12 px-6 py-16">
        <div className="max-w-3xl space-y-5">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Kontax</p>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
            A clean foundation for a consumer contact app.
          </h1>
          <p className="max-w-2xl text-lg text-slate-200">
            This fresh T3 rebuild gives us Postgres, Prisma, TypeScript, and Auth.js
            scaffolding without the extra complexity we were fighting before.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:max-w-3xl md:gap-6">
          <Link
            className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-white/8 p-5 text-white transition hover:bg-white/14"
            href="/api/auth/signin"
          >
            <h3 className="text-2xl font-bold">Open auth flow</h3>
            <div className="text-base text-slate-200">
              The starter auth route is live and ready for us to replace with the login experience
              we actually want for Kontax.
            </div>
          </Link>
          <Link
            className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-white/8 p-5 text-white transition hover:bg-white/14"
            href="https://create.t3.gg/en/introduction"
            target="_blank"
          >
            <h3 className="text-2xl font-bold">Read the T3 docs</h3>
            <div className="text-base text-slate-200">
              The scaffold is clean now, so the next job is shaping auth, contacts, and the
              dashboard around the product we want.
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
