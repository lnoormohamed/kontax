# P27-01 — Google Contacts OAuth Connector

## Purpose

Add a Google Contacts sync connector using OAuth 2.0 and the Google People API, providing a live two-way sync between Kontax and the user's Google account — automatic on a polling schedule, not requiring a manual CSV export. This is the most-requested sync source outside CardDAV.

## Background

The existing sync infrastructure (Phase 5/7) handles the account model, job scheduling, conflict detection, and link mapping. This ticket adds Google as a new `SyncProvider` that plugs into this infrastructure. The existing `SyncAccount` model stores the OAuth tokens (encrypted, same pattern as CardDAV credentials). The `SyncJob` runner reads provider type and routes to the Google-specific fetch/push implementation added here.

Google People API uses `syncToken` for incremental syncs — after the initial full import, each poll only fetches contacts that changed since the last sync, dramatically reducing API quota consumption.

## Scope

**In scope:**
- `GOOGLE` value added to `SyncProvider` enum
- Google OAuth app registration documentation (`.env.example` additions)
- OAuth 2.0 PKCE flow: `GET /api/sync/google/connect` (generates auth URL) and `GET /api/sync/google/callback` (exchanges code for tokens, creates SyncAccount)
- Token storage: access token + refresh token encrypted in `SyncAccount.encryptedCredential` (same encryption as CardDAV)
- Token refresh: automatic refresh using `google-auth-library` before each sync job
- Initial full import: fetch all contacts via `people.connections.list` with pagination
- `syncToken` persistence: stored on `SyncAccount.lastSyncCursor` after each successful poll
- Incremental sync: subsequent jobs use `syncToken` to fetch only changed contacts

**Out of scope:**
- Field mapping (P27-02)
- Conflict handling (P27-03)
- Deduplication (P27-08)

---

## Design / Implementation Spec

### Environment variables

Add to `.env.example`:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://app.kontax.app/api/sync/google/callback
```

### OAuth flow

`src/app/api/sync/google/connect/route.ts`:

```typescript
import { OAuth2Client } from "google-auth-library";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect("/login");

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  const state = encryptState({ userId: session.user.id, returnTo: "/sync" });

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/contacts",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
    prompt: "consent", // forces refresh token issuance
  });

  return NextResponse.redirect(authUrl);
}
```

`src/app/api/sync/google/callback/route.ts`:

```typescript
export async function GET(req: NextRequest) {
  const { code, state } = parseCallbackParams(req);
  const { userId } = decryptState(state);

  const client = new OAuth2Client(...);
  const { tokens } = await client.getToken(code);

  // Get the connected Google account email
  const people = google.people({ version: "v1", auth: client });
  const me = await people.people.get({ resourceName: "people/me", personFields: "emailAddresses" });
  const googleEmail = me.data.emailAddresses?.[0]?.value ?? "";

  // Store as a SyncAccount
  await db.syncAccount.create({
    data: {
      userId,
      provider: "GOOGLE",
      label: `Google Contacts (${googleEmail})`,
      serverUrl: "https://people.googleapis.com/v1",
      encryptedCredential: encrypt({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        googleEmail,
      }),
      status: "ACTIVE",
    },
  });

  return NextResponse.redirect("/sync?connected=google");
}
```

### Token refresh

Before each sync job, check if the access token is expired and refresh if needed:

```typescript
async function getGoogleClient(syncAccount: SyncAccount): Promise<OAuth2Client> {
  const credential = decrypt(syncAccount.encryptedCredential);
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken,
    expiry_date: credential.expiryDate,
  });

  if (Date.now() > credential.expiryDate - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    // Update stored tokens
    await db.syncAccount.update({
      where: { id: syncAccount.id },
      data: {
        encryptedCredential: encrypt({
          ...credential,
          accessToken: credentials.access_token,
          expiryDate: credentials.expiry_date,
        }),
      },
    });
    client.setCredentials(credentials);
  }

  return client;
}
```

### Initial full import

```typescript
async function googleFullImport(syncAccount: SyncAccount): Promise<void> {
  const client = await getGoogleClient(syncAccount);
  const people = google.people({ version: "v1", auth: client });

  let pageToken: string | undefined;
  let syncToken: string | undefined;

  do {
    const response = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 1000,
      personFields: GOOGLE_PERSON_FIELDS,
      pageToken,
      requestSyncToken: true,
    });

    await processGoogleContacts(response.data.connections ?? [], syncAccount);
    pageToken = response.data.nextPageToken ?? undefined;
    syncToken = response.data.nextSyncToken ?? undefined;
  } while (pageToken);

  // Store syncToken for incremental syncs
  await db.syncAccount.update({
    where: { id: syncAccount.id },
    data: { lastSyncCursor: syncToken },
  });
}
```

### Incremental sync

```typescript
async function googleIncrementalSync(syncAccount: SyncAccount): Promise<void> {
  const client = await getGoogleClient(syncAccount);
  const people = google.people({ version: "v1", auth: client });

  const response = await people.people.connections.list({
    resourceName: "people/me",
    personFields: GOOGLE_PERSON_FIELDS,
    syncToken: syncAccount.lastSyncCursor!, // the stored syncToken from the last sync
    requestSyncToken: true,
  }).catch((err) => {
    if (err.code === 410) {
      // syncToken expired — fall back to full sync
      return googleFullImport(syncAccount);
    }
    throw err;
  });

  // response.data.connections includes only changed/deleted contacts
  await processGoogleContacts(response.data.connections ?? [], syncAccount);
}
```

`GOOGLE_PERSON_FIELDS` constant (used in P27-02): `"names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,urls,biographies,relations"`.

---

## Acceptance Criteria

- `GOOGLE` is a valid `SyncProvider` enum value.
- `GET /api/sync/google/connect` redirects to Google's OAuth consent screen with the correct scopes.
- After OAuth consent, `GET /api/sync/google/callback` creates a `SyncAccount` row with encrypted tokens.
- The initial full import fetches all Google contacts and creates `Contact` rows via P27-02's field mapping.
- After the initial import, `SyncAccount.lastSyncCursor` stores the `syncToken`.
- Incremental syncs fetch only changed contacts using the stored `syncToken`.
- When the `syncToken` expires (HTTP 410), the connector falls back to a full re-sync automatically.
- Token expiry triggers automatic refresh using the stored `refreshToken` — no user interaction needed.
- Disconnecting (P27-07) revokes the Google access token via `client.revokeToken(accessToken)`.

---

## Risks and Open Questions

- **Google OAuth app verification:** the Google OAuth app must be verified by Google before it can access the `contacts` scope for general users (unverified apps can only access up to 100 test users). Start the verification process early — it can take 2–6 weeks. In the meantime, add test user emails in the Google Cloud Console to allow development.
- **Refresh token scarcity:** Google only issues a `refreshToken` on the first consent or when `prompt: "consent"` is set. If a user has previously authorised the app and the `refreshToken` is lost from the DB, the connection breaks permanently and the user must re-authorise. Always store the `refreshToken` immediately on receipt and never discard it.
