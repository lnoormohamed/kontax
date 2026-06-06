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
        <div className="rounded-2xl border border-white/15 bg-white/8 p-6 md:max-w-3xl">
          <h2 className="text-2xl font-bold">Next up</h2>
          <p className="mt-3 text-base text-slate-200">
            The starter is now focused on the clean app foundation only. Next we can build a real
            Kontax login flow, user dashboard, and contact management without the default Discord
            provider getting in the way.
          </p>
        </div>
      </div>
    </main>
  );
}
