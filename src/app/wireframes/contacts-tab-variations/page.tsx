import Link from "next/link";
import type { ReactNode } from "react";

type RowBadge = {
  name: string;
  email: string;
  phone: string;
  jobTitleAndCompany: string;
  birthday: string;
};

type VariantProps = {
  title: string;
  summary: string;
  children: ReactNode;
};

const contacts: RowBadge[] = [
  {
    name: "Jordan Lee",
    email: "jordan.lee@acme.example",
    phone: "+1 555 0102",
    jobTitleAndCompany: "Product Lead · Acme Studio",
    birthday: "Mar 4, 1988",
  },
  {
    name: "Nina Patel",
    email: "nina.patel@northline.co",
    phone: "+44 20 7946",
    jobTitleAndCompany: "Ops Manager · Northline Co",
    birthday: "Jun 16, 1990",
  },
  {
    name: "Liam O’Connor",
    email: "liam@blueframe.io",
    phone: "+61 412 998",
    jobTitleAndCompany: "Sales Director · Blueframe",
    birthday: "Nov 22, 1985",
  },
  {
    name: "Maya Chen",
    email: "maya.chen@harborlabs.com",
    phone: "+49 170 222",
    jobTitleAndCompany: "Founding Partner · Harbor Labs",
    birthday: "Jan 9, 1992",
  },
];

const PHONE_PREFIX_MAP: Record<string, string> = {
  "+1": "🇺🇸",
  "+44": "🇬🇧",
  "+61": "🇦🇺",
  "+49": "🇩🇪",
  "+33": "🇫🇷",
  "+39": "🇮🇹",
  "+34": "🇪🇸",
};

const parsePhoneParts = (phone: string) => {
  const cleaned = phone.trim();
  const parts = /^(\+\d{1,3})([\s-]?(.*))$/.exec(cleaned);
  if (!parts) {
    return { flag: "🌐", code: "", number: cleaned };
  }
  const code = parts[1] ?? "";
  const number = parts[2]?.trim() ?? "";
  return { flag: PHONE_PREFIX_MAP[code] ?? "🌐", code, number };
};

const PhoneCell = ({ value }: { value: string }) => {
  const { flag, code, number } = parsePhoneParts(value);
  return (
    <p className="truncate text-slate-600">
      <span className="mr-2 inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-full bg-slate-50 text-xs">
        {flag}
      </span>
      <span className="text-slate-500">{code}</span>
      <span className="ml-1">{number}</span>
    </p>
  );
};

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {label}
    </p>
    <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
  </div>
);

const VariantShell = ({ title, summary, children }: VariantProps) => (
  <section className="overflow-hidden rounded-xl border border-slate-300 bg-white">
    <header className="border-b border-slate-300 bg-slate-50 px-5 py-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{summary}</p>
    </header>
    {children}
  </section>
);

const ActionButton = ({ children }: { children: string }) => (
  <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700">
    {children}
  </button>
);

const HeaderControls = () => (
  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
    <div className="h-10 flex-1 min-w-40 rounded-md border border-slate-300 bg-white" />
    <div className="hidden gap-2 sm:flex">
      <ActionButton>Filter</ActionButton>
      <ActionButton>Sort</ActionButton>
      <ActionButton>Export</ActionButton>
      <ActionButton>⋮</ActionButton>
    </div>
    <button className="ml-auto rounded-full border border-slate-300 bg-slate-100 px-3 py-2 text-xs">
      ⋯
    </button>
  </div>
);

const TabStrip = () => (
  <div className="mb-3 flex gap-2 overflow-x-auto border-b border-slate-200 px-5 pb-3">
    {["Dashboard", "Contacts", "Merge", "Imports", "Sync"].map((tab) => (
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

const NameCell = ({ contact }: { contact: RowBadge }) => (
  <div className="flex items-center gap-2 min-w-0">
    <div className="h-8 w-8 shrink-0 rounded-full border border-slate-300 bg-slate-200" />
    <p className="truncate font-medium text-slate-900">{contact.name}</p>
  </div>
);

const ActionCell = () => <div className="justify-self-end text-right text-[11px] text-slate-500">⋯</div>;

const ListHeader = ({
  columns,
  columnClassName,
}: {
  columns: string[];
  columnClassName: string;
}) => (
  <div
    className={`grid gap-2 border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 ${columnClassName}`}
  >
    {columns.map((column) => (
      <p key={column}>{column}</p>
    ))}
  </div>
);

const ListRow = ({
  columns,
  dense = false,
  columnClassName,
}: {
  columns: ReactNode[];
  dense?: boolean;
  columnClassName: string;
}) => (
  <div
    className={`grid gap-2 border-b border-slate-200 px-3 text-slate-600 ${
      dense
        ? "py-2 text-[12px] sm:text-xs"
        : "py-3 text-sm"
    } ${columnClassName} md:items-center`}
  >
    {columns.map((col, index) => (
      <div className={index === 0 ? "min-w-0" : "truncate"} key={typeof col === "string" ? col : `col-${index}`}>
        {col}
      </div>
    ))}
  </div>
);

const defaultCols = "grid-cols-[2.3fr_1.7fr_1.2fr_1.8fr_1fr_100px]";
const compactCols = "grid-cols-[2.5fr_1.8fr_1.2fr_1.8fr_0.9fr_90px]";
const wideCols = "grid-cols-[2.2fr_1.6fr_1.2fr_1.1fr_1fr_110px]";
const threeCol = "grid-cols-[2.2fr_1.6fr_0.9fr_1.2fr_1fr_110px]";
const fiveCol = "grid-cols-[2.2fr_1.5fr_1.2fr_1fr_110px]";

type ListPanelProps = {
  dense?: boolean;
  title?: string;
  subtitle?: string;
  headingColumns?: string[];
  headingClassName?: string;
  rowClassName?: string;
  rows: RowBadge[];
  renderRow: (contact: RowBadge) => ReactNode[];
};

const ListPanel = ({
  dense = false,
  title = "Filtered list",
  subtitle = "Contacts",
  headingColumns = ["Name", "Email", "Phone", "Job title / company", "Birthday", "Actions"],
  headingClassName = defaultCols,
  rowClassName = dense ? compactCols : defaultCols,
  rows,
  renderRow,
}: ListPanelProps) => {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {title}
        </div>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">{subtitle}</h3>
      </div>
      <ListHeader columns={headingColumns} columnClassName={headingClassName} />
      <div>
        {rows.map((contact) => (
          <ListRow
            columns={renderRow(contact)}
            columnClassName={rowClassName}
            dense={dense}
            key={contact.email}
          />
        ))}
      </div>
      <div className="border-t border-slate-200 px-4 py-3">
        <p className="text-sm text-slate-600">Showing 4 of 1,248 rows</p>
      </div>
    </section>
  );
};

const StandardRow = (contact: RowBadge): ReactNode[] => [
  <NameCell contact={contact} key={`${contact.email}-name`} />,
  <p className="truncate text-slate-600" key={`${contact.email}-email`}>{contact.email}</p>,
  <PhoneCell key={`${contact.email}-phone`} value={contact.phone} />,
  <p className="truncate text-slate-600" key={`${contact.email}-job`}>{contact.jobTitleAndCompany}</p>,
  <p className="truncate text-slate-600" key={`${contact.email}-birthday`}>{contact.birthday}</p>,
  <ActionCell key={`${contact.email}-action`} />,
];

const EngagementRow = (contact: RowBadge): ReactNode[] => [
  <NameCell contact={contact} key={`${contact.email}-name`} />,
  <p className="truncate text-slate-600" key={`${contact.email}-email`}>{contact.email}</p>,
  <PhoneCell key={`${contact.email}-phone`} value={contact.phone} />,
  <p className="truncate text-slate-600" key={`${contact.email}-engagement`}>Last touched: yesterday</p>,
  <p className="truncate text-slate-500" key={`${contact.email}-priority`}>Needs review</p>,
  <ActionCell key={`${contact.email}-action`} />,
];

const TwoPrimaryRows = (contact: RowBadge): ReactNode[] => [
  <NameCell contact={contact} key={`${contact.email}-name`} />,
  <div key={`${contact.email}-primary`}>
    <p className="truncate text-slate-900">{contact.email}</p>
    <p className="mt-1 text-xs text-slate-500">{contact.jobTitleAndCompany}</p>
  </div>,
  <PhoneCell key={`${contact.email}-phone`} value={contact.phone} />,
  <p className="truncate text-slate-600" key={`${contact.email}-updated`}>Yesterday</p>,
  <ActionCell key={`${contact.email}-action`} />,
];

const VariationOne = () => (
  <div className="px-5 py-5">
    <div className="mb-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Filters</p>
          <div className="mt-3 space-y-2">
            <div className="h-9 rounded-md border border-slate-300 bg-slate-50" />
            <div className="h-9 rounded-md border border-slate-300 bg-slate-50" />
            <div className="h-9 rounded-md border border-slate-300 bg-slate-50" />
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Quick metrics
          </p>
          <div className="mt-3 space-y-2">
            <Stat value="1,248" label="Active" />
            <Stat value="42" label="Missing emails" />
          </div>
        </div>
      </aside>
      <div className="space-y-3">
        <HeaderControls />
        <TabStrip />
        <ListPanel rows={contacts} renderRow={StandardRow} />
      </div>
    </div>
  </div>
);

const VariationTwo = () => (
  <div className="px-5 py-5">
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="h-3 w-56 rounded-full bg-slate-300" />
      <div className="ml-auto flex gap-2">
        <ActionButton>Import</ActionButton>
        <ActionButton>Export</ActionButton>
        <ActionButton>Settings</ActionButton>
      </div>
    </div>
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <div className="h-12 rounded-md border border-slate-300 bg-slate-50" />
        <div className="h-12 rounded-md border border-slate-300 bg-slate-50" />
        <div className="h-12 rounded-md border border-slate-300 bg-slate-50" />
      </div>
      <TabStrip />
      <ListPanel
        dense
        rows={contacts}
        renderRow={StandardRow}
        headingColumns={["Contact", "Email", "Phone", "Title", "Birthday", "Actions"]}
      />
    </div>
  </div>
);

const VariationThree = () => (
  <div className="px-5 py-5">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-slate-50">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">Today&apos;s focus</p>
          <p className="mt-2 text-lg font-semibold">Contacts needing attention</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="h-16 rounded-md bg-slate-800" />
            <div className="h-16 rounded-md bg-slate-800" />
          </div>
        </div>
        <TabStrip />
        <ListPanel
          rows={contacts}
          renderRow={EngagementRow}
          headingColumns={["Name", "Email", "Phone", "Engagement", "Priority", "Actions"]}
          headingClassName={threeCol}
          rowClassName={threeCol}
        />
      </div>
      <aside className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Smart queue</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-md border border-slate-200 p-3">
              <div className="h-2 w-16 rounded-full bg-slate-200" />
              <div className="mt-2 h-2 w-24 rounded-full bg-slate-300" />
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="h-2 w-16 rounded-full bg-slate-200" />
              <div className="mt-2 h-2 w-24 rounded-full bg-slate-300" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bulk actions</p>
          <div className="mt-3 space-y-2">
            <ActionButton>Tag selected</ActionButton>
            <ActionButton>Assign owner</ActionButton>
            <ActionButton>Export selected</ActionButton>
          </div>
        </div>
      </aside>
    </div>
  </div>
);

const VariationFour = () => (
  <div className="px-5 py-5">
    <div className="mb-4 grid gap-4 md:grid-cols-4">
      <Stat value="1,120" label="Active" />
      <Stat value="18" label="Duplicates" />
      <Stat value="84" label="Import updates" />
      <Stat value="7" label="Waiting reply" />
    </div>
    <HeaderControls />
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white px-3 pb-3">
      <ListPanel
        rows={contacts}
        renderRow={(contact) => StandardRow(contact)}
        headingColumns={["Name", "Email", "Phone", "Title", "Birthday", "Actions"]}
        headingClassName={wideCols}
        rowClassName={wideCols}
      />
    </div>
  </div>
);

const VariationFive = () => (
  <div className="px-5 py-5">
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <TabStrip />
        <HeaderControls />
        <ListPanel
          rows={contacts}
          renderRow={TwoPrimaryRows}
          headingColumns={["Contact", "Details", "Phone", "Last edited", "Actions"]}
          headingClassName={fiveCol}
          rowClassName={fiveCol}
        />
      </div>
      <aside className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Activity stream</p>
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-slate-200 p-3">
              <div className="h-2 w-28 rounded-full bg-slate-200" />
              <div className="mt-2 h-2 w-20 rounded-full bg-slate-300" />
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="h-2 w-36 rounded-full bg-slate-200" />
              <div className="mt-2 h-2 w-24 rounded-full bg-slate-300" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Actions</p>
          <div className="mt-3 grid gap-2">
            <button className="rounded-md border border-slate-300 p-2 text-xs">Quick add from email</button>
            <button className="rounded-md border border-slate-300 p-2 text-xs">Clean duplicate tags</button>
            <button className="rounded-md border border-slate-300 p-2 text-xs">Open import audit</button>
          </div>
        </div>
      </aside>
    </div>
  </div>
);

export default function ContactsTabVariationsPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-xl border border-slate-300 bg-white p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Kontax Wireframe
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal text-slate-950">
                Contacts tab concept variants
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Five redesigned core-page mockups to compare layouts for the production
                Contacts tab.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:text-slate-900"
                href="/wireframes/contacts-tab"
              >
                Open current concept
              </Link>
              <Link
                className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:text-slate-900"
                href="/wireframes/contacts-tab-clean"
              >
                Open cleaner variant
              </Link>
            </div>
          </div>
        </header>

        <VariantShell
          title="01. Sidebar filters + list"
          summary="Keeps a familiar two-column workbench and preserves your current list table while opening space for task controls."
        >
          <VariationOne />
        </VariantShell>

        <VariantShell
          title="02. Dense operations dashboard"
          summary="Compresses vertical rhythm for high-volume usage and surfaces actions near the list."
        >
          <VariationTwo />
        </VariantShell>

        <VariantShell
          title="03. Priority lane + right rail"
          summary="Prioritizes contact queue health and includes a right rail for bulk and queue tasks."
        >
          <VariationThree />
        </VariantShell>

        <VariantShell
          title="04. Card-grid summary row"
          summary="Uses a metrics-first pattern for quick orientation before the detailed list."
        >
          <VariationFour />
        </VariantShell>

        <VariantShell
          title="05. Contacts + activity split"
          summary="Combines list productivity with contextual activity and quick utility actions."
        >
          <VariationFive />
        </VariantShell>
      </div>
    </main>
  );
}
