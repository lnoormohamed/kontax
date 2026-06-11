# P29-05 — API Access Tokens

## Purpose

Allow users to create named API tokens (scoped read-only or read-write) that authenticate requests to the Kontax REST API (P29-06). Tokens are shown once on creation, hashed at rest, and revocable from the settings panel. The token management panel lives at `/settings/developer`.

## Background

The approach mirrors the `AppPassword` model from P9-02 (32-byte random token, SHA-256 hash stored, shown once), with additions: `scope` (read-only vs read-write), `lastUsedAt` (for the usage panel), and `requestCountThisMonth` (for rate limit display). A separate `ApiToken` model is used — not `AppPassword` — to keep concerns distinct, as the roadmap specifies.

## Scope

**In scope:**
- `ApiToken` Prisma model: `id`, `userId`, `name`, `tokenHash`, `tokenPrefix` (first 8 chars for display), `scope`, `lastUsedAt`, `requestCountThisMonth`, `createdAt`, `revokedAt`
- `createApiToken(name, scope)` server action — generates token, hashes it, returns the plaintext once
- `revokeApiToken(id)` server action
- Token validation utility: `validateApiToken(bearerToken)` → `{ userId, scope }` — used by the P29-06 API
- Pro+ plan gate: Free users see the locked panel with an upgrade prompt
- Settings panel UI per P29-DB10 spec: token list, create modal, show-once state, revoke confirmation

**Out of scope:**
- API rate limiting implementation (P29-08 extends this ticket's model)
- The REST API itself (P29-06)

---

## Design / Implementation Spec

### Schema

```prisma
enum ApiTokenScope {
    READ_ONLY
    READ_WRITE
}

model ApiToken {
    id                    String        @id @default(cuid())
    userId                String
    name                  String
    tokenHash             String        @unique // SHA-256 of the plaintext token
    tokenPrefix           String        // first 8 chars of plaintext, for display ("ktx_live_7f3a...")
    scope                 ApiTokenScope @default(READ_ONLY)
    lastUsedAt            DateTime?
    requestCountThisMonth Int           @default(0)
    createdAt             DateTime      @default(now())
    revokedAt             DateTime?

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, revokedAt])
    @@index([tokenHash]) // fast lookup on auth
}
```

Run: `prisma migrate dev --name add-api-token`

### Token format

```typescript
import { randomBytes, createHash } from "crypto";

export function generateApiToken(): { plaintext: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("base64url"); // 43-char URL-safe string
  const plaintext = `ktx_live_${raw}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  const prefix = plaintext.slice(0, 12); // "ktx_live_7f3" — enough to identify in UI
  return { plaintext, hash, prefix };
}
```

Token format: `ktx_live_{43-char-base64url}`. Total length: 52 characters. Unmistakable as a Kontax token.

### `createApiToken` server action

```typescript
export async function createApiToken(input: {
  name: string;
  scope: ApiTokenScope;
}): Promise<{ token: string; id: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  // Pro+ gate
  const entitlements = await getUserEntitlements(session.user.id);
  if (!entitlements.apiAccessEnabled) throw new Error("UPGRADE_REQUIRED");

  const { plaintext, hash, prefix } = generateApiToken();

  const record = await db.apiToken.create({
    data: {
      userId: session.user.id,
      name: input.name.trim(),
      tokenHash: hash,
      tokenPrefix: prefix,
      scope: input.scope,
    },
  });

  // Return the plaintext ONLY here — never stored, never retrievable again
  return { token: plaintext, id: record.id };
}
```

### `revokeApiToken` server action

```typescript
export async function revokeApiToken(id: string): Promise<void> {
  const session = await auth();
  await db.apiToken.update({
    where: { id, userId: session!.user!.id },
    data: { revokedAt: new Date() },
  });
}
```

### `validateApiToken` utility

Called by the P29-06 API middleware:

```typescript
export async function validateApiToken(
  bearerToken: string,
): Promise<{ userId: string; scope: ApiTokenScope } | null> {
  if (!bearerToken.startsWith("ktx_live_")) return null;

  const hash = createHash("sha256").update(bearerToken).digest("hex");

  const token = await db.apiToken.findUnique({
    where: { tokenHash: hash },
    select: { userId: true, scope: true, revokedAt: true },
  });

  if (!token || token.revokedAt) return null;

  // Update lastUsedAt and increment count (fire and forget — don't block the response)
  void db.apiToken.update({
    where: { tokenHash: hash },
    data: {
      lastUsedAt: new Date(),
      requestCountThisMonth: { increment: 1 },
    },
  });

  return { userId: token.userId, scope: token.scope };
}
```

### Settings panel UI

`src/app/settings/developer/page.tsx` — follows P29-DB10 spec:

- **Token list:** fetched server-side. Columns: name, scope badge, last used, `[Revoke]` on hover.
- **Create modal:** name input + scope radio (Read-only / Read-write) + Create button.
- **Show-once state:** after creation, display the plaintext token in a green `background: #e3efe7` panel with a copy button. `[Done]` dismisses.
- **Revoke confirmation modal:** "Any application using this token will immediately lose access."

---

## Acceptance Criteria

- `ApiToken` model exists; migration applied.
- `createApiToken` generates a `ktx_live_{...}` token, stores only the SHA-256 hash, and returns the plaintext once.
- `validateApiToken` returns the userId and scope for a valid token; null for an invalid or revoked one.
- `revokeApiToken` sets `revokedAt`; subsequent `validateApiToken` calls return null.
- Free users see the upgrade prompt; Pro+ users see the full token management panel.
- The show-once token state renders immediately after creation; the token is not retrievable after the panel is closed.
- `lastUsedAt` and `requestCountThisMonth` are updated on every validated API request.

---

## Risks and Open Questions

- **Token prefix collision:** the 12-char prefix (`ktx_live_7f3`) is display-only and not unique. If two tokens happen to share the same prefix, both appear identically in the UI. The user identifies tokens by name (which must be unique per user) — the prefix is just a visual hint. Add a uniqueness constraint on `(userId, name)` to ensure names are distinct.
- **`requestCountThisMonth` reset:** the counter must reset at the start of each calendar month. Add a CRON job that runs on the 1st of each month: `db.apiToken.updateMany({ data: { requestCountThisMonth: 0 } })`. Alternatively, use a `countResetAt DateTime` field and compute the count in a time-windowed query, but the CRON approach is simpler for v1.
