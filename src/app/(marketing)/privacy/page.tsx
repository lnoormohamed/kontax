// ⚠ LEGAL REVIEW REQUIRED before publishing.
// This draft covers GDPR Article 13 disclosures and Stripe requirements.
// Have a qualified lawyer review before go-live.
// Reviewer: [NAME] · Review date: [DATE]

import type { Metadata } from "next";
import "../_components/doc.css";

const LAST_UPDATED = "2026-06-14";

export const metadata: Metadata = {
  title: "Privacy Policy — Kontax",
  description:
    "How Kontax collects, uses, and protects your data, and your rights under GDPR.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy",
    description:
      "How Kontax collects, uses, and protects your data, and your rights under GDPR.",
    url: "/privacy",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=homepage", width: 1200, height: 630, alt: "Kontax" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy — Kontax",
    description:
      "How Kontax collects, uses, and protects your data, and your rights under GDPR.",
  },
};

export default function PrivacyPage() {
  return (
    <div className="doc-wrap">
      <h1 className="doc-title">Privacy Policy</h1>
      <p className="doc-meta">Last updated: {new Date(LAST_UPDATED).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>

      <div className="doc-body">

        <h2>1. Who we are</h2>
        <p>
          Kontax is operated by Vexon. Our registered address is [ADDRESS]. For
          privacy enquiries, contact us at{" "}
          <a href="mailto:privacy@getkontax.com">privacy@getkontax.com</a>.
        </p>

        <h2>2. What data we collect</h2>
        <ul>
          <li>
            <strong>Account data:</strong> your name, email address, hashed
            password, username, and subscription plan.
          </li>
          <li>
            <strong>Contact data:</strong> all contacts you store — names,
            emails, phone numbers, addresses, notes, and labels. This is the
            core service data and belongs to you.
          </li>
          <li>
            <strong>Sync credentials:</strong> CardDAV app passwords (hashed)
            and Google and Outlook OAuth tokens (encrypted). Stored solely to
            provide the sync service.
          </li>
          <li>
            <strong>Activity data:</strong> timestamps of when contacts were
            created, updated, or deleted. Retained for 30 days (Free plan) or
            indefinitely (Pro and above) for the activity history feature.
          </li>
          <li>
            <strong>Payment data:</strong> your payment method, billing address,
            and transaction history are processed and stored by Stripe. Kontax
            stores only your Stripe customer ID and subscription status.
          </li>
          <li>
            <strong>Session data:</strong> session token (HTTPOnly cookie), IP
            address, browser user agent, and last-seen timestamp. Used for
            authentication and fraud prevention.
          </li>
          <li>
            <strong>Contact form submissions:</strong> your name, email address,
            subject, and message. Used only to respond to your enquiry; not
            retained beyond 90 days.
          </li>
        </ul>

        <h2>3. Why we collect it (lawful basis)</h2>
        <ul>
          <li>
            <strong>Account and contact data:</strong> contract — necessary to
            provide the service you signed up for.
          </li>
          <li>
            <strong>Payment data:</strong> contract — processing your
            subscription.
          </li>
          <li>
            <strong>Session data:</strong> legitimate interest — securing your
            account against unauthorised access.
          </li>
          <li>
            <strong>Activity data:</strong> contract — powering the activity
            history feature included in your plan.
          </li>
          <li>
            <strong>Contact form data:</strong> legitimate interest — responding
            to your enquiry.
          </li>
        </ul>

        <h2>4. Data retention</h2>
        <ul>
          <li>
            <strong>Account and contact data:</strong> retained while your
            account is active and deleted within 30 days of account deletion.
          </li>
          <li>
            <strong>Payment data:</strong> Stripe retains payment data per their
            own policy. Kontax retains subscription status for tax and accounting
            purposes for 7 years.
          </li>
          <li>
            <strong>Session data:</strong> expires after 30 days of inactivity.
          </li>
          <li>
            <strong>Activity data:</strong> 30 days (Free plan) or indefinitely
            (Pro and above).
          </li>
          <li>
            <strong>Contact form submissions:</strong> deleted after 90 days.
          </li>
        </ul>

        <h2>5. Who we share data with</h2>
        <p>
          We do not sell your data to third parties. We do not use your contact
          data for advertising. We share data only with the sub-processors below,
          and only to the extent necessary to provide the service:
        </p>
        <ul>
          <li>
            <strong>Stripe</strong> — payment processing.{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              stripe.com/privacy
            </a>
          </li>
          <li>
            <strong>Amazon Web Services (SES)</strong> — transactional email.
            Emails are sent from noreply@vexon.co via AWS SES (us-east-1).
          </li>
          <li>
            <strong>Google LLC</strong> — only when you connect a Google
            Contacts account. Your contacts are sent to Google&apos;s Contacts
            API on your behalf, governed by your Google account&apos;s privacy
            policy.
          </li>
          <li>
            <strong>Microsoft Corporation</strong> — only when you connect an
            Outlook account, under the same conditions.
          </li>
        </ul>

        <h2>6. Your rights</h2>
        <p>Under GDPR you have the right to:</p>
        <ul>
          <li>
            <strong>Access:</strong> request a copy of your data (Settings →
            Privacy → Export data).
          </li>
          <li>
            <strong>Rectification:</strong> update your account details in
            Settings.
          </li>
          <li>
            <strong>Erasure:</strong> delete your account from Settings →
            Account → Delete account.
          </li>
          <li>
            <strong>Data portability:</strong> export all contacts as vCard or
            CSV at any time, on any plan.
          </li>
          <li>
            <strong>Restriction and objection:</strong> contact{" "}
            <a href="mailto:privacy@getkontax.com">privacy@getkontax.com</a>.
          </li>
          <li>
            <strong>Lodge a complaint:</strong> with the ICO (
            <a
              href="https://ico.org.uk"
              target="_blank"
              rel="noopener noreferrer"
            >
              ico.org.uk
            </a>
            ) if you are in the UK, or your national supervisory authority if
            you are in the EU.
          </li>
        </ul>

        <h2>7. Cookies</h2>
        <p>
          We use one session cookie (<code>next-auth.session-token</code>) to
          keep you logged in. This is a strictly necessary cookie — no consent
          is required. We do not use advertising, tracking, or analytics
          cookies.
        </p>
        <p>
          If analytics are added in future, this policy will be updated and
          consent obtained where required.
        </p>

        <h2>8. Changes to this policy</h2>
        <p>
          Material changes will be communicated via email to account holders.
          The &ldquo;last updated&rdquo; date at the top of this page reflects
          the most recent revision.
        </p>

      </div>
    </div>
  );
}
