import Link from "next/link";

const tabs = ["Dashboard", "Contacts", "Merge", "Imports", "Sync"];

const Label = ({ children }: { children: string }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
    {children}
  </p>
);

const HeaderIcon = ({ label, icon }: { label: string; icon: string }) => (
  <button
    aria-label={label}
    className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    type="button"
  >
    {icon}
  </button>
);

const Tab = ({ name, active = false }: { name: string; active?: boolean }) => (
  <div
    className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium ${
      active
        ? "border-slate-900 bg-slate-900 text-white"
        : "border-slate-300 bg-white text-slate-700"
    }`}
  >
    {name}
  </div>
);

export default function HeaderWireframePage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Kontax Wireframe
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal text-slate-950">
                Header only concept
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Focused header layout with tabbed navigation, search, and action
                controls for the logged-in experience.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:text-slate-900"
                href="/wireframes/logged-in-home"
              >
                Back to dashboard wireframes
              </Link>
            <Link
              className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:text-slate-900"
              href="/wireframes/contacts-tab"
            >
              Open contacts tab
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:text-slate-900"
              href="/wireframes/header-variations"
            >
              See 5 header variations
            </Link>
          </div>
        </div>
      </header>

        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white">
          <div className="border-b border-slate-300 bg-slate-50 px-6 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 bg-white text-lg font-bold text-slate-700">
                  K
                </div>
                <div>
                  <div className="h-3 w-20 rounded-full bg-slate-300" />
                  <div className="mt-1 h-2 w-16 rounded-full bg-slate-200" />
                </div>
              </div>

              <div className="flex-1">
                <div className="h-10 w-full rounded-md border border-slate-300 bg-white" />
              </div>

              <div className="flex items-center gap-2">
                <HeaderIcon icon="🔔" label="Notifications" />
                <HeaderIcon icon="⚙" label="Settings" />
                <HeaderIcon icon="☰" label="More options" />
                <div className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-slate-200" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 px-6 py-3">
            {tabs.map((tab) => (
              <Tab key={tab} name={tab} active={tab === "Contacts"} />
            ))}
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Contacts</Label>
                <p className="mt-2 text-sm text-slate-500">
                  Search result, filters, and quick tools live under this header.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-24 rounded-md border border-slate-300 bg-slate-50" />
                <div className="h-8 w-24 rounded-md border border-slate-300 bg-slate-50" />
                <div className="h-8 w-28 rounded-md border border-slate-300 bg-slate-900" />
              </div>
            </div>
            <div className="grid gap-3 border-t border-slate-200 pt-3">
              <div className="h-2 w-full rounded-full bg-slate-200" />
              <div className="h-2 w-5/6 rounded-full bg-slate-200" />
              <div className="h-2 w-4/6 rounded-full bg-slate-200" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
