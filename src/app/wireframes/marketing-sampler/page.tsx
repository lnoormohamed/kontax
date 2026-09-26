import Link from "next/link";
import type { Metadata } from "next";

import "~/app/(marketing)/_components/marketing.css";
import { MarketingFooter } from "~/app/(marketing)/_components/marketing-footer";
import { MarketingNav } from "~/app/(marketing)/_components/marketing-nav";
import {
  ArrowIcon,
  Band,
  CheckIcon,
  CtaBand,
  Faq,
  IndexLabel,
  NoMark,
  PlanCard,
  SectionHead,
  SourceTag,
  Ticks,
  WindowFrame,
  Wire,
  YesMark,
} from "~/app/(marketing)/_components/mkt-ui";

/**
 * P50-02 · Direction A component sampler — the build's counterpart to the
 * prototype's `?view=sampler`. Development only: /wireframes/** 404s in
 * production (see ../layout.tsx).
 */
export const metadata: Metadata = {
  title: "Marketing component sampler",
  robots: { index: false, follow: false },
};

const TOKENS = [
  ["--mkt-g900", "Green 900", "#0f2620"],
  ["--mkt-g800", "Forest (brand)", "#17352e"],
  ["--mkt-g600", "Green 600", "#2f6b52"],
  ["--mkt-g400", "Green 400", "#6f9c86"],
  ["--mkt-g200", "Green 200", "#cfe1d6"],
  ["--mkt-g100", "Green 100", "#e8f0eb"],
  ["--mkt-stone", "Stone (warm)", "#f4f1ea"],
  ["--mkt-stone-line", "Stone line", "#e3ddd0"],
  ["--mkt-ink", "Ink", "#1d2823"],
  ["--mkt-body", "Body", "#4e5851"],
  ["--mkt-mute", "Mute", "#646c65"],
  ["--mkt-line-strong", "Border", "#d4d9d0"],
  ["--mkt-focus", "Focus", "#4158f4"],
] as const;

const TYPE = [
  ["Display 80", "mkt-h1", "Your contacts. Organised."],
  ["H2 50", "mkt-h2", "Why not just use iCloud?"],
  ["H3 34", "mkt-h3", "Duplicates, found and fixed"],
  ["H4 22", "mkt-h4", "Your family"],
] as const;

const card: React.CSSProperties = {
  border: "1px solid var(--mkt-line-strong)",
  borderRadius: "var(--mkt-r-lg)",
  background: "var(--mkt-card)",
  padding: 28,
  minWidth: 0,
};
const cardTitle: React.CSSProperties = {
  margin: "0 0 20px",
  font: "600 11.5px/1 var(--mkt-mono)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--mkt-mute)",
};
const row: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" };

function SyncRow({ glyph, name, sub }: { glyph: string; name: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 4px", borderTop: "1px solid var(--mkt-line2)" }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--mkt-stone)", border: "1px solid var(--mkt-line)", fontSize: 12, fontWeight: 700, color: "var(--mkt-body)" }}>
        {glyph}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{name}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--mkt-body)" }}>{sub}</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: "500 11px/1 var(--mkt-mono)", color: "var(--mkt-g600)" }}>
        <CheckIcon size={13} />4 min ago
      </span>
    </div>
  );
}

export default function MarketingSamplerPage() {
  return (
    <div className="mkt-wrap">
      <MarketingNav />
      <main>
        <section style={{ padding: "72px 0 112px" }}>
          <div className="mkt-container">
            <IndexLabel>Component sampler</IndexLabel>
            <h1 className="mkt-h2" style={{ marginTop: 14 }}>A · Evolved calm · components</h1>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 20, marginTop: 40 }}>
              <div style={{ ...card, gridColumn: "1 / -1" }}>
                <p style={cardTitle}>Type scale</p>
                <div style={{ display: "grid", gap: 14 }}>
                  {TYPE.map(([label, cls, text]) => (
                    <div key={cls} style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "baseline", paddingBottom: 14, borderBottom: "1px solid var(--mkt-line2)" }}>
                      <code style={{ flex: "0 0 110px", font: "500 11.5px/1.4 var(--mkt-mono)", color: "var(--mkt-mute)" }}>{label}</code>
                      <p className={cls} style={{ flex: "1 1 260px", minWidth: 0 }}>{text}</p>
                    </div>
                  ))}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "baseline", paddingBottom: 14, borderBottom: "1px solid var(--mkt-line2)" }}>
                    <code style={{ flex: "0 0 110px", font: "500 11.5px/1.4 var(--mkt-mono)", color: "var(--mkt-mute)" }}>Body 17</code>
                    <p className="mkt-body-lg" style={{ flex: "1 1 260px", minWidth: 0 }}>Kontax keeps Google, iCloud and Fastmail in step with each other.</p>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "baseline" }}>
                    <code style={{ flex: "0 0 110px", font: "500 11.5px/1.4 var(--mkt-mono)", color: "var(--mkt-mute)" }}>Mono 13</code>
                    <IndexLabel index="01">How it works</IndexLabel>
                  </div>
                </div>
              </div>

              <div style={{ ...card, gridColumn: "1 / -1" }}>
                <p style={cardTitle}>Colour tokens</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
                  {TOKENS.map(([token, name, hex]) => (
                    <div key={token} style={{ display: "grid", gap: 8, fontSize: 12.5, color: "var(--mkt-body)" }}>
                      <i style={{ height: 56, borderRadius: "var(--mkt-r-sm)", border: "1px solid var(--mkt-line)", background: `var(${token})` }} />
                      <b style={{ fontWeight: 600, color: "var(--mkt-ink)" }}>{name}</b>
                      <code style={{ font: "500 11px/1.3 var(--mkt-mono)", color: "var(--mkt-mute)" }}>{token}<br />{hex}</code>
                    </div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <p style={cardTitle}>Buttons &amp; links</p>
                <div style={row}>
                  <Link className="mkt-btn mkt-btn--pri" href="#">Get started free</Link>
                  <Link className="mkt-btn mkt-btn--sec" href="#">Compare plans</Link>
                  <Link className="mkt-btn mkt-btn--pri mkt-btn--sm" href="#">Small</Link>
                </div>
                <div style={{ ...row, marginTop: 20 }}>
                  <Link className="mkt-more" href="#">Text link<ArrowIcon /></Link>
                  <Link href="#" style={{ color: "var(--mkt-g800)", textDecoration: "underline", textUnderlineOffset: 2 }}>Inline link</Link>
                </div>
              </div>

              <div style={card}>
                <p style={cardTitle}>Section header &amp; badges</p>
                <IndexLabel index="02">Why people switch</IndexLabel>
                <h2 className="mkt-h3" style={{ marginTop: 16 }}>The things your address book never did</h2>
                <div style={{ ...row, marginTop: 18 }}>
                  <span className="mkt-tag">Most flexible</span>
                  <span className="mkt-tag mkt-tag--soon">Coming soon</span>
                  <span className="mkt-chip">Synced · just now</span>
                  <SourceTag>iCloud</SourceTag>
                  <SourceTag>Google</SourceTag>
                </div>
              </div>

              <div style={card}>
                <p style={cardTitle}>Card</p>
                <Link className="mkt-card" href="#" style={{ padding: 24 }}>
                  <span className="mkt-card__kicker">Family</span>
                  <h3 className="mkt-card__title">Your family</h3>
                  <p className="mkt-card__body">The dentist, the school, the neighbours with the spare key.</p>
                  <span className="mkt-card__foot"><span className="mkt-more">See Family<ArrowIcon /></span></span>
                </Link>
              </div>

              <div style={card}>
                <p style={cardTitle}>Product window frame</p>
                <WindowFrame title="Settings · Sync">
                  <p style={{ margin: "0 0 10px", font: "700 10.5px/1 var(--mkt-sans)", letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--mkt-mute)" }}>Connections</p>
                  <SyncRow glyph="G" name="Google Contacts" sub="lina@gmail.com" />
                  <SyncRow glyph="iC" name="iCloud" sub="lina@icloud.com" />
                  <SyncRow glyph="F" name="Fastmail" sub="lina@fastmail.com" />
                </WindowFrame>
              </div>

              <div style={card}>
                <p style={cardTitle}>Table</p>
                <div className="mkt-table-wrap">
                  <table className="mkt-table">
                    <thead>
                      <tr><th scope="col">Plan</th><th scope="col">Free</th><th scope="col" className="is-hl">Pro</th></tr>
                    </thead>
                    <tbody>
                      <tr className="mkt-table__group"><th colSpan={3} scope="colgroup">Contacts and sync</th></tr>
                      <tr><th scope="row">Contacts</th><td>500</td><td className="is-hl">Unlimited</td></tr>
                      <tr><th scope="row">API</th><td><NoMark /></td><td className="is-hl"><YesMark /></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={card}>
                <p style={cardTitle}>Hairline wire &amp; source tags</p>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 72px minmax(0, 1fr)", alignItems: "center", background: "var(--mkt-stone)", border: "1px solid var(--mkt-stone-line)", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(["Google", "iCloud", "Fastmail"] as const).map((s) => (
                      <div key={s} style={{ background: "var(--mkt-card)", border: "1px solid var(--mkt-line-strong)", borderRadius: 10, padding: "10px 12px", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                        Ben Nakamura <SourceTag>{s}</SourceTag>
                      </div>
                    ))}
                  </div>
                  <Wire />
                  <div style={{ background: "var(--mkt-card)", border: "1px solid var(--mkt-line-strong)", borderRadius: 12, padding: 14, fontSize: 13 }}>
                    <b style={{ display: "block", font: "var(--mkt-h4)", fontSize: 17 }}>Ben Nakamura</b>
                    One contact, from three records
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Band stone id="compare">
          <SectionHead
            index="03"
            label="Why Kontax"
            title="Why not just use iCloud or Google Contacts?"
            lede="They’re fine inside one company’s world. Kontax is for when your contacts live in more than one."
          />
          <div style={{ maxWidth: 880, margin: "52px auto 0" }}>
            <table className="mkt-cmp">
              <caption className="mkt-sr-only">Kontax compared with Google Contacts and iCloud Contacts</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="mkt-sr-only">Feature</span></th>
                  <th scope="col" className="is-us">Kontax</th>
                  <th scope="col">Google</th>
                  <th scope="col">iCloud</th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">Keeps Google, iCloud and Fastmail in step</th><td className="is-us"><YesMark /></td><td><NoMark /></td><td><NoMark /></td></tr>
                <tr><th scope="row">Shared books for a family or team, with roles</th><td className="is-us"><YesMark /></td><td className="mkt-cmp__part">Workspace only</td><td><NoMark /></td></tr>
                <tr><th scope="row">Finds and merges duplicates</th><td className="is-us"><YesMark /></td><td><YesMark /></td><td className="mkt-cmp__part">Mac only</td></tr>
              </tbody>
            </table>
            <p className="mkt-note">Judged against each product’s own help pages in September 2026, on their free consumer tiers.</p>
          </div>
        </Band>

        <Band id="pricing-teaser">
          <SectionHead index="06" label="Pricing" title="Free until you need more" />
          <div className="mkt-plans mkt-plans--2" style={{ marginTop: 48 }}>
            <PlanCard
              name="Free"
              audience="For one person getting organised."
              price={<span className="mkt-plan__amount">£0</span>}
              features={["Up to 500 contacts", "1 sync source", "1 phone or Mac over CardDAV", "CSV export"]}
              action={<Link className="mkt-btn mkt-btn--sec" href="#">Get started free</Link>}
            />
            <PlanCard
              name="Pro"
              highlight
              badge="Most flexible"
              audience="For you, across every account."
              price={<span style={{ font: "500 12.5px/1 var(--mkt-mono)", padding: "6px 8px", border: "1px dashed var(--mkt-line-strong)", borderRadius: 6 }}>stripe: pro.monthly</span>}
              features={["Unlimited contacts", "Up to 5 sync sources", "5 devices", "Developer API", "vCard and Kontax export"]}
              action={<Link className="mkt-btn mkt-btn--pri" href="#">Start with Pro</Link>}
            />
          </div>
          <div style={{ marginTop: 28 }}>
            <Ticks items={["Two-way sync, not a one-off import", "No app to install on iPhone or Mac"]} />
          </div>
        </Band>

        <Band stone id="faq">
          <SectionHead index="07" label="Questions" title="Questions, answered" />
          <Faq
            items={[
              { q: "Do I need to install an app?", a: "No. On iPhone and Mac, Kontax appears inside the Contacts app you already use, over CardDAV. Everywhere else, use Kontax in your browser." },
              { q: "Is Kontax free?", a: <>The Free plan holds up to 500 contacts with one sync source and one phone or Mac. No card needed. <Link href="/pricing">Compare plans</Link>.</> },
              { q: "What happens to my contacts if I leave?", a: "Export everything at any time as vCard, CSV or the documented Kontax format, then delete your account from Settings. Deletion completes after a 30-day grace period." },
            ]}
          />
        </Band>

        <CtaBand title="Start with the contacts you already have." sub="Free for up to 500 contacts. No card needed.">
          <Link className="mkt-btn mkt-btn--pri" href="/register">Get started free</Link>
          <Link className="mkt-btn mkt-btn--sec" href="/pricing">Compare plans</Link>
        </CtaBand>
      </main>
      <MarketingFooter />
    </div>
  );
}
