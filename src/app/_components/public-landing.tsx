import Link from "next/link";

import { LandingReveal } from "~/app/_components/landing-reveal";
import { PublicFooter } from "~/app/_components/public-footer";
import { PublicNav } from "~/app/_components/public-nav";
import "~/app/_components/public-site.css";

export function PublicLanding({ isAuthenticated }: { isAuthenticated?: boolean }) {
  return (
    <div className="kx">
      <LandingReveal />

      <PublicNav isAuthenticated={isAuthenticated} />

      <main id="top">
        {/* ─────────────────────────── HERO ─────────────────────────── */}
        <section className="hero">
          <div className="hero__inner">
            <div className="hero__copy">
              <p className="eyebrow">Contact management, reimagined</p>
              <h1 className="hero__title">Your contacts,<br />synced everywhere.</h1>
              <p className="hero__sub">One address book, always up to date — across all your devices, apps, and the people you share with.</p>
              <div className="hero__ctas">
                {isAuthenticated ? (
                  <Link className="btn-primary" href="/contacts">
                    Open Kontax
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13" /><path d="M13 6l6 6-6 6" /></svg>
                  </Link>
                ) : (
                  <>
                    <Link className="btn-primary" href="/register">Get started free</Link>
                    <Link className="btn-secondary" href="/login">
                      Log in
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13" /><path d="M13 6l6 6-6 6" /></svg>
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="hero__preview">
              <div className="preview" role="img" aria-label="Preview of the Kontax contacts list">
                <div className="chrome">
                  <div className="chrome__dots">
                    <span className="chrome__dot" style={{ background: "#ec6a5e" }}></span>
                    <span className="chrome__dot" style={{ background: "#f4be4f" }}></span>
                    <span className="chrome__dot" style={{ background: "#61c454" }}></span>
                  </div>
                  <div className="chrome__url">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#8b938c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                    vexon.co
                  </div>
                </div>
                <div className="app-header">
                  <div className="app-header__brand">
                    <span className="app-header__k">K</span>
                    <span className="app-header__word">Kontax</span>
                  </div>
                  <div className="app-header__actions">
                    <span className="mini-create">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                      Create contact
                    </span>
                    <span className="mini-icon">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-2 8-2 8h16s-2-1-2-8" /><path d="M10.5 21a1.8 1.8 0 003 0" /></svg>
                    </span>
                    <span className="app-header__avatar">L</span>
                  </div>
                </div>
                <div className="app-search">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b938c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3" /></svg>
                  Search by name, email, phone…
                </div>
                <div className="list">
                  <div className="sec-head">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#bf8526" stroke="#bf8526" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 17.8 6.1 20.5l1.3-6.3L2.7 9.6l6.3-.7z" /></svg>
                    Favourites
                  </div>
                  <div className="row">
                    <span className="row__av" style={{ background: "#efe9df", color: "#85703f" }}>AO</span>
                    <span className="row__text"><span className="row__name">Amara Okafor</span><span className="row__meta">Orbit Health</span></span>
                  </div>
                  <div className="sec-head">A</div>
                  <div className="row">
                    <span className="row__av" style={{ background: "#e9e7f4", color: "#5a55a6" }}>AC</span>
                    <span className="row__text"><span className="row__name">Alex Chen</span><span className="row__meta">alex@acme.com</span></span>
                  </div>
                  <div className="row">
                    <span className="row__av" style={{ background: "#f2e6ea", color: "#9a4a63" }}>AW</span>
                    <span className="row__text"><span className="row__name">Alexandra Wong</span><span className="row__meta">+1 415 555 0192</span></span>
                  </div>
                  <div className="sec-head">B</div>
                  <div className="row">
                    <span className="row__av" style={{ background: "#e6ece4", color: "#3f6b53" }}>BN</span>
                    <span className="row__text"><span className="row__name">Ben Nakamura</span><span className="row__meta">Acme Corp</span></span>
                  </div>
                  <div className="row">
                    <span className="row__av" style={{ background: "#e8efe0", color: "#5f7a3a" }}>BO</span>
                    <span className="row__text"><span className="row__name">Beth Okafor</span><span className="row__meta">beth@studiob.co</span></span>
                  </div>
                  <div className="sec-head">C</div>
                  <div className="row">
                    <span className="row__av" style={{ background: "#e3eef0", color: "#3f7d7a" }}>CR</span>
                    <span className="row__text"><span className="row__name">Carlos Rivera</span><span className="row__meta">+44 7911 555 021</span></span>
                  </div>
                  <div className="row">
                    <span className="row__av" style={{ background: "#f3e7df", color: "#9a623a" }}>CD</span>
                    <span className="row__text"><span className="row__name">Clara Dubois</span><span className="row__meta">clara@design.fr</span></span>
                  </div>
                  <div className="list__bottom-fade"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────── TRUST STRIP ─────────────────────────── */}
        <section className="trust" aria-label="Works with">
          <div className="trust__inner">
            <span className="trust__label">Works with</span>
            <span className="trust__item">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="10" r="2.4" /><path d="M8 17c0-2.2 1.8-3.4 4-3.4s4 1.2 4 3.4" /></svg>
              Apple Contacts
            </span>
            <span className="trust__dot"></span>
            <span className="trust__item">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="3" /><path d="M5 19c0-3 3.1-4.8 7-4.8s7 1.8 7 4.8" /></svg>
              Google Contacts
            </span>
            <span className="trust__dot"></span>
            <span className="trust__item">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
              Outlook
            </span>
            <span className="trust__dot"></span>
            <span className="trust__item">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9a8 8 0 0114-3l2 2" /><path d="M20 15a8 8 0 01-14 3l-2-2" /><path d="M20 4v4h-4" /><path d="M4 20v-4h4" /></svg>
              Any CardDAV client
            </span>
          </div>
        </section>

        {/* ─────────────────────────── HOW IT WORKS ─────────────────────────── */}
        <section className="band" id="how">
          <div className="container">
            <div className="section-head section-head--center reveal">
              <p className="section-kicker">How it works</p>
              <h2 className="section-title">From scattered to synced in three steps</h2>
              <p className="section-lede">No migration project, no proprietary client. Bring your contacts in, connect your devices, and share what matters — without the fiddly setup.</p>
            </div>
            <div className="steps">
              <div className="step reveal">
                <div className="step__num">1</div>
                <h3 className="step__title">Import</h3>
                <p className="step__body">Bring your contacts from Google, Apple, Outlook, or a CSV. Nothing left behind.</p>
              </div>
              <div className="step reveal">
                <div className="step__num">2</div>
                <h3 className="step__title">Sync</h3>
                <p className="step__body">Connect any device over CardDAV. Edits sync everywhere, instantly.</p>
              </div>
              <div className="step reveal">
                <div className="step__num">3</div>
                <h3 className="step__title">Share</h3>
                <p className="step__body">Share a contact or a whole book — they stay current automatically.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────── DEEP FEATURES ─────────────────────────── */}
        <section className="band band--surface" id="features">
          <div className="features container">
            <div className="section-head section-head--center reveal">
              <p className="section-kicker">Built for the long run</p>
              <h2 className="section-title">Everything an address book should have done all along</h2>
            </div>

            {/* Sync */}
            <div className="frow reveal">
              <div className="frow__text">
                <span className="ficon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9a8 8 0 0114-3l2 2" /><path d="M20 15a8 8 0 01-14 3l-2-2" /><path d="M20 4v4h-4" /><path d="M4 20v-4h4" /></svg>
                </span>
                <h3 className="frow__title">Live everywhere, through an open standard</h3>
                <p className="frow__body">Kontax speaks CardDAV — the same protocol Apple Contacts and Google use — so your address book stays in lockstep across every device and app. No proprietary client to install, and up to five sync accounts on Pro.</p>
                <div className="frow__meta">
                  <span className="chip chip--live">CardDAV</span>
                  <span className="chip chip--live">No lock-in</span>
                </div>
              </div>
              <div className="frow__media">
                <div className="mini">
                  <div className="mini__label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b938c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9a8 8 0 0114-3l2 2" /><path d="M20 15a8 8 0 01-14 3l-2-2" /><path d="M20 4v4h-4" /><path d="M4 20v-4h4" /></svg>
                    Synced 5h ago
                  </div>
                  <div className="sync-grid">
                    <div className="sync-dev">
                      <div className="dev-box"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5c655e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg></div>
                      <span>iPhone</span>
                    </div>
                    <svg className="sync-line" width="26" height="20" viewBox="0 0 26 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h17l-3-3" /><path d="M23 13H6l3 3" /></svg>
                    <div className="sync-dev">
                      <div className="dev-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#17352e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M9 21h6" /><path d="M12 18v3" /></svg></div>
                      <span>Laptop</span>
                    </div>
                    <svg className="sync-line" width="26" height="20" viewBox="0 0 26 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h17l-3-3" /><path d="M23 13H6l3 3" /></svg>
                    <div className="sync-dev">
                      <div className="dev-box"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5c655e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></svg></div>
                      <span>Tablet</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity */}
            <div className="frow frow--flip reveal">
              <div className="frow__text">
                <span className="ficon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
                </span>
                <h3 className="frow__title">Every change, on the record</h3>
                <p className="frow__body">See who changed what, and when — edits, merges, imports, and syncs across your whole account. Pro keeps a 365-day activity feed, and the last 20 events per contact are kept forever, so recent history is never lost.</p>
                <div className="frow__meta">
                  <span className="chip chip--live">365-day feed</span>
                  <span className="chip chip--live">Source badges</span>
                </div>
              </div>
              <div className="frow__media">
                <div className="mini">
                  <div className="mini__label">Activity</div>
                  <div className="act-item">
                    <span className="act-dot" style={{ background: "#4158f4" }}></span>
                    <div><div className="act-text"><b>Alex Chen</b> — phone number updated</div><div className="act-time">2 hours ago · iCloud sync</div></div>
                  </div>
                  <div className="act-item">
                    <span className="act-dot" style={{ background: "#17352e" }}></span>
                    <div><div className="act-text"><b>Beth Okafor</b> merged with duplicate</div><div className="act-time">Yesterday · You</div></div>
                  </div>
                  <div className="act-item">
                    <span className="act-dot" style={{ background: "#bf8526" }}></span>
                    <div><div className="act-text">Imported <b>48 contacts</b> from Google</div><div className="act-time">3 days ago · CSV import</div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Import */}
            <div className="frow reveal">
              <div className="frow__text">
                <span className="ficon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>
                </span>
                <h3 className="frow__title">Bring your contacts — leave nothing behind</h3>
                <p className="frow__body">One-click import from CSV or vCard, with tuned source profiles for Google, Apple, and Outlook. Every contact carries a source badge, so you always know where it came from and which import or account it belongs to.</p>
                <div className="frow__meta">
                  <span className="chip chip--live">CSV &amp; vCard</span>
                  <span className="chip chip--live">Google · Apple · Outlook</span>
                </div>
              </div>
              <div className="frow__media">
                <div className="mini">
                  <div className="mini__label">Import preview · 48 contacts</div>
                  <div className="mini-row">
                    <span className="mini-av" style={{ background: "#e9e7f4", color: "#5a55a6" }}>AC</span>
                    <div><div className="mini-name">Alex Chen</div><div className="mini-sub">alex@acme.com</div></div>
                    <span className="dchip" style={{ background: "#edf0fe", color: "#3a49c0", marginLeft: "auto" }}>Google</span>
                  </div>
                  <div className="mini-row">
                    <span className="mini-av" style={{ background: "#e6ece4", color: "#3f6b53" }}>BN</span>
                    <div><div className="mini-name">Ben Nakamura</div><div className="mini-sub">Acme Corp</div></div>
                    <span className="dchip" style={{ background: "#edf0fe", color: "#3a49c0", marginLeft: "auto" }}>Google</span>
                  </div>
                  <div className="mini-row">
                    <span className="mini-av" style={{ background: "#f3e7df", color: "#9a623a" }}>CD</span>
                    <div><div className="mini-name">Clara Dubois</div><div className="mini-sub">clara@design.fr</div></div>
                    <span className="dchip" style={{ background: "#f6edd9", color: "#8a6118", marginLeft: "auto" }}>Apple</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Coming soon: Family & team sharing */}
            <div className="soon-card reveal">
              <span className="soon-card__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.2a3 3 0 010 5.6" /><path d="M17.5 14.4c2 .8 3.5 2.3 3.5 4.6" /></svg>
              </span>
              <div>
                <div className="soon-card__top">
                  <h3 className="soon-card__title">Family &amp; team sharing</h3>
                  <span className="chip chip--soon">Coming soon</span>
                </div>
                <p className="soon-card__body">A shared address book for your household or small team — everyone edits, everyone stays current, with admin controls and live sync across members. Arriving soon.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────── TESTIMONIALS ─────────────────────────── */}
        {/* NOTE: placeholder quotes — replace with real, attributable testimonials before launch. */}
        <section className="band container">
          <div className="section-head section-head--center reveal">
            <p className="section-kicker">Social proof</p>
            <h2 className="section-title">People who keep a lot of contacts, kept happy</h2>
          </div>
          <div className="tgrid">
            <figure className="tcard reveal">
              <blockquote className="tquote">&ldquo;I moved fifteen years of contacts off three different phones in an afternoon. The import just understood my messy Google export.&rdquo;</blockquote>
              <figcaption className="tperson">
                <span className="tperson__av" style={{ background: "#e0ebe2", color: "#356048" }}>RM</span>
                <span><span className="tperson__name">Rosa Marín</span><br /><span className="tperson__role">Freelance photographer</span></span>
              </figcaption>
            </figure>
            <figure className="tcard reveal">
              <blockquote className="tquote">&ldquo;It syncs to Apple Contacts over CardDAV without a single proprietary app. That alone made it worth switching.&rdquo;</blockquote>
              <figcaption className="tperson">
                <span className="tperson__av" style={{ background: "#e6e6f2", color: "#4f4a9c" }}>DK</span>
                <span><span className="tperson__name">Daniel Køhler</span><br /><span className="tperson__role">Software engineer</span></span>
              </figcaption>
            </figure>
            <figure className="tcard reveal">
              <blockquote className="tquote">&ldquo;The merge tool caught duplicates I&rsquo;d been ignoring for years — and the undo window meant I never worried about getting it wrong.&rdquo;</blockquote>
              <figcaption className="tperson">
                <span className="tperson__av" style={{ background: "#f1e7dd", color: "#8c5a36" }}>AO</span>
                <span><span className="tperson__name">Amara Okafor</span><br /><span className="tperson__role">Operations lead, Orbit Health</span></span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ─────────────────────────── PRIVACY / OWNERSHIP ─────────────────────────── */}
        <section className="band band--surface" id="privacy">
          <div className="container">
            <div className="section-head section-head--center reveal">
              <p className="section-kicker">Privacy &amp; ownership</p>
              <h2 className="section-title">Your contacts, yours</h2>
              <p className="section-lede">It&rsquo;s the one thing the big platforms can&rsquo;t say. With Kontax you&rsquo;re never locked in, and never in the dark about your own information.</p>
            </div>
            <div className="priv-grid">
              <div className="priv-card reveal">
                <span className="priv-card__icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9a8 8 0 0114-3l2 2" /><path d="M20 15a8 8 0 01-14 3l-2-2" /><path d="M20 4v4h-4" /><path d="M4 20v-4h4" /></svg></span>
                <h3 className="priv-card__title">Open standards</h3>
                <p className="priv-card__body">Built on CardDAV. No lock-in, ever — leave with one click and your contacts come with you, in formats every app understands.</p>
              </div>
              <div className="priv-card reveal">
                <span className="priv-card__icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></svg></span>
                <h3 className="priv-card__title">Export anytime</h3>
                <p className="priv-card__body">Your full address book as vCard or CSV, whenever you want — including on a cancelled account. Portability is a guarantee, not a perk.</p>
              </div>
              <div className="priv-card reveal">
                <span className="priv-card__icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 4v5c0 4.4-3.1 7.6-8 9-4.9-1.4-8-4.6-8-9V7z" /><path d="M9 12l2 2 4-4" /></svg></span>
                <h3 className="priv-card__title">We don&rsquo;t sell your data</h3>
                <p className="priv-card__body">No ads, no profiling. Kontax is funded by subscriptions, so you&rsquo;re the customer — never the product.</p>
              </div>
            </div>
            <div className="priv-quote reveal">
              <p>&ldquo;Your address book should outlive any one app.&rdquo;</p>
              <Link className="priv-link" href="/privacy">Read our privacy policy
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13" /><path d="M13 6l6 6-6 6" /></svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ─────────────────────────── PRICING TEASER ─────────────────────────── */}
        <section className="band container">
          <div className="ptease reveal">
            <p className="section-kicker" style={{ textAlign: "center" }}>Pricing</p>
            <div className="ptease__price"><span>Free</span> for up to 500 contacts.</div>
            <p className="ptease__sub">Upgrade when you grow. Pro adds unlimited contacts and a deeper activity history; Family and Teams add shared address books for the people you sync with.</p>
            <Link className="ptease__link" href="/pricing">See all plans
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13" /><path d="M13 6l6 6-6 6" /></svg>
            </Link>
            <p className="ptease__note">Paid-plan prices shown at launch.</p>
          </div>
        </section>

        {/* ─────────────────────────── FAQ ─────────────────────────── */}
        <section className="band band--surface container">
          <div className="section-head section-head--center reveal">
            <p className="section-kicker">FAQ</p>
            <h2 className="section-title">Questions, answered</h2>
          </div>
          <div className="faq reveal">
            <details>
              <summary>Is it really free?<span className="q-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg></span></summary>
              <div className="faq__a">Yes. The Free plan holds up to 500 contacts with one sync account and full CSV &amp; vCard export — no credit card and no trial countdown. You only pay when you need unlimited contacts, more sync accounts, or shared address books.</div>
            </details>
            <details>
              <summary>Which apps does it sync with?<span className="q-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg></span></summary>
              <div className="faq__a">Kontax uses CardDAV, the open contacts standard built into iPhone, Android, macOS, Outlook, and most mail apps. You add Kontax as a CardDAV account with an app password — there&rsquo;s no separate app to install, and your contacts stay live in the address book you already use.</div>
            </details>
            <details>
              <summary>Can I export and leave?<span className="q-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg></span></summary>
              <div className="faq__a">Always. Export your full address book as CSV or vCard at any time — including on a cancelled account. We treat data portability as a guarantee, so you&rsquo;re never locked in.</div>
            </details>
            <details>
              <summary>Is my data secure and encrypted?<span className="q-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg></span></summary>
              <div className="faq__a">All traffic runs over HTTPS/TLS, your data is encrypted at rest, and passwords are stored only as bcrypt hashes — never plain text. Security-sensitive actions are recorded in an append-only audit log. See the <Link className="inline" href="/privacy">privacy policy</Link> for the full picture.</div>
            </details>
            <details>
              <summary>Do you sell my data?<span className="q-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg></span></summary>
              <div className="faq__a">Never. There are no ads and no profiling. Kontax is funded entirely by subscriptions — your contacts are yours, and they&rsquo;re never sold, mined, or shared with third parties for marketing.</div>
            </details>
            <details>
              <summary>When are family and team sharing available?<span className="q-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg></span></summary>
              <div className="faq__a">Shared address books for households and teams are coming soon. The Family and Teams plans on the <Link className="inline" href="/pricing">pricing page</Link> describe exactly what each will include when they ship.</div>
            </details>
          </div>
        </section>

        {/* ─────────────────────────── CLOSING CTA ─────────────────────────── */}
        <section className="cta-band">
          <div className="cta-band__inner reveal">
            <h2 className="cta-band__title">Take back your contacts.</h2>
            <p className="cta-band__sub">One clean address book, synced everywhere, that you&rsquo;ll never have to rebuild again.</p>
            <div className="cta-band__btns">
              {isAuthenticated ? (
                <Link className="btn-primary" href="/contacts">Open Kontax</Link>
              ) : (
                <>
                  <Link className="btn-primary" href="/register">Get started free</Link>
                  <Link className="btn-ghost" href="/pricing">See pricing</Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
