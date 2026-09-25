import Link from "next/link";

import { ArrowIcon, NoMark, SectionHead, YesMark } from "../mkt-ui";
import { Icon, type HomeIconName } from "./icons";

// P49-04 / P50-03 · §03 comparison, §04 privacy & security, §05 who it's for.

// ── §03 Comparison ──────────────────────────────────────────────────────────
// Marks judged from each vendor's own help pages (Sep 2026), free consumer
// tiers. A real <table> with row and column headers; short column headers so
// it fits 375px without scrolling.

type Mark = true | false | string;
type CompareRow = { feature: string; kontax: Mark; google: Mark; icloud: Mark };

const COMPARE_ROWS: CompareRow[] = [
  // P50-03: was "Works across iPhone and Android" — Android sync is not in the
  // verified fact list; keeping several providers in step is.
  { feature: "Keeps Google, iCloud and Fastmail in step", kontax: true, google: false, icloud: false },
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
  const cls = [us ? "is-us" : "", typeof mark === "string" ? "mkt-cmp__part" : ""].filter(Boolean).join(" ");
  return (
    <td className={cls || undefined}>
      {mark === true ? <YesMark /> : mark === false ? <NoMark /> : mark}
    </td>
  );
}

export function CompareTable() {
  return (
    <section className="mkt-band mkt-band--stone" id="compare">
      <div className="mkt-container">
        <SectionHead
          index="03"
          label="Why Kontax"
          title="Why not just use iCloud or Google Contacts?"
          lede="They’re fine inside one company’s world. Kontax is for when your contacts live in more than one."
        />
        <div className="hp-cmpw">
          <table className="mkt-cmp">
            <caption className="mkt-sr-only">Kontax compared with Google Contacts and iCloud Contacts</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="mkt-sr-only">Feature</span>
                </th>
                <th scope="col" className="is-us">
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
          <p className="mkt-note">
            Judged against each product’s own help pages in September 2026, on their free consumer
            tiers. “Only” means the feature exists on some platforms or plans.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── §04 Privacy & security ──────────────────────────────────────────────────
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
    body: "It’s in Settings — no request form. Deletion completes after a 30-day grace period you can cancel.",
  },
];

export function SecurityFacts() {
  return (
    <section className="mkt-band" id="privacy">
      <div className="mkt-container hp-priv">
        <div>
          <SectionHead
            stack
            index="04"
            label="Privacy & security"
            title="Your contacts are other people’s details. We treat them that way."
            lede="Kontax is paid for by subscriptions, not advertising. Here’s what that means in practice."
          />
          <Link className="mkt-more hp-priv__more" href="/security">
            How we keep your data safe
            <ArrowIcon />
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

// ── §05 Who it's for ────────────────────────────────────────────────────────
// /pricing has no per-plan anchors, so every card links to the page itself.
// "You get" lines use only limits in the verified fact list (billing.ts).

const AUDIENCES: { plan: string; title: string; body: string; get: string; cta: string }[] = [
  {
    plan: "Free · Pro",
    title: "Just you",
    body: "Every account you’ve ever saved a number in, finally agreeing with each other.",
    get: "sync, clean-up and change history on all your devices.",
    cta: "See Free and Pro",
  },
  {
    plan: "Family",
    title: "Your family",
    body: "The dentist, the school, the neighbours with the spare key. Kept in one place everyone can reach.",
    get: "a shared book for up to six people.",
    cta: "See Family",
  },
  {
    plan: "Teams",
    title: "Your team",
    body: "Clients and suppliers that stay with the business when people move on.",
    get: "shared books with roles, an audit log and the API, for up to 25 people.",
    cta: "See Teams",
  },
];

export function AudienceCards() {
  return (
    <section className="mkt-band mkt-band--stone">
      <div className="mkt-container">
        <SectionHead index="05" label="Who it’s for" title="One address book, however many people use it" />
        <div className="hp-who">
          {AUDIENCES.map((a, i) => (
            <Link className="mkt-card hp-who__c" href="/pricing" key={a.title} aria-labelledby={`hp-who-${i}`}>
              <span className="mkt-card__kicker">{a.plan}</span>
              <h3 className="mkt-card__title" id={`hp-who-${i}`}>
                {a.title}
              </h3>
              <p className="mkt-card__body">{a.body}</p>
              <p className="hp-who__get">
                <b>You get</b> {a.get}
              </p>
              <span className="mkt-more hp-who__more">
                {a.cta}
                <ArrowIcon />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
