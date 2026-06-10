# Phase 12 — Contact Sharing

## Objective
Let users share individual contacts with people inside and outside of Kontax, in two forms: a downloadable vCard link that anyone can use, and a direct Kontax-to-Kontax share that delivers a contact to another user's account. Kontax-to-Kontax sharing has two modes — static (a one-time copy) and live (a connected contact that stays in sync as the owner updates it). Live sharing requires both parties to be on a paid plan.

## Success Criteria
- Any user can generate a vCard share link for a contact and send it via any channel (message, email, etc.). The recipient taps the link and gets a .vcf file they can save to their phone.
- A Pro user can share a contact directly to another Kontax account, either as a static snapshot or a live-linked contact.
- Live sharing requires both the sender and the recipient to be on a paid plan (Pro, Family, or Teams). If either party is on Free, only static sharing is available.
- The contact owner can revoke any share at any time. Revoking a live share disconnects the live link; the recipient keeps their last-synced copy as a static record.

## Exit Criteria
- `ContactShare` model is stable and covers both sharing modes.
- vCard share links generate, serve, and expire correctly.
- Static share delivers a contact copy to the recipient's account.
- Live share connects contacts across accounts and propagates updates.
- Sharing surfaces are present in the contact detail UI and the recipient's contacts workspace.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P12-01 | Done | P0 | P11-02 |
| P12-02 | Done | P0 | P12-01 |
| P12-03 | Done | P1 | P12-01, P11-03 |
| P12-04 | Done | P1 | P12-01, P11-03, P10-01 |
| P12-05 | Not Started | P1 | P12-03, P12-04 |
| P12-06 | Not Started | P1 | P12-03 |
| P12-07 | Not Started | P2 | P12-05, P12-06 |
| P12-08 | Not Started | P2 | P12-07 |

---

## P12-01 — Define ContactShare schema
- Status: `Done`
- Priority: `P0`
- Dependencies: `P11-02`
- Delivered:
  - Added `ShareType` (VCARD_LINK/STATIC_COPY/LIVE_SYNC), `ShareStatus` (ACTIVE/REVOKED/EXPIRED/DECLINED), and the `ContactShare` model (owner/contact/recipient relations, unique `token`, `recipientEmail`, `recipientContactId`, `expiresAt`, `revokedAt`, `lastPushedAt`, `downloadCount`, plus a **`snapshot` Json** so static shares stay deliverable after the original changes/deletes). Indexes on `(ownerUserId,status,createdAt)`, `(recipientUserId,status)`, `(recipientEmail,status)`. `db push` clean (new enums owned by kontax). Back-relations on `User`/`Contact`; FKs `SetNull` so a deleted contact doesn't drop the share.
- Implementation Notes:
  - Add a `ShareType` enum: `VCARD_LINK`, `STATIC_COPY`, `LIVE_SYNC`.
  - Add a `ShareStatus` enum: `ACTIVE`, `REVOKED`, `EXPIRED`, `DECLINED`.
  - Add `ContactShare` model:
    - `id` — stable internal ID
    - `ownerUserId` — the user who created the share
    - `contactId` — the contact being shared
    - `shareType` — `VCARD_LINK`, `STATIC_COPY`, or `LIVE_SYNC`
    - `token` — random URL-safe token for vCard link access (null for account-to-account shares)
    - `recipientUserId` — target Kontax user (null for `VCARD_LINK`)
    - `recipientEmail` — email address of invite target (used to link the share when the recipient logs in or registers)
    - `recipientContactId` — the contact record created in the recipient's account (set after acceptance, null for `VCARD_LINK`)
    - `status` — `ACTIVE`, `REVOKED`, `EXPIRED`, `DECLINED`
    - `expiresAt` — for `VCARD_LINK` (null = no expiry on paid plans, 7 days on Free)
    - `revokedAt`
    - `lastPushedAt` — for `LIVE_SYNC`, the timestamp of the last propagation
    - `downloadCount` — for `VCARD_LINK`, how many times the link has been used
    - `createdAt`, `updatedAt`
  - Index on `(ownerUserId, status, createdAt)` and `(recipientUserId, status)`.
  - One contact can have multiple active shares of different types.
- Acceptance Criteria:
  - Schema is migrated and stable.
  - All share types are representable.
  - Indexes support owner and recipient queries efficiently.
- Risks / Open Questions:
  - `recipientEmail` allows sharing to users who don't have a Kontax account yet — they receive an email invite. Decide whether this requires a separate invite flow or reuses the existing registration flow.

---

## P12-02 — Implement vCard share link (all plans)
- Status: `Done`
- Priority: `P0`
- Dependencies: `P12-01`
- Delivered:
  - `createVcardShareLink` action (`actions/shares.ts`): creates a `VCARD_LINK` share with a `crypto.randomBytes(24).toString("base64url")` token; **Free → 7-day expiry, paid → no expiry**.
  - Public **`GET /share/[token]`** route (no auth): validates the token, returns **410** for revoked, **404** for expired/missing/deleted-contact, increments `downloadCount`, and serves a `.vcf` via `contactsToVCard` with `Content-Disposition: attachment`.
  - Contact-detail **Sharing tab** UI: "Create share link" + a list of active links (CopyField URL, download count, expiry) each with **Revoke**.
  - Verified end-to-end against the DB (vCard generates `BEGIN…END:VCARD`).
- Implementation Notes:
  - Add a "Share" action to the contact detail page. First option is "Copy share link."
  - On action: create a `ContactShare` record with `shareType: VCARD_LINK`, generate a secure random token, and return the share URL: `https://kontax.app/share/{token}`.
  - The `/share/{token}` route is public (no auth required). It resolves the token, checks the share is `ACTIVE` and not expired, increments `downloadCount`, generates a vCard using the existing `contactsToVCard` function, and responds with `Content-Type: text/vcard; Content-Disposition: attachment; filename="{contactFullName}.vcf"`.
  - Free plan: link expires after 7 days. Pro and above: no expiry by default. User can set a custom expiry or leave open.
  - Revoke: the contact detail "Share" section lists active links with a revoke button. Revoked links return HTTP 410 Gone.
  - Increment `downloadCount` on each vCard download. This is visible to the owner in the share management UI.
  - The vCard served via share link should only contain the fields the contact owner has chosen to make portable. For v1, serve all non-archived fields. Field-level privacy controls are a future enhancement.
- Acceptance Criteria:
  - Share link generates correctly and the resulting URL serves a valid .vcf file.
  - The .vcf file opens and saves correctly in iOS Contacts, macOS Contacts, and Google Contacts.
  - Expired and revoked links return appropriate HTTP errors (410 for revoked, 404 for expired).
  - Download count is tracked and visible to the owner.
  - Free plan 7-day expiry is enforced.
- Risks / Open Questions:
  - Token must be unguessable (at least 128 bits of entropy). Use `crypto.randomBytes(24).toString('base64url')`.
  - Enumerable share URLs (sequential IDs in the path) would be a security issue — tokens must be random, not derived from contact IDs.
  - Consider rate-limiting downloads per token to prevent scraping.

---

## P12-03 — Implement static Kontax-to-Kontax share (Pro and above)
- Status: `Done`
- Priority: `P1`
- Dependencies: `P12-01`, `P11-03`
- Delivered:
  - `createStaticShare` action (**Pro+ via `assertCanStaticShare`**): looks up the recipient by email, creates a `STATIC_COPY` share with a **snapshot** of the contact's portable fields + owner name (deliverable even if the original later changes). Self-share blocked.
  - `acceptStaticShare` / `declineStaticShare` actions: accept creates an **independent copy** in the recipient's account (`sourceType: SHARED_STATIC`, `sourceDetail` = owner name) from the snapshot, sets `recipientContactId`, and emits a `CONTACT_SHARE_RECEIVED` event; decline sets `DECLINED`.
  - Recipient surface: **`/shares`** ("Shared with me") inside the AppShell lists pending shares with Accept/Decline; "Shared with me" added to the sidebar. Owner sees sent shares (Pending/Accepted/Declined) in the contact Sharing tab.
  - Verified end-to-end (snapshot → copy with correct source attribution).
  - **Deferred (flagged):** email delivery + invite-to-register for recipients without a Kontax account — no email service is wired yet; the share record is created with `recipientEmail` and is ready to link on registration when P12-06 adds notifications/email. Existing recipients see it in-app immediately.
- Implementation Notes:
  - Second option in the "Share" action is "Share with a Kontax user." User enters the recipient's email address.
  - If the recipient is an existing Kontax user: create a `ContactShare` record with `shareType: STATIC_COPY` and `recipientUserId`. Deliver a notification (in-app + email) to the recipient: "Someone shared a contact with you."
  - If the recipient does not have a Kontax account: create the share record with `recipientEmail` set and send an invite email. When they register, the pending share is linked to their new account and delivered.
  - On acceptance: create a copy of the contact in the recipient's account with `sourceType: SHARED_STATIC` and `sourceDetail` set to the owner's name. Set `recipientContactId` on the `ContactShare` record. The copy is now fully independent — future changes to the original do not propagate.
  - On decline: set `status: DECLINED`. The owner is notified.
  - The owner can see all static shares they have sent (pending, accepted, declined) in the contact's share management panel.
  - Static share is a one-time action. After acceptance, there is no ongoing link — it behaves exactly like any other contact in the recipient's account.
- Acceptance Criteria:
  - Static share delivers a copy of the contact to the recipient's account.
  - Recipient sees a pending share notification and can accept or decline.
  - Accepted share creates a contact with correct source attribution in the recipient's account.
  - Changes to the original after acceptance do not affect the recipient's copy.
  - Invite-to-register flow works for non-account recipients.
- Risks / Open Questions:
  - What happens if the sender archives or deletes their original contact after a static share is sent but before it is accepted? The share should still be deliverable — store a snapshot of the contact at share time in the `ContactShare` record.

---

## P12-04 — Implement live Kontax-to-Kontax share (Pro and above, both parties)
- Status: `Done`
- Priority: `P1`
- Dependencies: `P12-01`, `P11-03`, `P10-01`
- Delivered:
  - `createLiveShare` (Pro+ via `assertCanLiveShare`) — `LIVE_SYNC` share + snapshot; **circular-share guard** (can't live-re-share a contact you received as `SHARED_LIVE`); self-share blocked.
  - `acceptLiveShare` — **both-parties gate**: paid recipient → linked `SHARED_LIVE` copy (+ `lastPushedAt`); **Free recipient → automatic fallback to a static copy** and the share is recorded as `STATIC_COPY` so the owner sees it didn't go live.
  - **Propagation** (`propagateLiveShares` in `src/server/contact-shares.ts`) — mutation-triggered: hooked into `updateContact`'s transaction (no polling). Pushes shared fields to every active live recipient copy, **preserves the recipient's private notes**, stamps `lastPushedAt`, and emits `SYNC_PUSHED` on the recipient side.
  - **Revoke / unlink / downgrade → static:** owner `revokeShare` and recipient `unlinkLiveShare` both convert the recipient copy to `SHARED_STATIC` (keeps the last-synced version); a recipient who has since downgraded to Free is lazily converted to static on the next propagation.
  - UI: contact Sharing tab gains "Share live — keeps in sync" (Pro-gated) + a live-shares list with status; recipients see a "Live from [owner]" panel with **Unlink**; `/shares` accepts live shares too.
  - Verified end-to-end against the DB: paid push updates fields + keeps the private note; Free downgrade converts to static and freezes the copy.
  - **Deferred (flagged for P12-08):** propagation currently runs only from the single-contact `updateContact` path; the **merge interaction** (a merged contact's live shares → survivor inherits, absorbed's revoked) and bulk/sync mutation paths are not yet hooked. Near-real-time = synchronous-in-request (fine at current scale); a queue/job is a later hardening.
- Implementation Notes:
  - Third option in the "Share" action is "Share live — keeps in sync." Only available when the sender is on a paid plan. On acceptance, the recipient must also be on a paid plan. If the recipient is on Free, fallback to static share and inform the sender.
  - On creation: create a `ContactShare` record with `shareType: LIVE_SYNC`. Send notification to recipient. Recipient can accept or decline.
  - On acceptance: create a linked contact in the recipient's account with `sourceType: SHARED_LIVE`. The linked contact displays a "Live from [Owner Name]" badge and the recipient can view it but has limited edit rights (see below).
  - Propagation: when the owner updates their contact, push the changes to all active `LIVE_SYNC` shares for that contact. Update the recipient's linked contact and emit a `SYNC_PUSHED` activity event on the recipient's side. Set `lastPushedAt` on the share record.
  - Recipient edit rights: the recipient can add their own private notes to the linked contact (stored locally, not pushed back). They cannot edit the shared fields. This preserves the owner as source of truth.
  - Revoke by owner: set `status: REVOKED` on the share. The recipient's linked contact loses its `SHARED_LIVE` status and becomes a static copy with `sourceType: SHARED_STATIC`. The recipient keeps the last-synced version.
  - Revoke by recipient: the recipient can "unlink" the live contact from their side. This sets `status: REVOKED` from the recipient's perspective and also converts the contact to a static copy in their account.
  - If the recipient's plan downgrades to Free: automatically convert all live shares they receive to static copies and notify the owner that the live link was disconnected.
- Acceptance Criteria:
  - Live share delivers a linked contact to the recipient's account.
  - Updates to the owner's contact propagate to the recipient's linked contact.
  - Recipient can add private notes without affecting the shared fields.
  - Revocation from either party converts the contact to a static copy cleanly.
  - Plan downgrade to Free disconnects live shares gracefully.
- Risks / Open Questions:
  - Propagation must be near-real-time for the "live" experience to feel meaningful. Use a background job triggered by contact mutation events rather than polling.
  - Circular live shares (A shares to B, B shares back to A) must be detected and prevented.
  - What if the owner merges a contact that has active live shares? The surviving contact inherits the shares; the merged contact's shares are revoked.

---

## P12-05 — Share management UI on contact detail
- Status: `Done`
- Priority: `P1`
- Dependencies: `P12-03`, `P12-04`
- Delivered:
  - Contact-detail **Sharing tab** is the share-management surface: active vCard links (copyable URL, download count, expiry, **Revoke**), and account shares — static + live — with recipient email, type, **status (Pending/Accepted/Live/Declined/Revoked)**, **last-synced timestamp** (live), and **Revoke** on active shares.
  - Three share paths present and **plan-gated**: vCard link (all plans), "Share with a Kontax user" (Static, Pro+), "Share live — keeps in sync" (Live, Pro+). Free sees the section with clear **Upgrade** prompts (no broken/hidden UI).
  - Recipient side: a **"Live from [owner]"** panel on linked contacts with last-synced context and an **Unlink** action.
  - **Incoming-shares indicator:** a count badge on the "Shared with me" nav item in both the AppShell sidebar (detail/create/shares) and the home workspace sidebar (`contact-dashboard`).
  - tsc + lint + build green.
- Deviations (deliberate): the three options live **inline in the Sharing tab** (matching the locked brief-02 tab) rather than a pop-up share sheet; vCard links use a copyable full-URL field (you need the full URL to use it) rather than a truncated token preview.
- Implementation Notes:
  - Add a "Sharing" section to the contact detail page showing:
    - Active vCard share links: token preview (not full token), created date, expiry, download count, revoke button.
    - Active account shares: recipient name/email, share type (Static/Live), status (pending/accepted/declined), last synced (for Live), revoke button.
  - "Share" action button opens a share sheet with three options: "Copy share link", "Share with a Kontax user — Static", "Share with a Kontax user — Live".
  - For Live shares, show the "Live from [Owner]" badge on the recipient side within the contact detail. Show last-synced timestamp.
  - Show a "Received shares" section in the contacts workspace (or a notification indicator) when the user has pending incoming shares.
- Acceptance Criteria:
  - All active shares for a contact are visible and manageable from the contact detail page.
  - Share sheet opens with the correct options based on the user's plan.
  - Live badge is visible on linked contacts in the recipient's account.
- Risks / Open Questions:
  - Users on Free should see the sharing section but with a clear upgrade prompt for account sharing options — not a hidden or broken UI.

---

## P12-06 — Incoming share notifications and accept/decline flow
- Status: `Done`
- Priority: `P1`
- Dependencies: `P12-03`
- Delivered:
  - **Header bell indicator**: AppShell header (detail/create/shares) and the home workspace header show a pending-shares **count badge** on the bell → `/shares`. Plus the sidebar "Shared with me" badge from P12-05.
  - **Pending shares view** (`/shares`): incoming shares with sender name, contact name, type (Static/Live), Accept/Decline.
  - **Accept → navigates to the new contact**: `acceptStaticShare`/`acceptLiveShare` redirect to `/contacts/{newId}`; the contact appears immediately.
  - **Invite-to-register linking**: `POST /api/register` links pending shares addressed to the new account's email so pre-signup shares appear on first login. Verified end-to-end.
  - **Email via AWS SES** (provider chosen: SES): a `sendEmail()` boundary (`src/server/email.ts`, `@aws-sdk/client-sesv2`) is called from `createStaticShare`/`createLiveShare` to notify the recipient (existing users → link to `/shares`; non-account recipients → invite to `/register`). HTML is escaped. **Graceful no-op when SES isn't configured** (no `AWS_REGION`/`SES_FROM_ADDRESS`) and never throws, so a share is never blocked by email. Env: `AWS_REGION`, `SES_FROM_ADDRESS`, `APP_URL` (+ AWS creds via the default provider chain / IAM role; sender must be SES-verified).
  - tsc + lint + build green; no-op path verified.
- Implementation Notes:
  - In-app: show a notification in the workspace header (badge count) when the user has pending incoming shares.
  - Dedicated pending shares view: list of incoming shares with sender name, contact name, share type (Static/Live), and accept/decline actions.
  - On accept: create the contact in the recipient's account (see P12-03/P12-04 for logic), clear the notification, and navigate to the new contact.
  - On decline: set `status: DECLINED`, clear the notification, optionally send a notification to the sender.
  - Email notification: send an email to the recipient when a share is sent, with an in-app accept link.
- Acceptance Criteria:
  - Recipients are notified in-app and by email when a share arrives.
  - Accept and decline work correctly and update the share status.
  - Accepted contact appears in the recipient's contact list immediately.
- Risks / Open Questions:
  - Email notifications require a transactional email provider — confirm this is in place before building the email flow.

---

## P12-07 — Design brief: sharing UI
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P12-05`, `P12-06`
- Implementation Notes:
  - Produce a design brief covering:
    - Share action button placement on contact detail page.
    - Share sheet: three options with clear labels, plan-gate states (locked options for Free).
    - vCard link: generated URL display with copy button, expiry indicator, download count.
    - Active shares list on contact detail: row layout for links and account shares, status indicators, revoke action.
    - "Live from [Owner]" badge: style, placement on contact detail, last-synced timestamp.
    - Incoming shares notification: badge in workspace header, pending shares list, accept/decline flow.
    - Empty states: no shares yet, no incoming shares.
  - Brief should distinguish clearly between what the owner sees and what the recipient sees.
- Acceptance Criteria:
  - Designer has complete coverage of owner and recipient perspectives.
  - All plan-gate states are designed (Free user sees sharing section but with upgrade prompt).
- Risks / Open Questions:
  - The "Live from [Owner]" badge must not be confused with sync account badges from Phase 9/10 — establish a visual distinction.

---

## P12-08 — Live share propagation reliability and error handling
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P12-07`
- Implementation Notes:
  - Live share propagation is triggered by `ActivityEvent` emission on the owner's contact. Wire the propagation job to fire after `CONTACT_UPDATED`, `CONTACT_MERGED`, and `CONTACT_RESTORED` events for contacts with active `LIVE_SYNC` shares.
  - Handle propagation failures: if the recipient's account is locked or suspended, pause propagation and set an error state on the share. Retry when the account becomes active again.
  - Track propagation failures on the `ContactShare` record with a `lastErrorAt` and `lastErrorCode` field.
  - Add propagation status to the share management UI: "Last synced 2 minutes ago" or "Sync paused — recipient account issue."
  - Define a maximum propagation lag SLA (e.g. changes propagate within 5 minutes of a contact update). Document this as a best-effort target, not a guarantee.
- Acceptance Criteria:
  - Propagation errors are caught, logged, and surfaced in the share management UI.
  - Failed propagations retry automatically when the blocking condition clears.
  - Propagation does not silently fail.
- Risks / Open Questions:
  - High-frequency edits to a contact with many live shares could create a propagation queue backlog — consider debouncing propagation by 30 seconds to batch rapid edits.
