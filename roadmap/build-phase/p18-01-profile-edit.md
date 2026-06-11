# P18-01 — Profile Edit (Name, Display Name, Avatar)

## Purpose

Users currently have no way to change their own name or upload a profile photo after signing up. The `User.name` field exists in the schema but is never exposed for editing. This ticket adds a profile settings section where users can update their display name and avatar, making the account feel personal and giving the product parity with any basic SaaS product a user would compare it to.

## Background

The Prisma `User` model has a `name String?` field but no `avatarUrl` field. The app displays initials-based avatars throughout (contact list, header user menu, shared-by lines in Phase 12) by deriving initials from `User.name`. Adding `avatarUrl` is an optional enhancement that falls back gracefully to initials when not set.

NextAuth stores `name` in the JWT session token and exposes it as `session.user.name`. Updating the name in the database requires invalidating the JWT so the next request picks up the new value — this is handled by triggering a session update via `update()` from `next-auth/react`.

The existing auth config (`src/server/auth/config.ts`) uses a Credentials provider with a JWT strategy. The `jwt` callback currently embeds `token.sub = user.id`. The `session` callback returns `session.user.id`. Both need to be extended to include `name` and `avatarUrl` so the header and other surfaces reflect changes without a full sign-out/sign-in.

## Scope

**In scope:**
- `User.avatarUrl String?` field addition to the Prisma schema
- `updateProfile` server action: update `name` and optionally `avatarUrl`
- Settings page section: profile form with name input and avatar upload/remove
- Avatar storage: accept a URL input or a file upload (uploaded to self-hosted MinIO via `@aws-sdk/client-s3` — MinIO is S3-compatible)
- Session refresh after name change (so the header reflects the new name without re-login)
- `ActivityEvent` emission on profile update (actor: USER, eventType: a new `ACCOUNT_UPDATED` event or piggyback on existing audit patterns — document the decision)

**Out of scope:**
- Username / handle (not in the Kontax product model)
- Profile visibility to other users (Kontax is single-user per account)
- Avatar crop or image editing in-browser
- File size enforcement beyond the blob storage provider's own limits

---

## Design / Implementation Spec

### Schema change

Add to the `User` model in `prisma/schema.prisma`:

```prisma
avatarUrl String?
```

No index needed — `avatarUrl` is never filtered or sorted on.

Run: `prisma migrate dev --name add-user-avatar-url`

The existing `Contact.avatarUrl` field follows the same pattern. Use the same nullable-string approach.

### Server action — `updateProfile`

Create or add to `src/app/actions/account.ts`:

```typescript
export async function updateProfile(input: {
  name: string;
  avatarUrl?: string | null;
}): Promise<{ success: true } | { error: string }>
```

Steps:
1. Assert authenticated session (`auth()` from `~/server/auth`).
2. Validate `name`: non-empty after trim, max 120 characters.
3. Validate `avatarUrl` if provided: must be a valid HTTPS URL (or `null` to remove). Reject `http://` URLs to avoid mixed-content warnings.
4. Update `User` record: `{ name: input.name.trim(), avatarUrl: input.avatarUrl ?? null }`.
5. Return `{ success: true }`.

The caller (the settings page client component) must call `update()` from `next-auth/react` after a successful response to refresh the JWT session with the new name and avatarUrl. This triggers a round-trip to the `jwt` callback with `trigger: "update"`.

### NextAuth session extension

Extend `src/server/auth/config.ts` to carry `name` and `avatarUrl` in the JWT and surface them in the session:

```typescript
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
    } & DefaultSession["user"];
  }
}
```

Update the `jwt` callback:

```typescript
jwt: async ({ token, user, trigger, session }) => {
  if (user) {
    token.sub = user.id;
    token.name = user.name;
    token.avatarUrl = (user as { avatarUrl?: string | null }).avatarUrl ?? null;
  }
  if (trigger === "update" && session) {
    // Re-read from DB on manual session update trigger
    const fresh = await db.user.findUnique({
      where: { id: token.sub! },
      select: { name: true, avatarUrl: true },
    });
    token.name = fresh?.name ?? token.name;
    token.avatarUrl = fresh?.avatarUrl ?? null;
  }
  return token;
},
```

Update the `session` callback:

```typescript
session: ({ session, token }) => ({
  ...session,
  user: {
    ...session.user,
    id: token.sub ?? session.user.id,
    name: token.name as string | null,
    avatarUrl: token.avatarUrl as string | null,
  },
}),
```

### Avatar upload

For MVP, support two avatar modes:

**Mode A — URL input (lowest friction):** The form accepts a direct image URL. The server action validates it is an HTTPS URL. No file upload infrastructure needed. Suitable for users who have a Gravatar or hosted image.

**Mode B — File upload:** The settings page uses a `<input type="file" accept="image/*">`. On selection, the file is uploaded client-side to a blob storage endpoint (`/api/upload/avatar`), which returns a URL. That URL is then submitted via `updateProfile`.

The blob storage endpoint (`src/app/api/upload/avatar/route.ts`):
- Accept multipart/form-data, file field `avatar`
- Enforce: max 2 MB, accept MIME types `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Upload to MinIO via `@aws-sdk/client-s3` (S3-compatible), using `PutObjectCommand`
- Return `{ url: string }` — the MinIO public URL for the object
- Auth required: only the authenticated user's ID is used to namespace the object key (`avatars/{userId}/{randomId}.{ext}`)
- MinIO env vars: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_PUBLIC_URL`

If MinIO is not configured (missing `MINIO_ENDPOINT`), Mode A (URL input) is the fallback. Log a warning on server startup if MinIO env vars are absent.

### Settings page UI

The profile section lives within the main `/settings` page (or `/settings/profile` sub-route — match the existing settings layout pattern).

**Form fields:**
- Display name: single text input, pre-populated from `session.user.name`, max 120 chars, required
- Avatar: current avatar preview (or initials if none), "Upload photo" button + "Remove" link if `avatarUrl` is set

**Save button:**
- Disabled while unchanged (compare current form state against session values)
- "Saving…" loading state during the server action
- On success: brief inline "Saved" confirmation, no page reload

**Validation:**
- Empty name: "Please enter your name"
- Name too long: "Name must be 120 characters or fewer"
- Invalid avatar URL: "Avatar must be a valid HTTPS URL"

---

## Acceptance Criteria

- `User.avatarUrl` exists in the schema and migration is applied.
- A user can update their display name from the settings page; the header reflects the new name without requiring sign-out.
- A user can upload a profile photo (or provide an HTTPS URL) and it appears as their avatar in the header user menu.
- A user can remove their avatar; the header falls back to initials.
- Saving an empty name returns a validation error.
- The `updateProfile` server action rejects HTTP avatar URLs.
- Avatar file upload enforces a 2 MB size limit and accepted MIME types.
- The JWT `update()` call is made after a successful save, refreshing `session.user.name` and `session.user.avatarUrl` in the client.
- Saving with no changes to the form does not call the server action (Save button is disabled when unchanged).

---

## Risks and Open Questions

- **MinIO configuration:** MinIO must have a bucket created and public read access enabled for the avatars path. The `MINIO_PUBLIC_URL` is the externally reachable base URL (e.g. `https://minio.yourdomain.com/kontax-uploads`). If MinIO is behind a private network, avatar URLs will not load in the browser — ensure the bucket or path is publicly accessible.
- **Old avatar cleanup:** When a user replaces their avatar with a new upload, the old blob is orphaned. For v1, accept the storage leak and schedule a cleanup job in a future phase. Document this decision.
- **Name in shared contacts:** If a user's name appears in `actorDetail` on `ActivityEvent` rows (e.g., "Jane Smith edited this contact"), updating the name does not retroactively update those strings. This is correct — activity logs should reflect who did the action at the time it happened. Note this explicitly to avoid support confusion.
- **Session update trigger:** Calling `update()` from `next-auth/react` fires a `GET /api/auth/session` request. Ensure the `jwt` callback's `trigger === "update"` path does a single DB read (not a full user hydration) to keep this lightweight.
