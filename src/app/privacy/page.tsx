import type { Metadata } from "next";

import { PublicFooter } from "~/app/_components/public-footer";
import { PublicNav } from "~/app/_components/public-nav";
import "~/app/_components/public-site.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kontax collects, uses, and protects your data. Your contacts are yours — no selling, no profiling, full export at any time.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="kx">
      <PublicNav />
      <main>
        <div className="doc-wrap">
          <div className="doc-head">
            <p className="eyebrow">Legal</p>
            <h1>Privacy Policy</h1>
            <p className="doc-meta">Last updated 10 June 2026 · Effective on public launch</p>
            <p className="doc-note"><strong>Draft for review.</strong> This policy describes Kontax&rsquo;s intended data practices and reflects our security baseline. It is a working draft and must be reviewed and approved by qualified legal counsel before public launch. It is not yet legal advice.</p>
          </div>

          <div className="doc-layout">
            <nav className="doc-toc" aria-label="Contents">
              <span className="doc-toc__title">Contents</span>
              <a href="#overview">1. Overview</a>
              <a href="#collect">2. Information we collect</a>
              <a href="#use">3. How we use it</a>
              <a href="#security">4. Storage &amp; security</a>
              <a href="#portability">5. Portability &amp; export</a>
              <a href="#retention">6. Data retention</a>
              <a href="#plans">7. Changing your plan</a>
              <a href="#third">8. Third-party services</a>
              <a href="#cookies">9. Cookies &amp; sessions</a>
              <a href="#rights">10. Your rights</a>
              <a href="#children">11. Children&rsquo;s privacy</a>
              <a href="#changes">12. Changes</a>
              <a href="#contact">13. Contact</a>
            </nav>

            <div className="doc-body">
              <section id="overview">
                <h2><span className="num">1</span> Overview</h2>
                <p>Kontax is a contact management service. This policy explains what information we collect, how we use and protect it, and the control you have over it. Our guiding principle is simple: <strong>your contacts are yours.</strong> We don&rsquo;t sell your data, we don&rsquo;t profile you for advertising, and we make it easy to take your information with you at any time.</p>
                <p>This policy applies to the Kontax web application, its CardDAV sync endpoints, and the public website.</p>
              </section>

              <section id="collect">
                <h2><span className="num">2</span> Information we collect</h2>
                <h3>Account information</h3>
                <p>When you register, we collect your email address and a password. Passwords are never stored in plain text — only as a bcrypt hash (see <a className="inline" href="#security">Storage &amp; security</a>).</p>
                <h3>Contact data you create or import</h3>
                <p>The contacts you add, import, or sync — names, email addresses, phone numbers, organisations, notes, and related fields. This is your data; we store and process it solely to provide the service to you.</p>
                <h3>Activity and usage records</h3>
                <p>To power the activity log and protect your account, we keep records of security-sensitive and contact-related actions — sign-ins, contact edits, merges, imports, exports, and sync events — along with metadata such as timestamps, IP address, and user agent.</p>
                <h3>Billing information</h3>
                <p>If you subscribe to a paid plan, payment is handled by our payment processor. We do not store full card details on our servers; we retain only the subscription status and identifiers needed to manage your plan.</p>
              </section>

              <section id="use">
                <h2><span className="num">3</span> How we use your information</h2>
                <ul>
                  <li>To provide, maintain, and secure the Kontax service and sync your contacts across your devices.</li>
                  <li>To authenticate you, prevent abuse, and maintain an audit trail of sensitive actions.</li>
                  <li>To process imports, exports, merges, and CardDAV synchronisation that you initiate.</li>
                  <li>To manage your subscription and send essential service communications (for example, security or billing notices).</li>
                </ul>
                <p>We do <strong>not</strong> use your contact data for advertising, sell it to third parties, or share it for anyone else&rsquo;s marketing.</p>
              </section>

              <section id="security">
                <h2><span className="num">4</span> Storage &amp; security</h2>
                <p>We protect your data with strong, clearly-enforced defaults:</p>
                <ul>
                  <li><strong>Encryption in transit.</strong> All traffic — sign-in, registration, import, export, billing, and sync — is served over HTTPS/TLS. Credentials and session tokens are never transmitted over plain HTTP.</li>
                  <li><strong>Encryption at rest.</strong> Our database and its backups are encrypted at rest by our infrastructure provider. Backups are treated with the same protection as production data.</li>
                  <li><strong>Password hashing.</strong> Passwords are stored only as bcrypt hashes, never in plain text or a reversible form.</li>
                  <li><strong>Audit trail.</strong> Security-sensitive actions are recorded in an append-only audit log that cannot be edited after the fact.</li>
                  <li><strong>Access controls.</strong> Production data access is role-based and tightly scoped, and secrets are managed through our deployment tooling rather than stored in code.</li>
                </ul>
                <p>No system can be guaranteed perfectly secure, but we treat protecting your trust as a first-order priority and continuously review these controls.</p>
              </section>

              <section id="portability">
                <h2><span className="num">5</span> Data portability &amp; export</h2>
                <p>You can export your full address book as <strong>CSV or vCard at any time</strong> — including on a cancelled or downgraded account. Portability is a guarantee, not a paid feature. Because Kontax is built on the open CardDAV standard, your contacts remain usable in Apple Contacts, Google Contacts, Outlook, and any other CardDAV-compatible client without lock-in.</p>
              </section>

              <section id="retention">
                <h2><span className="num">6</span> Data retention</h2>
                <p>We keep your contact data for as long as your account is active. Activity-log retention depends on your plan (for example, the global feed is retained for 365 days on Pro and 90 days on Family, while a number of the most recent events per contact are always kept). Import and export file artifacts are short-lived and cleaned up by routine jobs, while the corresponding job records may be retained for auditability.</p>
                <p>If you delete your account, we delete or anonymise your personal data within a reasonable period, except where we are required to retain limited records for legal or security reasons.</p>
              </section>

              <section id="plans">
                <h2><span className="num">7</span> Changing or cancelling your plan</h2>
                <p>Changing plans never deletes your data. If you downgrade, contacts above the new plan&rsquo;s limit become read-only rather than being removed, older activity beyond the new retention window may be pruned (recent per-contact history is always preserved), and live shares may convert to static snapshots. You can always export everything first.</p>
              </section>

              <section id="third">
                <h2><span className="num">8</span> Third-party services</h2>
                <p>We rely on a small number of trusted providers to operate Kontax:</p>
                <ul>
                  <li><strong>Hosting &amp; database.</strong> Infrastructure providers that store your data with provider-managed encryption at rest.</li>
                  <li><strong>Payment processing.</strong> A payment provider that handles subscription billing; full card details are held by them, not by us.</li>
                  <li><strong>CardDAV sync.</strong> When you connect an external CardDAV account (such as iCloud, Google, or a self-hosted server), contact data flows between Kontax and that service at your direction. Those services have their own privacy policies.</li>
                </ul>
                <p>We do not share your contact data with any third party for advertising or profiling.</p>
              </section>

              <section id="cookies">
                <h2><span className="num">9</span> Cookies &amp; sessions</h2>
                <p>We use strictly necessary cookies to keep you signed in and to secure your session. We do not use advertising or cross-site tracking cookies.</p>
              </section>

              <section id="rights">
                <h2><span className="num">10</span> Your rights</h2>
                <p>Depending on where you live, you may have rights to access, correct, export, or delete your personal data, and to object to or restrict certain processing. Kontax is designed to make most of these self-serve — you can view, edit, export, and delete your contacts directly in the app. For anything else, contact us using the details below.</p>
              </section>

              <section id="children">
                <h2><span className="num">11</span> Children&rsquo;s privacy</h2>
                <p>Kontax is not directed to children and is not intended for use by anyone under the age required by their local law to consent to data processing. We do not knowingly collect data from children.</p>
              </section>

              <section id="changes">
                <h2><span className="num">12</span> Changes to this policy</h2>
                <p>We may update this policy as the service evolves. When we make material changes, we&rsquo;ll update the date at the top and, where appropriate, notify you. Continued use of Kontax after a change means you accept the updated policy.</p>
              </section>

              <section id="contact">
                <h2><span className="num">13</span> Contact</h2>
                <p>Questions about this policy or your data? Email us at <a className="inline" href="mailto:privacy@vexon.co">privacy@vexon.co</a>.</p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
