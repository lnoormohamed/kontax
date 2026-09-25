import Link from "next/link";
import type { Metadata } from "next";

import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { webPageSchema } from "../../_components/page-schema";
import { CtaBand, Faq, SectionHead, Ticks } from "../../_components/mkt-ui";
import "../../_components/content-page.css";

// P50A-07 · Use-case page. Lives under /for/ (not /family — that route is the
// signed-in family workspace; tests in tests/node/public-paths.test.ts pin
// /for/families as the public one). Facts verified against src/server/billing.ts,
// src/server/dav/plan-entitlements.mjs, src/app/actions/family.ts,
// src/server/family-access.ts and roadmap/build-phase/lifecycle-policies.md
// (§3a, the post-lapse 7-day notice) — see the report for the ticket for the
// exact references.

const TITLE = "Shared family address book for iPhone — Kontax";
const DESCRIPTION =
  "Apple has no shared family address book. Kontax gives your household one shared book for up to 6 people, while everyone keeps their own contacts private.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/for/families" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/for/families", siteName: "Kontax", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FAQ_ITEMS = [
  {
    q: "Does everyone in the family see all of my contacts?",
    a: "No. Only the contacts you or another member deliberately add to the shared family book are visible to the family. Your personal address book stays private — the family book is a separate, additional book, not a merge of everyone's contacts.",
  },
  {
    q: "Who can edit the shared book?",
    a: "The owner invites members by email and decides, per member, whether they can edit the shared book or only view it. The owner can change that at any time from Settings.",
  },
  {
    q: "What happens to the shared contacts if the Family plan ends?",
    a: "Nothing disappears straight away. Members keep access to the shared book for 7 days after the plan lapses, with a notice to export if they want to. After that, each member gets their own private copy of the shared contacts, the owner keeps the book's contacts, and the shared book itself is retired.",
  },
  {
    q: "Can a member remove themselves later?",
    a: "Yes. Leaving the family book keeps a private copy of the contacts you had access to, and does not touch your own personal contacts.",
  },
];

export default function ForFamiliesPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "For families", path: "/for/families" },
          ]),
          webPageSchema({
            name: TITLE,
            description: DESCRIPTION,
            path: "/for/families",
          }),
        ]}
      />

      {/* ── Hero ── */}
      <section className="mkt-band">
        <div className="mkt-container">
          <SectionHead
            headingLevel={1}
            label="For families"
            title="One address book your whole family can share"
            lede="Apple's Family Sharing covers photos, calendars and locations — not a joint address
              book. Google Contacts sharing needs a Google Workspace account. Kontax gives your
              household a shared book that appears in the Contacts app everyone already uses, on
              iPhone and Mac, without installing anything."
          />
        </div>
      </section>

      {/* ── The problem, and the fix ── */}
      <section className="mkt-band mkt-band--stone">
        <div className="mkt-container cp-grid-2">
          <div className="mkt-card">
            <span className="mkt-card__kicker">The problem</span>
            <h2 className="mkt-card__title">Everyone keeps their own copy of &ldquo;the school&rdquo;, &ldquo;the dentist&rdquo;</h2>
            <p className="mkt-card__body">
              A shared household number changes, and everyone has to update it separately, or
              doesn&apos;t. There&apos;s no single place a family keeps the contacts that belong to
              the household rather than to one person&apos;s phone.
            </p>
          </div>
          <div className="mkt-card">
            <span className="mkt-card__kicker">How Kontax fixes it</span>
            <h2 className="mkt-card__title">A shared Family Book, alongside everyone&apos;s own contacts</h2>
            <p className="mkt-card__body">
              One shared address book that every invited member can read (and, if the owner allows
              it, edit). It syncs to each member&apos;s iPhone, Mac or CardDAV-compatible device
              automatically, next to their own private contacts.
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
            title="A shared book, plus everyone's own private one"
          />
          <Ticks
            items={[
              "The owner creates one shared Family Book and invites people by email — up to 6 members in total, owner included.",
              "Each member keeps their own personal address book. Nothing in it is shared unless they choose to add it to the Family Book.",
              "The owner controls who can edit the shared book and who can only view it, and can change that at any time.",
              "The shared book appears in every member's phone or computer Contacts app over CardDAV — no separate app to install.",
              "Every change to a shared contact is attributed to the member who made it, so the family can see who added or edited what.",
            ]}
          />
        </div>
      </section>

      {/* ── Setup ── */}
      <section className="mkt-band mkt-band--stone" id="setup">
        <div className="mkt-container">
          <SectionHead index="02" label="Setup" title="Getting the family book onto everyone's phone" />
          <ol className="cp-steps" style={{ marginTop: 32 }}>
            <li>
              <h3>Upgrade to Family</h3>
              <p>From Settings, or the <Link href="/pricing">pricing page</Link>. The owner&apos;s account holds the subscription for the whole household.</p>
            </li>
            <li>
              <h3>Invite up to 5 more people</h3>
              <p>By email, from Settings → Sharing. Each invite is valid for 48 hours; the owner can resend it if it expires.</p>
            </li>
            <li>
              <h3>Members accept and create an app password</h3>
              <p>Once accepted, each member creates a device app password in Settings — a separate password just for connecting a phone or computer, so it can be revoked on its own.</p>
            </li>
            <li>
              <h3>Add Kontax as a contacts account</h3>
              <p>On iPhone: Settings → Apps → Contacts → Contacts Accounts → Add Account → Other → Add CardDAV Account. On a Mac: System Settings → Internet Accounts → Add Account → Other Accounts → CardDAV account. Use the Kontax server address, the member&apos;s email and the app password.</p>
            </li>
            <li>
              <h3>The shared book appears automatically</h3>
              <p>No app to open — the family contacts show up in the Contacts app alongside each member&apos;s own, and stay in sync both ways.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* ── If the plan ends ── */}
      <section className="mkt-band" id="if-the-plan-ends">
        <div className="mkt-container">
          <SectionHead
            index="03"
            label="If the plan ends"
            title="A 7-day notice, then everyone keeps their own copy"
            lede="Cancelling isn't a cliff-edge. Members get warning, and no one loses the contacts they
              had access to."
          />
          <Ticks
            items={[
              "When the Family plan lapses — cancelled, a failed payment that isn't fixed, or downgraded — members keep their current access to the shared book for 7 more days, with an in-app and email notice.",
              "During those 7 days, new invites are paused, but existing members can still use and export the shared book as normal.",
              "If the owner re-subscribes within the 7 days, the family book continues and nothing changes for members.",
              "After the 7 days, each member automatically gets their own private copy of the shared contacts, and the owner keeps the book's contacts. No one needs to do anything to keep them.",
            ]}
          />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mkt-band mkt-band--stone" id="faq">
        <div className="mkt-container">
          <SectionHead index="04" label="Questions" title="Family book, answered" />
          <div style={{ marginTop: 32 }}>
            <Faq items={FAQ_ITEMS} />
          </div>
          <p className="cp-note">
            More on sharing and permissions in <Link href="/help">Help</Link>.
          </p>
        </div>
      </section>

      <CtaBand title="Give your family one address book" sub="Free to start. Upgrade to Family when you're ready to share a book.">
        <Link className="mkt-btn mkt-btn--pri" href="/register">
          Get started free
        </Link>
        <Link className="mkt-btn mkt-btn--sec" href="/pricing">
          See Family pricing
        </Link>
      </CtaBand>
    </>
  );
}
