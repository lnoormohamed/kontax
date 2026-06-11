# P18-DB01 Design Brief: Account & Security Settings UI

## Purpose

This brief gives the designer everything they need to produce high-fidelity mockups for all new UI surfaces introduced by Phase 18. Without a thorough brief, assumptions about layout and interaction will conflict with the engineering decisions already made in P18-01 through P18-08. The brief is the single source of truth for every component, every state (including edge cases), and every interactive transition for the account and security settings surfaces.

## Background

Phase 18 introduces a set of account-management screens that currently do not exist:
- Profile edit (name + avatar)
- Password change (and "set a password" variant for OAuth-only users)
- Email change (with pending-state management)
- Active sessions list with revocation
- Two-factor authentication enrolment, management, and disable
- Connected OAuth accounts (Google, Apple)

The existing Kontax visual system uses Tailwind CSS on the locked light palette: ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, green `#17352e`, blue `#4158f4`, Geist typeface. All new surfaces must follow this palette. The icon set is Lucide React.

The existing settings page (`/settings`) uses a sectioned layout. The new account and security surfaces extend this layout — the designer should use the existing settings chrome as the shell and fill in new section content.

## Scope

### In scope

This brief covers all states for:

1. Profile section (P18-01)
2. Password section — change password + set password for OAuth-only accounts (P18-02)
3. Email section — current email display, change-email form, pending-change state (P18-03 / P18-04)
4. Email verification banner (P18-04)
5. Active sessions panel (P18-06)
6. Two-factor authentication section (P18-07)
7. Connected accounts section (P18-08)
8. `/login/verify-2fa` challenge page (P18-07)
9. Password reset pages — `/forgot-password` and `/reset-password` (P18-05)

### Out of scope

- Visual design of email templates (Phase 20 / DB-03)
- Admin UI (Phase 21 / DB-04)
- Notification settings (Phase 22 / DB-05)
- Mobile layout variants (addressed in Phase 24 / DB-06)

---

## Design / Implementation Spec

### Settings page structure

The existing settings shell (left sidebar nav + content area) is kept. New surfaces are distributed across existing and new sidebar routes — no single-page scroll approach. The sidebar gains one new route (`/settings/account`) and the existing `/settings/security` is expanded.

**Sidebar routes and their surfaces:**

| Route | Sidebar label | Surfaces |
|---|---|---|
| `/settings/profile` | Profile | Name + avatar (P18-01) |
| `/settings/account` | Account | Email change + verification banner (P18-03/04) · Password change/set (P18-02) |
| `/settings/security` | Security | 2FA enrolment/manage (P18-07) · Active sessions (P18-06) · Connected accounts placeholder (P18-08 deferred) |

Within each route, sections are separated by a hairline divider and a section header label (12px, all-caps, muted, `letter-spacing: 0.08em`).

```
Settings sidebar          Content area
─────────────────         ───────────────────────────────────────
Plan                  →   (existing)
Profile               →   [Avatar + name]
Account               →   [Email section]
                          [Password section]
Security              →   [2FA section]
                          [Active sessions section]
                          [Connected accounts — Coming soon]
Preferences           →   (existing)
Devices               →   (existing)
```

---

### 1. Profile Section

#### 1a. Default state

```
Profile

[88px avatar — initials or photo]   [Upload photo]  [Remove]  (only if photo set)

Display name
[John Smith                    ]

[Save changes]   (disabled until form is dirty)
```

**Avatar:**
- 88px circle. If `avatarUrl` is set: displays the photo. If not: initials avatar on a muted background (same pattern as contact list avatars).
- "Upload photo" is a styled button (secondary, small). Clicking opens a file picker.
- "Remove" is a text link (muted, red-600 on hover). Only shown when a photo is set.
- While uploading: replace the avatar with a 88px skeleton pulse + spinner overlay.

**Name input:**
- Full-width text field, pre-populated.
- Max 120 characters — show a character counter when < 20 chars remaining: "N / 120".
- Validation error (inline, below the field): "Please enter your name."

**Save button:**
- Disabled and grayed out when the form matches the current saved values.
- Loading state: "Saving…" with a small spinner.
- Success state: button returns to "Save changes"; show a brief inline "Saved ✓" label that fades after 2 seconds.

---

### 2. Email Section

#### 2a. No pending change

```
Email address

user@example.com
[Change email]  (text button, secondary)
```

Clicking "Change email" expands an inline form below:

```
Email address

user@example.com

New email address
[                                           ]
[Send verification email]   [Cancel]
```

- "Send verification email" is the primary button; disabled until a valid email is entered that differs from the current address.
- Validation errors (inline):
  - "Please enter a valid email address."
  - "That's already your current email address."
  - "That email is already associated with another Kontax account."
- "Cancel" collapses the form without changes.

#### 2b. Pending change in progress

```
Email address

user@example.com  (current, greyed out)

⏳ Waiting for verification

A verification link was sent to newemail@example.com.
Check your inbox to confirm the change.
Sent 2 hours ago.

[Resend verification]   [Cancel email change]
```

- The pending email address is shown in a subtle chip or inline note (not editable).
- "Resend verification" is a secondary button; disabled for 5 minutes after a send (show a countdown: "Resend in 4:23").
- "Cancel email change" is a text link (muted, destructive on hover). Clicking shows an inline confirmation: "Cancel this email change? Your address will remain [current email]. [Yes, cancel]  [Keep waiting]"

#### 2c. Expired pending change

Same as 2b but the "Sent N hours ago" line shows "Expired. The link sent to [email] is no longer valid." and "Resend verification" is available immediately (not rate-limited in the expired state).

---

### 3. Password Section

#### 3a. Standard — user has a password

```
Password

Last changed: never  (or "Last changed 3 months ago")

[Change password]  (expands inline form)
```

Expanded:

```
Current password
[                               ]  [👁 show/hide]

New password
[                               ]  [👁 show/hide]

Confirm new password
[                               ]  [👁 show/hide]

[Update password]   [Cancel]
```

- All three fields: `type=password` with a show/hide toggle (`Eye` / `EyeOff` Lucide icons, 16px, right-aligned inside the input).
- "Update password" disabled until all three fields are filled and new = confirm.
- Error states (inline below the relevant field):
  - Current password field: "Incorrect password" (on CURRENT_PASSWORD_INCORRECT)
  - New password field: "Password must be at least 8 characters" / "Must be different from current password"
  - Confirm field: "Passwords don't match" (client-side, before submit)
- Success: form collapses; show a brief "Password updated. All other sessions have been signed out." inline notice.
- Rate-limit error: inline banner: "Too many attempts. Please try again in 1 hour."

#### 3b. OAuth-only — user has no password

```
Password

You signed in with Google (or Apple). You haven't set a password yet.

[Set a password]  (expands inline form)
```

Expanded (no "Current password" field):

```
New password
[                               ]  [👁]

Confirm new password
[                               ]  [👁]

[Set password]   [Cancel]
```

Success: "Password set. You can now sign in with your email and password." The section label updates to the 3a state.

---

### 4. Email Verification Banner

Shown at the top of the contacts workspace (and possibly other key pages) when `emailVerified` is null.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✉  Please verify your email address — we sent a link to user@example.com  │
│     [Resend verification]                                              [×]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Visual spec:**
- Background: `amber-50`, border: `amber-200`, border-left: 4px `amber-500`
- Icon: `Mail` (Lucide, 16px, amber-600)
- Text: 14px, `#1d2823`. Email address in semibold.
- "Resend verification": text link (blue-600), disabled for 5 minutes after a send.
- Dismiss [×]: removes banner for the session (reappears on next login).

**Position:** Pinned below the main top navigation bar; above the page content. Does not push content down — it overlays or uses a sticky notice slot.

---

### 5. Active Sessions Panel

#### 5a. Multiple sessions

```
Active sessions

  [Monitor icon]  Chrome on macOS               Current session
                  91.108.4.5 · Active just now

  [Smartphone]    Safari on iPhone                             [Sign out]
                  185.92.123.4 · Active 2 days ago

  [Monitor icon]  Firefox on Windows                           [Sign out]
                  203.0.113.42 · Active 1 week ago

  ─────────────────────────────────────────────────────────────────────
  [Sign out of all other devices]  (text link, red-600 on hover)
```

**Row layout:**
- Height: 52px
- Left: 32px wide icon column. Device icons: `Monitor` (desktop/unknown), `Smartphone` (mobile), `Tablet`.
- Center: device hint in 14px medium weight; IP + relative time in 12px muted on the line below.
- Right: "Current session" label (green-600, 12px) for the current session. "Sign out" button (secondary, small, 28px height) for others.
- "Sign out" loading state: spinner replaces button; row dims to 60% opacity.
- "Sign out" success: row animates out (height collapses over 150ms).

**"Sign out of all other devices":**
- Clicking shows an inline confirmation below the list: "Sign out of N other sessions? [Confirm]  [Cancel]"
- On confirm: all rows except "Current session" fade out simultaneously; toast: "Signed out of N devices."

#### 5b. Single session (current only)

```
Active sessions

You're only signed in on this device.
```

12px muted text, no icon, centered vertically in the section.

---

### 6. Two-Factor Authentication Section

#### 6a. 2FA disabled

```
Two-factor authentication  [Disabled]  (grey chip)

Add an extra layer of security. When 2FA is enabled, you'll need
a code from your authenticator app each time you sign in.

[Set up authenticator app]  (primary button)
```

#### 6b. Enrolment flow — Step 1: Scan QR code

Full-section expanded state (or a modal — designer's choice):

```
Set up two-factor authentication

Step 1 of 2 — Scan this QR code with your authenticator app

  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │          [QR code — 200×200px]                  │
  │                                                 │
  └─────────────────────────────────────────────────┘

  Can't scan? Enter this code manually:
  JBSW Y3DP EHPK 3PXP  (monospace, spaced in groups of 4)

[Continue →]
```

- QR code is a data URI image rendered as `<img>`.
- "Can't scan?" section uses a `ChevronDown` toggle to expand the manual entry code. Collapsed by default.
- Secret is displayed in groups of 4 in a `code` block style (monospace, muted background).

#### 6c. Enrolment flow — Step 2: Verify code

```
Set up two-factor authentication

Step 2 of 2 — Enter the 6-digit code from your authenticator app

  [  ][  ][  ][  ][  ][  ]  (6 individual digit inputs, or one 6-digit OTP input)

[Verify and enable]   (disabled until 6 digits entered)
[← Back]

```

- OTP input: 6 individual single-character inputs that auto-advance focus, or a single `<input maxLength=6 inputMode="numeric">`. Auto-submit on 6th digit.
- Loading state: spinner on "Verify and enable" + inputs disabled.
- Error state: inline below the input: "Incorrect code. Try again." with a subtle shake animation on the input row.

#### 6d. Enrolment success — Show recovery codes

```
Two-factor authentication is now enabled! ✓

Save your recovery codes somewhere safe.

If you lose access to your authenticator app, these codes
are the only way to recover your account.

  ┌──────────────────────────────────┐
  │  R3KP7Q4X2A   B7NM5T9WQ1       │
  │  X2QF6K8PJ3   H4VN3R7BQ9       │
  │  M9JW4T2LP5   K6CX8B1QN7       │
  │  D5RP9X3NM8   W2TJ7K4QV6       │
  └──────────────────────────────────┘

[Copy all codes]   [Download as .txt]

[I've saved my codes →]  (primary; clicking dismisses the recovery code screen)
```

- Recovery code grid: 2 columns, monospace font, `#1d2823`, light background cell.
- Warning text: amber-700 text in an amber-50 box with a `AlertTriangle` icon.
- "Copy all codes": copies all codes to clipboard, button label changes to "Copied ✓" for 2 seconds.
- "I've saved my codes →": routes to the main 2FA settings section (6e state).

#### 6e. 2FA enabled state

```
Two-factor authentication  [Enabled]  (green chip)

Authenticator app connected. You'll be asked for a code on each sign-in.
Enabled on June 11, 2026.

Recovery codes: 8 remaining  [View or regenerate]

[Disable 2FA]  (text link, red-600)
```

"View or regenerate" expands a panel showing the remaining unused codes (hashed — show only count? Or regenerate to see new ones?) — design decision for the designer: recommend showing count only, with a "Regenerate recovery codes" CTA that shows a new set.

"Disable 2FA" link expands an inline confirmation form:

```
To disable two-factor authentication, enter your password and
a code from your authenticator app.

Password
[                                ]  [👁]

Authenticator code
[      ]

[Disable 2FA]   [Cancel]
```

Both fields required before the button is enabled. Error handling same as password change (P18-02 pattern).

---

### 7. Connected Accounts Section

```
Connected accounts

  [Google logo 20px]   Google
                       john@gmail.com  [Disconnect]

  [Apple logo 20px]    Apple
                       Not connected   [Connect]
```

**Row layout:**
- Provider logo (20px, exact brand colour/mark — source from simple-icons or brand assets)
- Provider name: 14px medium
- Connected: email address in 12px muted, then [Disconnect] text button (secondary, small)
- Not connected: "Not connected" in 12px muted, then [Connect] button (secondary, small)

**"Disconnect" confirmation (inline):**
```
Disconnect Google? You'll no longer be able to sign in with Google.
[Yes, disconnect]   [Cancel]
```

If disconnecting the last auth method:
```
You must set a password before disconnecting your last sign-in method.
[Set a password →]   [Cancel]
```

---

### 8. `/login/verify-2fa` — TOTP Challenge Page

Standalone page, same shell as `/login` (no app sidebar). Consistent with the login page visual treatment.

```
                    [Kontax wordmark]

          Two-factor authentication

          Enter the 6-digit code from your
          authenticator app.

          [  ][  ][  ][  ][  ][  ]

          [Verify]  (primary button, full-width on this page)

          ─────────────────────────────────────────────
          [Use a recovery code instead]  (text link)

          [← Back to login]  (text link, small, muted)
```

**Recovery code view** (toggled by "Use a recovery code instead"):

```
          Enter one of your recovery codes

          [                              ]  (text input)

          [Verify recovery code]  (primary)

          [← Use authenticator app instead]
```

**Error state (wrong code):**
- The 6-digit input row gets a red border and a subtle horizontal shake animation.
- Inline error below: "Incorrect code. Please try again." (or "Incorrect recovery code.")
- After 5 failed attempts: "Too many attempts. Please try again in 15 minutes." — both inputs disabled.

---

### 9. Password Reset Pages

#### 9a. `/forgot-password`

Same shell as `/login`.

```
                    [Kontax wordmark]

          Forgot your password?

          Enter your email address and we'll send
          you a reset link.

          Email address
          [                                    ]

          [Send reset link]  (primary, full-width)

          [← Back to login]  (text link)
```

After submission (regardless of whether email exists):

```
                    [Kontax wordmark]

          Check your inbox

          If an account exists for [email@example.com], we've
          sent a password reset link. It expires in 15 minutes.

          Didn't receive it? [Resend]  (rate-limited — disabled 5min after send)

          [← Back to login]
```

#### 9b. `/reset-password?token=<valid>`

```
                    [Kontax wordmark]

          Set a new password

          New password
          [                               ]  [👁]

          Confirm new password
          [                               ]  [👁]

          [Reset password]  (primary, full-width; disabled until both match and min 8 chars)
```

#### 9c. `/reset-password?token=<invalid or expired>`

```
                    [Kontax wordmark]

          This link has expired

          Password reset links are only valid for 15 minutes.

          [Request a new reset link →]  (links to /forgot-password)
```

---

## Acceptance Criteria for the Brief

- Designer receives this brief and can produce high-fidelity mockups without a clarification meeting.
- Every interactive state is specified: hover, focus, loading, error, disabled, empty, success.
- All 9 surface groups are covered with all sub-states enumerated.
- Lucide icon choices are specified for all new icons.
- Tailwind colour tokens are specified using the locked palette.
- Typography sizes and weights are specified.
- Motion/animation is specified where applicable (shake on error, fade-out on session revoke).
- Overflow/truncation is specified for all text-heavy elements (email addresses, device hints).

## Risks and Open Questions

- **Settings navigation structure:** Decided — keep the existing sidebar shell. New surfaces distributed across `/settings/profile`, `/settings/account` (new), and the expanded `/settings/security`. Do not propose a single-scroll layout.
- **2FA enrolment as inline expansion vs modal:** Embedding the QR code flow inline within the settings page keeps context but can be visually heavy. A modal offers cleaner focus. Recommend the designer evaluate both and propose one; note that the recovery-codes step after confirmation should be modal regardless (to give it full visual prominence).
- **Recovery code display:** Should recovery codes be shown immediately after enrolment, or sent via email? Immediate display is more secure (email is a less secure channel). The brief specifies immediate display — document this decision clearly.
- **"Current session" identification in the sessions list:** On mobile, two sessions from the same device (e.g. browser + PWA) would both show the same device hint. Ensure the "Current session" label is derived from the session `jti` match, not from device hint matching.
