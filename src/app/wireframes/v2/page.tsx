import Link from "next/link";
import type { ReactNode } from "react";

type ContactRecord = {
  name: string;
  company: string;
  email: string;
  phone: string;
  tags: string;
  lastUpdated: string;
  lastContacted: string;
};

type Concept = {
  id: string;
  title: string;
  summary: string;
};

const NAV_ITEMS = [
  "All Contacts",
  "Favorites",
  "Companies",
  "Recent Contacts",
  "Tags",
  "Duplicates",
  "Imports & Exports",
  "Trash",
];

const CONTACTS: ContactRecord[] = [
  {
    name: "Jordan Lee",
    company: "Acme Studio",
    email: "jordan.lee@acme.example",
    phone: "+1 555 0102",
    tags: "Customer, Referral",
    lastUpdated: "Today",
    lastContacted: "2 hours ago",
  },
  {
    name: "Nina Patel",
    company: "Northline Co",
    email: "nina.patel@northline.co",
    phone: "+44 20 7946",
    tags: "Prospect",
    lastUpdated: "Yesterday",
    lastContacted: "3 days ago",
  },
  {
    name: "Liam O’Connor",
    company: "Blueframe",
    email: "liam@blueframe.io",
    phone: "+61 412 998",
    tags: "Partner, Supplier",
    lastUpdated: "Mar 3, 2026",
    lastContacted: "1 week ago",
  },
];

const COMPANY_RECORDS = [
  {
    name: "Acme Studio",
    website: "acme.studio",
    industry: "Design & Product",
    employees: "24",
  },
  {
    name: "Northline Co",
    website: "northline.co",
    industry: "Logistics",
    employees: "180",
  },
];

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500";

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_48px_rgba(15,23,42,0.06)]">
    {children}
  </div>
);

const ConceptSection = ({
  id,
  name,
  summary,
  children,
}: {
  id: string;
  name: string;
  summary: string;
  children: ReactNode;
}) => (
  <section id={id} className="space-y-4">
    <div className="pb-3">
      <p className={LABEL}>{id.toUpperCase()}</p>
      <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{name}</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">{summary}</p>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

const ScreenTitle = ({ title }: { title: string }) => (
  <div className="border-b border-slate-200 px-4 py-3">
    <p className={LABEL}>{title}</p>
  </div>
);

const LeftNav = ({ active }: { active: string }) => (
  <aside className="space-y-2">
    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
      <p className={LABEL}>Navigation</p>
      <div className="mt-3 space-y-2">
        {NAV_ITEMS.map((item) => (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              item === active
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
  </aside>
);

const ContactTableHeader = ({
  compact = false,
  includeScore = false,
}: {
  compact?: boolean;
  includeScore?: boolean;
}) => (
  <div className={`grid font-semibold uppercase tracking-[0.14em] text-slate-500 ${compact ? "gap-2 py-2 text-[10px]" : "gap-3 py-2 text-[11px]"}`} style={{ gridTemplateColumns: includeScore ? "32px 2fr 1.4fr 1.7fr 1.2fr 1.2fr 1fr 1.1fr" : "32px 2fr 1.4fr 1.7fr 1.1fr 1fr 1.1fr 1.0fr" }}>
      <p />
      <p>Name</p>
      <p>Company</p>
      <p>Email</p>
      <p>Phone</p>
      <p>Tags</p>
      <p>Last Updated</p>
      <p>Last Contacted</p>
      {includeScore && <p>Health</p>}
  </div>
);

const ContactRow = ({
  contact,
  compact = false,
  includeScore = false,
}: {
  contact: ContactRecord;
  compact?: boolean;
  includeScore?: boolean;
}) => (
  <div
    className={`grid border-b border-slate-200 text-slate-700 ${compact ? "gap-2 text-xs" : "gap-3 text-sm"}`}
    style={{ gridTemplateColumns: includeScore ? "32px 2fr 1.4fr 1.7fr 1.2fr 1fr 1.1fr 1fr" : "32px 2fr 1.4fr 1.7fr 1.1fr 1fr 1.1fr 1.0fr" }}
  >
    <label className="flex items-center justify-center py-3">
      <input className="h-4 w-4 rounded border-slate-400" type="checkbox" />
    </label>
    <div className="flex items-center gap-2 py-3 min-w-0">
      <div className="h-8 w-8 rounded-full border border-slate-300 bg-slate-200" />
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{contact.name}</p>
      </div>
    </div>
    <p className="truncate py-3">{contact.company}</p>
    <p className="truncate py-3">{contact.email}</p>
    <p className="py-3">{contact.phone}</p>
    <div className="py-3">
      <span className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-[11px]">
        {contact.tags}
      </span>
    </div>
    <p className="py-3 text-slate-600">{contact.lastUpdated}</p>
    <p className="py-3 text-slate-600">{contact.lastContacted}</p>
    {includeScore && (
      <p className="py-3">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">82</span>
      </p>
    )}
  </div>
);

const ContactActionsRow = () => (
  <div className="mt-3 flex flex-wrap gap-2">
    <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
      Print
    </button>
    <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
      Export
    </button>
    <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
      More actions
    </button>
  </div>
);

const ContactListA = () => (
  <Frame>
    <ScreenTitle title="Contact List View (Google-like)" />
    <div className="grid gap-4 bg-slate-50 p-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <LeftNav active="All Contacts" />
      <main className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <div className="h-10 flex-1 min-w-56 rounded-md border border-slate-300 bg-white" />
          <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Filters</button>
          <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Sort</button>
          <button className="rounded-md border border-slate-300 bg-slate-900 px-3 py-2 text-sm text-white">New</button>
        </div>
        <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Bulk actions
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded border border-slate-300 px-2 py-1 text-xs">Tag</button>
            <button className="rounded border border-slate-300 px-2 py-1 text-xs">Archive</button>
            <button className="rounded border border-slate-300 px-2 py-1 text-xs">Assign</button>
            <button className="rounded border border-slate-300 px-2 py-1 text-xs">Export</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <ContactTableHeader />
          <div className="mt-2">
            {CONTACTS.map((contact) => (
              <ContactRow key={contact.email} contact={contact} />
            ))}
          </div>
        </div>
        <ContactActionsRow />
      </main>
    </div>
  </Frame>
);

const ContactListB = () => (
  <Frame>
    <ScreenTitle title="Contact List View (CRM business context)" />
    <div className="grid gap-4 bg-slate-50 p-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <LeftNav active="Companies" />
      <main className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-100 p-3">
          <p className={LABEL}>List controls</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="h-10 flex-1 rounded-md border border-slate-300 bg-white" />
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Sort: Last Contacted</button>
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Filter by tag</button>
            <button className="rounded-md border border-slate-300 bg-slate-900 px-3 py-2 text-sm text-white">Bulk mode</button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-md border border-slate-200 p-4">
            <p className={LABEL}>Sales columns</p>
            <div className="mt-3 space-y-2 text-sm">
              <p>Owner, Stage, Owner confidence</p>
              <p>Open tasks, Next touch plan</p>
            </div>
          </div>
          <div className="rounded-md border border-slate-200 p-4">
            <p className={LABEL}>Saved views</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs">My pipeline</span>
              <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs">Dormant</span>
              <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs">Team sync</span>
            </div>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <ContactTableHeader includeScore />
          <div className="mt-2">
            {CONTACTS.map((contact) => (
              <ContactRow key={`${contact.email}-crm`} contact={contact} includeScore />
            ))}
          </div>
        </div>
        <ContactActionsRow />
      </main>
    </div>
  </Frame>
);

const ContactListC = () => (
  <Frame>
    <ScreenTitle title="Contact List View (Workspace first)" />
    <div className="space-y-3 bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className={LABEL}>Search</p>
          <div className="mt-2 h-10 rounded-md border border-slate-300 bg-white" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className={LABEL}>Command</p>
          <div className="mt-2 h-10 rounded-md border border-slate-300 bg-slate-50" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className={LABEL}>Keyboard</p>
          <div className="mt-2 h-10 rounded-md border border-slate-300 bg-slate-50" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className={LABEL}>Saved searches</p>
          <div className="mt-2 h-10 rounded-md border border-slate-300 bg-slate-50" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)_300px]">
        <LeftNav active="Recent Contacts" />
        <main className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Multi-select on</button>
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Sort</button>
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Density</button>
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Import / Export</button>
          </div>
          <div className="overflow-x-auto">
            <ContactTableHeader compact />
            <div className="mt-2">
              {CONTACTS.map((contact) => (
                <ContactRow key={`${contact.email}-ws`} contact={contact} compact />
              ))}
            </div>
          </div>
        </main>
        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className={LABEL}>Bulk command rail</p>
            <div className="mt-2 space-y-2">
              <button className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-sm">Merge selected</button>
              <button className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-sm">Send message</button>
              <button className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-sm">Export selected</button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className={LABEL}>Quick stats</p>
            <p className="mt-2 text-sm text-slate-700">1,120 total</p>
            <p className="mt-1 text-sm text-slate-700">18 duplicates</p>
          </div>
        </aside>
      </div>
    </div>
  </Frame>
);

const Tab = ({ title, active = false }: { title: string; active?: boolean }) => (
  <div
    className={`rounded-md border px-3 py-2 text-xs font-medium ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
  >
    {title}
  </div>
);

const ContactProfile = () => (
  <div className="rounded-lg border border-slate-200 bg-white">
    <ScreenTitle title="Contact Profile View" />
    <div className="px-4 py-4">
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[96px_minmax(0,1fr)]">
            <div className="h-20 w-20 rounded-full border border-slate-300 bg-slate-200" />
            <div>
              <p className="text-xl font-semibold text-slate-900">Jordan Lee</p>
              <p className="text-sm text-slate-600">Product Lead · Acme Studio</p>
              <p className="mt-1 text-sm text-slate-600">jordan.lee@acme.example</p>
              <p className="text-sm text-slate-600">+1 555 0102</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Email</button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Call</button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Message</button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Copy details</button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Share contact</button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className={LABEL}>Information</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <p>Social: LinkedIn, Twitter</p>
              <p>Website: acme.studio</p>
              <p>Address: 14 Mercer St</p>
              <p>Birthday: Apr 18</p>
            </div>
          </div>
        </div>
        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className={LABEL}>Notes</p>
            <div className="mt-2 h-24 rounded-md border border-slate-200 bg-white" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className={LABEL}>Activity</p>
            <div className="mt-2 space-y-2 text-sm text-slate-600">
              <p>Meeting · 2 hrs ago</p>
              <p>Opened profile · 1 day ago</p>
              <p>Email sent · yesterday</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className={LABEL}>Relationships</p>
            <div className="mt-2 space-y-2 text-sm text-slate-600">
              <p>Team: Alex, Priya</p>
              <p>Family: Sarah Lee</p>
              <p>Referral: Northline Co</p>
            </div>
          </div>
        </aside>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
        <Tab title="Overview" active />
        <Tab title="Notes" />
        <Tab title="Activity" />
        <Tab title="Relationships" />
        <Tab title="Files" />
      </div>
    </div>
  </div>
);

const ProfileCRM = () => (
  <div className="rounded-lg border border-slate-200 bg-white">
    <ScreenTitle title="Contact Profile View (CRM enriched)" />
    <div className="grid gap-5 p-4 xl:grid-cols-[1fr_320px]">
      <div>
        <ContactProfile />
      </div>
      <aside className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className={LABEL}>Files</p>
          <div className="mt-2 space-y-2">
            <div className="h-12 rounded border border-slate-200 bg-white" />
            <div className="h-12 rounded border border-slate-200 bg-white" />
          </div>
        </div>
      </aside>
    </div>
  </div>
);

const AddEditContact = ({ styleLabel }: { styleLabel: string }) => (
  <Frame>
    <ScreenTitle title={`Add / Edit Contact (${styleLabel})`} />
    <div className="grid gap-4 p-4 xl:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className={LABEL}>Personal Information</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
          <div className="h-10 rounded-md border border-slate-300 bg-white md:col-span-2" />
        </div>
        <p className={`mt-4 ${LABEL}`}>Communication</p>
        <div className="mt-2 space-y-2">
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className={LABEL}>Company & Addresses</p>
        <div className="mt-3 grid gap-3">
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
        </div>
        <p className={`mt-4 ${LABEL}`}>Custom Fields</p>
        <div className="mt-2 space-y-2">
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
          <div className="h-10 rounded-md border border-slate-300 bg-white" />
        </div>
      </div>
    </div>
  </Frame>
);

const CompanyView = () => (
  <Frame>
    <ScreenTitle title="Company View" />
    <div className="grid gap-4 p-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className={LABEL}>Company record</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {COMPANY_RECORDS.map((company) => (
            <div className="rounded border border-slate-200 bg-white p-3" key={company.name}>
              <p className="font-semibold text-slate-900">{company.name}</p>
              <p>Website: {company.website}</p>
              <p>Industry: {company.industry}</p>
              <p>Employees: {company.employees}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className={LABEL}>Associated contacts</p>
          <div className="mt-2 space-y-2">
            <p className="rounded border border-slate-200 bg-white p-2 text-sm">Jordan Lee</p>
            <p className="rounded border border-slate-200 bg-white p-2 text-sm">Nina Patel</p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className={LABEL}>Relationship map</p>
          <div className="mt-2 h-36 rounded border border-slate-200 bg-white" />
        </div>
      </div>
    </div>
  </Frame>
);

const SearchExperience = () => (
  <Frame>
    <ScreenTitle title="Search Experience" />
    <div className="grid gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-3">
        <p className={LABEL}>Saved searches</p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm">Top prospects</p>
          <p className="mt-1 text-sm">Team mentions</p>
          <p className="mt-1 text-sm">Missing email</p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-12 rounded-md border border-slate-300 bg-white" />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className={LABEL}>Instant results</p>
          <div className="mt-2 space-y-2">
            {CONTACTS.map((contact) => (
              <div className="rounded border border-slate-200 bg-white p-2" key={`${contact.email}-search`}>
                <p className="text-sm font-medium">{contact.name}</p>
                <p className="text-xs text-slate-500">{contact.company} · {contact.email}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className={LABEL}>Keyboard navigation</p>
          <p className="mt-2 text-sm text-slate-600">
            ↑ and ↓ select row, Enter opens contact, Esc closes results.
          </p>
        </div>
      </div>
    </div>
  </Frame>
);

const ImportExport = () => (
  <Frame>
    <ScreenTitle title="Import & Export" />
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className={LABEL}>Import</p>
          <div className="mt-3 space-y-2">
            <button className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm">
              CSV
            </button>
            <button className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm">
              Google Contacts
            </button>
            <button className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm">
              Outlook
            </button>
            <button className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm">
              vCard
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className={LABEL}>Mapping screen</p>
          <div className="mt-2 h-36 rounded border border-slate-200 bg-white" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className={LABEL}>Export</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">CSV</button>
            <button className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">vCard</button>
            <button className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">JSON</button>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className={LABEL}>Import history</p>
          <div className="mt-2 space-y-2 text-sm text-slate-600">
            <p>March 6 10:41 — CSV import finished</p>
            <p>March 3 09:12 — vCard import completed</p>
            <p>Duplicate checks: 42 flagged</p>
          </div>
        </div>
      </div>
    </div>
  </Frame>
);

const DuplicateManagement = () => (
  <Frame>
    <ScreenTitle title="Duplicate Management" />
    <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1fr]">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className={LABEL}>Potential duplicates</p>
        <div className="mt-3 space-y-3">
          <div className="rounded border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold">Jordan Lee</p>
            <p className="text-xs text-slate-500">jordan.lee@acme.example</p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold">Jordan Lee</p>
            <p className="text-xs text-slate-500">J. Lee · acme-studio.com</p>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className={LABEL}>Side-by-side compare</p>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white p-2">
              <p className="font-medium text-slate-900">Record A</p>
              <p>Jordan Lee</p>
              <p>Jordan</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-2">
              <p className="font-medium text-slate-900">Record B</p>
              <p>J. Lee</p>
              <p>Product Lead</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Merge</button>
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Ignore</button>
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">Review later</button>
          </div>
        </div>
      </div>
    </div>
  </Frame>
);

const Advanced = ({
  concept,
}: {
  concept: "familiar" | "professional" | "workspace";
}) => (
  <Frame>
    <ScreenTitle title="Advanced: optional wireframe studies" />
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className={LABEL}>Relationship graph</p>
        <div className="mt-2 h-36 rounded border border-slate-200 bg-white">
          <p className="p-2 text-xs text-slate-500">
            {concept === "familiar" ? "Simple node-map view" : concept === "professional" ? "Team + external graph" : "Real-time connector graph"}
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className={LABEL}>Timeline view</p>
        <div className="mt-2 h-36 rounded border border-slate-200 bg-white" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className={LABEL}>Contact health</p>
        <div className="mt-2 space-y-2 text-sm text-slate-600">
          <p>Missing country code</p>
          <p>Missing last name</p>
          <p>Duplicate likelihood score</p>
        </div>
      </div>
    </div>
  </Frame>
);

const ConceptA = () => (
  <>
    <ContactListA />
    <ContactProfile />
    <AddEditContact styleLabel="familiar" />
    <CompanyView />
    <SearchExperience />
    <ImportExport />
    <DuplicateManagement />
    <Advanced concept="familiar" />
  </>
);

const ConceptB = () => (
  <>
    <ContactListB />
    <ProfileCRM />
    <AddEditContact styleLabel="professional" />
    <CompanyView />
    <SearchExperience />
    <ImportExport />
    <DuplicateManagement />
    <Advanced concept="professional" />
  </>
);

const ConceptC = () => (
  <>
    <ContactListC />
    <ContactProfile />
    <AddEditContact styleLabel="workspace" />
    <CompanyView />
    <SearchExperience />
    <ImportExport />
    <DuplicateManagement />
    <Advanced concept="workspace" />
  </>
);

const concepts: Concept[] = [
  {
    id: "concept-a",
    title: "Concept A — Familiar",
    summary:
      "Google-inspired adoption first: familiar interactions, visible controls, and quick scanning for personal users.",
  },
  {
    id: "concept-b",
    title: "Concept B — Professional CRM Lite",
    summary:
      "Business-first flows with richer company context, relationship context, and operational contact signals.",
  },
  {
    id: "concept-c",
    title: "Concept C — Modern Workspace",
    summary:
      "Productivity focused surface for power users with command-line search, fast actions, and dense list operations.",
  },
];

const renderConcept = (id: string) => {
  switch (id) {
    case "concept-a":
      return <ConceptA />;
    case "concept-b":
      return <ConceptB />;
    case "concept-c":
      return <ConceptC />;
    default:
      return null;
  }
};

export default function ContactWireframesV2Page() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-xl border border-slate-300 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={LABEL}>Kontax Wireframe · V2</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
                Contact Management Platform Wireframe Set
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Three concept variations focusing on list-first contact workflows.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:text-slate-900"
                href="/"
              >
                Back to app
              </Link>
              <Link
                className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:text-slate-900"
                href="/wireframes/logged-in-home"
              >
                Dashboard wireframes
              </Link>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            {concepts.map((concept) => (
              <Link
                className="rounded-full border border-slate-300 px-4 py-2 text-sm hover:border-slate-500"
                href={`#${concept.id}`}
                key={concept.id}
              >
                {concept.title}
              </Link>
            ))}
          </div>
        </header>
        <div className="space-y-10">
          {concepts.map((concept) => (
            <ConceptSection
              id={concept.id}
              key={concept.id}
              name={concept.title}
              summary={concept.summary}
            >
              {renderConcept(concept.id)}
            </ConceptSection>
          ))}
        </div>
      </div>
    </main>
  );
}
