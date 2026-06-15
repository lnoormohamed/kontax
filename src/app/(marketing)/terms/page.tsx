// ⚠ LEGAL REVIEW REQUIRED before publishing.
// This draft covers the minimum required for Stripe compliance.
// Have a qualified lawyer (preferably one familiar with SaaS and UK law)
// review before go-live. Sections 6, 9, and 10 in particular require
// careful review.
// Reviewer: [NAME] · Review date: [DATE]

import type { Metadata } from "next";
import "../_components/doc.css";

const LAST_UPDATED = "2026-06-14";

export const metadata: Metadata = {
  title: "Terms of Service — Kontax",
  description:
    "The terms governing your use of Kontax — subscriptions, acceptable use, and your rights.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service",
    description:
      "The terms governing your use of Kontax — subscriptions, acceptable use, and your rights.",
    url: "/terms",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=homepage", width: 1200, height: 630, alt: "Kontax" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — Kontax",
    description:
      "The terms governing your use of Kontax — subscriptions, acceptable use, and your rights.",
  },
};

export default function TermsPage() {
  return (
    <div className="doc-wrap">
      <h1 className="doc-title">Terms of Service</h1>
      <p className="doc-meta">Last updated: 14 June 2026</p>

      <div className="doc-body">

        <h2>1. Acceptance of terms</h2>
        <p>
          By creating a Kontax account or using the Kontax service, you agree
          to these Terms of Service. If you do not agree, do not use the
          service. You must be at least 16 years old to use Kontax.
        </p>

        <h2>2. Service description</h2>
        <p>
          Kontax is a contact management service that lets you store, organise,
          and sync contact information. We provide access via the Kontax web app
          at getkontax.com and the Kontax developer API at api.getkontax.com.
        </p>

        <h2>3. User accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account
          credentials and for all activity that occurs under your account. Notify
          us immediately at{" "}
          <a href="mailto:support@getkontax.com">support@getkontax.com</a> if
          you suspect unauthorised access.
        </p>
        <p>
          You may not share your account with other people — use the Family or
          Teams plan for multi-user access. You may not create accounts by
          automated means or for the purpose of resale.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You may not use Kontax to:</p>
        <ul>
          <li>
            Store contact data without a lawful basis for holding it (for
            example, without satisfying the requirements of GDPR).
          </li>
          <li>
            Send unsolicited communications using contact data stored in Kontax.
          </li>
          <li>
            Reverse-engineer, scrape, or extract data from the service in ways
            not provided by the API.
          </li>
          <li>Violate the rights of any third party whose data you store.</li>
          <li>Use the service in any way that violates applicable law.</li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate
          these terms without prior notice.
        </p>

        <h2>5. Subscription and billing</h2>
        <p>
          <strong>Free plan:</strong> no charge, provided &ldquo;as is&rdquo;,
          may be changed or discontinued with 30 days&rsquo; notice.
        </p>
        <p>
          <strong>Paid plans:</strong> billed monthly or annually in advance via
          Stripe. Prices are shown on the{" "}
          <a href="/pricing">pricing page</a>. We reserve the right to change
          prices with 30 days&rsquo; notice to existing subscribers.
        </p>
        <p>
          All prices are in GBP and exclude VAT where applicable. VAT will be
          added at checkout where required by law.
        </p>

        <h2>6. Cancellation and refunds</h2>
        <p>
          You may cancel your subscription at any time from Settings → Billing.
          Your plan remains active until the end of the current billing period.
        </p>
        <p>
          If a paid plan isn&rsquo;t right for you, email us within 14 days of
          a charge and we will refund it in full, no questions asked. Annual
          plans are covered by the same 14-day window from the renewal date. To
          request a refund, contact{" "}
          <a href="mailto:support@getkontax.com">support@getkontax.com</a>.
        </p>

        <h2>7. Data and privacy</h2>
        <p>
          Our <a href="/privacy">Privacy Policy</a> describes how we collect and
          use your data. By using Kontax, you agree to the Privacy Policy.
        </p>
        <p>
          You own your contact data. We do not claim any rights to the contacts
          you store. When you delete your account, your data is deleted within
          30 days.
        </p>

        <h2>8. Intellectual property</h2>
        <p>
          The Kontax service, including its software, design, and content, is
          owned by Vexon and protected by copyright. You may not copy, modify,
          or distribute the service or any part of it without our written
          permission.
        </p>
        <p>
          The developer API is available under the terms described at{" "}
          <a href="/developers">getkontax.com/developers</a>.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Vexon is not liable for any
          indirect, incidental, special, or consequential damages arising from
          your use of Kontax. Our total liability to you for any claim arising
          from these terms or the service is limited to the greater of: (a) the
          amount you paid in the 12 months preceding the claim, or (b) £100.
        </p>
        <p>
          We provide the service &ldquo;as is&rdquo; with no warranty of
          availability, accuracy, or fitness for a particular purpose. We do not
          warrant that the service will be uninterrupted or error-free.
        </p>

        <h2>10. Governing law</h2>
        <p>
          These terms are governed by and construed in accordance with the laws
          of England and Wales. Any disputes arising from these terms or the
          service shall be subject to the exclusive jurisdiction of the courts
          of England and Wales.
        </p>

        <h2>11. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Material changes will be
          notified via email to registered users at least 14 days before they
          take effect. Continued use of the service after the effective date
          constitutes acceptance of the updated terms. The &ldquo;last
          updated&rdquo; date at the top reflects the most recent revision.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions about these terms:{" "}
          <a href="mailto:support@getkontax.com">support@getkontax.com</a>.
        </p>

      </div>
    </div>
  );
}
