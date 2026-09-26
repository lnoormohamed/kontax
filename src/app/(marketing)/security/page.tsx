import type { Metadata } from "next";
import { isMicrosoftSyncEnabled } from "~/lib/microsoft-sync-flag";
import { CheckIcon, CtaBand, MktLabel, MktWindow, PageHead, SourceTag, Ticks } from "../_components/mkt-ui";
import "./security.css";

export const metadata: Metadata = {
  title: "Security — Kontax",
  description:
    "How Kontax protects your data: TLS encryption, bcrypt passwords, 2FA, encrypted sync credentials, and GDPR compliance.",
  alternates: { canonical: "/security" },
  openGraph: {
    title: "Security",
    description:
      "How Kontax protects your data: TLS encryption, bcrypt passwords, 2FA, encrypted sync credentials, and GDPR compliance.",
    url: "/security",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=security", width: 1200, height: 630, alt: "Kontax — Security you can trust" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Security — Kontax",
    description:
      "How Kontax protects your data: TLS encryption, bcrypt passwords, 2FA, encrypted sync credentials, and GDPR compliance.",
  },
};

// P50-04 · /security in Direction A (P50-DB01 `?view=security`): page head,
// a sticky "On this page" list beside the sections (hidden below 980px),
// tick lists for the facts and decorative product windows / a hairline-wire
// diagram. The claims are exactly the P49 page's — nothing added (in
// particular, no backup-encryption claim until that ships).

const TOC = [
  { id: "end-to-end", label: "End to end" },
  { id: "encryption", label: "Encryption" },
  { id: "access", label: "Accounts & access" },
  { id: "your-data", label: "Your data & disclosure" },
];

// Small line icons for the diagram and windows (decorative).
function Glyph({ name }: { name: "devices" | "shield" | "sync" | "key" | "lock" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    devices: (
      <>
        <rect x="3" y="4" width="14" height="10" rx="1.5" />
        <path d="M2 18h16" />
        <rect x="16" y="9" width="6" height="11" rx="1.5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z" />
        <rect x="9.5" y="10.5" width="5" height="4" rx="0.8" />
        <path d="M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5" />
      </>
    ),
    sync: (
      <>
        <path d="M20 11a8 8 0 0 0-14.3-3.7M4 5v3h3" />
        <path d="M4 13a8 8 0 0 0 14.3 3.7M20 19v-3h-3" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="M10.8 12.2 19 4M16 7l3 3M14 9l2 2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10.5" width="14" height="10" rx="2" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </>
    ),
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

// Hairline wire between two diagram nodes, with a mono tag on the line.
function Wire({ tag }: { tag: string }) {
  return (
    <div className="sp-flow__wire">
      <svg className="mkt-wire" viewBox="0 0 2 56" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line x1="1" y1="0" x2="1" y2="56" />
      </svg>
      <SourceTag>{tag}</SourceTag>
    </div>
  );
}

function FlowNode({ glyph, label, sub, brand }: { glyph: "devices" | "shield" | "sync"; label: string; sub: string; brand?: boolean }) {
  return (
    <div className={`sp-flow__node${brand ? " sp-flow__node--k" : ""}`}>
      <span className="sp-glyph">
        <Glyph name={glyph} />
      </span>
      <div>
        <div className="sp-flow__label">{label}</div>
        <div className="sp-flow__sub">{sub}</div>
      </div>
    </div>
  );
}

function Item({ title, children, facts }: { title: string; children: React.ReactNode; facts: string[] }) {
  return (
    <div className="sp-item">
      <h3>{title}</h3>
      <p>{children}</p>
      <Ticks items={facts} />
    </div>
  );
}

export default function SecurityPage() {
  // P50A-01: Outlook only appears once Microsoft sync is configured. This
  // page has no dynamic API, so it's statically prerendered — see
  // ~/lib/microsoft-sync-flag for why a build-time read is correct here.
  const outlookLive = isMicrosoftSyncEnabled();
  const syncProviders = ["Google", ...(outlookLive ? ["Outlook"] : []), "CardDAV"];
  const syncProvidersLabel = syncProviders.join(", ");

  return (
    <>
      <PageHead
        label="Security & privacy"
        title="Security you can trust"
        lede={
          <>
            Kontax is built around the principle that your contacts are yours. Here&apos;s how we
            keep them safe — in plain terms, no hand-waving.
          </>
        }
      >
        <ul className="sp-trust" aria-label="At a glance">
          {["TLS 1.2+", "HSTS enforced", "bcrypt + TOTP", "GDPR ready", "No ad tracking"].map((fact) => (
            <li key={fact}>
              <CheckIcon />
              {fact}
            </li>
          ))}
        </ul>
      </PageHead>

      <div className="mkt-container sp-lay">
        <nav className="sp-toc" aria-label="On this page">
          <p className="sp-toc__h">On this page</p>
          {TOC.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sp-main">
          {/* ── End to end ── */}
          <section className="sp-b" id="end-to-end" aria-labelledby="end-to-end-h">
            <div className="sp-b__txt">
              <h2 className="mkt-h3" id="end-to-end-h">End to end</h2>
              <p className="sp-b__lede">
                How your contacts stay protected, from your device to every sync.
              </p>
            </div>
            <div
              className="sp-flow"
              role="img"
              aria-label={`Data protection flow: your devices connect over TLS 1.2+ to Kontax, which encrypts sensitive secrets — 2FA and sync credentials — with AES-256-GCM, and syncs to ${syncProvidersLabel} using encrypted credentials.`}
            >
              <FlowNode glyph="devices" label="Your devices" sub="Web, mobile & CardDAV clients" />
              <Wire tag="TLS 1.2+ · HSTS" />
              <FlowNode glyph="shield" label="Kontax" sub="Secrets encrypted · AES-256-GCM" brand />
              <Wire tag="Encrypted tokens" />
              <FlowNode glyph="sync" label={syncProviders.join(" · ")} sub="OAuth tokens & scoped app passwords" />
            </div>
          </section>

          {/* ── 01 Encryption ── */}
          <section className="sp-b sp-b--solo" id="encryption" aria-labelledby="encryption-h">
            <div className="sp-b__txt">
              <MktLabel n="01">Encryption</MktLabel>
              <h2 className="mkt-h3" id="encryption-h">Encrypted in transit, secrets sealed at rest</h2>
              <p className="sp-b__lede">
                Every request is encrypted in transit, and the credentials that could unlock your
                accounts — your 2FA secret, your sync credentials — are sealed before they ever
                touch disk.
              </p>
            </div>
            <div className="sp-items">
              <Item title="Sensitive secrets, sealed" facts={["AES-256-GCM secrets"]}>
                Your contacts live in a PostgreSQL database on our own servers — not a third-party
                managed database. Your most sensitive secrets go further: your 2FA secret and your
                sync credentials ({syncProvidersLabel}) are each sealed with <code>AES-256-GCM</code>{" "}
                before they ever touch disk, so they&apos;re never readable from a raw database copy.
              </Item>
              <Item title="TLS-only connections" facts={["TLS 1.2+", "HSTS preload", "Auto-renewed certs"]}>
                Every request — web, mobile, CardDAV, and API — travels over <code>TLS 1.2</code> or
                higher. Plain HTTP is redirected, never served, and an <code>HSTS</code> header keeps
                browsers on HTTPS from the very first visit. Certificates renew automatically.
              </Item>
            </div>
          </section>

          {/* ── 02 Accounts & access ── */}
          <section className="sp-b" id="access" aria-labelledby="access-h">
            <div className="sp-b__txt">
              <MktLabel n="02">Accounts &amp; access</MktLabel>
              <h2 className="mkt-h3" id="access-h">Getting in is hard for everyone but you</h2>
              <p className="sp-b__lede">
                Strong defaults on your account, and careful handling of the credentials you give us
                to sync.
              </p>
              <div className="sp-items sp-items--stack">
                <Item title="Secure by default" facts={["bcrypt", "TOTP 2FA", "Step-up auth", "Rate limiting"]}>
                  Passwords are hashed with <code>bcrypt</code> — never stored or logged. Turn on{" "}
                  <code>TOTP</code> two-factor in under a minute, with single-use recovery codes.
                  Sensitive actions re-ask for your password mid-session, and sign-in endpoints are
                  rate-limited against brute force.
                </Item>
                <Item
                  title="Sync credentials, handled with care"
                  facts={["Encrypted OAuth tokens", "Scoped app passwords", "Instant revocation"]}
                >
                  OAuth tokens for {outlookLive ? "Google and Outlook" : "Google"} are encrypted before
                  storage and used only for the accounts you link. For CardDAV you issue scoped app
                  passwords instead of your main password — revoke one and that client is cut off on
                  its very next request.
                </Item>
              </div>
            </div>
            <MktWindow bar="Settings · Security" className="sp-vis">
              <p className="sp-v-label">Two-factor</p>
              <div className="sp-vrow">
                <span className="sp-glyph">
                  <Glyph name="lock" />
                </span>
                <div className="sp-vrow__m">
                  <div className="sp-vname">Authenticator app</div>
                  <div className="sp-vsub">TOTP · recovery codes saved</div>
                </div>
                <span className="sp-ok">
                  <CheckIcon size={13} />
                  On
                </span>
              </div>
              <p className="sp-v-label sp-v-label--gap">App passwords</p>
              {[
                ["Lina\u2019s iPhone", "CardDAV · created 2 Sep"],
                ["MacBook Air", "CardDAV · created 2 Sep"],
                ["Old iPad", "CardDAV · created 14 Mar"],
              ].map(([name, sub]) => (
                <div className="sp-vrow" key={name}>
                  <span className="sp-glyph">
                    <Glyph name="key" />
                  </span>
                  <div className="sp-vrow__m">
                    <div className="sp-vname">{name}</div>
                    <div className="sp-vsub">{sub}</div>
                  </div>
                  <span className="sp-vbtn">Revoke</span>
                </div>
              ))}
            </MktWindow>
          </section>

          {/* ── 03 Your data & disclosure ── */}
          <section className="sp-b" id="your-data" aria-labelledby="your-data-h">
            <div className="sp-b__txt">
              <MktLabel n="03">Your data &amp; disclosure</MktLabel>
              <h2 className="mkt-h3" id="your-data-h">Your contacts are yours — and we mean it</h2>
              <p className="sp-b__lede">
                Take your data with you whenever you like, and tell us if you find a problem.
              </p>
              <div className="sp-items sp-items--stack">
                <Item
                  title="Your data, your rights"
                  facts={["CSV, all plans", "vCard on Pro", "GDPR archive", "Scheduled deletion"]}
                >
                  Export everything — contacts, labels, and account data — as CSV or a full GDPR
                  archive, on any plan including Free; vCard export is available on Pro. Account
                  deletion runs on a clear schedule, export links expire on their own, and we never
                  sell your data or run ads against it.
                </Item>
                <Item
                  title="Responsible disclosure"
                  facts={["security@getkontax.com", "Coordinated disclosure"]}
                >
                  Found something? Email <a href="mailto:security@getkontax.com">security@getkontax.com</a>{" "}
                  with steps to reproduce and we&apos;ll acknowledge quickly. We won&apos;t pursue
                  legal action against good-faith research that respects user privacy and avoids data
                  destruction — just give us time to ship a fix first.
                </Item>
              </div>
            </div>
            <MktWindow bar="Settings · Export" className="sp-vis">
              <p className="sp-v-label">Export everything</p>
              {[
                ["CSV", "Contacts, labels and account data", "All plans", true],
                ["GDPR archive", "A full copy of your account", "All plans", false],
                ["vCard (.vcf)", "For any contacts app", "Pro", false],
              ].map(([name, sub, plan, on]) => (
                <div className="sp-vrow" key={name as string}>
                  <span className={`sp-radio${on ? " sp-radio--on" : ""}`} />
                  <div className="sp-vrow__m">
                    <div className="sp-vname">{name}</div>
                    <div className="sp-vsub">{sub}</div>
                  </div>
                  <SourceTag>{plan}</SourceTag>
                </div>
              ))}
              <div className="sp-vfoot">
                <span className="sp-vbtn sp-vbtn--solid">Download export</span>
              </div>
            </MktWindow>
          </section>

          {/* ── What we don't claim ── */}
          <aside className="sp-note" aria-label="Certifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v4h1" />
            </svg>
            <p>
              <strong>No badges we haven&apos;t earned.</strong> We deliberately don&apos;t claim SOC 2,
              ISO 27001, or certifications that are still in progress. Everything on this page is true
              of Kontax today — nothing aspirational.
            </p>
          </aside>
        </div>
      </div>

      <CtaBand
        title="Your contacts, kept safe"
        sub="Start free — no credit card, no tracking, and a full export whenever you want one."
        secondary={null}
      />
    </>
  );
}
