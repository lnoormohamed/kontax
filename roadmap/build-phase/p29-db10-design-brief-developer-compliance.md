# P29-DB10 — Design Brief: Developer & Compliance Settings

## Purpose

This brief specifies the design for two settings surfaces: the developer API token management panel and the GDPR data export/erasure flow. Both live in `/settings` and must feel like first-class features, not afterthoughts — they signal to users and regulators that Kontax takes data rights and programmability seriously.

## Background

Phase 29 delivers: (1) a REST API protected by user-issued tokens, and (2) GDPR-compliant data export and erasure confirmation. The developer panel is a Pro feature; data export and erasure are available on all plans (portability is a right, not a premium).

The locked design language applies: ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, surface `#f2f4f0`, brand green `#17352e`, CTA blue `#4158f4`, Geist.

---

## Scope

### In scope

1. API tokens panel in settings (`/settings/developer`)
2. GDPR data export request flow in settings (`/settings/account` or dedicated section)
3. Data export status indicator (preparing / ready / expired)
4. Account deletion confirmation email content spec (P29-04)
5. Rate limit header display in the token panel

### Out of scope

- The API documentation page (`/developers` — P29-07, a public page)
- Billing history section (Phase 19)

---

## Design / Implementation Spec

### 1. API Tokens Panel (`/settings/developer`)

**Page header:**
```
Developer API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use API tokens to access your Kontax contacts
programmatically. [Read the API docs →]
```

`font-size: 14px`, `color: #5c655e`. Docs link: `color: #4158f4`, opens `/developers`.

**Plan gate (Free users):**
```
┌─────────────────────────────────────────────────────────┐
│  🔒  API access is a Pro feature                        │
│  Create API tokens and build with the Kontax API.       │
│  [Upgrade to Pro →]                                     │
└─────────────────────────────────────────────────────────┘
```
`background: #f2f4f0`, `border: 1px solid #d8ddd6`, `border-radius: 12px`, `padding: 20px 24px`.

**Token list (Pro+ users):**

```
Active tokens
─────────────────────────────────────────────────────────
  My scripts          read-only   Last used: 2h ago
  Automation          read-write  Last used: 3 days ago
  Zapier integration  read-only   Never used

[+ Create token]
```

- Each row: token name (14px 600 ink), scope badge (see below), last-used (12px muted).
- **Scope badge:** `read-only` → `background: #f2f4f0`, `color: #5c655e`; `read-write` → `background: #e3efe7`, `color: #1c6b48`.
- Hover row: `[Revoke]` button appears right-aligned — `color: #b5472f`, `font-size: 13px`, text button.

**Create token modal:**
```
┌──────────────────────────────────────────────────────┐
│  Create API token                                    │
│                                                      │
│  Token name  [My automation               ]          │
│                                                      │
│  Scope                                               │
│  ● Read-only  (can read but not modify contacts)     │
│  ○ Read-write (can create, update, and delete)       │
│                                                      │
│  [Cancel]   [Create token]                           │
└──────────────────────────────────────────────────────┘
```

**Show-once token state** (immediately after creation):
```
┌──────────────────────────────────────────────────────┐
│  ✓  Token created                                    │
│                                                      │
│  Copy your token now — it won't be shown again.      │
│                                                      │
│  ktx_live_7f3a...  [Copy]                            │
│                                                      │
│  [Done]                                              │
└──────────────────────────────────────────────────────┘
```
`background: #e3efe7`, `border: 1px solid #b6d9c0`. Monospace token value. `[Copy]` uses clipboard API.

**Revoke confirmation:**
```
Revoke "My scripts"?
Any application using this token will immediately lose access.
[Cancel]  [Revoke token]  ← red
```

**Usage stats (per token):**
```
My scripts            read-only
Last used: 2 hours ago   ·   492 requests this month   ·  Rate limit: 1,000/hour
```
12px muted. Rate limit resets at the top of each hour.

---

### 2. Data Export (`/settings/account` → "Your data" section)

```
Your data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Export all your Kontax data as a ZIP file.
Includes contacts (vCard + CSV), activity log,
billing summary, and account metadata.

[Request data export]
```

**Status states:**

*Idle (no recent request):*
```
[Request data export]   ← blue button
```

*Preparing:*
```
⏳ Preparing your export…
This usually takes less than a minute.
[Cancel request]
```

*Ready (download available):*
```
✓  Your export is ready
Prepared 3 minutes ago · Expires in 47 hours

[Download your data]   ← green button, icon: Download
```
`background: #e3efe7`, `border-radius: 12px`, `padding: 16px 20px`.

*Expired:*
```
⚠  Export expired
Your previous export link has expired.
[Request a new export]
```

---

### 3. Account Deletion Context

Below the data export section, a subdued link:

```
Delete account
If you'd like to permanently delete your account and all your data,
you can do so from the account deletion settings.
[Account deletion →]  ← links to /settings/account#delete
```
`font-size: 13px`, `color: #8b938c`. Not a button — just a contextual note linking to the existing P18-09 deletion flow.

---

## Acceptance Criteria

- Designer can produce the API token panel (list, create, show-once, revoke) without a follow-up meeting.
- All scope badge variants (read-only, read-write) are specified with exact colour tokens.
- The show-once token state is explicitly specified — green background, monospace value, single copy opportunity.
- All 4 data export status states (idle, preparing, ready, expired) are specified.
- Rate limit display per token is specified.
- Mobile: token list rows stack; create modal is a full-screen bottom sheet.
