# P27-DB08 — Design Brief: OAuth Sync Connector Connect Flow & Status

## Purpose

This brief specifies the design for the Google Contacts and Microsoft Outlook OAuth sync connectors: the connect flow (OAuth redirect, permission prompt, success state), sync status card extension, disconnect confirmation, and error recovery states. It extends the existing sync connections design (`07-sync-connections.md`) without breaking the existing CardDAV UI.

## Background

Phase 27 adds two new sync account types: Google (via People API) and Microsoft Outlook/Exchange (via Microsoft Graph). These are OAuth-based — instead of a server URL and password, the user authorises Kontax's OAuth app and Kontax receives a token. The connect flow is different from CardDAV (no manual URL entry), but the account list, detail panel, and sync history table are shared infrastructure and should feel consistent.

The locked design language applies: ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, surface `#f2f4f0`, brand green `#17352e`, CTA blue `#4158f4`, Geist.

---

## Scope

### In scope

1. OAuth connect tiles on the "Add account" form (Google, Outlook)
2. OAuth connect flow: redirect, permission prompt, success/error return state
3. Account list item variants for Google and Outlook (new provider icons)
4. Account detail panel additions: OAuth-specific fields (connected Google account email, token expiry, scope)
5. Re-authorisation flow (token expired or revoked)
6. Disconnect confirmation for OAuth accounts
7. Error states: token expired, scope reduced, API quota exceeded

### Out of scope

- CardDAV account UI (unchanged from `07-sync-connections.md`)
- Billing gate (OAuth sync is a Pro feature — handled by entitlement gates, not design)

---

## Design / Implementation Spec

### 1. OAuth connect tiles (in "Add account" form)

The existing "Add account" form in the right detail panel gains two new quick-connect tiles at the top:

```
Add sync account

Quick-connect
┌─────────────────┐  ┌─────────────────┐
│  [Google icon]  │  │ [Outlook icon]  │
│  Google         │  │ Outlook         │
│  Contacts       │  │ / Exchange      │
└─────────────────┘  └─────────────────┘
┌─────────────────┐  ┌─────────────────┐
│  [cloud icon]   │  │ [cloud icon]    │
│  iCloud         │  │ Manual          │
│                 │  │ CardDAV         │
└─────────────────┘  └─────────────────┘
```

Clicking Google or Outlook tiles: initiates the OAuth redirect flow (external, no form). The tile shows a loading spinner while the OAuth URL is being generated.

**Google tile:** Google "G" multi-colour icon. Label: "Google Contacts".
**Outlook tile:** Microsoft Office blue icon. Label: "Outlook / Exchange".

---

### 2. OAuth connect flow

**Redirect state:** when the user clicks a tile, the right detail panel briefly shows:

```
Connecting to Google...
Opening Google's sign-in page.

[Cancel]
```

`font-size: 14px`, `color: #5c655e`. Spinner at top. Cancel returns to the "Add account" form.

**Return state (success):** after OAuth callback, the right panel transitions to:

```
✓  Connected to Google

Syncing as: user@gmail.com
Importing contacts now...

[Close]
```

Background: `#e3efe7`. Check circle `#1f8a5b`. Email in `color: #5c655e`, `font-size: 13px`. Spinner on "Importing contacts now..."

**Return state (error):** if the user denies permissions or an error occurs:

```
⚠  Connection failed

Google didn't grant the required permissions.
Please try again and allow access to Contacts.

[Try again]   [Cancel]
```

Background: `#f7e9e4`. Warning icon `#b5472f`.

---

### 3. Account list item — OAuth providers

Same structure as CardDAV accounts, with provider-specific icons:

```
┌────────────────────────────────────┐
│  [G] Google Contacts    ●          │
│      user@gmail.com                │
│      5 min ago                     │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│  [M] Outlook            ● err      │
│      user@company.com              │
│      Re-auth required              │
└────────────────────────────────────┘
```

Provider icon: 20×20px. Google: official G icon. Outlook: official M365 icon. Secondary line shows the connected email address in `color: #8b938c`, `font-size: 12px`.

---

### 4. Account detail panel — OAuth additions

Below the direction badge and health summary, add:

```
Connected account:  user@gmail.com
Authorised scope:   Contacts (read & write)
Token status:       ✓ Valid
Last refreshed:     2 hours ago

[Re-authorise]     (only shown if token is expired/revoked)
```

- Label: `font-size: 12px`, `font-weight: 600`, `text-transform: uppercase`, `color: #8b938c`.
- Value: `font-size: 13px`, `color: #5c655e`.
- "Re-authorise" button: same as "Edit credentials" for CardDAV — triggers the OAuth re-auth flow.

---

### 5. Re-authorisation state

When `SyncAccount.status === "AUTH_FAILED"` for an OAuth account:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  Re-authorisation required                                   │
│  Your Google authorisation has expired or been revoked.         │
│  Click Re-authorise to restore the connection.                  │
│                                                                  │
│  [Re-authorise Google →]                                        │
└─────────────────────────────────────────────────────────────────┘
```

`background: #f6edd9`, `border: 1px solid #e9c87b`, `border-radius: 12px`. Same amber pattern as the CardDAV re-auth banner.

---

### 6. Disconnect confirmation — OAuth

Same modal pattern as CardDAV disconnect but with OAuth-specific copy:

```
Disconnect Google Contacts?

Contacts synced from Google will remain in Kontax
but will no longer sync automatically.

Your Google authorisation will be revoked.

[Cancel]   [Disconnect]
```

---

### 7. Error states unique to OAuth

**API quota exceeded:**
```
⚠  Google API quota exceeded
Sync is paused. Kontax will automatically retry in 1 hour.
[Sync now] is disabled during the pause.
```

**Scope reduced (user removed Contacts permission):**
```
⚠  Permission reduced
You removed Contacts access from the Kontax app in your Google account.
Re-authorise to restore sync.
[Re-authorise →]
```

---

## Acceptance Criteria

- Designer can produce the Google and Outlook connect flows without a follow-up meeting.
- All 6 states (redirect, success, error, re-auth needed, quota exceeded, scope reduced) are specified.
- OAuth tiles are shown alongside (not replacing) the CardDAV quick-connect tiles.
- The account list item variant for OAuth shows the connected email address as the secondary line.
- Disconnect copy is specific to OAuth (mentions authorisation revocation).
