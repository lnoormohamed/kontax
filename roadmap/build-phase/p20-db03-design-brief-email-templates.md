# P20-DB03 Design Brief: Email Template Visual Language

## Purpose

This brief gives the designer the specification needed to define the Kontax email visual language — the shared layout, colour palette, typography, and component patterns that all transactional emails use. Email templates must render consistently across major email clients (Gmail, Apple Mail, Outlook, Yahoo) while reflecting the Kontax brand identity.

## Background

Phase 20 introduces six transactional email templates built with React Email. All templates share a common `EmailLayout` wrapper defined in P20-03. This brief specifies the visual design that `EmailLayout`, `EmailButton`, and individual template content sections should follow.

The web app uses the locked light palette. Email must be a simplified version of this — email clients strip external CSS, cannot use Tailwind, and have quirky rendering engines. All styles must be inline. The email palette should feel familiar to Kontax users but be self-contained.

## Scope

### In scope

1. Shared email layout (header, body, footer)
2. Typography scale for email
3. Colour palette for email
4. `EmailButton` CTA button styling
5. Content section patterns (heading, body text, detail block, warning block)
6. Individual template content specifications for all 6 templates

### Out of scope

- In-app UI (separate design system)
- HTML/CSS implementation (covered by P20-03)
- Email client testing (engineering responsibility)

---

## Design / Implementation Spec

### 1. Layout

**Container:**
- Max width: 600px, centred
- Background: white (`#ffffff`)
- Border: 1px solid `#e4e4e7`
- Border radius: 8px
- Outer background: `#f4f4f5` (page grey)
- Vertical margin from top: 32px (desktop); full-width on mobile

**Header:**
- Padding: 24px 32px
- Content: Kontax wordmark (PNG, 120×32px, linked to `APP_URL`)
- Background: white — no coloured header band
- Separated from body by a 1px hairline rule

**Body:**
- Padding: 24px 32px
- All content lives here

**Footer:**
- Padding: 16px 32px 24px
- 1px hairline rule above
- Text: "Kontax · You're receiving this because you have an account at kontax.app"
- Unsubscribe link (non-security emails only): "Unsubscribe from non-security emails"
- Font: 12px, `#71717a`

### 2. Colour palette

| Token | Hex | Usage |
|---|---|---|
| Ink | `#1d2823` | Headings, primary body text |
| Secondary | `#5c655e` | Body text, descriptive copy |
| Muted | `#8b938c` | Meta text, timestamps, footnotes |
| Hairline | `#d8ddd6` | Dividers |
| Blue | `#4158f4` | CTA buttons, links |
| Red | `#dc2626` | Security alert labels, destructive labels |
| Amber | `#d97706` | Warning labels, payment failure |
| Green | `#16a34a` | Success states (plan upgraded) |
| Page bg | `#f4f4f5` | Email outer background |
| Card bg | `#ffffff` | Container background |
| Detail bg | `#f4f4f5` | Detail block backgrounds (device info, etc.) |

### 3. Typography

All email fonts use system font stack: `Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Geist loads from a hosted CDN link in the `<head>` — falls back to system sans-serif where web fonts are blocked.

| Role | Size | Weight | Colour |
|---|---|---|---|
| Heading | 20px | 600 | Ink |
| Section label | 13px | 600 | Ink (uppercase, letter-spacing 0.06em) |
| Body | 14px | 400 | Secondary |
| Muted / footnote | 12px | 400 | Muted |
| Button | 14px | 600 | White |

Line height: body = 22px, footnote = 20px.

### 4. CTA Button

- Background: `#4158f4` (blue)
- Text: white, 14px, 600 weight
- Padding: 12px 24px
- Border radius: 6px
- Displayed as a block-level button for maximum email client compatibility
- For destructive/security actions: use `#dc2626` (red) background

### 5. Content patterns

**Standard heading + body:**
```
[Heading — 20px ink 600]
[Body copy — 14px secondary]
[Button]
[Footnote — 12px muted]
```

**Detail block** (used in suspicious activity, billing):
```
┌──────────────────────────────┐
│  Key: Value                  │  background: #f4f4f5
│  Key: Value                  │  border-radius: 6px
└──────────────────────────────┘  padding: 12px 16px
```

**Warning block** (payment failure, account deletion):
```
┌──────────────────────────────┐
│  ⚠  Warning message          │  background: #fffbeb (amber-50)
└──────────────────────────────┘  border-left: 4px solid #d97706
```

**Security alert label** (suspicious activity only):
```
SECURITY ALERT          13px, 600 weight, #dc2626, uppercase
```

### 6. Individual template specifications

#### Verification email
- Preview: "Confirm your Kontax email address"
- Heading: "Confirm your email address" (SIGNUP) / "Confirm your new email address" (EMAIL_CHANGE)
- Body: One sentence explaining the purpose. No marketing copy.
- Button: "Verify email address →" (blue)
- Footnote: "Link expires in 72 hours (or 24 hours). Ignore if you didn't request this."

#### Password reset
- Preview: "Reset your Kontax password"
- Heading: "Reset your password"
- Body: "Click to set a new password. Link expires in 15 minutes."
- Button: "Reset password →" (blue)
- Footnote: "Ignore if you didn't request this. Your password hasn't changed."

#### Share invite — existing user
- Preview: "{SenderName} shared a contact with you"
- Heading: "{SenderName} shared a contact with you"
- Body: Contact name, company, share type. If live: "Updates will sync automatically."
- Button: "View and accept →" (blue)
- Footnote: "Ignore if unexpected."

#### Share invite — new user
- Same as existing user but Button: "Create account and receive contact →"
- Add: "Kontax is a free contacts app. No credit card required."

#### Suspicious activity
- Preview: "Security alert — unusual activity on your Kontax account"
- Security alert label (red, uppercase)
- Heading: "Unusual activity detected"
- Body: Activity description (e.g. "A new device signed into your account")
- Detail block: device hint + IP address + timestamp
- "If this was you, no action needed. If not, secure your account."
- Button: "Secure my account →" (red)
- Footnote: "Security alerts cannot be unsubscribed from."

#### Payment failed
- Preview: "Action required: payment failed"
- Heading: "Payment failed"
- Body: Plan name, days until grace expires.
- Button: "Update payment method →" (blue)
- Footnote: "If not updated by [date], account moves to Free. Contacts are never deleted."

#### Trial ending
- Preview: "Your trial ends in N days"
- Heading: "Your trial ends in N day(s)"
- Body: "Add a payment method to continue with Pro."
- Button: "Add payment method →" (blue)
- Footnote: "If not added, moves to Free. No contacts deleted."

#### Plan changed
- Upgrade: "Welcome to [Plan]" — confirmation, no CTA needed
- Downgrade: "Plan changed to [Plan]" — brief summary of what changed, "View settings" link

#### Notification digest
- Preview: "Your Kontax [daily/weekly] summary — [period]"
- Heading: "Your [daily/weekly] summary"
- Sub-heading: period label
- Grouped sections by category (Contact shares, Sync activity, Upcoming dates, Security)
- Each section: bold category label + bullet-list items
- Button: "View in Kontax →"

---

## Acceptance Criteria

- Designer can produce email mockups without a follow-up meeting.
- All colour tokens are specified as hex values.
- All typography specs include size, weight, and colour.
- Every template variant (signup vs email-change, existing vs new user, upgrade vs downgrade) is described.
- The detail block and warning block patterns are visually specified.
- Mobile rendering note: single-column, 100% width on screens < 600px — no specific mobile design needed beyond this.
