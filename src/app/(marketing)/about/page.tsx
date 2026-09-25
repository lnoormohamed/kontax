import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema, organizationSchema } from "~/app/_components/json-ld";
import { webPageSchema } from "../_components/page-schema";
import "../_components/doc.css";

// P50A-07 · About rewrite (E-E-A-T). Every claim below is checked against the
// code: sync providers and CardDAV (src/app/(marketing)/page.tsx worksWith()),
// duplicate merge + 30-day undo (src/server/contact-merge.ts), per-contact
// history (src/server/dav/plan-entitlements.mjs), Family/Teams books, roles
// and audit log (src/server/family-access.ts, src/server/team-access.ts,
// src/server/team-audit.ts), the developer API and open export format
// (src/app/developers/page.tsx, src/server/export-format/constants.ts), 2FA
// and app passwords (src/app/settings/data/devices/page.tsx), encrypted sync
// credentials and export/delete (src/app/(marketing)/security/page.tsx,
// src/app/(marketing)/privacy/page.tsx), and the company name / governing law
// (src/app/(marketing)/terms/page.tsx, src/app/(marketing)/privacy/page.tsx —
// both say "Vexon", not "Vexon Group", and privacy's registered address is an
// unfilled placeholder, so neither is stated here). No team size, founding
// date, user numbers or funding are stated anywhere below because none of
// them are documented in the codebase.
//
// Owner to approve: the copy below is a full rewrite, not a copyedit.

const TITLE = "About — Kontax";
const DESCRIPTION =
  "What Kontax does today, the open standards it's built on, and who makes it — Vexon, based in the UK.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Kontax",
    description: DESCRIPTION,
    url: "/about",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=about", width: 1200, height: 630, alt: "About Kontax" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          webPageSchema({ name: TITLE, description: DESCRIPTION, path: "/about" }),
        ]}
      />
      <div className="doc-wrap">
        <h1 className="doc-title">About Kontax</h1>

        {/* Owner to approve: page copy below. */}
        <div className="doc-body" style={{ marginTop: "32px" }}>
          <p>
            Kontax is a contacts manager. It keeps your address book in step across iCloud,
            Google Contacts and Fastmail — and any other CardDAV server — and shows up inside the
            Contacts app you already use on iPhone and Mac, without a separate app to install.
          </p>

          <h2>Why we built it</h2>
          <p>
            Contacts end up scattered the moment you use more than one ecosystem: a number saved
            on iCloud doesn&rsquo;t show up when you&rsquo;re signed in with Google, and vice
            versa. Sharing a single address book with a household or a team isn&rsquo;t built into
            either platform on its own terms — Apple&rsquo;s Family Sharing covers photos,
            calendars and locations, not a joint address book, and sharing contacts on Google
            Workspace is a business feature, not a personal one. Meanwhile the same person quietly
            piles up as two or three near-identical entries after a few imports, and most services
            never tell you what you&rsquo;d actually get if you asked for your data back.
          </p>
          <p>
            Kontax exists to put one address book back in your hands: synced everywhere you need
            it, cleaned up automatically, shareable with the people who should see it, and yours to
            take with you.
          </p>

          <h2>What Kontax does today</h2>
          <p>
            Kontax syncs two ways with iCloud, Google Contacts, Fastmail and any other CardDAV
            server, and it speaks CardDAV itself — so it appears as a normal contacts account on
            iPhone and Mac, no separate app required. It finds likely duplicate contacts and merges
            them field by field, with a 30-day undo, on every plan including Free. Every contact
            keeps a change history — what changed, when, and who or what changed it. Family plans
            add one shared address book for up to 6 people, alongside everyone&rsquo;s own private
            contacts; Teams plans add shared address books with roles, per-book permissions and a
            full audit log, paid per seat. A developer REST API is available on Pro and
            Teams. Sign-in supports two-factor authentication, and each connected device uses its
            own revocable app password rather than your account password, with sync credentials
            encrypted at rest.
          </p>

          <h2>Principles we build to</h2>
          <p>
            Kontax is built on open standards rather than a closed format: CardDAV and vCard for
            sync, and a documented export format based on JSContact, published openly with a JSON
            Schema and a reference validator anyone can check independently — not a promise to
            trust, a file you can inspect. There are no ads and no tracking. You can export your
            contacts, or delete your account, at any time from Settings; deletion completes after a
            30-day grace period you can cancel, so it&rsquo;s neither instant nor indefinite.
          </p>

          <h2>Who&rsquo;s behind it</h2>
          <p>
            Kontax is made by Vexon, based in the UK. If you want the legal detail, our Terms are
            governed by the laws of England and Wales, and our Privacy policy explains how we
            handle your data under UK data protection law.
          </p>

          <h2>What&rsquo;s next</h2>
          <p>
            Kontax keeps shipping in small steps rather than one big launch. What&rsquo;s coming
            stays on the roadmap rather than promised on this page — the{" "}
            <Link href="/changelog">changelog</Link> is the honest record of what&rsquo;s actually
            shipped.
          </p>
        </div>

        <div className="doc-cta">
          <Link className="doc-cta__btn" href="/pricing">
            See plans and pricing →
          </Link>
        </div>
      </div>
    </>
  );
}
