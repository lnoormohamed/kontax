import Link from "next/link";
import type { Metadata } from "next";

import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { webPageSchema } from "../../_components/page-schema";
import { CtaBand, Faq, SectionHead, Ticks } from "../../_components/mkt-ui";
import "../../_components/content-page.css";

// P50A-07 · Use-case page. Lives under /for/ (not /teams — that route is the
// signed-in team workspace). Facts verified against src/server/dav/plan-entitlements.mjs,
// src/server/team-access.ts, src/server/team-audit.ts,
// src/app/settings/sharing/teams/page.tsx and roadmap/build-phase/lifecycle-policies.md
// (§3e, the 30-day read-only grace on Teams → Pro) — see the report for the
// ticket for the exact references.

const TITLE = "Contacts that stay with the business — Kontax";
const DESCRIPTION =
  "Shared address books with roles, per-book permissions and a full audit log for up to 25 people. Works in iPhone Contacts, no app needed; API on Teams.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/for/teams" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/for/teams", siteName: "Kontax", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FAQ_ITEMS = [
  {
    q: "What roles are there?",
    a: "Owner, Admin and Member. Owners and Admins can always edit every shared book. Members get a per-book permission — edit, view-only, or no access — set by an Owner or Admin, so a client-facing book can be read-only for people who shouldn't change it.",
  },
  {
    q: "What's in the audit log?",
    a: "Every change to a team address book: contacts created, updated, archived, restored or merged, and sync activity, each attributed to the member who made it. It's admin-only, filterable by member, book and date, and kept for as long as the team is on the Teams plan — it isn't pruned on a retention schedule the way personal history is.",
  },
  {
    q: "Do team members need their own Kontax account?",
    a: "Yes — each member signs in with their own Kontax account and their own device connection, so access can be revoked person by person without affecting anyone else.",
  },
  {
    q: "What happens to the books if we downgrade from Teams?",
    a: "Team books become read-only for 30 days. The owner can export everything, or migrate one book into their personal library, during that window. After 30 days, any books not migrated are archived.",
  },
];

export default function ForTeamsPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "For teams", path: "/for/teams" },
          ]),
          webPageSchema({
            name: TITLE,
            description: DESCRIPTION,
            path: "/for/teams",
          }),
        ]}
      />

      {/* ── Hero ── */}
      <section className="mkt-band">
        <div className="mkt-container">
          <SectionHead
            headingLevel={1}
            label="For teams"
            title="Contacts that stay with the business, not with one phone"
            lede="Client and supplier contacts scattered across personal phones disappear when someone
              moves on. Kontax gives a team shared address books with roles, per-book permissions
              and a full audit log — appearing in the Contacts app on every member's iPhone or Mac,
              no app required."
          />
        </div>
      </section>

      {/* ── The problem, and the fix ── */}
      <section className="mkt-band mkt-band--stone">
        <div className="mkt-container cp-grid-2">
          <div className="mkt-card">
            <span className="mkt-card__kicker">The problem</span>
            <h2 className="mkt-card__title">Business contacts living in personal address books</h2>
            <p className="mkt-card__body">
              Without a shared book, a client&rsquo;s number lives on one person&rsquo;s phone. When they
              leave, so does the number — and there&rsquo;s no record of who changed what, or when.
            </p>
          </div>
          <div className="mkt-card">
            <span className="mkt-card__kicker">How Kontax fixes it</span>
            <h2 className="mkt-card__title">Shared books, with roles and a full audit trail</h2>
            <p className="mkt-card__body">
              Shared address books that belong to the team, not a person. Roles and per-book
              permissions decide who can edit or just view each one, and every change is logged
              and attributed.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mkt-band" id="how-it-works">
        <div className="mkt-container">
          <SectionHead
            index="01"
            label="How it works"
            title="Roles, per-book permissions, and an audit log"
          />
          <Ticks
            items={[
              "Create as many shared address books as the team needs — one per client segment, department or region — for up to 25 members.",
              "Every member holds a role: Owner, Admin, or Member. Owners and Admins can edit every book; a Member's access to each book is set individually to edit, view-only, or no access.",
              "Every create, edit, archive, restore, merge and sync event on a team book is recorded in the audit log, attributed to the member who did it — filterable by member, book, event type and date.",
              "Shared books appear in each member's iPhone or Mac Contacts app over CardDAV, the same as a personal address book — nothing extra to install.",
              "The developer API is available on Teams, for reading and writing contacts from your own scripts and integrations.",
            ]}
          />
        </div>
      </section>

      {/* ── Setup ── */}
      <section className="mkt-band mkt-band--stone" id="setup">
        <div className="mkt-container">
          <SectionHead index="02" label="Setup" title="Getting a team of 25 onto shared books" />
          <ol className="cp-steps" style={{ marginTop: 32 }}>
            <li>
              <h3>Upgrade to Teams</h3>
              <p>From Settings, or the <Link href="/pricing">pricing page</Link>. The owner&rsquo;s subscription covers the team&rsquo;s seats.</p>
            </li>
            <li>
              <h3>Create your address books</h3>
              <p>Set up the shared books the team needs — by client, department, or however the work is organised.</p>
            </li>
            <li>
              <h3>Invite members with a role</h3>
              <p>Invite by email as Admin or Member, then set each Member&rsquo;s per-book permission (edit, view-only, or none).</p>
            </li>
            <li>
              <h3>Each member connects their own device</h3>
              <p>Members create their own app password in Settings, then add Kontax as a CardDAV contacts account on their iPhone or Mac.</p>
            </li>
            <li>
              <h3>Review the audit log any time</h3>
              <p>Owners and Admins can see every change across the team&rsquo;s books, filtered by member, book or date.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mkt-band" id="faq">
        <div className="mkt-container">
          <SectionHead index="03" label="Questions" title="Teams, answered" />
          <div style={{ marginTop: 32 }}>
            <Faq items={FAQ_ITEMS} />
          </div>
          <p className="cp-note">
            Building an integration? See the <Link href="/developers">developer API</Link>.
          </p>
        </div>
      </section>

      <CtaBand title="Give client and supplier contacts a home that outlasts one phone" sub="Free to start. Upgrade to Teams when you're ready to share books with roles.">
        <Link className="mkt-btn mkt-btn--pri" href="/register">
          Get started free
        </Link>
        <Link className="mkt-btn mkt-btn--sec" href="/pricing">
          See Teams pricing
        </Link>
      </CtaBand>
    </>
  );
}
