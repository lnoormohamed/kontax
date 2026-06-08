import Link from "next/link";
import type { ReactNode } from "react";

const tabs = ["Dashboard", "Contacts", "Merge", "Imports", "Sync"];

type HeaderPatternProps = {
  name: string;
  summary: string;
  children: ReactNode;
};

const HeaderPattern = ({ name, summary, children }: HeaderPatternProps) => (
  <section className="overflow-hidden rounded-xl border border-slate-300 bg-white">
    <header className="border-b border-slate-300 bg-slate-50 px-5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {name}
      </p>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{summary}</p>
    </header>
    {children}
  </section>
);

const CircleButton = ({ icon }: { icon: string }) => (
  <button
    className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-sm text-slate-600"
    type="button"
    aria-label={icon}
  >
    {icon}
  </button>
);

const TabRow = () => (
  <div className="mt-1 flex gap-2 border-t border-slate-200 px-5 py-3">
    {tabs.map((tab) => (
      <div
        className={`rounded-full border px-3 py-2 text-xs font-medium ${
          tab === "Contacts"
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-300 bg-white text-slate-700"
        }`}
        key={tab}
      >
        {tab}
      </div>
    ))}
  </div>
);

const SearchStrip = () => (
  <div className="px-5 py-4">
    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
      <div className="h-10 rounded-md border border-slate-300 bg-white" />
      <div className="h-10 rounded-md border border-slate-300 bg-slate-50" />
      <div className="h-10 rounded-md border border-slate-300 bg-slate-50" />
    </div>
  </div>
);

const MetricTiles = () => (
  <div className="grid gap-2 border-t border-slate-200 px-5 py-3 sm:grid-cols-2 lg:grid-cols-4">
    <div className="h-16 rounded-md border border-slate-200 bg-slate-50" />
    <div className="h-16 rounded-md border border-slate-200 bg-slate-50" />
    <div className="h-16 rounded-md border border-slate-200 bg-slate-50" />
    <div className="h-16 rounded-md border border-slate-200 bg-slate-50" />
  </div>
);

const HeaderOne = () => (
  <div>
    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white font-bold text-slate-700">
        K
      </div>
      <div className="h-3 w-28 rounded-full bg-slate-300" />
      <div className="ml-auto hidden sm:block">
        <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
          Free plan
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2 sm:ml-0">
        <CircleButton icon="🔔" />
        <CircleButton icon="⚙" />
        <div className="h-8 w-8 rounded-full border border-slate-300 bg-slate-200" />
      </div>
    </div>
    <SearchStrip />
    <TabRow />
  </div>
);

const HeaderTwo = () => (
  <div>
    <div className="px-5 py-4">
      <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div className="inline-flex items-center gap-2">
          <div className="h-9 w-9 rounded-full border border-slate-300 bg-slate-200" />
          <div>
            <div className="h-3 w-32 rounded-full bg-slate-300" />
            <div className="mt-1 h-2 w-20 rounded-full bg-slate-200" />
          </div>
        </div>
        <div className="h-10 rounded-md border border-slate-300 bg-white" />
        <div className="inline-flex gap-2 justify-self-end">
          <div className="h-9 w-24 rounded-md border border-slate-300 bg-slate-900" />
          <CircleButton icon="＋" />
        </div>
      </div>
    </div>
    <div className="flex gap-2 overflow-x-auto border-t border-slate-200 px-5 py-3">
      <div className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs">Workspace</div>
      <div className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs">Recent</div>
      <div className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs">Starred</div>
      <div className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs">Templates</div>
    </div>
    <div className="border-t border-slate-200 px-5 py-3">
      <div className="h-10 rounded-md border border-slate-300 bg-white" />
    </div>
  </div>
);

const HeaderThree = () => (
  <div>
    <div className="bg-slate-900 px-5 py-3 text-slate-100">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.14em]">Kontax</span>
        <div className="h-2.5 w-20 rounded-full bg-slate-500" />
        <div className="ml-auto flex items-center gap-2">
          <CircleButton icon="✉️" />
          <CircleButton icon="🔔" />
        </div>
      </div>
    </div>
    <div className="px-5 py-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="h-10 rounded-md border border-slate-300 bg-white" />
        <div className="h-10 w-40 rounded-md border border-slate-300 bg-slate-900" />
      </div>
    </div>
    <TabRow />
    <MetricTiles />
  </div>
);

const HeaderFour = () => (
  <div>
    <div className="flex items-start justify-between gap-3 px-5 py-4">
      <div>
        <div className="h-3 w-24 rounded-full bg-slate-300" />
        <div className="mt-2 h-8 w-40 rounded-md border border-slate-300 bg-white" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-9 rounded-md border border-slate-300 bg-white" />
        <div className="h-9 w-9 rounded-md border border-slate-300 bg-white" />
      </div>
    </div>
    <div className="px-5">
      <div className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2">
        <div className="h-2 w-2/3 rounded-full bg-slate-300" />
      </div>
    </div>
    <TabRow />
    <SearchStrip />
  </div>
);

const HeaderFive = () => (
  <div>
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white">
          A
        </div>
        <div className="inline-flex h-10 min-w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
          Search command ...
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <span className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium">
            + New
          </span>
          <span className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium">
            Filter
          </span>
          <span className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium">
            Sort
          </span>
        </div>
      </div>
    </div>
    <div className="border-t border-slate-200 px-5 py-3">
      <div className="grid gap-2 md:grid-cols-3">
        <div className="h-8 rounded-md border border-slate-300 bg-slate-50" />
        <div className="h-8 rounded-md border border-slate-300 bg-slate-50" />
        <div className="h-8 rounded-md border border-slate-300 bg-slate-50" />
      </div>
    </div>
    <TabRow />
  </div>
);

export default function HeaderVariationsPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-xl border border-slate-300 bg-white p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Kontax Wireframe
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal text-slate-950">
                Header variations
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Five alternate header wireframes while keeping the original header intact.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:text-slate-900"
                href="/wireframes/header"
              >
                Back to primary header
              </Link>
            </div>
          </div>
        </header>

        <HeaderPattern
          name="01 · Search-led"
          summary="Prioritizes quick discovery with a dedicated command area and compact utility actions."
        >
          <HeaderOne />
        </HeaderPattern>

        <HeaderPattern
          name="02 · Workspace-first"
          summary="Adds workspace context and quick actions for team switches, then drops into a content-focused row."
        >
          <HeaderTwo />
        </HeaderPattern>

        <HeaderPattern
          name="03 · Dark accent"
          summary="Stronger hierarchy with a dark utility row, useful for emphasizing notifications and activity."
        >
          <HeaderThree />
        </HeaderPattern>

        <HeaderPattern
          name="04 · Split utility"
          summary="Separates branding and quick actions from search, with extra density controls underneath."
        >
          <HeaderFour />
        </HeaderPattern>

        <HeaderPattern
          name="05 · Productivity strip"
          summary="Promotes fast commands (new/filter/sort) in a minimal, single-line style."
        >
          <HeaderFive />
        </HeaderPattern>
      </div>
    </main>
  );
}
