# P34C-12 — /security Page

## Purpose

Create `src/app/(marketing)/security/page.tsx` — a dedicated security and trust
page that clearly explains how Kontax protects user data. A professional,
transparent security page is a trust signal for privacy-conscious users (the
core Kontax audience) and a prerequisite for enterprise and team buyers.

## Background

P34C-DB03 specifies the visual design. The content covers the same security
measures already implemented in the app (bcrypt, TOTP 2FA, HTTPOnly session
cookies, TLS, encrypted sync credentials, GDPR export) — this page makes them
visible to users who need to trust the product before giving it their address
book.

## Scope

**In scope**
- `src/app/(marketing)/security/page.tsx`.
- Six sections covering the areas below.
- `<MarketingNav>` and `<MarketingFooter>` via shared layout.
- Static content — no server data fetching.

**Out of scope**
- Actual security implementation changes (the security measures described are
  already live).
- SOC 2 / ISO 27001 certifications (not yet in progress).
- Penetration test reports (may be added post-launch).
- Legal review of the copy (flag for review before go-live, same as /privacy).

## Design / Implementation Spec

### Page sections

#### 1. Page hero

```
"Security you can trust"
"Kontax is built around the principle that your contacts are yours.
 Here's how we keep them safe."
```

Typography: same marketing heading scale as other pages. No screenshot needed
in the hero — security pages are copy-heavy by nature.

#### 2. Encryption at rest

Icon: `LockIcon` or `DatabaseIcon`.
Heading: "Your data is encrypted at rest"
Body:
```
Contact data, sync credentials, and session tokens are stored in a PostgreSQL
database running on an encrypted volume. Encryption at rest means that even
if storage media were physically compromised, your data remains unreadable.

Sync account credentials (CardDAV passwords, Google and Outlook OAuth tokens)
are additionally encrypted at the application layer before being written to
the database — a separate encryption key from the disk encryption.
```

#### 3. Encryption in transit

Icon: `ShieldCheckIcon`.
Heading: "TLS-only connections"
Body:
```
All connections to Kontax — including sync traffic, the web app, and the
developer API — are encrypted with TLS 1.2 or higher. We enforce HTTPS Strict
Transport Security (HSTS) so browsers never fall back to an unencrypted
connection, even if you type "http://" by mistake.
```

#### 4. Authentication security

Icon: `KeyIcon`.
Heading: "Secure by default"
Body:
```
Passwords are hashed with bcrypt (cost factor 12) and never stored in plain
text. Session tokens are random, stored in HTTPOnly cookies (not accessible
to JavaScript), and expire after inactivity.

We support two-factor authentication (TOTP) via any authenticator app.
Sensitive actions — like changing your email or accessing the API token
manager — require step-up authentication even within an active session.
```

#### 5. Sync credential security

Icon: `RefreshCwIcon` or `CloudIcon`.
Heading: "Sync credentials are treated differently"
Body:
```
When you connect a CardDAV account, your app password is hashed — we never
store the plain-text credential, and it is never transmitted or logged after
initial connection. Google and Outlook OAuth tokens are encrypted at the
application layer and refreshed automatically. Kontax never has access to
your full Google or Outlook account — only the Contacts scope you explicitly
grant.
```

#### 6. GDPR and data handling

Icon: `FileTextIcon` or `FlagIcon`.
Heading: "Your data, your rights"
Body:
```
You can export all your contacts and account data at any time from
Settings → Privacy. You can request account deletion from the same page.

We do not sell or share your contact data with third parties. We share data
only with sub-processors required to run the service: Stripe (payment
processing), AWS SES (transactional email), and Google / Microsoft (only when
you explicitly connect a sync account).

Kontax is operated by Vexon and the service is subject to English law.
For GDPR enquiries, email privacy@getkontax.com.
```

#### 7. Responsible disclosure

Icon: `MailIcon` or `BugIcon`.
Heading: "Responsible disclosure"
Body:
```
If you discover a security vulnerability in Kontax, please report it to
security@getkontax.com. We aim to acknowledge reports within 24 hours and
resolve critical issues within 7 days. We do not currently offer a bug
bounty programme, but we will acknowledge your contribution publicly (with
your permission) when a fix ships.

Please do not disclose vulnerabilities publicly until we've had a chance to
investigate and patch.
```

### Section component

Each section is a full-width content block (not a card):

```tsx
function SecuritySection({ icon: Icon, heading, body }: SecuritySectionProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14 border-b border-[#edf0ea]
                    last:border-none">
      <div className="flex items-start gap-6">
        <div className="shrink-0 w-12 h-12 rounded-[12px] bg-[#eef5ef]
                        flex items-center justify-center text-[#17352e]">
          <Icon size={22} />
        </div>
        <div>
          <h2 className="text-[22px] font-bold text-[#17352e] mb-3">
            {heading}
          </h2>
          <div className="text-[16px] text-[#5c655e] leading-[1.8] space-y-3">
            {/* body paragraphs */}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Email addresses in copy

Use `security@getkontax.com` and `privacy@getkontax.com`. These must be real
aliases that route to the product inbox before the page goes live. Confirm with
the team before merging.

### SEO

```tsx
export const metadata: Metadata = {
  title: "Security | Kontax",
  description:
    "How Kontax keeps your contacts safe: TLS encryption, bcrypt passwords, " +
    "2FA, encrypted sync credentials, GDPR compliance, and responsible disclosure.",
};
```

## Acceptance Criteria

- [ ] Page exists at `/security` and renders via the `(marketing)` layout.
- [ ] All six sections render with icon, heading, and body copy.
- [ ] Email addresses (`security@getkontax.com`, `privacy@getkontax.com`) are
      live aliases before the page ships to production.
- [ ] Page is fully static (no server data fetching or auth dependency).
- [ ] `metadata` title and description are set.
- [ ] Copy is reviewed by a technical lead for accuracy before merge.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Email aliases**: `security@` and `privacy@` must be configured in the email
  provider before go-live. Track this as a separate infra task in P34D.
- **Accuracy**: the body copy describes the actual security implementation.
  Before shipping, a technical reviewer should confirm each claim is accurate
  (e.g. bcrypt cost factor 12, HSTS header is actually set, OAuth tokens are
  actually encrypted at the app layer). Do not ship unverified claims.
- **Legal review**: the GDPR section references English law. A brief legal
  review before go-live is strongly recommended. Flag for the same review as
  `/privacy` and `/terms`.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: add a note that /security copy
      must be reviewed and updated whenever the auth or storage implementation
      changes
- [x] Internal · engineering — docs/: cross-reference the security page with
      the actual implementation (bcrypt cost, HSTS header config, OAuth token
      encryption)
