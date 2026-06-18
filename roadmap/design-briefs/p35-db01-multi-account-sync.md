# P35-DB01 — Multi-Account Sync

**Route:** `/sync`
**Extends:** [07-sync-connections.md](07-sync-connections.md)
**Status:** Design brief — net-new UI on top of the existing sync page.

---

## Context

The sync data model already supports multiple accounts per provider — the unique constraint is `(userId, baseUrl, label)`, not `(userId, provider)`. The Google OAuth callback was previously clobbering any existing Google account on reconnect; that bug is fixed in this phase (P35). This brief defines how the UI surfaces, manages, and guides users through connecting multiple sync accounts — including two Gmail accounts, a work Outlook and a personal Outlook, or any mix of CardDAV + OAuth providers.

---

## What changes vs. the current page

| Area | Current | New |
|---|---|---|
| Account list | Flat list — any order | Grouped by provider (Google, Microsoft, CardDAV) with a section header per group |
| "Add account" form | Single "Connect with OAuth" section shows Google + Outlook tiles | Same tiles, but labelled "Connect another…" if ≥ 1 account of that provider already exists |
| Re-auth banner | Links to `/api/sync/google/connect` (one shared URL) | Must carry `?accountId=…` context so the callback reconnects the right account rather than creating a new one |
| Entitlement cap | Hard count check against `syncAccountsLimit` | Same, but cap message is scoped: "You have N of M sync accounts" with per-provider context |
| Account list item | Provider icon only | Icon + email label under the account name so two Google rows are visually distinct |

---

## Account List — Grouped Layout

```
┌────────────────────────────┐
│  SYNC ACCOUNTS             │
│                            │
│  GOOGLE                    │  ← provider group label (if ≥1 Google account)
│  ┌──────────────────────┐  │
│  │ [G] personal@gmail   │  │  ← connectedEmail shown as subtitle
│  │     2 min ago      ● │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │ [G] work@company.com │  │
│  │     1 hour ago     ● │  │
│  └──────────────────────┘  │
│                            │
│  MICROSOFT                 │
│  ┌──────────────────────┐  │
│  │ [M] me@outlook.com   │  │
│  │     Needs reauth   ● │  │
│  └──────────────────────┘  │
│                            │
│  CARDDAV                   │
│  ┌──────────────────────┐  │
│  │ [☁] iCloud           │  │
│  │     15 min ago     ● │  │
│  └──────────────────────┘  │
│                            │
│  + Add account             │
└────────────────────────────┘
```

**Provider group label:** `font-size: 10px`, `font-weight: 700`, `letter-spacing: 0.12em`, `text-transform: uppercase`, `color: #8b938c`, `padding: 12px 0 4px`. Only shown when ≥ 1 account of that provider exists. Do not show the label for a group with one provider type if that's the only group (i.e. only show grouping when there are 2+ provider types, or always when there are 2+ accounts).

**Account list item subtitle:** when `connectedEmail` is set (Google, Microsoft), show it instead of the baseUrl. `font-size: 12px`, `color: #8b938c`. This is the main visual differentiator between two accounts of the same provider — the email must be visible in the collapsed list row.

**Ordering within groups:** sort by `createdAt` ascending (oldest first). Groups ordered: Google → Microsoft → CardDAV.

---

## "Add Account" Form — OAuth Section

### When no accounts of a provider exist

Show the tile normally:

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  [G]  Google Contacts        │  │  [M]  Outlook / Exchange     │
│       via Google People API  │  │       via Microsoft Graph    │
└──────────────────────────────┘  └──────────────────────────────┘
```

### When ≥ 1 account of that provider already exists

Change the tile label to "Connect another…" and add a sub-note showing the already-connected accounts:

```
┌──────────────────────────────────────────────────────┐
│  [G]  Connect another Google account                 │
│       personal@gmail.com already connected           │
└──────────────────────────────────────────────────────┘
```

- Sub-note: `font-size: 11px`, `color: #8b938c`. List up to 2 emails inline; if more, show "2 accounts connected".
- The tile still links to `/api/sync/google/connect` — no `accountId` param needed since this flow is always creating a new account.

### Entitlement cap — "Add account" disabled state

When `accounts.length >= syncAccountsLimit`:
- The `+ Add account` button in the list is greyed out with an upgrade tooltip on hover.
- The Add Account form still opens but shows a cap banner at the top instead of the form:

```
┌──────────────────────────────────────────────────────┐
│  ⚠  You're using all 3 of your 3 sync accounts.     │
│     Upgrade to Pro to connect more.  [Upgrade →]    │
└──────────────────────────────────────────────────────┘
```

- Banner: `background: #f6edd9`, `border: 1px solid #e9c87b`, `border-radius: 10px`, `padding: 14px 16px`.
- "Upgrade →": `color: #4158f4`, `font-weight: 600`.

---

## Re-auth Flow — Account-scoped

The current re-auth banner links to `/api/sync/google/connect` without any account context, which means a second Google account can accidentally become a re-auth for the first.

**Fix:** pass `?accountId={syncAccountId}` on the connect URL when initiating a reconnect from an existing account's detail panel. The connect route must persist this in the OAuth state, and the callback must use it to scope the `findFirst` to that specific account rather than matching by email.

> Note: this is a backend addition — `/api/sync/google/connect` must accept and forward `accountId` through the OAuth `state` param, and the callback must prefer `{ id: accountId }` over the email lookup when `accountId` is present.

**Re-auth button label change:**

| Context | Current label | New label |
|---|---|---|
| Only one Google account | "Re-authorise Google" | "Re-authorise Google" (unchanged) |
| Multiple Google accounts | "Re-authorise Google" | "Re-authorise personal@gmail.com" |

Show the email in the button label when the user has 2+ accounts of the same provider, so it's unambiguous which account is being reconnected.

---

## Account Detail Panel — No Changes Required

The detail panel is already account-scoped (it receives a `SyncAccountData` with `id`, `connectedEmail`, etc.). The only change is the re-auth button label described above.

---

## Mobile Layout

The existing mobile sync screen (`mobile-sync-screen.tsx`) already passes `syncAccountsLimit` and renders a cap message. Additions:

- In the account list (mobile Screen 1), show `connectedEmail` as a subtitle under the account name — same as desktop.
- Provider group labels omitted on mobile (too noisy at small width) — items are visually distinct by icon + email.
- The cap banner in "Add account" is full-width, same copy as desktop.

---

## Edge Cases

**Two accounts, same email resolved:** The callback will find the existing account by `remoteAccountId` and update it (reconnect), not create a duplicate. This is correct — Google's `prompt: "select_account"` forces the user to pick an account, so same email = same account.

**Email not resolved (network failure during profile fetch):** The callback falls back to matching any Google account with no email stored. If the user has two accounts and one has no email stored, the fallback may update the wrong one. This is a pre-existing edge case (non-fatal profile fetch); surfacing a "couldn't confirm account identity" warning in the detail panel's OAuth metadata row would help but is a stretch goal.

**Re-auth banner on a shared-book account (Teams):** The `TeamSyncAccount` relation means a shared sync account may be visible to non-owner members. Re-auth should only be actionable by the account owner (`userId` match). Non-owners see the NEEDS_REAUTH status but the re-auth button is hidden; instead: "Ask the account owner to re-authorise."

---

## Implementation Checklist

### Backend
- [x] Fix Google callback `findFirst` to match by `remoteAccountId` only (not broad OR fallback) — **done in this phase**
- [ ] Accept `?accountId=` on `/api/sync/google/connect` and `/api/sync/microsoft/connect`; embed it in OAuth state
- [ ] In callbacks: when `state.accountId` is present, look up by `{ id: state.accountId, userId }` and treat as reconnect regardless of email

### Frontend
- [ ] Account list: group by provider with section headers
- [ ] Account list item: show `connectedEmail` as subtitle (Google/Microsoft)
- [ ] "Add account" OAuth tiles: detect existing accounts and show "Connect another…" variant
- [ ] Re-auth button: show email in label when 2+ accounts of same provider exist
- [ ] Cap banner in Add Account form (already enforced on mobile; add to desktop form)
