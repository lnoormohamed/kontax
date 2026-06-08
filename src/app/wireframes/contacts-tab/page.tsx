import Link from "next/link";

type RowBadge = {
  name: string;
  email: string;
  phone: string;
  jobTitleAndCompany: string;
  birthday: string;
};

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

const tabs = ["Dashboard", "Contacts", "Merge", "Imports", "Sync"];

const Label = ({ children }: { children: string }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{children}</p>
);

const Metric = ({ labelText, value }: { labelText: string; value: string }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <Label>{labelText}</Label>
    <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
  </div>
);

const PillButton = ({ children, active = false }: { children: string; active?: boolean }) => (
  <div
    className={`rounded-full border px-4 py-2 text-sm font-medium ${
      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
    }`}
  >
    {children}
  </div>
);

const HeaderActionButton = ({ ariaLabel, icon, title }: { ariaLabel: string; icon: string; title: string }) => (
  <button
    aria-label={ariaLabel}
    className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    title={title}
    type="button"
  >
    {icon}
  </button>
);

const ContactRow = ({ contact }: { contact: RowBadge }) => (
  <div className="group grid gap-4 border-b border-slate-200 px-3 py-3 text-sm md:grid-cols-[minmax(220px,2fr)_minmax(220px,1.4fr)_minmax(150px,0.95fr)_minmax(260px,1.5fr)_minmax(120px,0.85fr)_110px] md:items-center">
    <div className="flex items-center gap-3 min-w-0">
      <div className="group relative h-10 w-10 shrink-0 rounded-full border border-slate-300 bg-slate-200">
        <div className="absolute inset-0 z-10 grid place-items-center rounded-full bg-white/90 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <input
            aria-label={`Select ${contact.name}`}
            className="h-4 w-4 rounded border-slate-400"
            type="checkbox"
          />
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{contact.name}</p>
      </div>
    </div>
    <p className="truncate text-slate-600">{contact.email}</p>
    <PhoneCell value={contact.phone} />
    <p className="truncate text-slate-600">{contact.jobTitleAndCompany}</p>
    <p className="truncate text-slate-600">{contact.birthday}</p>
    <div className="pointer-events-none flex justify-end gap-2 justify-self-end opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto">
      <button
        className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        title="Favourite"
        type="button"
      >
        ☆
      </button>
      <button
        className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        title="Edit"
        type="button"
      >
        ✎
      </button>
      <button
        className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        title="More actions"
        type="button"
      >
        ⋯
      </button>
    </div>
  </div>
);

const ContactListPanel = ({ items }: { items: RowBadge[] }) => (
  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
      <div>
        <Label>Filtered list</Label>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Contacts</h2>
      </div>
      <div className="flex gap-2">
        <HeaderActionButton ariaLabel="Print" icon="🖨" title="Print" />
        <HeaderActionButton ariaLabel="Export" icon="⤓" title="Export" />
        <HeaderActionButton
          ariaLabel="More actions"
          icon="⋮"
          title="More actions: display density, change column order"
        />
      </div>
    </header>

    <div className="overflow-x-auto px-3 pt-3">
      <div className="grid">
        <div className="grid gap-4 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 md:grid-cols-[minmax(220px,2fr)_minmax(220px,1.4fr)_minmax(150px,0.95fr)_minmax(260px,1.5fr)_minmax(120px,0.85fr)_110px]">
          <p className="text-left">Name</p>
          <p className="text-left">Email</p>
          <p className="text-left">Phone number</p>
          <p className="text-left">Job title and company</p>
          <p className="text-left">Birthday</p>
          <p className="text-right">Actions</p>
        </div>
        <div className="mt-1 space-y-2">
          {items.map((item) => (
            <ContactRow contact={item} key={item.email} />
          ))}
        </div>
      </div>
    </div>

    <div className="border-t border-slate-200 px-4 py-3">
      <p className="text-sm text-slate-600">Showing 4 of 1,248 rows</p>
    </div>
  </section>
);

const FilterBar = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <Label>Filter and sort</Label>
    <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
      <div className="h-10 rounded-md border border-slate-300 bg-slate-50" />
      <div className="h-10 rounded-md border border-slate-300 bg-slate-50" />
      <div className="h-10 rounded-md border border-slate-300 bg-slate-50" />
      <div className="h-10 rounded-md border border-slate-300 bg-slate-900" />
    </div>
  </div>
);

export default function ContactsTabWireframePage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Kontax Wireframe
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Contacts tab concept
              </h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                A practical contacts tab with strong scanability: filters first, list next, and quality signals
                surfaced in parallel.
              </p>
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
              href="/wireframes/logged-in-home"
            >
              Back to dashboard wireframes
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
              href="/wireframes/contacts-tab-clean"
            >
              Open cleaner tabbed version
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
              href="/wireframes/header"
            >
              Open header wireframe
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
              href="/wireframes/contacts-tab-variations"
            >
              See 5 redesigned contacts tabs
            </Link>
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 py-1">
          {tabs.map((tab) => (
            <PillButton active={tab === "Contacts"} key={tab}>
              {tab}
            </PillButton>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric labelText="Active" value="1,120" />
          <Metric labelText="Archived" value="128" />
          <Metric labelText="Potential Duplicates" value="18" />
          <Metric labelText="Import Gaps" value="42" />
        </div>

        <div className="grid gap-6">
          <div className="space-y-4">
            <FilterBar />
            <ContactListPanel
              items={[
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
              ]}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
