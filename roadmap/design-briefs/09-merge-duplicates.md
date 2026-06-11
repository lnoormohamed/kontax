# 09 — Merge Duplicates

**Routes:**
- `/merge-suggestions/[id]` — review and resolve a system-suggested merge **(rebuilt to this spec in P10-05/P10-08 — as-built below)**
- `/merge/manual` — manually pick two contacts to merge **(still on the legacy UI — see "Manual merge" note)**

**Priority:** P1 — merging is the quality-of-life feature that keeps the address book clean. A hesitant or confusing merge UI causes users to skip merges and accumulate duplicates, which degrades trust in the whole app.

> **Status: AS-BUILT (2026-06-11).** The suggestion review page is shipped and this brief documents the real behaviour so hi-fi mockups match. Earlier drafts described a per-row radio comparison table; that model was **not** built. The shipped model is **survivor-pick → resolve conflicts only → auto-union multi-value fields → gated merge**, described here.
>
> **Cross-references (do not re-spec here):** the **bulk-merge confirmation dialog**, the **"Merged contacts" / 30-day undo section** (both on the Duplicates tab), and the **source badges** are owned by **brief 10 — Activity Log & Source**. This brief covers the single-suggestion review surface and points to 10 for the rest.
>
> **Design language:** locked Kontax system (briefs 01/02/10) — page bg `#f4f6f2`, white cards, hairline `#d8ddd6`/`#edf0ea`, ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, brand green `#17352e`, blue link/CTA `#4158f4`, amber `#bf8526`, red `#b5472f`, Geist. Diff/removed = red, added/kept = green `#2f7d5b`. **No dark theme, no `slate-*`/`cyan` tokens** — those in any older copy are dead.

---

## Purpose

Collapse two contact records into one without the user ever feeling uncertain about what is kept or lost. The guiding principle is **explicit choice at low cost**: surface only the decisions that matter, decide everything else automatically, and never let the user lose data they didn't choose to drop.

The shipped model achieves this with four moves:
1. **Pick the survivor** — which record stays as the primary (kept) contact.
2. **Resolve only the conflicts** — fields where both contacts have *different* non-empty values.
3. **Auto-union multi-value fields** — emails, phones, addresses, etc. are combined from both sides (deduped); nothing is discarded.
4. **Auto-fill the rest** — identical fields and one-sided fields are decided silently and summarised, not surfaced as decisions.

The Merge button stays disabled until every conflict is resolved.

---

## Layout: `/merge-suggestions/[id]`

A single centred column (max-width ~768px) on the `#f4f6f2` page — **not** a sticky-action-bar three-column table. Sections stack top to bottom:

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to duplicates                                         │
│  Review duplicate                                             │
│  [high confidence]  [Score 130]                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  WHY THIS WAS SUGGESTED                  Match score 130 │ │
│  │  Same email: j@x.com                              +100   │ │
│  │  Names sound alike: Jon ≈ John                    +30    │ │
│  │  ⚠ Shared phone with different names — review first      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Which record should survive?                           │ │
│  │  [ Keep as primary: John Appleseed ]  [ Jon Appleseed ] │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Resolve 2 conflicting fields                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Full name                              [Choose one]    │ │
│  │  [ John Appleseed ]        [ Jon Appleseed ]            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Notes                                  [Choose one]    │ │
│  │  [ A's notes ]  [ B's notes ]  [ Keep both — combine ]  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  KEPT FROM BOTH CONTACTS                                 │ │
│  │  Email addresses · 2     Phone numbers · 2              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  3 fields filled automatically (Company, Birthday, …)   │ │
│  │  ▸ Show 5 matching fields                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [ Merge into John Appleseed ]   (disabled until resolved)  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Not a duplicate?   [ Dismiss suggestion ]              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Back link:** `← Back to duplicates` (blue `#4158f4`, 13px) → `/?tab=duplicates`.

---

## Key Components

### 1. Header + confidence

- **Title:** "Review duplicate" (22px semibold ink).
- **Confidence pill** — three tiers (P10-08): **high** (green wash `#eef5ef` / `#17352e`), **medium** (amber wash `#f6edd9` / `#7a5a1a`), **low** (neutral `#eef0f3` / `#5c655e`). Plus a neutral **"Score N"** pill on white.

### 2. "Why this was suggested?" panel  *(shipped — was "future" in older drafts)*

A white card listing each scoring signal with its individual point contribution, and the total:
- Row: signal label (left) + **`+score`** chip (right, green wash). E.g. "Same email: j@x.com … +100", "Names sound alike: Jon ≈ John … +30", "Same phone in a different format … +90".
- A **"Match score N"** total in the card header.
- **Edge-case warnings** (e.g. "Shared phone with different names — review first") render below a divider as amber `⚠` notes — these are *not* scored contributions, they're caution flags.
- Signal vocabulary (P10-08): exact email/phone, normalized phone (different formats), name + company, name-and-company proximity ("J. Smith at Acme" ≈ "John Smith, Acme Corp"), phonetic name (supporting only), shared email domain + similar name.

### 3. Survivor selector

A white card: "Which record should survive?" with subtext "The other contact is archived after the merge — you can undo it for 30 days." Two large selectable buttons side by side (stack on mobile), each showing the contact's **name** + a secondary identifier (email or phone). The selected one gets the brand-green ring/tint (`#17352e`). Default: Contact A.

Switching the survivor does **not** reset already-made field choices — choices are stored relative to the contact (A/B), so they remain valid when the primary flips.

### 4. Conflict field cards  *(the only real decisions)*

Shown **only** for fields where both contacts have different non-empty values. Today this covers the governed scalars: **full name, email, phone, company, notes**.

Each card (amber-tinted to read as "needs attention", `#f6edd9`/40):
- Field label + a status chip: **"Choose one"** (unresolved) → **"Resolved"** (after pick). Both states use the same amber styling (`bg-[#f3e1da] text-[#7a2f1d]`) — the chip confirms the decision by changing text, not by switching to green.
- Two option buttons side by side: each shows the source contact's label (its name) as a small uppercase caption + the value. Selected = green ring/tint.
- **Notes** additionally offers a third full-width option: **"Keep both — combine the notes from both contacts."**
- Empty value renders as "—".

### 5. "Kept from both contacts" panel  *(auto-union — keep-both)*

A white card listing the multi-value fields that were combined from both sides (count > 1): **email addresses, phone numbers, addresses, websites, labels, significant dates, related people, custom fields**. Each shows a count and the deduped values. Copy: "Multi-value fields are combined automatically — nothing is lost. Duplicates are removed." This is **informational, not interactive** — the union always happens (the engine dedupes by value).

### 6. Auto-filled + matching summary

A quiet white card so the user trusts that untouched fields were handled:
- **"N fields filled automatically"** — fields where only one contact had a value (lists them).
- **"Show N matching fields"** — a disclosure that expands a list of fields identical on both contacts (label: value). Collapsed by default so identical data never competes for attention.

### 7. Merge button (gated)

Primary green button (`#17352e`): **"Merge into [survivor name]"**. **Disabled until every conflict is resolved**, with a live hint beside it: "Resolve N more fields to continue." On success, the merge redirects to the survivor's detail page (`/contacts/[id]?saved=1`). There is **no in-page success view** and **no sticky bottom action bar**.

### 8. Dismiss card

A white card at the bottom: "Not a duplicate?" + a **Dismiss suggestion** button. Dismissing removes the pair from the open queue (status `DISMISSED`) while keeping the review history; it does not merge anything.

---

## Post-merge & undo  (see brief 10)

There is no success screen on this page — the user lands on the merged (survivor) contact. **Undo lives in the Duplicates tab's "Merged contacts" section** (brief 10): each recent merge shows survivor ← absorbed + date, with **Undo within 30 days** (restores the absorbed contact, reverts the survivor, re-opens the suggestion) or **Expired** after the window. The **bulk-merge confirmation dialog** ("Accept all N high-confidence") is likewise specced in brief 10. Do not re-design those here.

---

## States

- **Loading:** skeleton for the header, why-panel rows, and field cards.
- **Not found / already resolved:** Next.js 404 page — no custom message on this route. Fires for any suggestion that isn't `OPEN` (already merged, dismissed, or stale suggestions all reach 404 via the app's standard not-found page).
- **Stale auto-refresh (P10-08):** stale suggestions are retired by the bulk-refresh operation, triggered when the user clicks "Refresh duplicates" on the Duplicates tab or via `POST /api/merge-suggestions/refresh`. Individual page loads do **not** recompute inline — if a suggestion's contacts were edited and the refresh hasn't run yet, the page shows the last-generated reasons. A STALE suggestion URL 404s (same as the not-found state above). No special UI beyond the standard 404.
- **No conflicts (all fields match or are one-sided):** no conflict cards render; instead a calm note "No conflicting fields — everything either matches or only one contact has a value," and the Merge button is enabled immediately.
- **Merging:** button shows progress; on failure, keep the form and show an error.

---

## Mobile (< 768px)

Single column already, so it scales down directly: survivor buttons stack; conflict cards' two options stack vertically; the union and summary cards are full width. No horizontal comparison table to reflow. The Merge button is full-width near the bottom of the form (not a separate sticky bar).

---

## Manual merge (`/merge/manual`)  — known gap

The manual route still runs the **legacy** two-card "keep A / keep B" form (`merge-preview-form.tsx`, dark-theme, scalar choices only). It was intentionally left untouched during the P10-05 rebuild. **Target design (not yet built):** a two-contact **picker step** (search + select Contact A and Contact B) that then hands off to the *same* field-level review component used by `/merge-suggestions/[id]` — minus the confidence/why-panel (there's no system suggestion for a user-initiated merge). Until that's built, this route is a visual outlier; flag for alignment when the merge surfaces are next touched.

Picker step (target):
- Title "Merge two contacts" + subtext.
- Two equal cards "Contact A" / "Contact B", each a search input → dropdown of matches (avatar + name + email, keyboard-navigable, max 8) → selected mini-card with a clear (×).
- **"Compare & merge →"** enabled once both are selected → loads the field-level review.

---

## Notes for the designer

- The whole surface is **decision-minimising**: a clean review should show a survivor toggle, **zero-to-a-few** conflict cards, and the rest folded into the union + summary cards. Mock the common case (1–2 conflicts) and the zero-conflict case.
- Keep the **why-panel** legible — it's the trust anchor that explains an automated suggestion. Per-signal scores in a tabular/aligned column; warnings visually distinct (amber) from positive signals.
- Reuse the **same event/source iconography** as brief 10 if you show source hints on values (optional; source badges are owned by brief 10).
