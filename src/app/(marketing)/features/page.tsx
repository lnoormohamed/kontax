import Link from "next/link";
import type { Metadata } from "next";
import "./features.css";

export const metadata: Metadata = {
  title: "Features — Kontax",
  description:
    "From search to sync to sharing — everything Kontax does for your contacts, up close.",
};

export default function FeaturesPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__eyebrow">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />
            </svg>
            Every feature, up close
          </span>
          <h1 className="fp-hero__title">
            Everything your address book has been missing
          </h1>
          <p className="fp-hero__sub">
            From search to sync to sharing — Kontax keeps your contacts
            organised, backed up, and always up to date.
          </p>
        </div>
      </section>

      {/* ── Feature 1 — Search (mock left) ── */}
      <section className="fp-feat fp-feat--imgleft">
        <div className="fp-feat__grid">
          <div className="fp-feat__shot" aria-hidden="true">
            <div className="fp-shot__pane">
              <div className="fp-sm__bar">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.2-3.2" />
                </svg>
                <span>jam</span>
                <span className="fp-sm__cursor" />
              </div>
              <div className="fp-sm__panel">
                <div className="fp-sm__cat">Name</div>
                <div className="fp-sm__row fp-sm__row--active">
                  <span className="fp-av fp-av--36 fp-av--g">JW</span>
                  <span>
                    <span className="fp-sm__name"><span className="fp-hl">Jam</span>es Whitfield</span>
                    <span className="fp-sm__meta">Mobile · Work</span>
                  </span>
                </div>
                <div className="fp-sm__row">
                  <span className="fp-av fp-av--36 fp-av--a">JC</span>
                  <span>
                    <span className="fp-sm__name"><span className="fp-hl">Jam</span>ie Cole</span>
                    <span className="fp-sm__meta">Family</span>
                  </span>
                </div>
                <div className="fp-sm__cat">Email</div>
                <div className="fp-sm__row">
                  <span className="fp-av fp-av--36 fp-av--p">RP</span>
                  <span>
                    <span className="fp-sm__name">Rosa Pérez</span>
                    <span className="fp-sm__meta">rosa.<span className="fp-hl">jam</span>@studio.co</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="fp-feat__copy">
            <h2 className="fp-feat__h">Search that actually works</h2>
            <p className="fp-feat__body">
              Type a name, phone number, email, company, label, or note —
              Kontax finds it instantly. Results are grouped by match type so
              you see exactly why a contact appeared. No more scrolling past
              irrelevant results or wondering if you spelled the name right.
            </p>
          </div>
        </div>
      </section>

      {/* ── Feature 2 — Labels (mock right) ── */}
      <section className="fp-feat fp-feat--alt fp-feat--imgright">
        <div className="fp-feat__grid">
          <div className="fp-feat__copy">
            <h2 className="fp-feat__h">Labels that organise, not just tag</h2>
            <p className="fp-feat__body">
              Group contacts by anything that matters — family, clients, the
              five-a-side team — and filter your whole address book down to them
              in a tap. Labels stack, so one person can be both Work and VIP at
              once. Colour-coded badges keep every list scannable at a glance.
            </p>
          </div>
          <div className="fp-feat__shot" aria-hidden="true">
            <div className="fp-shot__pane">
              <div className="fp-lm__chips">
                <span className="fp-lm__chip">All</span>
                <span className="fp-lm__chip fp-lm__chip--active">Family</span>
                <span className="fp-lm__chip">Work</span>
                <span className="fp-lm__chip">Clients</span>
              </div>
              <div className="fp-lm__list">
                {(
                  [
                    { initials: "EM", color: "fp-av--g", name: "Elena Morales",  labels: ["family", "vip"]  },
                    { initials: "DK", color: "fp-av--a", name: "David Kaur",     labels: ["family"]         },
                    { initials: "TN", color: "fp-av--c", name: "Theo Nakamura",  labels: ["family", "work"] },
                    { initials: "SA", color: "fp-av--p", name: "Sofia Andersson", labels: ["family"]         },
                  ] as { initials: string; color: string; name: string; labels: string[] }[]
                ).map(({ initials, color, name, labels }) => (
                  <div key={name} className="fp-lm__row">
                    <span className={`fp-av fp-av--40 ${color}`}>{initials}</span>
                    <span className="fp-lm__nm">{name}</span>
                    <span className="fp-lm__badges">
                      {labels.includes("family") && <span className="fp-mock-label fp-ml--family">Family</span>}
                      {labels.includes("work")   && <span className="fp-mock-label fp-ml--work">Work</span>}
                      {labels.includes("vip")    && <span className="fp-mock-label fp-ml--vip">VIP</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature 3 — Sync (mock left) ── */}
      <section className="fp-feat fp-feat--imgleft">
        <div className="fp-feat__grid">
          <div className="fp-feat__shot" aria-hidden="true">
            <div className="fp-shot__pane fp-ym">
              <div className="fp-ym__row">
                <span className="fp-ym__icn" style={{ background: "#4285f4" }}>G</span>
                <span>
                  <span className="fp-ym__nm">Google Contacts</span>
                  <span className="fp-ym__sub">elena@gmail.com · 1,204 contacts</span>
                </span>
                <span className="fp-ym__status fp-st--ok">
                  <span className="fp-dot fp-dot--ok" />Synced 2m ago
                </span>
              </div>
              <div className="fp-ym__row">
                <span className="fp-ym__icn" style={{ background: "var(--mkt-green)" }}>C</span>
                <span>
                  <span className="fp-ym__nm">Fastmail</span>
                  <span className="fp-ym__sub">CardDAV · carddav.fastmail.com</span>
                </span>
                <span className="fp-ym__status fp-st--ok">
                  <span className="fp-dot fp-dot--ok" />Synced 6m ago
                </span>
              </div>
              <div className="fp-ym__row">
                <span className="fp-ym__icn" style={{ background: "#0a6ed1" }}>O</span>
                <span>
                  <span className="fp-ym__nm">Outlook</span>
                  <span className="fp-ym__sub">elena@outlook.com · 318 contacts</span>
                </span>
                <span className="fp-ym__status fp-st--busy">
                  <span className="fp-dot fp-dot--busy" />Syncing…
                </span>
              </div>
            </div>
          </div>
          <div className="fp-feat__copy">
            <h2 className="fp-feat__h">One address book, every device</h2>
            <p className="fp-feat__body">
              Connect Google Contacts, Outlook, and any CardDAV account —
              iCloud, Fastmail, Nextcloud — and Kontax keeps them all in step.
              Edits sync both ways on a schedule, with a clear status on every
              connection so you always know what&apos;s current. One address
              book, mirrored everywhere you already work.
            </p>
          </div>
        </div>
      </section>

      {/* ── Feature 4 — Sharing (mock right) ── */}
      <section className="fp-feat fp-feat--alt fp-feat--imgright">
        <div className="fp-feat__grid">
          <div className="fp-feat__copy">
            <h2 className="fp-feat__h">Share with family or your team</h2>
            <p className="fp-feat__body">
              Invite the people you trust into a shared address book and
              everyone sees the same up-to-date contacts. Assign roles — owner,
              editor, or viewer — so you control who can change what. Updates
              appear live, so when one person fixes a number, it&apos;s fixed
              for everyone.
            </p>
          </div>
          <div className="fp-feat__shot" aria-hidden="true">
            <div className="fp-shot__pane">
              <div className="fp-hm__card">
                <div className="fp-hm__head">
                  <span className="fp-hm__bk">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19V6a2 2 0 0 1 2-2h9l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                    </svg>
                  </span>
                  <span>
                    <span className="fp-hm__title">Morales Family</span>
                    <span className="fp-hm__cnt">3 members · 248 shared contacts</span>
                  </span>
                </div>
                {(
                  [
                    { initials: "EM", color: "fp-av--g", name: "Elena Morales", email: "elena@gmail.com",      role: "owner"  },
                    { initials: "DK", color: "fp-av--a", name: "David Kaur",    email: "david.kaur@gmail.com", role: "editor" },
                    { initials: "TN", color: "fp-av--c", name: "Theo Nakamura", email: "theo.n@icloud.com",    role: "viewer" },
                  ] as const
                ).map(({ initials, color, name, email, role }) => (
                  <div key={name} className="fp-hm__row">
                    <span className={`fp-av fp-av--36 ${color}`}>{initials}</span>
                    <span>
                      <span className="fp-hm__nm">{name}</span>
                      <span className="fp-hm__em">{email}</span>
                    </span>
                    <span className={`fp-role fp-role--${role}`}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature 5 — Public card (mock left) ── */}
      <section className="fp-feat fp-feat--imgleft">
        <div className="fp-feat__grid">
          <div className="fp-feat__shot" aria-hidden="true">
            <div className="fp-shot__pane fp-pm">
              <div className="fp-pm__phone">
                <div className="fp-pm__photo">LP</div>
                <p className="fp-pm__nm">Lena Park</p>
                <p className="fp-pm__role">Product Designer · Studio North</p>
                <div className="fp-pm__fields">
                  <div className="fp-pm__f">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
                    </svg>
                    +44 7700 900421
                  </div>
                  <div className="fp-pm__f">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                    lena@studionorth.co
                  </div>
                  <div className="fp-pm__f">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                    </svg>
                    studionorth.co
                  </div>
                </div>
                <div className="fp-pm__btn">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add to contacts
                </div>
              </div>
            </div>
          </div>
          <div className="fp-feat__copy">
            <h2 className="fp-feat__h">Your public contact card</h2>
            <p className="fp-feat__body">
              Give out one short link instead of reciting your details. Your
              public card shows exactly the fields you choose, and anyone can
              save you to their phone with a single tap — no app required.
              Update your number once and every card you&apos;ve ever shared
              updates with it.
            </p>
            <Link className="fp-feat__link" href="/u/demo">
              See an example{" "}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature 6 — API (mock right) ── */}
      <section className="fp-feat fp-feat--alt fp-feat--imgright">
        <div className="fp-feat__grid">
          <div className="fp-feat__copy">
            <h2 className="fp-feat__h">A developer API built for automation</h2>
            <p className="fp-feat__body">
              Every contact, label, and address book is available through a
              clean REST API. Authenticate with a scoped key, then read or write
              contacts straight from your own tools, scripts, and integrations.
              Rate limits are generous and every response is plain JSON.
            </p>
            <Link className="fp-feat__link" href="/developers">
              Read the API docs{" "}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
          <div className="fp-feat__shot fp-feat__shot--code" aria-hidden="true">
            <div className="fp-code">
              <div className="fp-code__bar">
                <span className="fp-code__dot fp-code__dot--r" />
                <span className="fp-code__dot fp-code__dot--y" />
                <span className="fp-code__dot fp-code__dot--g" />
                <span className="fp-code__tab">bash — api.getkontax.com</span>
              </div>
              <div className="fp-code__body">
                <div className="fp-code__line">
                  <span className="fp-code__prompt">$ </span>
                  <span className="fp-c-cmd">curl</span>{" "}
                  <span className="fp-c-flag">-H</span>{" "}
                  <span className="fp-c-str">&quot;Authorization: Bearer kt_live_xxx&quot;</span> \
                </div>
                <div className="fp-code__line">
                  {"     "}<span className="fp-c-url">https://api.getkontax.com/v1/contacts</span>
                </div>
                <div className="fp-code__line fp-code__out">&nbsp;</div>
                <div className="fp-code__line fp-code__out">
                  <span className="fp-code__brace">{"{"}</span>{" "}
                  <span className="fp-code__key">&quot;data&quot;</span>: [
                </div>
                <div className="fp-code__line fp-code__out">
                  {"    "}<span className="fp-code__brace">{"{"}</span>{" "}
                  <span className="fp-code__key">&quot;id&quot;</span>:{" "}
                  <span className="fp-c-str">&quot;ct_8f21&quot;</span>,{" "}
                  <span className="fp-code__key">&quot;name&quot;</span>:{" "}
                  <span className="fp-c-str">&quot;Elena Morales&quot;</span>,
                </div>
                <div className="fp-code__line fp-code__out">
                  {"      "}<span className="fp-code__key">&quot;labels&quot;</span>: [
                  <span className="fp-c-str">&quot;Family&quot;</span>,{" "}
                  <span className="fp-c-str">&quot;VIP&quot;</span>]{" "}
                  <span className="fp-code__brace">{"}"}</span>,
                </div>
                <div className="fp-code__line fp-code__out">
                  {"    "}<span className="fp-code__brace">{"{"}</span>{" "}
                  <span className="fp-code__key">&quot;id&quot;</span>:{" "}
                  <span className="fp-c-str">&quot;ct_8f33&quot;</span>,{" "}
                  <span className="fp-code__key">&quot;name&quot;</span>:{" "}
                  <span className="fp-c-str">&quot;David Kaur&quot;</span>{" "}
                  <span className="fp-code__brace">{"}"}</span>
                </div>
                <div className="fp-code__line fp-code__out">
                  {"  ], "}<span className="fp-code__key">&quot;has_more&quot;</span>:{" "}
                  <span className="fp-c-flag">false</span>{" "}
                  <span className="fp-code__brace">{"}"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="mkt-cta-band">
        <div className="mkt-cta-band__inner">
          <h2 className="mkt-cta-band__title">Ready to tidy your address book?</h2>
          <p className="mkt-cta-band__sub">
            Free forever for up to 100 contacts. Upgrade whenever you&apos;re ready.
          </p>
          <Link className="mkt-cta-band__btn" href="/register">
            Get started free{" "}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
