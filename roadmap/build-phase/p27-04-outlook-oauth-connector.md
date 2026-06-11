# P27-04 — Microsoft Outlook / Exchange OAuth Connector

## Purpose

Add a Microsoft Outlook/Exchange sync connector using MSAL (Microsoft Authentication Library) and the Microsoft Graph API (`/me/contacts`), enabling live two-way sync with Outlook, Exchange, and Microsoft 365 contact books. This is the second most common sync source after Google for professional users.

## Background

Same infrastructure approach as Google (P27-01): new `SyncProvider` value, OAuth token storage in `SyncAccount.encryptedCredential`, a token-refresh utility, and connector-specific implementations of the pull/push phases. Microsoft Graph uses `$deltaquery` for incremental syncs — the equivalent of Google's `syncToken`.

## Scope

**In scope:**
- `MICROSOFT` value added to `SyncProvider` enum
- Azure AD app registration documentation (`.env.example` additions)
- MSAL OAuth flow: `GET /api/sync/microsoft/connect` and `GET /api/sync/microsoft/callback`
- Token storage: access token + refresh token encrypted in `SyncAccount.encryptedCredential`
- Token refresh using MSAL `ConfidentialClientApplication`
- Initial full import: `GET /me/contacts` with pagination (`@odata.nextLink`)
- Delta link persistence: stored on `SyncAccount.lastSyncCursor` after each successful sync
- Incremental sync: `GET /me/contacts/delta` with stored delta link

**Out of scope:**
- Field mapping (P27-05)
- Conflict handling (P27-06)
- Exchange on-premises (Graph only covers Exchange Online and Microsoft 365)

---

## Design / Implementation Spec

### Environment variables

Add to `.env.example`:
```
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://app.kontax.app/api/sync/microsoft/callback
```

`MICROSOFT_TENANT_ID=common` allows personal Microsoft accounts (Outlook.com) and work accounts (Microsoft 365). Use `organizations` to restrict to work accounts only.

### OAuth flow

```bash
npm install @azure/msal-node
```

`src/app/api/sync/microsoft/connect/route.ts`:

```typescript
import { ConfidentialClientApplication } from "@azure/msal-node";

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
  },
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const cca = new ConfidentialClientApplication(msalConfig);
  const state = encryptState({ userId: session.user.id });

  const authCodeUrl = await cca.getAuthCodeUrl({
    scopes: ["Contacts.ReadWrite", "User.Read", "offline_access"],
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
    state,
  });

  return NextResponse.redirect(authCodeUrl);
}
```

`src/app/api/sync/microsoft/callback/route.ts`:

```typescript
export async function GET(req: NextRequest) {
  const { code, state } = parseCallbackParams(req);
  const { userId } = decryptState(state);

  const cca = new ConfidentialClientApplication(msalConfig);
  const tokenResponse = await cca.acquireTokenByCode({
    code,
    scopes: ["Contacts.ReadWrite", "User.Read", "offline_access"],
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
  });

  // Get the connected Microsoft account email
  const graphClient = Client.initWithMiddleware({ authProvider: tokenToAuthProvider(tokenResponse) });
  const me = await graphClient.api("/me").select("mail,userPrincipalName").get();
  const microsoftEmail = me.mail ?? me.userPrincipalName ?? "";

  await db.syncAccount.create({
    data: {
      userId,
      provider: "MICROSOFT",
      label: `Outlook (${microsoftEmail})`,
      serverUrl: "https://graph.microsoft.com/v1.0",
      encryptedCredential: encrypt({
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresOn: tokenResponse.expiresOn?.getTime(),
        microsoftEmail,
      }),
      status: "ACTIVE",
    },
  });

  return NextResponse.redirect("/sync?connected=microsoft");
}
```

### Token refresh

```typescript
async function getMicrosoftClient(syncAccount: SyncAccount): Promise<Client> {
  const credential = decrypt(syncAccount.encryptedCredential);

  if (Date.now() > credential.expiresOn - 60_000) {
    const cca = new ConfidentialClientApplication(msalConfig);
    const tokenResponse = await cca.acquireTokenByRefreshToken({
      refreshToken: credential.refreshToken,
      scopes: ["Contacts.ReadWrite", "User.Read", "offline_access"],
    });

    await db.syncAccount.update({
      where: { id: syncAccount.id },
      data: {
        encryptedCredential: encrypt({
          ...credential,
          accessToken: tokenResponse!.accessToken,
          expiresOn: tokenResponse!.expiresOn?.getTime(),
        }),
      },
    });

    return Client.initWithMiddleware({ authProvider: tokenToAuthProvider(tokenResponse!) });
  }

  return Client.initWithMiddleware({ authProvider: tokenToAuthProvider(credential) });
}
```

### Initial full import and incremental sync

**Full import:**
```typescript
async function microsoftFullImport(syncAccount: SyncAccount): Promise<void> {
  const graphClient = await getMicrosoftClient(syncAccount);

  let response = await graphClient.api("/me/contacts")
    .select(MICROSOFT_CONTACT_FIELDS)
    .get();

  do {
    await processMicrosoftContacts(response.value, syncAccount);
    if (response["@odata.nextLink"]) {
      response = await graphClient.api(response["@odata.nextLink"]).get();
    } else {
      break;
    }
  } while (true);

  // Get the delta link for incremental syncs
  const deltaInit = await graphClient.api("/me/contacts/delta")
    .select(MICROSOFT_CONTACT_FIELDS)
    .get();
  // Follow through all pages to get the final deltaLink
  const deltaLink = await exhaustDeltaPages(graphClient, deltaInit);

  await db.syncAccount.update({
    where: { id: syncAccount.id },
    data: { lastSyncCursor: deltaLink },
  });
}
```

**Incremental sync:**
```typescript
async function microsoftIncrementalSync(syncAccount: SyncAccount): Promise<void> {
  const graphClient = await getMicrosoftClient(syncAccount);

  let response = await graphClient.api(syncAccount.lastSyncCursor!).get();

  do {
    await processMicrosoftContacts(response.value, syncAccount);
    if (response["@odata.nextLink"]) {
      response = await graphClient.api(response["@odata.nextLink"]).get();
    } else {
      break;
    }
  } while (true);

  // Update the delta link
  await db.syncAccount.update({
    where: { id: syncAccount.id },
    data: { lastSyncCursor: response["@odata.deltaLink"] },
  });
}
```

Delta responses include contacts with `@removed: { reason: "changed" | "deleted" }` for deletions.

---

## Acceptance Criteria

- `MICROSOFT` is a valid `SyncProvider` enum value.
- `GET /api/sync/microsoft/connect` redirects to Microsoft's login/consent page.
- After consent, `GET /api/sync/microsoft/callback` creates a `SyncAccount` row with encrypted tokens.
- The initial full import fetches all Outlook contacts via Graph and creates `Contact` rows via P27-05's mapping.
- After import, `SyncAccount.lastSyncCursor` stores the delta link URL.
- Incremental syncs use the delta link and update it after each poll.
- Token refresh runs automatically when the access token is within 60 seconds of expiry.
- Disconnecting revokes the Microsoft token via the MSAL `logout` / token revocation endpoint.

---

## Risks and Open Questions

- **Azure AD app registration:** the Microsoft app must be registered in Azure Portal with the correct redirect URI and `Contacts.ReadWrite` + `offline_access` permissions. Document the registration steps in the runbook. Note: personal Microsoft account (MSA) apps require a different registration than enterprise Azure AD apps. The `common` tenant ID supports both, but some Graph APIs behave differently for MSA vs AAD.
- **Contacts vs People API:** Microsoft Graph has both `/me/contacts` (Outlook-style contact list) and `/me/people` (relevance-based people suggestions). Use `/me/contacts` — this is the canonical contact store. `/me/people` is not suitable for sync.
