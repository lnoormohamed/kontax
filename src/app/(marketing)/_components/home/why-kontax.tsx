import Link from "next/link";

import { Icon, type HomeIconName } from "./icons";

// P49-04 · §5 comparison, §6 privacy & security, §7 who it's for.

// ── §5 Comparison ───────────────────────────────────────────────────────────
// Marks judged from each vendor's own help pages (Sep 2026), free consumer
// tiers. A real <table> with row and column headers; short column headers so
// it fits 375px without scrolling.

type Mark = true | false | string;
type CompareRow = { feature: string; kontax: Mark; google: Mark; icloud: Mark };

const COMPARE_ROWS: CompareRow[] = [
  // Kontax reaches Android through Google sync, not a native Android client.
  { feature: "Works across iPhone and Android", kontax: true, google: true, icloud: false },
  { feature: "Shared books for a family or team, with roles", kontax: true, google: "Workspace only", icloud: false },
  // iPhone Contacts has detected duplicates since iOS 16, not just the Mac app.
  { feature: "Finds and merges duplicates", kontax: true, google: true, icloud: "Apple devices only" },
  { feature: "Change history for each contact", kontax: true, google: false, icloud: false },
  {
    feature: "Export with labels, notes and history in a documented format",
    kontax: true,
    google: false,
    icloud: false,
  },
];

function MarkCell({ mark, us = false }: { mark: Mark; us?: boolean }) {
  const cls = (state: string) => `${us ? "hp-us " : ""}${state}`;
  if (mark === true) {
    return (
      <td className={cls("hp-yes")}>
        <Icon name="check" size={18} />
        <span className="hp-sr-only">Yes</span>
      </td>
    );
  }
  if (mark === false) {
    return (
      <td className={cls("hp-no")}>
        <span aria-hidden="true">—</span>
        <span className="hp-sr-only">No</span>
      </td>
    );
  }
  return <td className={cls("hp-part")}>{mark}</td>;
}

export function CompareTable() {
  return (
    <section className="hp-band hp-band--surface" id="compare">
      <div className="hp-container">
        <div className="hp-section-head hp-section-head--center">
          <p className="hp-section-kicker">Why Kontax</p>
          <h2 className="hp-section-title">Why not just use iCloud or Google Contacts?</h2>
          <p className="hp-section-lede">
            They&apos;re fine inside one company&apos;s world. Kontax is for when your contacts
            live in more than one.
          </p>
        </div>
        <div className="hp-cmp-wrap">
          <table className="hp-cmp">
            <caption className="hp-sr-only">
              Kontax compared with Google Contacts and iCloud Contacts
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="hp-sr-only">Feature</span>
                </th>
                <th scope="col" className="hp-us">
                  Kontax
                </th>
                <th scope="col">Google</th>
                <th scope="col">iCloud</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  <MarkCell mark={row.kontax} us />
                  <MarkCell mark={row.google} />
                  <MarkCell mark={row.icloud} />
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hp-cmp-note">
            Judged against each product&apos;s own help pages in September 2026, on their free
            consumer tiers. &quot;Only&quot; means the feature exists on some platforms or plans.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── §6 Privacy & security ───────────────────────────────────────────────────
// Four verifiable facts: 2FA + per-device app passwords (P18-07), AES-256-GCM
// sync credentials (P48-16), the privacy policy, and the Settings deletion
// flow (30-day grace period, src/app/actions/account.ts). Encrypted backups
// are deliberately NOT claimed until backup encryption ships.

const FACTS: { icon: HomeIconName; title: string; body: string }[] = [
  {
    icon: "key",
    title: "Two-factor sign-in, and app passwords you can revoke",
    body: "Lose a phone? Revoke its password without touching anything else.",
  },
  {
    icon: "lock",
    title: "Sync credentials encrypted at rest",
    body: "Tokens for Google, iCloud and Fastmail are stored with AES-256-GCM.",
  },
  {
    icon: "shield",
    title: "No ads, no tracking pixels",
    body: "Your contacts are never sold, rented or used to profile you.",
  },
  {
    icon: "export",
    title: "Export everything, or delete your account, any time",
    body: "It's in Settings — no request form. Deletion completes after a 30-day grace period you can cancel.",
  },
];

export function SecurityFacts() {
  return (
    <section className="hp-band" id="privacy">
      <div className="hp-container hp-priv">
        <div className="hp-section-head">
          <p className="hp-section-kicker">Privacy &amp; security</p>
          <h2 className="hp-section-title">
            Your contacts are other people&apos;s details. We treat them that way.
          </h2>
          <p className="hp-section-lede">
            Kontax is paid for by subscriptions, not advertising. Here&apos;s what that means in
            practice.
          </p>
          <Link className="hp-more-link hp-priv__link" href="/security">
            How we keep your data safe
            <Icon name="arrow" size={16} />
          </Link>
        </div>
        <div className="hp-facts">
          {FACTS.map((fact) => (
            <div className="hp-fact" key={fact.title}>
              <Icon name={fact.icon} size={22} />
              <h3>{fact.title}</h3>
              <p>{fact.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── §7 Who it's for ─────────────────────────────────────────────────────────
// /pricing has no per-plan anchors, so every card links to the page itself.

const AUDIENCES: { plan: string; title: string; body: string; get: string; cta: string }[] = [
  {
    plan: "Free · Pro",
    title: "Just you",
    body: "Every account you've ever saved a number in, finally agreeing with each other.",
    get: "sync, clean-up and change history on all your devices.",
    cta: "See Free and Pro",
  },
  {
    plan: "Family",
    title: "Your family",
    body: "The dentist, the school, the neighbours with the spare key. Kept in one place everyone can reach.",
    get: "a shared family book, plus a private book for each member.",
    cta: "See Family",
  },
  {
    plan: "Teams",
    title: "Your team",
    body: "Clients and suppliers that stay with the business when people move on.",
    get: "shared books with roles, and one bill for the whole team.",
    cta: "See Teams",
  },
];

export function AudienceCards() {
  return (
    <section className="hp-band hp-band--surface">
      <div className="hp-container">
        <div className="hp-section-head hp-section-head--center">
          <p className="hp-section-kicker">Who it&apos;s for</p>
          <h2 className="hp-section-title">One address book, however many people use it</h2>
        </div>
        <div className="hp-who">
          {AUDIENCES.map((a, i) => (
            <Link className="hp-who__card" href="/pricing" key={a.title} aria-labelledby={`hp-who-${i}`}>
              <span className="hp-who__plan">{a.plan}</span>
              <h3 id={`hp-who-${i}`}>{a.title}</h3>
              <p>{a.body}</p>
              <p className="hp-who__get">
                <b>You get</b> {a.get}
              </p>
              <span className="hp-more-link">
                {a.cta}
                <Icon name="arrow" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
