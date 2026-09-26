import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { isMicrosoftSyncEnabled } from "~/lib/microsoft-sync-flag";
import {
  ArrowIcon,
  CheckIcon,
  CtaBand,
  MktLabel,
  MktWindow,
  PageHead,
  SectionHead,
  SourceTag,
} from "../_components/mkt-ui";
import "./features.css";

export const metadata: Metadata = {
  title: "Features — Kontax",
  description:
    "Grouped search, labels, multi-provider sync, family and team shared books, public contact cards, and a developer REST API.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Features",
    description:
      "Grouped search, labels, multi-provider sync, family and team shared books, public contact cards, and a developer REST API.",
    url: "/features",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=features", width: 1200, height: 630, alt: "Kontax — Everything your contacts need" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Features — Kontax",
    description:
      "Grouped search, labels, multi-provider sync, family and team shared books, public contact cards, and a developer REST API.",
  },
};

// P50-05 · /features in Direction A. Not designed in the prototype, so it
// follows the homepage's feature rows (5/7 grid, alternating, product
// windows) and secondary grid (P50-03 `.hp-frow` / `.hp-sgrid`), with the
// page's own copy unchanged. Styles: features.css (fp- prefix).

function FeatureRow({
  n,
  label,
  title,
  flip = false,
  id,
  media,
  children,
}: {
  n: string;
  label: string;
  title: string;
  flip?: boolean;
  id?: string;
  media: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`fp-frow${flip ? " fp-frow--flip" : ""}`} id={id}>
      <div className="fp-frow__text">
        <MktLabel n={n}>{label}</MktLabel>
        <h2 className="fp-frow__title">{title}</h2>
        {children}
      </div>
      <div className="fp-frow__media">{media}</div>
    </div>
  );
}

function Synced({ when }: { when: string }) {
  return (
    <span className="fp-ok">
      <CheckIcon size={13} />
      <span className="fp-vmono">{when}</span>
    </span>
  );
}

// Secondary grid icons (inline, decorative — the h3 beside each carries it).
const GRID_ICONS = {
  merge: <path d="M6 4v5a4 4 0 0 0 4 4h8M6 20v-5M15 9l4 4-4 4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h8l4.5 4.5v12a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5zM14 3.5V8h4.5" />
      <path d="M9 13h6M9 16.5h4" />
    </>
  ),
  tidy: <path d="M4 7h16M4 12h10M4 17h6M16 15l2 2 4-4" />,
  list: (
    <>
      <path d="M4 5h16l-6 7v6l-4 2v-8z" />
    </>
  ),
  device: (
    <>
      <rect x="6.5" y="3" width="11" height="18" rx="2.5" />
      <path d="M10.5 18h3" />
    </>
  ),
} as const;

// Secondary grid: short lines already verified elsewhere on the site (the
// homepage feature showcase and how-it-works, P49/P50-03, and the help
// centre FAQ) for things the rows above don't cover. No new claims.
const MORE: { icon: keyof typeof GRID_ICONS; title: string; body: string }[] = [
  {
    icon: "merge",
    title: "Duplicates, found and fixed",
    body: "Spots the same person saved twice across your accounts and lets you pick what to keep.",
  },
  { icon: "clock", title: "Change history", body: "See what changed on each contact, when, and from where." },
  { icon: "file", title: "Open export format", body: "A documented format that keeps labels, notes and history." },
  {
    icon: "tidy",
    title: "Tidy by default",
    body: "Phone numbers formatted for their country, names sorted properly in any script.",
  },
  {
    icon: "list",
    title: "Smart lists",
    body: "Save a combination of search, label and book filters, and recall it with one click.",
  },
  {
    icon: "device",
    title: "No app to install",
    body: "On iPhone and Mac, Kontax appears in the Contacts app you already use.",
  },
];

export default function FeaturesPage() {
  // P50A-01: Outlook is only shown once Microsoft sync is configured on this
  // deployment (see ~/lib/microsoft-sync-flag). This page has no dynamic API,
  // so it's statically prerendered — see that helper's doc comment for why a
  // build-time read is correct here rather than making the page dynamic.
  const outlookLive = isMicrosoftSyncEnabled();

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Features", path: "/features" },
        ])}
      />

      <PageHead
        label="Every feature, up close"
        title="Everything your address book has been missing"
        lede="From search to sync to sharing — Kontax keeps your contacts organised, backed up, and always up to date."
      />

      <section className="fp-rows" aria-label="Features">
        <div className="mkt-container">
          {/* ── 01 Search ── */}
          <FeatureRow
            n="01"
            label="Search"
            title="Search that actually works"
            media={
              <MktWindow bar="Contacts · Search">
                <div className="fp-search">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.2-3.2" />
                  </svg>
                  <span>jam</span>
                  <span className="fp-search__cursor" />
                </div>
                <p className="fp-v-label">Name</p>
                <div className="fp-vrow fp-vrow--on">
                  <span className="fp-av fp-av-e">JW</span>
                  <div className="fp-vrow__main">
                    <div className="fp-vname"><mark className="fp-hl">Jam</mark>es Whitfield</div>
                    <div className="fp-vsub">Mobile · Work</div>
                  </div>
                  <SourceTag>Google</SourceTag>
                </div>
                <div className="fp-vrow">
                  <span className="fp-av fp-av-a">JC</span>
                  <div className="fp-vrow__main">
                    <div className="fp-vname"><mark className="fp-hl">Jam</mark>ie Cole</div>
                    <div className="fp-vsub">Family</div>
                  </div>
                  <SourceTag>iCloud</SourceTag>
                </div>
                <p className="fp-v-label fp-v-label--gap">Email</p>
                <div className="fp-vrow">
                  <span className="fp-av fp-av-c">RP</span>
                  <div className="fp-vrow__main">
                    <div className="fp-vname">Rosa Pérez</div>
                    <div className="fp-vsub">rosa.<mark className="fp-hl">jam</mark>@studio.co</div>
                  </div>
                  <SourceTag>Fastmail</SourceTag>
                </div>
              </MktWindow>
            }
          >
            <p className="fp-frow__body">
              Type a name, phone number, email, company, label, or note —
              Kontax finds it instantly. Results are grouped by match type so
              you see exactly why a contact appeared. No more scrolling past
              irrelevant results or wondering if you spelled the name right.
            </p>
          </FeatureRow>

          {/* ── 02 Labels ── */}
          <FeatureRow
            flip
            n="02"
            label="Labels"
            title="Labels that organise, not just tag"
            media={
              <MktWindow bar="Contacts · Family">
                <div className="fp-chips">
                  <span className="fp-chip">All</span>
                  <span className="fp-chip fp-chip--on">Family</span>
                  <span className="fp-chip">Work</span>
                  <span className="fp-chip">Clients</span>
                </div>
                {(
                  [
                    { initials: "EM", av: "fp-av-e", name: "Elena Morales", labels: ["family", "vip"] },
                    { initials: "DK", av: "fp-av-a", name: "David Kaur", labels: ["family"] },
                    { initials: "TN", av: "fp-av-d", name: "Theo Nakamura", labels: ["family", "work"] },
                    { initials: "SA", av: "fp-av-b", name: "Sofia Andersson", labels: ["family"] },
                  ] as { initials: string; av: string; name: string; labels: string[] }[]
                ).map(({ initials, av, name, labels }) => (
                  <div key={name} className="fp-vrow">
                    <span className={`fp-av ${av}`}>{initials}</span>
                    <div className="fp-vrow__main">
                      <div className="fp-vname">{name}</div>
                    </div>
                    <span className="fp-badges">
                      {labels.includes("family") && <span className="fp-lbl fp-lbl--family">Family</span>}
                      {labels.includes("work") && <span className="fp-lbl fp-lbl--work">Work</span>}
                      {labels.includes("vip") && <span className="fp-lbl fp-lbl--vip">VIP</span>}
                    </span>
                  </div>
                ))}
              </MktWindow>
            }
          >
            <p className="fp-frow__body">
              Group contacts by anything that matters — family, clients, the
              five-a-side team — and filter your whole address book down to them
              in a tap. Labels stack, so one person can be both Work and VIP at
              once. Colour-coded badges keep every list scannable at a glance.
            </p>
          </FeatureRow>

          {/* ── 03 Sync ── */}
          <FeatureRow
            n="03"
            label="Sync"
            title="One address book, every device"
            media={
              <MktWindow bar="Settings · Sync">
                <p className="fp-v-label">Connections</p>
                <div className="fp-vrow">
                  <span className="fp-glyph">G</span>
                  <div className="fp-vrow__main">
                    <div className="fp-vname">Google Contacts</div>
                    <div className="fp-vsub">elena@gmail.com · 1,204 contacts</div>
                  </div>
                  <Synced when="Synced 2m ago" />
                </div>
                <div className="fp-vrow">
                  <span className="fp-glyph">F</span>
                  <div className="fp-vrow__main">
                    <div className="fp-vname">Fastmail</div>
                    <div className="fp-vsub">CardDAV · carddav.fastmail.com</div>
                  </div>
                  <Synced when="Synced 6m ago" />
                </div>
                {outlookLive ? (
                  <div className="fp-vrow">
                    <span className="fp-glyph">O</span>
                    <div className="fp-vrow__main">
                      <div className="fp-vname">Outlook</div>
                      <div className="fp-vsub">elena@outlook.com · 318 contacts</div>
                    </div>
                    <span className="fp-busy">
                      <i />
                      <span className="fp-vmono">Syncing…</span>
                    </span>
                  </div>
                ) : (
                  <div className="fp-vrow">
                    <span className="fp-glyph">iC</span>
                    <div className="fp-vrow__main">
                      <div className="fp-vname">iCloud</div>
                      <div className="fp-vsub">CardDAV · contacts.icloud.com</div>
                    </div>
                    <Synced when="Synced 4m ago" />
                  </div>
                )}
              </MktWindow>
            }
          >
            <p className="fp-frow__body">
              Connect Google Contacts{outlookLive ? ", Outlook," : ""} and any CardDAV account —
              iCloud, Fastmail, Nextcloud — and Kontax keeps them all in step.
              Edits sync both ways on a schedule, with a clear status on every
              connection so you always know what&apos;s current. One address
              book, mirrored everywhere you already work.
            </p>
          </FeatureRow>

          {/* ── 04 Sharing ── */}
          <FeatureRow
            flip
            n="04"
            label="Sharing"
            title="Share with family or your team"
            media={
              <MktWindow bar="Books · Morales Family">
                <div className="fp-book-h">
                  <span className="fp-glyph fp-glyph--tint">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19V6a2 2 0 0 1 2-2h9l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                    </svg>
                  </span>
                  <div className="fp-vrow__main">
                    <div className="fp-vname">Morales Family</div>
                    <div className="fp-vsub">3 members · 248 shared contacts</div>
                  </div>
                </div>
                {(
                  [
                    { initials: "EM", av: "fp-av-e", name: "Elena Morales", email: "elena@gmail.com", role: "owner" },
                    { initials: "DK", av: "fp-av-a", name: "David Kaur", email: "david.kaur@gmail.com", role: "editor" },
                    { initials: "TN", av: "fp-av-d", name: "Theo Nakamura", email: "theo.n@icloud.com", role: "viewer" },
                  ] as const
                ).map(({ initials, av, name, email, role }) => (
                  <div key={name} className="fp-vrow">
                    <span className={`fp-av ${av}`}>{initials}</span>
                    <div className="fp-vrow__main">
                      <div className="fp-vname">{name}</div>
                      <div className="fp-vsub">{email}</div>
                    </div>
                    <span className={`fp-role fp-role--${role}`}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                  </div>
                ))}
              </MktWindow>
            }
          >
            <p className="fp-frow__body">
              Invite the people you trust into a shared address book and
              everyone sees the same up-to-date contacts. Assign roles — owner,
              editor, or viewer — so you control who can change what. Updates
              appear live, so when one person fixes a number, it&apos;s fixed
              for everyone.
            </p>
          </FeatureRow>

          {/* ── 05 Public card ── */}
          <FeatureRow
            n="05"
            label="Public card"
            title="Your public contact card"
            id="public-card"
            media={
              <MktWindow bar="Public card" className="fp-win--stone">
                <div className="fp-card">
                  <div className="fp-card__photo">LP</div>
                  <p className="fp-card__nm">Lena Park</p>
                  <p className="fp-card__role">Product Designer · Studio North</p>
                  <div className="fp-card__fields">
                    <div className="fp-card__f">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
                      </svg>
                      +44 7700 900421
                    </div>
                    <div className="fp-card__f">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m4 7 8 6 8-6" />
                      </svg>
                      lena@studionorth.co
                    </div>
                    <div className="fp-card__f">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                      </svg>
                      studionorth.co
                    </div>
                  </div>
                  <div className="fp-card__btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add to contacts
                  </div>
                </div>
              </MktWindow>
            }
          >
            <p className="fp-frow__body">
              Give out one short link instead of reciting your details. Your
              public card shows exactly the fields you choose, and anyone can
              save you to their phone with a single tap — no app required.
              Update your number once and every card you&apos;ve ever shared
              updates with it.
            </p>
            {/* P49A-15: /u/demo doesn't exist (no seeded demo user, and we're
                not creating one). The static mock card is right here in this
                section already, so point the link at it instead of a 404. */}
            <Link className="mkt-more fp-frow__link" href="/features#public-card">
              See an example
              <ArrowIcon />
            </Link>
          </FeatureRow>

          {/* ── 06 Developer API ── */}
          <FeatureRow
            flip
            n="06"
            label="Developer API"
            title="A developer API built for automation"
            media={
              <MktWindow bar="bash — api.getkontax.com">
                <div className="fp-code">
                  <div>
                    <span className="fp-code__prompt">$ </span>curl{" "}
                    <span className="fp-code__flag">-H</span>{" "}
                    <span className="fp-code__str">&quot;Authorization: Bearer kt_live_xxx&quot;</span> \
                  </div>
                  <div className="fp-code__indent">
                    <span className="fp-code__url">https://api.getkontax.com/v1/contacts</span>
                  </div>
                  <div className="fp-code__out">
                    <div>
                      {"{ "}<span className="fp-code__key">&quot;data&quot;</span>: [
                    </div>
                    <div className="fp-code__indent">
                      {"{ "}<span className="fp-code__key">&quot;id&quot;</span>:{" "}
                      <span className="fp-code__str">&quot;ct_8f21&quot;</span>,{" "}
                      <span className="fp-code__key">&quot;name&quot;</span>:{" "}
                      <span className="fp-code__str">&quot;Elena Morales&quot;</span>,{" "}
                      <span className="fp-code__key">&quot;labels&quot;</span>: [
                      <span className="fp-code__str">&quot;Family&quot;</span>,{" "}
                      <span className="fp-code__str">&quot;VIP&quot;</span>]{" }"},
                    </div>
                    <div className="fp-code__indent">
                      {"{ "}<span className="fp-code__key">&quot;id&quot;</span>:{" "}
                      <span className="fp-code__str">&quot;ct_8f33&quot;</span>,{" "}
                      <span className="fp-code__key">&quot;name&quot;</span>:{" "}
                      <span className="fp-code__str">&quot;David Kaur&quot;</span>{" }"}
                    </div>
                    <div>
                      {"], "}<span className="fp-code__key">&quot;has_more&quot;</span>:{" "}
                      <span className="fp-code__flag">false</span>{" }"}
                    </div>
                  </div>
                </div>
              </MktWindow>
            }
          >
            <p className="fp-frow__body">
              Every contact, label, and address book is available through a
              clean REST API. Authenticate with a scoped key, then read or write
              contacts straight from your own tools, scripts, and integrations.
              Rate limits are generous and every response is plain JSON.
            </p>
            <Link className="mkt-more fp-frow__link" href="/developers">
              Read the API docs
              <ArrowIcon />
            </Link>
          </FeatureRow>
        </div>
      </section>

      {/* ── Secondary grid ── */}
      <section className="mkt-band" aria-labelledby="fp-more-title">
        <div className="mkt-container">
          <SectionHead
            n="07"
            label="And the rest"
            title="The details that keep it tidy"
            id="fp-more-title"
          />
          <div className="fp-sgrid">
            {MORE.map((item) => (
              <div className="fp-sitem" key={item.title}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  {GRID_ICONS[item.icon]}
                </svg>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Ready to tidy your address book?"
        sub="Free forever for up to 500 contacts. Upgrade whenever you’re ready."
      />
    </>
  );
}
