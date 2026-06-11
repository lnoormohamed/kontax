# P27-07 — OAuth Sync Account UI

## Purpose

Extend the existing sync connections settings page to display Google and Outlook/Microsoft sync accounts alongside CardDAV accounts, with provider-specific icons, connected account email, re-authorisation flow, and disconnect confirmation. This is the UI layer for P27-01 and P27-04 — the connectors work independently; this ticket makes them visible and manageable.

## Background

The sync connections page (`07-sync-connections.md`) was built for CardDAV accounts with a server URL and credentials. Google and Outlook accounts have no server URL — they show the connected Google/Microsoft email address instead. The account list, detail panel, and sync history table are shared; this ticket adds OAuth-specific variants within those zones.

## Scope

**In scope:**
- Google and Outlook tiles in the "Add account" form (per P27-DB08 spec)
- Provider icon and connected email address in the account list item
- Detail panel OAuth section: connected email, scope, token status, "Re-authorise" button
- Re-authorisation redirect flow (same OAuth route as initial connect, with `prompt: "consent"`)
- Disconnect confirmation with OAuth-specific copy ("Your authorisation will be revoked")
- `GET /api/sync/google/disconnect` and `GET /api/sync/microsoft/disconnect` — revoke tokens and delete SyncAccount
- Error states in the account detail panel: token expired, quota exceeded, scope reduced

**Out of scope:**
- CardDAV UI changes
- Settings for book allowlist and sync direction (P23-02 — applies to all providers uniformly)

---

## Design / Implementation Spec

### Add account form — OAuth tiles

In the existing "Add account" form (right panel when "+ Add account" is clicked), extend the quick-connect tiles:

```tsx
const PROVIDER_TILES = [
  {
    provider: "GOOGLE",
    label: "Google Contacts",
    icon: GoogleIcon, // SVG component — official Google G colours
    href: "/api/sync/google/connect",
  },
  {
    provider: "MICROSOFT",
    label: "Outlook / Exchange",
    icon: MicrosoftIcon, // SVG component — M365 blue
    href: "/api/sync/microsoft/connect",
  },
  { provider: "ICLOUD",    label: "iCloud",     icon: iCloudIcon,    preset: "iCloud" },
  { provider: "MANUAL",    label: "Manual CardDAV", icon: CloudIcon, preset: null },
];
```

OAuth tiles: clicking navigates to the OAuth redirect route (`href`). No form fields shown — the OAuth flow handles the rest.

### Account list item — OAuth providers

```tsx
function AccountListItem({ account }: { account: SyncAccountWithSettings }) {
  const credential = account.provider === "GOOGLE" || account.provider === "MICROSOFT"
    ? decryptedProviderEmail(account) // e.g. "user@gmail.com"
    : account.serverUrl;

  return (
    <div style={{ height: 56 }}>
      <ProviderIcon provider={account.provider} size={24} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1d2823" }}>{account.label}</div>
        <div style={{ fontSize: 12, color: "#8b938c" }}>{credential}</div>
      </div>
      <StatusDot status={account.status} />
    </div>
  );
}
```

For OAuth accounts, the secondary line shows the connected email address (e.g. `user@gmail.com`) instead of the server URL.

### Detail panel — OAuth section

Replace the "Edit credentials" zone for OAuth accounts with:

```
Connected account:    user@gmail.com
Authorised scope:     Contacts (read & write)
Token status:         ✓ Valid   (or ✗ Expired / ✗ Revoked)
Last refreshed:       2 hours ago

[Re-authorise →]    ← only shown when status is AUTH_FAILED
```

Re-authorise button links to the OAuth connect route (`/api/sync/google/connect` or `/api/sync/microsoft/connect`). After successful re-auth, the callback creates a new access token and the account status returns to `ACTIVE`.

### Disconnect — OAuth accounts

```tsx
// Disconnect confirmation modal (per P27-DB08 spec):
// "Disconnect {providerName}?"
// "Contacts synced from {providerName} will remain in Kontax but will no longer sync automatically."
// "Your {Google/Microsoft} authorisation will be revoked."
// [Cancel] [Disconnect]
```

`DELETE /api/sync/[accountId]` server action:
```typescript
export async function disconnectSyncAccount(accountId: string): Promise<void> {
  const session = await auth();
  const account = await db.syncAccount.findUniqueOrThrow({
    where: { id: accountId, userId: session!.user!.id },
  });

  // Revoke OAuth token for Google/Microsoft
  if (account.provider === "GOOGLE") {
    const credential = decrypt(account.encryptedCredential);
    await new OAuth2Client().revokeToken(credential.accessToken);
  }
  if (account.provider === "MICROSOFT") {
    // Microsoft token revocation is implicit — delete the refresh token
    // MSAL doesn't have a standalone revoke endpoint for web apps
  }

  await db.syncAccount.delete({ where: { id: accountId } });
}
```

### Error state banners

In the account detail panel, show provider-specific error banners based on `SyncAccount.pauseReason`:

- `AUTH_FAILED` → "Re-authorisation required" amber banner + "Re-authorise →" button
- `QUOTA_EXCEEDED` → "Google API quota exceeded. Sync paused — will auto-retry in 1 hour." amber banner
- `SCOPE_REDUCED` → "Permission reduced. Re-authorise Kontax to restore contacts access." amber banner

---

## Acceptance Criteria

- The "Add account" form shows Google and Outlook tiles alongside CardDAV tiles.
- Clicking a Google/Outlook tile redirects to the OAuth flow (no form fields shown).
- After successful OAuth, the new account appears in the account list with the connected email address as the secondary line.
- The detail panel shows the OAuth section (connected email, scope, token status) instead of the credentials form.
- The "Re-authorise" button appears only when `account.status === "AUTH_FAILED"` and redirects to the OAuth flow.
- Disconnect confirmation shows the OAuth-specific copy and calls `disconnectSyncAccount` which revokes the Google token.
- Error banners for AUTH_FAILED, QUOTA_EXCEEDED, and SCOPE_REDUCED states are visible in the detail panel.

---

## Risks and Open Questions

- **Google revoke on disconnect:** revoking a Google access token also revokes the refresh token (if the access token was issued from the same grant). Verify this behaviour — if it doesn't fully revoke, the user must also revoke access from their Google account settings (`myaccount.google.com/permissions`). Note this in the disconnect confirmation copy.
