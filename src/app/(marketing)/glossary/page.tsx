import type { Metadata } from "next";

import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { webPageSchema } from "../_components/page-schema";
import { SectionHead } from "../_components/mkt-ui";
import "../_components/content-page.css";

// P50A-07 · Glossary. Terms and facts verified against:
// - CardDAV / vCard / two-way sync: src/server/carddav.ts, src/server/dav/vcard.mjs,
//   the .well-known/carddav redirect (src/app/.well-known/carddav/route.ts).
// - JSContact / the export format: src/app/developers/page.tsx (#export-format),
//   src/server/export-format/constants.ts (RFC 9553, vendor namespace getkontax.com:).
// - App password: src/app/settings/data/devices/page.tsx, src/server/app-passwords.ts.
// - Sync token: src/server/sync-runner.ts, src/server/google-sync.ts (internal
//   delta cursor for pulling provider changes — described generically, no
//   protocol-level claim beyond what's verified there).
// - Address book / book / label: src/server/family-access.ts, src/server/team-access.ts,
//   src/app/_components/label-chip.tsx and the API field reference in
//   src/app/developers/page.tsx (bookId, labels).
// - Public card: src/app/u/[username]/page.tsx.

const TITLE = "Glossary — CardDAV, vCard and contact-sync terms | Kontax";
const DESCRIPTION =
  "Plain-English definitions for the standards and terms Kontax uses: CardDAV, vCard, JSContact, sync tokens, app passwords, address books, labels and more.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/glossary" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/glossary", siteName: "Kontax", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

type Term = { id: string; term: string; body: React.ReactNode };

const TERMS: Term[] = [
  {
    id: "carddav",
    term: "CardDAV",
    body: (
      <>
        <p>
          CardDAV is an open, standard protocol for storing and syncing address books over the
          web — an extension of WebDAV, specifically for contacts. Any app or device that speaks
          CardDAV (the Contacts app on iPhone and Mac, most desktop and Android contact apps) can
          add an account and get two-way sync without needing a dedicated app for that service.
        </p>
        <p>
          Kontax runs its own CardDAV server, so any CardDAV-compatible device can connect
          directly and see your Kontax contacts as a native contacts account. Kontax also connects
          out to other CardDAV servers — iCloud, Fastmail, or any other provider that supports it —
          as a sync source.
        </p>
      </>
    ),
  },
  {
    id: "vcard",
    term: "vCard",
    body: (
      <>
        <p>
          vCard is the standard file format for a single contact&rsquo;s details — name, phone numbers,
          email addresses, company, birthday and so on — used across the address-book world for
          decades. It&rsquo;s the format CardDAV carries under the hood, and the format most contact
          apps use to import and export.
        </p>
        <p>
          Kontax uses vCard for CardDAV sync and includes a vCard-compatible copy in its export
          archive, for tools that can only read vCard. The richer, documented Kontax export
          format is based on JSContact instead, with a defined mapping down to vCard for anything
          that has no vCard equivalent.
        </p>
      </>
    ),
  },
  {
    id: "jscontact",
    term: "JSContact",
    body: (
      <>
        <p>
          JSContact (RFC 9553) is a newer, JSON-based standard for representing contact data,
          designed to be simpler for modern software to read and write than vCard&rsquo;s older
          text format. It covers the same kind of information as vCard — names, emails, phones,
          addresses, dates — in a structure that maps naturally onto JSON.
        </p>
        <p>
          Kontax&rsquo;s documented export format (the Kontax Contact Export Format) is built on
          JSContact: each exported contact is a JSContact Card, with Kontax-specific additions
          kept under a separate vendor namespace, so a generic JSContact reader that ignores
          properties it doesn&rsquo;t recognise still gets back a usable, mostly complete contact.
        </p>
      </>
    ),
  },
  {
    id: "sync-token",
    term: "Sync token",
    body: (
      <p>
        A sync token is a marker that a sync client and server use to identify a specific point in
        time, so a later sync can ask for only what changed since then instead of re-downloading
        everything. Kontax&rsquo;s sync engine uses tokens like this internally when pulling changes
        from a connected provider — Google, iCloud or Fastmail — so a routine sync moves only the
        difference, not your whole address book, every time it runs.
      </p>
    ),
  },
  {
    id: "app-password",
    term: "App password",
    body: (
      <p>
        An app password is a separate password generated for one device or connection, used
        instead of your main Kontax account password. Kontax uses them for CardDAV connections —
        adding your phone or computer as a contacts account — so each device can be revoked on its
        own from Settings. Losing a phone means revoking that one app password, not changing the
        password every other device uses to sign in.
      </p>
    ),
  },
  {
    id: "two-way-sync",
    term: "Two-way sync",
    body: (
      <p>
        Two-way sync means changes flow in both directions: edit a contact on your phone and it
        updates in Kontax; edit it in Kontax and the change reaches the connected device or
        provider too. That&rsquo;s different from a one-way import or export, where data only ever
        travels in a single direction and the two copies can drift apart.
      </p>
    ),
  },
  {
    id: "address-book",
    term: "Address book / book",
    body: (
      <>
        <p>
          An address book — Kontax usually just says &ldquo;book&rdquo; — is a distinct collection of
          contacts. Every account has a personal book by default. Family and Teams plans add
          shared books that more than one person can access, sitting alongside each member&rsquo;s own
          personal book rather than replacing it.
        </p>
        <p>
          A book is the unit contacts are organised into. It&rsquo;s a different idea from a label
          (below), which tags contacts for filtering without moving them into a separate
          collection.
        </p>
      </>
    ),
  },
  {
    id: "label",
    term: "Label",
    body: (
      <p>
        A label is a tag you attach to a contact — for example &ldquo;Clients&rdquo; or &ldquo;Newsletter&rdquo; — to
        group and filter contacts that don&rsquo;t otherwise belong together in one address book. A
        contact can carry more than one label at once. Labels are personal organisation on top of
        a book; renaming or deleting a label doesn&rsquo;t move contacts between books.
      </p>
    ),
  },
  {
    id: "public-card",
    term: "Public card",
    body: (
      <p>
        A public card is a shareable web page for one contact — often yourself — at a URL such as
        getkontax.com/u/username, so someone can add those details to their own contacts in a
        single tap without needing a Kontax account. It&rsquo;s opt-in: nothing about your account is
        public unless you choose a username and share that link.
      </p>
    ),
  },
];

export default function GlossaryPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Glossary", path: "/glossary" },
          ]),
          webPageSchema({ name: TITLE, description: DESCRIPTION, path: "/glossary" }),
        ]}
      />

      <section className="mkt-band">
        <div className="mkt-container">
          <SectionHead
            headingLevel={1}
            label="Glossary"
            title="The standards and terms behind Kontax"
            lede="Kontax is built on open, documented standards rather than a closed, proprietary
              format. Here&rsquo;s what the terms you&rsquo;ll see across the site actually mean."
          />

          <nav aria-label="Terms on this page" style={{ marginTop: 40 }}>
            <ul className="cp-jump">
              {TERMS.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`}>{t.term}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div style={{ marginTop: 24 }}>
            {TERMS.map((t) => (
              <section key={t.id} id={t.id} className="cp-term">
                <h2 className="cp-term__title">{t.term}</h2>
                {t.body}
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
