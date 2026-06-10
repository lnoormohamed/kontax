# 12 — Sharing UI

**Surfaces:**
- **Owner side** — the **Sharing tab** on contact detail (`/contacts/[id]?tab=sharing`) + the header **Share** action
- **Recipient side** — **`/shares`** ("Shared with me"), the header **bell** + sidebar badge, and the **"Live from [owner]"** panel on a received live contact

**Priority:** P2 — the visual/IA layer over the shipped Phase 12 sharing engine.

> **Status: AS-BUILT (2026-06-XX).** Phase 12 (P12-01→06) is shipped; this brief documents the real behaviour so hi-fi mockups match, then refine. It deliberately distinguishes **owner** vs **recipient** views. Design language: the locked light system (briefs 01/02/10) — ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, brand green `#17352e`, blue CTA `#4158f4`, amber `#bf8526`, red `#b5472f`, Geist.

---

## Share model recap (fixed vocabulary)

Three share types (`ShareType`): **vCard link** (anyone, no account), **Static copy** (one-time snapshot to a Kontax user), **Live sync** (linked copy that stays in sync; both parties paid). Statuses: `ACTIVE`, `REVOKED`, `EXPIRED`, `DECLINED`. Plan gates: vCard = all plans; Static + Live = **Pro and above** (Live also requires the *recipient* to be paid, else it falls back to a static copy).

---

## OWNER VIEW

### 1. Share action (header)
A **Share** button in the contact-detail header action row (alongside Archive · Favorite · ⋯). It routes to the **Sharing tab** (`?tab=sharing`) — the management surface — rather than opening a separate sheet. (As-built: the three options live inline in the Sharing tab, matching the locked brief-02 tab model; a designer may propose a pop-up sheet, but the tab is the source of truth.)

### 2. Sharing tab — three blocks

**a) vCard link (all plans).**
```
vCard link                                          [ Create share link ]
Anyone with the link can download this contact as a .vcf.
(Free: "Free links expire after 7 days.")

  ┌ Share link ─────────────────────────────────────────────┐
  │ https://kontax.app/share/{token}              [ Copy ]   │
  │ 3 downloads · expires 14 Jun 2026   (or "· no expiry")   │
  └─────────────────────────────────────────────────────────┘
  Revoke link
```
- Each active link: copyable **full URL** (you need it to use it), **download count**, **expiry** ("expires …" or "no expiry"), and a red **Revoke link**. Revoked links serve HTTP 410; expired serve 404.

**b) Share with a Kontax user — Static (Pro+).**
- An email input + **Send copy**. On Free: the block shows an **amber upgrade prompt** ("Sharing with another Kontax user is a Pro feature · Upgrade →"), not a disabled/hidden control.
- Sent-shares list: recipient email · **status** (Pending / Accepted / Declined / Revoked) · **Revoke** on still-pending shares.

**c) Share live — keeps in sync (Pro+).**
- Email input + **Share live**. Free → amber upgrade prompt. Copy: "The recipient gets a linked copy that updates whenever you edit. Both of you must be on a paid plan."
- Live-shares list: recipient email · status (Pending / **Live** / Declined / Revoked) · **last-synced timestamp** (when live & accepted) · **Revoke**.

### 3. Plan-gate states (owner)
- **Free:** vCard block fully usable; Static + Live blocks visible but show the **amber upgrade prompt** with an Upgrade link to `/pricing`. Never hide or break.
- **Pro/Family/Teams:** all three blocks active.

### 4. Empty state (owner)
No active shares → the blocks render with their create controls and no list rows. The page is never blank — the create affordances are the empty state.

---

## RECIPIENT VIEW

### 5. Incoming-share notification
- **Header bell** with an amber **count badge** (pending incoming shares) → links to `/shares`. Present in both the AppShell header (detail/create/shares) and the home workspace header.
- **Sidebar** "Shared with me" nav item with the same count badge.

### 6. `/shares` — "Shared with me"
```
Shared with me
Contacts other Kontax users have shared with you. Accept to add a copy.

  ┌──────────────────────────────────────────────────────────┐
  │ Adriana Castellanos                       [Decline][Accept]│
  │ Shared by Daniel Vega · live (stays in sync)              │
  └──────────────────────────────────────────────────────────┘
```
- Each pending row: **contact name**, "Shared by [owner]", and **· live (stays in sync)** when it's a live share. **Decline** (ghost) + **Accept** (green).
- **Accept** → creates the copy and **navigates to the new contact**. **Decline** → row removed (status DECLINED).
- **Empty state:** "No pending shares" + explainer + a link back to contacts.

### 7. "Live from [owner]" panel (on a received live contact)
On a contact whose `sourceType === SHARED_LIVE`, the **Sharing tab** shows a distinct **green-wash** panel:
```
  Live from Daniel Vega
  This contact stays in sync with its owner — shared fields are read-only.
  Your notes stay private. Unlink to keep a frozen copy you can edit.
  [ Unlink (keep a static copy) ]
```
- **Visual distinction from sync badges (Phase 9/10):** the live-share indicator uses the **green status wash** (`#eef5ef` / `#17352e`) and the word **"Live from [person]"** — a *person*, not a sync account. Source/sync badges (Phase 10) are neutral chips referencing an *account/source* (e.g. "Synced from iCloud"). Keep them clearly different: live = green + person name; sync = neutral + service name.
- **Unlink** converts the contact to an independent static copy (recipient keeps the last-synced version, gains edit rights).
- **Recipient edit rights:** shared fields are read-only on a live contact; only the recipient's **notes** are editable (and stay private). The mock should show the read-only treatment + an editable notes affordance.

---

## States to mock (checklist)
- **Owner:** each block default + with rows; Free upgrade-prompt variants for Static/Live; vCard link row (downloads/expiry/revoke); static/live status rows (pending/accepted/live/declined/revoked) with revoke; last-synced on live.
- **Recipient:** bell + sidebar badge (0 vs N); `/shares` list (static row, live row) + empty; "Live from" panel (live contact) incl. read-only fields + private notes; post-accept landing on the new contact.
- **Plan gates:** Free vs paid for every account-share control.

---

## Notes for the designer
- **Owner vs recipient are different surfaces** — the owner manages shares in the Sharing tab; the recipient acts in `/shares` and sees the "Live from" panel. Don't merge them.
- **Don't confuse "Live from [person]" with sync-source badges** (the ticket's explicit risk) — different colour family and different referent (person vs account).
- vCard link shows the **full URL** with a copy button (not a truncated token) — copying it is the whole point.
- Everything stays in the locked light system; account-share gates use the amber upgrade-prompt pattern, consistent with the activity-log lock and near-limit banner.
