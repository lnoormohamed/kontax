import Link from "next/link";
import type { ReactNode } from "react";

type ConceptProps = {
  title: string;
  summary: string;
  children: ReactNode;
};

const tabs = ["Dashboard", "Contacts", "Merge", "Import / Export", "Sync"];

const line = "rounded-full bg-slate-300";
const darkLine = "rounded-full bg-slate-800";
const panel = "rounded-lg border border-slate-300 bg-white";
const mutedPanel = "rounded-lg border border-slate-300 bg-slate-50";
const label =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500";

const Line = ({ className = "h-2 w-24" }: { className?: string }) => (
  <div className={`${line} ${className}`} />
);

const TextStack = ({ compact = false }: { compact?: boolean }) => (
  <div className={compact ? "space-y-2" : "space-y-3"}>
    <Line className="h-2 w-4/5" />
    <Line className="h-2 w-3/5" />
    <Line className="h-2 w-2/5" />
  </div>
);

const TabStrip = ({ active = "Dashboard" }: { active?: string }) => (
  <div className="border-b border-slate-300 bg-white px-5 py-3">
    <div className="flex gap-2 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          className={`shrink-0 rounded-md border px-4 py-2 text-sm font-semibold ${
            tab === active
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-700"
          }`}
          key={tab}
        >
          {tab}
        </div>
      ))}
    </div>
  </div>
);

const Stat = ({ labelText, value }: { labelText: string; value: string }) => (
  <div className={`${panel} p-4`}>
    <p className={label}>{labelText}</p>
    <p className="mt-4 text-2xl font-semibold text-slate-950">{value}</p>
  </div>
);

const ContactRow = () => (
  <div className={`${panel} flex items-center gap-4 px-4 py-3`}>
    <div className="h-10 w-10 shrink-0 rounded-full border border-slate-300 bg-slate-200" />
    <div className="min-w-0 flex-1 space-y-2">
      <div className={`${darkLine} h-2.5 w-36`} />
      <Line className="h-2 w-56 max-w-full" />
    </div>
    <div className="hidden h-8 w-20 rounded-md border border-slate-300 bg-slate-50 sm:block" />
  </div>
);

const TaskRow = ({ urgent = false }: { urgent?: boolean }) => (
  <div className={`${panel} flex items-center justify-between gap-3 px-4 py-3`}>
    <div className="min-w-0 flex-1 space-y-2">
      <div
        className={`${urgent ? "bg-slate-900" : "bg-slate-600"} h-2.5 w-32 rounded-full`}
      />
      <Line className="h-2 w-48 max-w-full" />
    </div>
    <div className="h-8 w-16 shrink-0 rounded-md border border-slate-300 bg-slate-50" />
  </div>
);

const GapCard = ({
  labelText,
  value,
}: {
  labelText: string;
  value: string;
}) => (
  <div className={`${panel} p-4`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className={label}>{labelText}</p>
        <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      </div>
      <div className="h-8 w-8 rounded-md border border-slate-300 bg-slate-100" />
    </div>
    <div className="mt-4 space-y-2">
      <Line className="h-2 w-5/6" />
      <Line className="h-2 w-2/3" />
    </div>
  </div>
);

const Concept = ({ title, summary, children }: ConceptProps) => (
  <section className="space-y-4">
    <div className="border-t border-slate-300 pt-8">
      <div>
        <p className={label}>Concept</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
          {title}
        </h2>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {summary}
      </p>
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_14px_48px_rgba(15,23,42,0.08)]">
      {children}
    </div>
  </section>
);

const TopBar = () => (
  <div className="border-b border-slate-300 bg-slate-100 px-5 py-4">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-3">
        <Line className="h-2 w-20 bg-slate-400" />
        <div className={`${darkLine} h-6 w-52`} />
      </div>
      <div className="flex min-w-0 flex-1 justify-end gap-3">
        <div className="h-10 w-full max-w-xs rounded-md border border-slate-300 bg-white" />
        <div className="h-10 w-24 shrink-0 rounded-md border border-slate-300 bg-white" />
      </div>
    </div>
  </div>
);

const DailyHub = () => (
  <Concept
    summary="A clean daily workspace with tabs up top, saved views on the left, the active contact list in the center, and duplicate review on the right."
    title="01. Daily Hub"
  >
    <TopBar />
    <TabStrip />
    <div className="grid gap-5 bg-slate-50 p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-5 lg:col-span-2 xl:col-span-1">
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>Saved Views</p>
          <div className="mt-4 space-y-2">
            {[
              "All contacts",
              "Recently updated",
              "Needs details",
              "Archived",
            ].map((item, index) => (
              <div
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  index === 0
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>List Health</p>
          <div className="mt-4 space-y-4">
            <TextStack compact />
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-2 w-3/4 rounded-full bg-slate-800" />
            </div>
          </div>
        </div>
      </aside>

      <main className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Stat labelText="Active" value="1,248" />
          <Stat labelText="Merge Queue" value="12" />
          <Stat labelText="Imported" value="84" />
        </div>
        <div className={`${mutedPanel} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={label}>Primary List</p>
              <div className={`${darkLine} mt-3 h-4 w-36`} />
            </div>
            <div className="h-9 w-24 rounded-md border border-slate-300 bg-white" />
          </div>
          <div className="mt-4 space-y-3">
            <ContactRow />
            <ContactRow />
            <ContactRow />
            <ContactRow />
          </div>
        </div>
      </main>

      <aside className="space-y-5">
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>Duplicate Review</p>
          <div className="mt-4 space-y-3">
            <TaskRow urgent />
            <TaskRow />
            <TaskRow />
          </div>
        </div>
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>Plan Status</p>
          <div className="mt-4">
            <TextStack />
          </div>
        </div>
      </aside>
    </div>
  </Concept>
);

const OpsBoard = () => (
  <Concept
    summary="A more operational version for cleanup-heavy days, grouping the homepage around review lanes and the queue that needs attention."
    title="02. Ops Board"
  >
    <TopBar />
    <TabStrip />
    <div className="grid gap-5 bg-slate-50 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <main className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat labelText="Needs Review" value="12" />
          <Stat labelText="Ready" value="4" />
          <Stat labelText="Archived" value="9" />
          <Stat labelText="Sync Issues" value="2" />
        </div>
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>Review Lanes</p>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {["Duplicates", "Missing Details", "Recent Imports"].map((lane) => (
              <div className={`${panel} p-4`} key={lane}>
                <div className={`${darkLine} h-3 w-28`} />
                <div className="mt-4 space-y-3">
                  <TaskRow urgent={lane === "Duplicates"} />
                  <TaskRow />
                  <TaskRow />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <aside className="space-y-5">
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>Today</p>
          <div className="mt-4 space-y-3">
            <TaskRow urgent />
            <TaskRow />
            <TaskRow />
            <TaskRow />
          </div>
        </div>
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>Workflow Actions</p>
          <div className="mt-4 grid gap-2">
            <div className="h-10 rounded-md border border-slate-300 bg-white" />
            <div className="h-10 rounded-md border border-slate-300 bg-white" />
            <div className="h-10 rounded-md bg-slate-900" />
          </div>
        </div>
      </aside>
    </div>
  </Concept>
);

const RelationshipPulse = () => (
  <Concept
    summary="A calmer relationship-oriented layout that keeps the warmth, but uses the dashboard to expose useful contact-data gaps."
    title="03. Relationship Pulse"
  >
    <TopBar />
    <TabStrip />
    <div className="grid gap-5 bg-slate-50 p-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <main className="space-y-5">
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>Relationship Overview</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_240px]">
            <div className={`${panel} p-5`}>
              <div className={`${darkLine} h-5 w-48`} />
              <div className="mt-5">
                <TextStack />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="h-20 rounded-md border border-slate-300 bg-slate-50" />
                <div className="h-20 rounded-md border border-slate-300 bg-slate-50" />
                <div className="h-20 rounded-md border border-slate-300 bg-slate-50" />
              </div>
            </div>
            <div className={`${panel} flex items-center justify-center p-5`}>
              <div className="h-24 w-24 rounded-full border-[16px] border-slate-400 border-r-slate-300 border-b-slate-200" />
            </div>
          </div>
        </div>
        <div className={`${mutedPanel} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={label}>Data Quality Gaps</p>
              <div className={`${darkLine} mt-3 h-4 w-40`} />
            </div>
            <div className="h-9 w-24 rounded-md border border-slate-300 bg-white" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <GapCard labelText="Missing Country Code" value="42" />
            <GapCard labelText="Missing Last Name" value="18" />
            <GapCard labelText="Missing Email" value="37" />
            <GapCard labelText="Missing Company" value="24" />
          </div>
        </div>
      </main>
      <aside className="space-y-5">
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>Health Signals</p>
          <div className="mt-4 grid gap-3">
            <Stat labelText="Missing Emails" value="37" />
            <Stat labelText="Duplicates" value="12" />
          </div>
        </div>
        <div className={`${mutedPanel} p-4`}>
          <p className={label}>Activity</p>
          <div className="mt-4 space-y-3">
            <TaskRow />
            <TaskRow />
            <TaskRow />
          </div>
        </div>
      </aside>
    </div>
  </Concept>
);

export default function LoggedInHomeWireframesPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-300 pb-8 lg:flex-row lg:items-end">
          <div>
            <p className={label}>Kontax Wireframes</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
              Logged-in homepage
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Cleaner low-fidelity directions with tabbed navigation, fewer
              competing panels, and clearer daily workflows.
            </p>
          </div>
          <Link
            className="inline-flex w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
            href="/"
          >
            Back to app
          </Link>
          <Link
            className="inline-flex w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
            href="/wireframes/header"
          >
            Open header wireframe
          </Link>
        </header>

        <DailyHub />
        <OpsBoard />
        <RelationshipPulse />
      </div>
    </main>
  );
}
