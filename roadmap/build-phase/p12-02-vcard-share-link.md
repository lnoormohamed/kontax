# P12-02 vCard Share Link

## Purpose
This ticket implements the simplest sharing primitive in Kontax: a public URL that anyone can follow to download a contact as a `.vcf` file without needing a Kontax account. The vCard share link is the only sharing feature available on the Free plan. It lets users share a single contact via any channel — SMS, email, messaging app, QR code — and have the recipient save it directly to their phone's contacts app in one tap. This feature directly reduces the friction of the most common real-world contact-sharing scenario and makes Kontax useful even for people who are not yet Kontax users themselves.

## Background
Phase 12-01 introduced the `ContactShare` model with `shareType: VCARD_LINK`, the `token` field (nullable, unique), and the `downloadCount` and `expiresAt` fields. This ticket is the first consumer of that schema.

The existing `contactsToVCard` function (referenced throughout the export and CardDAV sync codebase) is the canonical vCard serializer. Its output must be used directly — do not write a second vCard serializer for share links. The share link endpoint should call `contactsToVCard` the same way the export job does.

The `Contact` model carries `userId` scoping. All share link creation must verify that the requesting user owns the contact before generating a token. This check must happen in the server action, not only in the UI.

Phase 11 established that Free plan users have access to vCard share links but with a 7-day expiry. Pro, Family, and Teams users get no expiry by default but can set a custom expiry. The `Subscription.liveShareEnabled` and `staticShareEnabled` fields are not relevant here — vCard links are available at all plan tiers.

## Scope

**In scope:**
- Server action to create a `ContactShare` with `shareType: VCARD_LINK`
- Secure token generation using `crypto.randomBytes(24).toString('base64url')`
- Plan-gated expiry logic at creation time (Free: +7 days, Pro+: null by default)
- Optional custom expiry input for Pro+ users
- Public Next.js route `/share/[token]` — no authentication required
- Token resolution: look up share, validate ACTIVE + not expired
- Atomic `downloadCount` increment on each successful download
- vCard file response: `Content-Type: text/vcard`, `Content-Disposition: attachment; filename="{fullName}.vcf"`
- HTTP 404 for expired or unknown tokens
- HTTP 410 for revoked tokens
- Rate limiting per token to prevent scraping
- Revoke action: server action to set `status: REVOKED`, `revokedAt: now()`
- `CONTACT_SHARED` ActivityEvent emission on share creation
- UI: "Share" button on contact detail → share sheet → "Copy share link" option
- UI: active vCard links list in the contact detail "Sharing" section (abbreviated view — full management UI is P12-05)

**Out of scope:**
- Account-to-account sharing (P12-03, P12-04)
- Full share management UI (P12-05)
- Field-level privacy controls on what is included in the vCard — serve all non-archived fields in v1
- QR code generation for share links
- Link preview metadata (Open Graph tags on `/share/[token]`) — nice to have but deferred
- Custom vanity URLs

---

## Design / Implementation Spec

### Token Generation

Token generation lives in a utility function, not inline in the server action, so it can be tested independently:

```typescript
// src/lib/share-token.ts
import { randomBytes } from "crypto";

export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}
```

`randomBytes(24)` produces 192 bits of entropy. Base64url encoding produces a 32-character string using the URL-safe alphabet (`A-Z`, `a-z`, `0-9`, `-`, `_`). No padding characters are present. The resulting token is safe to embed directly in a URL path segment without encoding.

On token collision (unique constraint violation from the database): retry generation up to 3 times before throwing. In practice, collision probability for 192-bit tokens is negligible — this retry is defensive code.

### Server Action: createVCardShareLink

Location: `src/app/actions/shares.ts` (new file, or extend an existing actions file if one already covers contact detail actions)

```typescript
export async function createVCardShareLink(
  contactId: string,
  options?: { expiresAt?: Date }
): Promise<{ shareId: string; url: string }>
```

Steps:

1. Authenticate the calling user via `getServerSession`. Throw if unauthenticated.
2. Load the contact by `contactId`. Verify `contact.userId === session.user.id`. Throw `FORBIDDEN` if not.
3. Load the user's active subscription to determine plan tier.
4. Compute `expiresAt`:
   - If plan is `FREE`: `new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)`
   - If plan is `PRO`, `FAMILY`, or `TEAMS`: `options?.expiresAt ?? null`
5. Capture contact snapshot for the `contactSnapshot` field. Call the same serialization logic used by the static share (not the full vCard serialization — just the plain object representation). This snapshot is used for delivery continuity if the contact is archived before any Pro+ share is downloaded (unlikely scenario, but consistent with the pattern established in P12-01).
6. Generate a token with `generateShareToken()`. Attempt to insert the `ContactShare` record. On unique constraint violation, retry token generation up to 3 times.
7. Emit a `CONTACT_SHARED` ActivityEvent with `actor: SHARE`, `actorDetail: "vcard_link"`, `payload: { shareType: "VCARD_LINK", shareId: newShare.id }`.
8. Return `{ shareId: newShare.id, url: \`https://kontax.app/share/\${token}\` }`.

The URL returned is based on the `NEXT_PUBLIC_APP_URL` environment variable, not a hardcoded domain, so this works in staging and development environments.

### Public Route: /share/[token]

Location: `src/app/share/[token]/route.ts` — a Next.js Route Handler (not a page component) to allow direct file response control.

```typescript
export async function GET(
  request: Request,
  { params }: { params: { token: string } }
): Promise<Response>
```

Steps:

1. Look up `ContactShare` where `token = params.token`.
2. If not found: return `Response` with status 404, body: `"Share link not found"`.
3. If found but `status === "REVOKED"`: return status 410, body: `"This share link has been revoked"`.
4. If found but `status === "EXPIRED"` or (`status === "ACTIVE"` and `expiresAt !== null` and `expiresAt < now()`):
   - If status is still `ACTIVE`, update status to `EXPIRED` (lazy expiry — avoids needing the background job to have run).
   - Return status 404, body: `"This share link has expired"`.
5. Apply rate limiting (see below). If rate limit exceeded, return status 429.
6. Load the contact via `share.contactId`. If the contact is archived or soft-deleted, fall back to `share.contactSnapshot`. If both are unavailable, return status 410, body: `"The shared contact is no longer available"`.
7. Atomically increment `downloadCount`: `prisma.contactShare.update({ where: { id: share.id }, data: { downloadCount: { increment: 1 } } })`. Do this in a fire-and-forget manner — do not block the response on the counter update. Use `void` and catch errors independently to avoid a counter failure affecting the download.
8. Call `contactsToVCard` with the contact data to produce the `.vcf` content string.
9. Derive a safe filename: strip non-ASCII, collapse whitespace, fallback to `"contact"` if `displayName` is empty. Produce `"{sanitizedName}.vcf"`.
10. Return:
    ```typescript
    return new Response(vcfContent, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
    ```

The `no-store` cache control header prevents CDN or browser caching, ensuring that revoked links are not served from cache after revocation. The `noindex` robot tag prevents search engine indexing of share URLs.

### Rate Limiting

Rate limiting is applied per token at the edge or middleware layer. Target: 20 downloads per token per hour. Implementation options:

- **Option A (preferred if Redis is already in the stack):** Use a Redis counter with a 1-hour TTL, keyed by `share_dl:{token}`. Increment on each request; if the counter exceeds 20, return 429.
- **Option B (no Redis):** Use an in-memory LRU cache in the route handler process. This is not cluster-safe — if the app runs on multiple instances, each instance has its own counter. Acceptable for MVP; revisit if the product runs on multiple replicas.
- **Option C:** Implement via Vercel's built-in rate limiting middleware (`@vercel/edge-rate-limit`) if the deployment platform supports it. This would apply before the route handler runs.

Document the chosen approach in `src/app/share/[token]/route.ts` with a comment explaining why it was selected and what its limitations are.

### Revoke Server Action

```typescript
export async function revokeShareLink(
  shareId: string
): Promise<void>
```

1. Authenticate and verify ownership: load the share, verify `share.ownerUserId === session.user.id`.
2. If `share.shareType !== "VCARD_LINK"`, throw an error — this action is for vCard links only. Account shares are revoked through a separate action.
3. Update: `status: "REVOKED"`, `revokedAt: new Date()`.
4. No ActivityEvent is emitted for revocation in v1 — this is a candidate for a future `CONTACT_SHARE_REVOKED` event type.

### UI: Share Action Button

The "Share" button appears in the contact detail action bar. Clicking it opens a bottom sheet (mobile) or dropdown (desktop) with three options:

1. **Copy share link** — available to all plans. If no active vCard link exists for this contact, calls `createVCardShareLink` and then copies the URL to the clipboard. If an active vCard link already exists, copies the existing URL directly without creating a new share.

   The decision to reuse the existing link (rather than always creating a new one) avoids the UX confusion of a user having dozens of identical vCard links for the same contact. One active vCard link per contact at a time is enforced at the UI level, not the database level. If the user wants a fresh link (e.g. to track downloads separately), they must revoke the existing one first.

2. **Share with a Kontax user — Static** — gated to Pro+ (P12-03)
3. **Share with a Kontax user — Live** — gated to Pro+ (P12-04)

### UI: Active vCard Links on Contact Detail

This is a minimal inline display (not the full management panel from P12-05). Show:

- Link preview: first 8 characters of the token + `"…"` (e.g. `aB3xQ7mZ…`)
- Created: relative timestamp (e.g. "3 days ago")
- Expiry: "Expires in 4 days" / "No expiry" / "Expired"
- Downloads: "Downloaded 7 times"
- Revoke button

This section is hidden if the contact has no active vCard links. When an active link exists and the user taps "Copy share link," skip creating a new link and copy the existing one. Show a brief "Copied!" toast confirmation.

### vCard Content

The vCard served via the share link should be generated by `contactsToVCard` in exactly the same way as the CSV/vCard export job uses it. Do not create a separate code path. In v1, all non-null, non-archived fields of the contact are included. Avatar: if `avatarUrl` is a public URL, include the URL in the vCard `PHOTO;VALUE=URI:` property. Do not download and re-embed binary avatar data — this would be expensive and could cause the response to time out.

The vCard `PRODID` property should identify the source:

```
PRODID:-//Kontax//Kontax Contact Share//EN
```

This makes it clear to Contacts apps and sync tools that this vCard came from Kontax.

### Free Plan Expiry Enforcement

Free plan users have a 7-day expiry enforced at creation time by the server action. The UI should communicate this clearly:

- When the share link is first created for a Free user, show: "Your share link expires in 7 days. Upgrade to Pro for permanent links."
- In the active link display, show the expiry countdown: "Expires in 6 days"
- When the link is within 24 hours of expiry: "Expires tomorrow" (with visual urgency indicator)
- When expired: the row remains visible in the share section with an "Expired" badge so the user knows the link has stopped working. They can create a new one.

Pro+ users see "No expiry" by default. Optionally, Pro+ users can set a custom expiry date via a date picker in the share sheet. This is surfaced as "Set expiry (optional)" under the copy button in the share sheet.

### Security Considerations

- The token is never derived from the contact ID, user ID, or any predictable input. It is always independently generated random bytes.
- The `/share/[token]` route must not be crawled by authenticated middleware. Ensure Next.js middleware explicitly excludes `/share/*` from any auth redirect logic.
- The `X-Robots-Tag: noindex` header prevents Google from indexing share URLs and exposing contact data in search results.
- The vCard response must not include any internal system IDs. The `UID` property in the vCard should be set to the contact's `syncUid` (a stable opaque identifier), not the `id` field.
- Do not log the full token in server logs. Log only the first 8 characters + `"[redacted]"` in structured log output.

---

## Acceptance Criteria

- A Free plan user can generate a vCard share link for any contact they own. The link URL is copied to the clipboard.
- The generated URL follows the format `https://kontax.app/share/{token}` where `{token}` is 32 URL-safe characters.
- Accessing the URL from a browser (no auth cookie) downloads a valid `.vcf` file.
- The `.vcf` file imports successfully into iOS Contacts, macOS Contacts, and Google Contacts (manual verification required).
- Free plan links expire after 7 days. Accessing an expired link returns HTTP 404.
- Pro+ links created without a custom expiry never expire.
- Revoking a link returns HTTP 410 on subsequent accesses.
- `downloadCount` increases by 1 on each successful download.
- `downloadCount` is displayed correctly in the contact detail sharing section.
- The `CONTACT_SHARED` ActivityEvent is emitted when a new link is created.
- Two users accessing the same share link simultaneously do not cause a race condition on `downloadCount`.
- Rate limiting returns HTTP 429 after the configured threshold is exceeded.
- The `/share/[token]` route does not redirect unauthenticated users to the login page.
- Accessing `/share/[nonexistent-token]` returns 404, not a 500 error.
- The vCard response includes `Content-Disposition: attachment` so browsers offer a save dialog rather than displaying the vCard inline.
- The UI shows an active vCard link on the contact detail page after creation.
- The UI shows the "Expires in N days" countdown for Free plan links.

---

## Risks and Open Questions

- **Shared contact archival before download** — if the contact is archived after the link is created but before it is downloaded, the download should still work (from the snapshot). Test this scenario explicitly.
- **`contactsToVCard` API compatibility** — verify that `contactsToVCard` accepts a single contact or an array. If it only accepts an array, wrap the single contact in an array. Confirm the return type is a string, not a Buffer.
- **Multiple active links** — the UI logic enforces "one active link at a time" by reusing the existing link when the user taps "Copy share link." But the database allows multiple. If a user has multiple active links (e.g. from a previous UI version or direct API use), the UI should display all of them in the P12-05 management view.
- **Rate limiting implementation** — if Redis is not in the stack, the in-memory approach is not cluster-safe. Document the limitation. Do not ship without any rate limiting — even the in-memory approach is better than nothing.
- **`NEXT_PUBLIC_APP_URL` in production** — ensure this environment variable is set correctly in production and staging. A missing variable produces broken share URLs. Add a startup check.
- **vCard filename sanitization** — contact names with special characters (e.g. `O'Brien`, `García`, `李明`) must be handled in the filename. Use a library or tested regex to strip or replace characters that are invalid in `Content-Disposition` filenames across different HTTP clients.
- **Expiry background job** — lazy expiry (marking as EXPIRED when first accessed after expiry) is used in the download handler. A background job that marks records proactively is a nice-to-have for reporting accuracy but is not required for v1.

---

## Outcome

Any Kontax user on any plan can generate a share link for a contact and send it to anyone, who can then download the contact as a `.vcf` file in one tap — with Free users receiving a 7-day link and Pro+ users receiving a permanent link.
