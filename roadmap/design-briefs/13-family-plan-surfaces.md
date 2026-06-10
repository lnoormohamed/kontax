# 13 — Family Plan Surfaces

**Surfaces:**
- **Onboarding / management** — `/settings/family` (create book · member list · invite · permissions · delete) + the Family entry on `/settings`
- **Invite acceptance** — `/family/join/[token]` (accept / decline) + the invite email
- **Workspace** — shared contacts in the People list with a **Family** badge, the **Private / Family / All** scope toggle, and the **Save to → Private / Family** target on Create
- **Contact detail (shared)** — a **Family-book** chip by the name, full change **History with member attribution**, and **"Add to family book"** on a private contact's ⋯ menu

**Priority:** P1 — the visual/IA layer over the shipped Phase 13 engine (P13-01→06).

> **Status: AS-BUILT (2026-06).** Phase 13 core is shipped; this brief documents the real behaviour so hi-fi mockups match, then refine. It deliberately distinguishes **owner** vs **member** views. Family tone should feel **warm and personal, not corporate**. Design language: the locked light system — ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, brand green `#17352e`, blue CTA `#4158f4`, amber `#bf8526`, red `#b5472f`, Geist.

---

## Model recap (fixed vocabulary)

A **family group** (Family plan) has **one shared address book** and up to **6 members** (owner + 5). A shared contact is a `Contact` linked into the book via `GroupContact`; it is owned (nominally) by the group **owner** and editable by any **member with `canEdit`**. Members keep a completely **private** library the group can't see. Roles: **Owner** (one) and **Member**; members can be **Can edit** or **View only**. Invite states: **Pending → Accepted / Declined** (48-hour token). **"Add to family book" copies** a private contact (it never moves it).

---

## OWNER VIEW

### 1. Settings entry
On `/settings`, the Family plan card shows the group state and a primary button → **Set up family book** (no group yet) or **Manage family book** (group exists). Pro/Free see the existing upgrade affordance; only Family sees the link.

### 2. Create the book (empty state)
`/settings/family` with no group: a single warm card —
```
Create your family book
One shared contact book everyone in your family can view and edit. Invite up to 5 people.
[ Family name (e.g. Okafor Family) ]   [ Create family book ]
```
Non-Family plan reaching this route sees an upgrade card (→ `/pricing`).

### 3. Manage (group exists)
Three stacked cards:

**a) Family book** — name, "{n} of 6 members", and the **member list**. Each row: name/email · joined date · a status/permission word on the right (**Owner** / **Can edit** / **View only** / **Pending** / **Declined**) and inline actions:
- Member (accepted): **Make view-only / Allow editing** (toggles `canEdit`), **Remove**.
- Member (pending): **Resend**, **Revoke**.
- Owner row: no actions.

**b) Invite a family member** — email input + **Send invite** (disabled with a full-book notice at 6). Copy: "They get an email with a link to join. They keep their own private contacts."

**c) Delete family book (danger)** — red-tinted card; a `details` disclosure reveals the confirm button: **"Yes, permanently delete '{name}'"**. Warn that shared contacts are deleted for everyone; members keep their private contacts. *Destructive-action pattern: reveal-then-confirm, no accidental single click.*

> **Owner transfer** is **not yet built** — the subscription is anchored to one `userId`, so it needs the billing integration confirmed first. Leave room in the member row for a future "Make owner" action.

---

## MEMBER VIEW

### 4. Member's family settings
`/settings/family` for a non-owner: a read card —
```
Your family book
{Book name}
Shared by {owner}. You can {view and edit | view} the family contacts. Your private contacts stay private.
[ Leave family book ]   ← red, immediate (removes shared access only)
```

### 5. Invite acceptance — `/family/join/[token]`
Centered card. **Valid invite:** "Family invitation · Join the {book} book" + "{owner} invited you to share this family contact book. Your private contacts stay private." with **Accept & join** (blue) and **Decline**. **Invalid/expired:** a calm "This invite is no longer valid" with a link to Kontax. Logged-out visitors are routed through login/register with a safe return (`?next=`) and the pending invite links to their new account on registration.

Invite email: warm subject ("{owner} invited you to the {book} book on Kontax"), one clear CTA, and the 48-hour expiry noted.

---

## SHARED CONTACTS IN THE WORKSPACE (owner + member)

### 6. People list
Shared contacts appear **alongside** private ones. Distinction = the **Family badge** in the inline `ContactBadgeCluster` (the `users` glyph, blue tint) next to the name — *not* a separate section. A **scope toggle** in the toolbar (shown only to family members): **All · Private · Family** (`?scope=`). Search and counts cover both sets; the People count reflects private + shared.

### 7. Create — target selector
The Create form shows a centered **"Save to → Private / {Family book}"** toggle (only for members with edit rights). Default **Private**. Choosing Family creates the contact directly in the shared book.

### 8. Contact detail (shared)
- A **Family-book chip** by the name (blue, `users` glyph, book name) sits with the source/emergency/archived chips.
- **History** shows **every member's** change with attribution — "**{Member} via Family Book**" — keyed to the contact, read-visible to all members.
- A private contact's **⋯ menu** offers **"Add to {family book}"** (copy); a shared contact shows an "In {book}" note instead.

---

## States to design
- Owner: no group / one member / full (6) / pending + declined invites mixed.
- Member: can-edit vs view-only (the view-only member must see edit affordances disabled, not hidden-then-failing).
- Workspace: All / Private / Family scope, including the empty Family state ("No family contacts yet").
- Acceptance: valid / expired / already-a-member / logged-out.
- Destructive: delete book (owner) and leave book (member) confirmations.

## Open questions for the designer
- Where does the scope toggle sit best on mobile (it's currently a segmented control next to density)?
- Should the Family badge ever show the **book name** inline on a row, or stay a generic icon until the detail page? (Teams, Phase 14, will have multiple books — plan for that.)
- Owner-transfer UI (deferred) — sketch it so it's ready when billing is confirmed.
