# P34C-16 — /terms Page (Required for Stripe Compliance)

## Purpose

Create `src/app/(marketing)/terms/page.tsx` — the Kontax Terms of Service.
Required by Stripe before the merchant account can process live payments.
Also the contractual basis for the user relationship.

## Background

Stripe requires a Terms of Service URL in the platform settings alongside
the privacy policy. The terms define acceptable use, the subscription
relationship, cancellation and refund policy, and limitation of liability.
Like the privacy policy, the structure is in scope for this ticket; legal
review is a required gating step before go-live.

## Scope

**In scope**
- `src/app/(marketing)/terms/page.tsx`.
- Full draft terms covering the sections below.
- "Last updated" date constant.
- Plain prose layout matching the privacy page.
- `<MarketingNav>` and `<MarketingFooter>` via shared layout.

**Out of scope**
- Legal sign-off (gating step, not part of this ticket).
- Cookie policy (linked from footer, handled in privacy page).

## Design / Implementation Spec

### Layout

Same prose layout as `/privacy`: `max-w-3xl mx-auto px-6 py-20`, headings
at `20px semibold #1d2823`, body at `16px #5c655e leading-[1.8]`.

### Section structure

#### 1. Acceptance of terms
By creating a Kontax account or using the Kontax service, you agree to these
terms. If you do not agree, do not use the service. You must be at least 16
years old to use Kontax.

#### 2. Service description
Kontax is a contact management service that lets you store, organise, and sync
contact information. We provide access to the service via the Kontax web app
at getkontax.com and the Kontax developer API at api.getkontax.com.

#### 3. User accounts
You are responsible for maintaining the confidentiality of your account
credentials. You are responsible for all activity that occurs under your
account. Notify us immediately at support@getkontax.com if you suspect
unauthorised access.

You may not share your account with other people (use the Family or Teams
plan for multi-user access). You may not create accounts by automated means
or for the purpose of resale.

#### 4. Acceptable use
You may not use Kontax to:
- Store contact data without a lawful basis for holding it (e.g. GDPR).
- Send unsolicited communications using contact data stored in Kontax.
- Attempt to reverse-engineer, scrape, or extract data from the service in
  ways not provided by the API.
- Violate the rights of any third party whose data you store.
- Use the service in any way that violates applicable law.

We reserve the right to suspend or terminate accounts that violate these
terms without prior notice.

#### 5. Subscription and billing
Free plan: no charge, provided "as is", may be changed or discontinued with
30 days notice.

Paid plans: billed monthly or annually in advance via Stripe. Prices are shown
on the pricing page. We reserve the right to change prices with 30 days notice
to existing subscribers.

All prices are in GBP and exclude VAT where applicable. VAT will be added at
checkout where required by law.

#### 6. Cancellation and refunds
You may cancel your subscription at any time from Settings → Billing. Your
plan remains active until the end of the current billing period.

Refunds: [REFUND POLICY — align with P34C-11 FAQ answer. Placeholder: "We
offer a full refund within 7 days of the first charge on a new subscription.
After 7 days, charges are non-refundable."] To request a refund, email
support@getkontax.com.

#### 7. Data and privacy
Our Privacy Policy (at /privacy) describes how we collect and use your data.
By using Kontax, you agree to the Privacy Policy.

You own your contact data. We do not claim any rights to the contacts you
store. When you delete your account, your data is deleted within 30 days.

#### 8. Intellectual property
The Kontax service, including its software, design, and content, is owned by
Vexon and protected by copyright. You may not copy, modify, or distribute
the service or any part of it.

The API is provided under the terms of the [API Terms / Developer Agreement]
(link to /developers#terms if this exists, or add it here).

#### 9. Limitation of liability
To the maximum extent permitted by law, Vexon is not liable for any indirect,
incidental, special, or consequential damages arising from your use of Kontax.
Our total liability to you for any claim arising from these terms or the
service is limited to the greater of: (a) the amount you paid in the 12 months
preceding the claim, or (b) £100.

We provide the service "as is" with no warranty of availability, accuracy, or
fitness for a particular purpose. We do not warrant that the service will be
uninterrupted or error-free.

#### 10. Governing law
These terms are governed by and construed in accordance with the laws of England
and Wales. Any disputes arising from these terms or the service shall be subject
to the exclusive jurisdiction of the courts of England and Wales.

#### 11. Changes to these terms
We may update these terms from time to time. Material changes will be notified
via email to registered users at least 14 days before they take effect. Continued
use of the service after the effective date constitutes acceptance of the updated
terms. The "last updated" date at the top reflects the most recent revision.

#### 12. Contact
Questions about these terms: legal@getkontax.com (or support@getkontax.com
until a dedicated legal alias is set up).

### "Last updated" date

```tsx
const LAST_UPDATED = "2026-06-14";
```

### Legal review gate

```tsx
// ⚠ LEGAL REVIEW REQUIRED before publishing.
// This draft covers the minimum required for Stripe compliance.
// Have a qualified lawyer (preferably one familiar with SaaS and UK law) review
// before go-live. Sections 6, 9, and 10 in particular require careful review.
// Reviewer: [NAME] · Review date: [DATE]
```

### SEO

```tsx
export const metadata: Metadata = {
  title: "Terms of Service | Kontax",
  description: "The terms governing your use of Kontax — subscriptions, acceptable use, and your rights.",
  robots: { index: true, follow: true },
};
```

## Acceptance Criteria

- [ ] Page exists at `/terms` and renders via the `(marketing)` layout.
- [ ] All twelve sections are present with substantive draft copy.
- [ ] Refund policy is consistent with the P34C-11 FAQ answer (same window,
      same conditions).
- [ ] "Last updated" date is a constant.
- [ ] The legal review gate comment is present.
- [ ] Page is NOT deployed to production until legal review is complete.
- [ ] `support@getkontax.com` and `legal@getkontax.com` aliases are live or
      a fallback single inbox is confirmed before the page goes live.
- [ ] `metadata` is set.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Refund policy consistency**: Section 6 and the P34C-11 FAQ answer must
  state the same refund window and conditions. Agree the policy internally
  before either ticket is merged. Placeholder: 7-day full refund on first
  charge.
- **VAT treatment**: "exclude VAT where applicable" may need to be made more
  specific depending on where Kontax's customers are located. A UK-based SaaS
  must charge VAT to UK consumers. Confirm with an accountant.
- **API Terms**: Section 8 references a developer agreement. Decide whether
  this is a separate page or a section within these terms, and ensure the
  `/developers` page links to it.
- **Stripe Terms URL**: add the `/terms` URL to Stripe Dashboard → Business
  settings → Public details as part of P34D go-live prep.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: document the legal review
      requirement and the Stripe URL update step
- [x] Internal · engineering — docs/: note the legal review gate comment
      pattern and the LAST_UPDATED constant
