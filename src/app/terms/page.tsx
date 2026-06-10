import type { Metadata } from "next";
import Link from "next/link";

import { PublicFooter } from "~/app/_components/public-footer";
import { PublicNav } from "~/app/_components/public-nav";
import "~/app/_components/public-site.css";

export const metadata: Metadata = {
  title: "Kontax · Terms of Service",
  description: "The terms of service governing your use of Kontax — your account, acceptable use, plans and billing, your content, and data portability.",
};

export default function TermsPage() {
  return (
    <div className="kx">
      <PublicNav />
      <main>
        <div className="doc-wrap">
          <div className="doc-head">
            <p className="eyebrow">Legal</p>
            <h1>Terms of Service</h1>
            <p className="doc-meta">Last updated 10 June 2026 · Effective on public launch</p>
            <p className="doc-note"><strong>Draft for review.</strong> These terms describe Kontax&rsquo;s intended agreement with its users. They are a working draft and must be reviewed and approved by qualified legal counsel before public launch. They are not yet legal advice.</p>
          </div>

          <div className="doc-layout">
            <nav className="doc-toc" aria-label="Contents">
              <span className="doc-toc__title">Contents</span>
              <a href="#acceptance">1. Acceptance</a>
              <a href="#account">2. Your account</a>
              <a href="#use">3. Acceptable use</a>
              <a href="#billing">4. Plans &amp; billing</a>
              <a href="#content">5. Your content</a>
              <a href="#portability">6. Portability</a>
              <a href="#availability">7. Availability</a>
              <a href="#termination">8. Termination</a>
              <a href="#disclaimers">9. Disclaimers</a>
              <a href="#liability">10. Liability</a>
              <a href="#changes">11. Changes</a>
              <a href="#contact">12. Contact</a>
            </nav>

            <div className="doc-body">
              <section id="acceptance">
                <h2><span className="num">1</span> Acceptance of terms</h2>
                <p>By creating a Kontax account or using the service, you agree to these Terms of Service and to our <Link className="inline" href="/privacy">Privacy Policy</Link>. If you don&rsquo;t agree, please don&rsquo;t use Kontax. If you&rsquo;re using Kontax on behalf of an organisation, you confirm you have authority to bind that organisation to these terms.</p>
              </section>

              <section id="account">
                <h2><span className="num">2</span> Your account</h2>
                <p>You&rsquo;re responsible for keeping your login credentials secure and for activity that happens under your account. Use a strong, unique password, and tell us promptly if you suspect unauthorised access. You must provide accurate registration information and be old enough to consent to data processing where you live.</p>
              </section>

              <section id="use">
                <h2><span className="num">3</span> Acceptable use</h2>
                <p>You agree not to misuse Kontax. In particular, you will not:</p>
                <ul>
                  <li>Use the service to store or distribute unlawful content, or to harass or harm others.</li>
                  <li>Upload contact data you don&rsquo;t have the right to use, or use Kontax for unsolicited bulk messaging.</li>
                  <li>Attempt to breach, probe, or disrupt the service, its security, or other users&rsquo; data.</li>
                  <li>Resell or sublicense the service except as expressly permitted.</li>
                </ul>
              </section>

              <section id="billing">
                <h2><span className="num">4</span> Plans &amp; billing</h2>
                <p>Kontax offers a free plan and paid plans (Pro, Family, and Teams). Paid subscriptions are billed in advance on a recurring basis through our payment processor, on the cycle you choose (for example, monthly or annual). Plan entitlements — such as contact limits, sync accounts, and shared address books — are described on our <Link className="inline" href="/pricing">pricing page</Link>.</p>
                <p>You can upgrade, downgrade, or cancel at any time. Changing plans never deletes your data: contacts over a plan&rsquo;s limit become read-only rather than removed, and you can always export your data first. Except where required by law, payments already made are non-refundable, and cancellation takes effect at the end of the current billing period.</p>
              </section>

              <section id="content">
                <h2><span className="num">5</span> Your content &amp; data</h2>
                <p>You retain all rights to the contact data and other content you put into Kontax. You grant us only the limited permission needed to host, process, sync, and back up that content so we can provide the service to you. We don&rsquo;t claim ownership of your data, and we don&rsquo;t sell it or use it for advertising.</p>
              </section>

              <section id="portability">
                <h2><span className="num">6</span> Data portability</h2>
                <p>You can export your full address book as CSV or vCard at any time, including on a cancelled or downgraded account. Because Kontax uses the open CardDAV standard, you&rsquo;re never locked in.</p>
              </section>

              <section id="availability">
                <h2><span className="num">7</span> Service availability</h2>
                <p>We work to keep Kontax reliable and available, but the service is provided on an &ldquo;as available&rdquo; basis. We may modify, suspend, or discontinue features, and we may perform maintenance that temporarily affects availability. We&rsquo;ll aim to give reasonable notice of significant changes.</p>
              </section>

              <section id="termination">
                <h2><span className="num">8</span> Cancellation &amp; termination</h2>
                <p>You may cancel your account at any time. We may suspend or terminate an account that violates these terms or that poses a security or legal risk. Before any closure on our initiative, except in urgent cases, we&rsquo;ll give you a reasonable opportunity to export your data. Your right to export your data survives termination.</p>
              </section>

              <section id="disclaimers">
                <h2><span className="num">9</span> Disclaimers</h2>
                <p>To the fullest extent permitted by law, Kontax is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express or implied, including fitness for a particular purpose and non-infringement. We do not warrant that the service will be uninterrupted, error-free, or that data loss will never occur — which is one reason we make export easy and keep encrypted backups.</p>
              </section>

              <section id="liability">
                <h2><span className="num">10</span> Limitation of liability</h2>
                <p>To the fullest extent permitted by law, Kontax and its operators will not be liable for indirect, incidental, special, or consequential damages, or for lost profits or data, arising from your use of the service. Where liability cannot be excluded, it is limited to the amount you paid for the service in the twelve months before the claim. Some jurisdictions don&rsquo;t allow certain limitations, so parts of this section may not apply to you.</p>
              </section>

              <section id="changes">
                <h2><span className="num">11</span> Changes to these terms</h2>
                <p>We may update these terms as the service evolves. When we make material changes, we&rsquo;ll update the date above and, where appropriate, notify you. Continued use of Kontax after a change means you accept the updated terms.</p>
              </section>

              <section id="contact">
                <h2><span className="num">12</span> Contact</h2>
                <p>Questions about these terms? Email us at <a className="inline" href="mailto:legal@vexon.co">legal@vexon.co</a>.</p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
