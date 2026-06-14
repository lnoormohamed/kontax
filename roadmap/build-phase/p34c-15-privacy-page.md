# P34C-15 — /privacy Page (Required for Stripe Compliance)

## Purpose

Create `src/app/(marketing)/privacy/page.tsx` — the Kontax privacy policy.
This page is a hard requirement for Stripe's platform review before live
payments can be accepted. It is also a GDPR Article 13 obligation: users must
be informed of data processing at the point of collection.

## Background

Stripe requires a privacy policy URL to be set in the platform settings before
a merchant account can go live. Additionally, GDPR requires that users be told
what data is collected, why, how long it is kept, and who it is shared with —
at or before the point they provide that data (i.e., registration).

The page structure is in scope for this ticket. The final legal copy requires
review by a qualified lawyer before publication. This ticket creates the page
and a complete draft; the legal review is a separate gating step.

## Scope

**In scope**
- `src/app/(marketing)/privacy/page.tsx`.
- Full draft privacy policy copy covering GDPR Article 13 disclosures.
- "Last updated" date in the document.
- Plain prose layout — no accordion or collapsing sections.
- `<MarketingNav>` and `<MarketingFooter>` via shared layout.

**Out of scope**
- Cookie consent banner (tracked separately).
- Cookie policy as a separate page (linked from footer as `/privacy#cookies`).
- Legal sign-off (required before go-live, not part of this ticket).

## Design / Implementation Spec

### Layout

```
[MarketingNav]
───────────────────────────────────────────
max-w-3xl mx-auto px-6 py-20

  "Privacy Policy"               (36px bold #17352e)
  "Last updated: 14 June 2026"   (14px muted)

  [Section headings at 20px semibold #1d2823]
  [Body at 16px #5c655e, leading-[1.8]]
  [Internal links: text-[#4158f4]]

───────────────────────────────────────────
[MarketingFooter]
```

### Section structure (GDPR Article 13 mandatory disclosures)

#### 1. Who we are
Identity and contact details of the data controller.

```
Kontax is operated by Vexon. Our registered address is [ADDRESS].
For privacy enquiries: privacy@getkontax.com.
```

#### 2. What data we collect
Enumerate each data category:
- **Account data**: name, email address, hashed password, username, plan.
- **Contact data**: all contacts you store (names, emails, phones, addresses,
  notes, labels). This is the core service data.
- **Sync credentials**: CardDAV app passwords (hashed), Google and Outlook
  OAuth tokens (encrypted). Stored solely to provide the sync service.
- **Activity data**: timestamps of when contacts were created, updated, or
  deleted. Retained for 30 days (Free) or indefinitely (Pro+) for the activity
  history feature.
- **Payment data**: payment method, billing address, and transaction history
  are processed and stored by Stripe. Kontax stores only the Stripe customer ID
  and subscription status.
- **Session data**: session token (HTTPOnly cookie), IP address, user agent,
  last seen timestamp. Used for authentication and fraud prevention.
- **Contact form submissions**: name, email, subject, message. Used only to
  respond to the enquiry; not retained beyond 90 days.

#### 3. Why we collect it (lawful basis)
Per data category:
- Contact and account data: **contract** (necessary to provide the service
  you signed up for).
- Payment data: **contract** (processing your subscription).
- Session data: **legitimate interest** (securing your account).
- Activity data: **contract** (activity history feature).
- Contact form data: **legitimate interest** (responding to your enquiry).
- Analytics (if any): **legitimate interest** / **consent** (specify if
  analytics are used).

#### 4. Data retention
- Account and contact data: retained while your account is active. Deleted
  within 30 days of account deletion.
- Payment data: Stripe retains payment data per their own policy. Kontax
  retains subscription status for tax/accounting purposes for 7 years.
- Session data: expires after 30 days of inactivity.
- Activity data: 30 days (Free plan) or indefinitely (Pro+).
- Contact form: 90 days then deleted.

#### 5. Who we share data with (sub-processors)
- **Stripe** — payment processing. [stripe.com/privacy]
- **Amazon Web Services (SES)** — transactional email. Emails sent from
  noreply@vexon.co via SES us-east-1.
- **Google LLC** — sync only when you connect a Google Contacts account. Your
  contacts data is sent to Google's Contacts API on your behalf. Governed by
  your Google account's privacy policy.
- **Microsoft Corporation** — sync only when you connect an Outlook account.
- We do not sell data to third parties. We do not use your contact data for
  advertising.

#### 6. Your rights (GDPR)
- **Access**: request a copy of your data (Settings → Privacy → Export data).
- **Rectification**: update your account details in Settings.
- **Erasure**: delete your account from Settings → Account → Delete account.
- **Data portability**: export all contacts as vCard or CSV at any time.
- **Restriction** and **objection**: contact privacy@getkontax.com.
- **Lodge a complaint**: with the ICO (ico.org.uk) if you are in the UK, or
  your national supervisory authority if you are in the EU.

#### 7. Cookies
We use one session cookie (`next-auth.session-token`) to keep you logged in.
This is a strictly necessary cookie — no consent required. We do not use
advertising, tracking, or analytics cookies.

If analytics are added in future, the policy will be updated and consent
obtained where required.

#### 8. Changes to this policy
Material changes will be communicated via email to account holders. The "last
updated" date at the top of this page reflects the most recent revision.

### "Last updated" date

```tsx
const LAST_UPDATED = "2026-06-14";
```

Define as a constant at the top of the file so it can be updated without
hunting through the copy.

### Legal review gate

Add a comment at the top of the file:

```tsx
// ⚠ LEGAL REVIEW REQUIRED before publishing.
// This draft covers GDPR Article 13 disclosures and Stripe requirements.
// Have a qualified lawyer review before go-live.
// Reviewer: [NAME] · Review date: [DATE]
```

The page should not be deployed to `getkontax.com` until the review is
complete and the comment is replaced with the reviewer's sign-off.

### SEO

```tsx
export const metadata: Metadata = {
  title: "Privacy Policy | Kontax",
  description: "How Kontax collects, uses, and protects your data — and your rights under GDPR.",
  robots: { index: true, follow: true },
};
```

## Acceptance Criteria

- [ ] Page exists at `/privacy` and renders via the `(marketing)` layout.
- [ ] All eight sections above are present with substantive draft copy.
- [ ] "Last updated" date is defined as a constant and rendered at the top.
- [ ] The legal review gate comment is present in the file.
- [ ] The page is NOT deployed to production until legal review is complete.
- [ ] All internal links (Settings → Privacy, etc.) are correct app routes.
- [ ] `privacy@getkontax.com` alias is live before the page goes live.
- [ ] `metadata` is set including `robots: index, follow`.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Legal review**: this is the highest-risk item. Shipping an inaccurate
  privacy policy is a GDPR violation. Block go-live on legal sign-off.
- **Registered address**: `[ADDRESS]` must be filled in before the page ships.
  Consult Vexon's incorporation documents for the correct registered address.
- **Analytics**: if any analytics tool is added (Plausible, PostHog, etc.),
  the policy must be updated before that tool is enabled.
- **Stripe minimum**: Stripe requires the privacy policy URL to be added to
  the Stripe Dashboard → Business settings → Public details before the live
  key is activated. Add it as part of P34D go-live prep.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: document the legal review
      requirement and who is responsible for signing off each privacy policy
      update
- [x] Internal · engineering — docs/: note the LAST_UPDATED constant and the
      legal review gate comment pattern
