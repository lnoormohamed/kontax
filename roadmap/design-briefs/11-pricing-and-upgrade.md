# 11 — Pricing & Upgrade Flows

**Surfaces:**
- **Pricing page** — `/pricing` (new; four-tier comparison, public + logged-in)
- **Upgrade prompt** — inline, contextual, shown when a user hits a gate
- **Plan comparison modal** — current vs. suggested tier, launched from a prompt
- **Family invite (overview only)** — full flow is Phase 13
- **Downgrade warning** — what's affected before confirming a downgrade

**Priority:** P1 — the conversion surface. Free users only upgrade if the value is legible and the moment is well-timed. The tone must be transparent and fair, never pushy.

> **Source of truth:** the frozen plan matrix in **`roadmap/build-phase/p11-01-plan-feature-matrix.md`** (tiers Free / Pro / Family / Teams). Every feature row, limit, and gate below comes from it — do not invent features or limits. **Pricing numbers are out of scope** (commercial decision pending) — use placeholders (e.g. "£X/mo").
>
> **Design language:** the locked Kontax light system (briefs 01/02/10) — bg `#f4f6f2`/white, ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, brand green `#17352e`, blue CTA `#4158f4`, amber `#bf8526`, red `#b5472f`, Geist. **No new hues.** The recommended-plan highlight uses the brand green; the primary upgrade CTA uses blue (consistent with the "Create contact" CTA).
>
> **Today's reality:** there is no `/pricing` route yet, and upgrade entry points currently link to `/settings`. This brief defines the target. The existing **`ActivityLocked`** card (Activity tab) and the **near-limit banner** (contacts list) are the current upgrade-prompt patterns — keep new prompts visually consistent with them.

---

## Tiers & what each unlocks (from the matrix)

Four tiers. Feature rows on the pricing page should be **grouped by category** in this order:

**Free** · individual, evaluating
- Contacts: up to **500**
- Sync: **1** CardDAV account, **1** device app password
- Import: **3 / month** · Export: CSV + vCard
- Merge: basic suggestions (no bulk accept, no undo)
- Activity: per-contact history shows the **last 3 events** (10 kept) · source badges · **no** global feed
- Sharing: vCard link (download, **expires 7 days**) · no Kontax-to-Kontax sharing
- Support: community

**Pro (Individual)** · power user
- Contacts: **unlimited** · Import: **unlimited**
- Sync: **5** CardDAV accounts, **5** device app passwords
- Merge: **advanced** — field-level, bulk accept, 30-day undo
- Activity: **global feed (365-day retention)** · per-contact history 365 days (+ last 20 per contact kept beyond)
- Sharing: vCard link (no expiry, revocable) · **static + live** Kontax-to-Kontax sharing
- Support: priority

**Family** · up to **6 members**
- Everything in Pro, **per member**
- **1 shared family address book** — everyone can view/edit, changes live-sync to all
- Family admin controls (add/remove members, set who can edit)
- Personal activity feed retention **90 days** (+ last 20 per contact kept beyond) · shared family-book activity log retention **1 year** (shared book is Phase 13)
- Each member keeps their own private library

**Teams** · up to **25 members**
- Everything in Pro, per member
- **Multiple** shared address books, Admin/Member roles per book
- Full audit log, **unlimited retention** · team-level CardDAV sync
- Dedicated account manager (larger teams)

---

## 1. Pricing page (`/pricing`)

### Layout (desktop ≥ 1280px)

A four-column comparison on the light page, centred (max-width ~1120px). Works **logged-out** (public, from the landing page) and **logged-in** (the user's current plan is marked).

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Plans that grow with you                          │
│                   [ Monthly ◐ Annual ]  (save ~20%)                    │
│                                                                        │
│  ┌─────────┐  ┌─────────────┐  ┌─────────┐  ┌─────────┐               │
│  │  Free   │  │  PRO ★ rec. │  │ Family  │  │  Teams  │               │
│  │  £0     │  │  £X / mo    │  │ £X / mo │  │ £X / mo │               │
│  │ [Current]│ │ [Upgrade]   │  │[Upgrade]│  │[Contact]│               │
│  ├─────────┤  ├─────────────┤  ├─────────┤  ├─────────┤               │
│  │ Contacts category rows … (✓ / value / —) across all four columns    │
│  │ Sync …                                                              │
│  │ Sharing …                                                           │
│  │ Collaboration …                                                     │
│  │ Activity …                                                          │
│  │ Support …                                                           │
│  └─────────┘  └─────────────┘  └─────────┘  └─────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

- **Header:** a calm headline + the **Monthly / Annual toggle** (segmented control; annual shows a "save ~20%" hint — placeholder %). Toggling updates the price line in every column.
- **Plan columns:** name, price (placeholder), one-line "who it's for", and a CTA button. The **recommended plan (Pro)** is highlighted with a brand-green border/ribbon ("Recommended" / "Most popular") — not a different background colour that breaks the light system.
- **CTA per column, state-aware:**
  - The user's **current** plan → a non-interactive **"Current plan"** chip (no button).
  - A higher tier → **"Upgrade"** (blue).
  - A lower tier (when logged in on a higher plan) → **"Downgrade"** (ghost) → triggers the downgrade warning (§5).
  - **Teams** → **"Contact sales"** (since seats/expansion are commercial), not a self-serve checkout.
  - Logged-out → all actionable CTAs route to register/checkout.
- **Feature rows grouped by category** (Contacts · Sync · Sharing · Collaboration · Activity · Support). Each row shows a per-tier cell: a **value** ("500", "Unlimited", "5"), a **✓** (green check) for included booleans, or **—** (muted) for not-included. Use the matrix verbatim.
- **Row hover** highlights the full row across columns so values line up legibly.

### States
- **Logged-out:** no "current plan"; all CTAs are acquisition.
- **Logged-in:** current plan chipped; up/down CTAs as above; show the user's usage inline where relevant (e.g. "You're using 420 / 500 contacts").
- **Annual vs monthly:** price line swaps; feature rows unchanged.

### Mobile (< 768px)
Columns stack into accordion cards (one expandable card per tier), recommended card expanded by default. The Monthly/Annual toggle stays pinned at the top.

---

## 2. Upgrade prompt (inline, contextual)

Shown **at the moment a user hits a gate** — never a generic nag. It must name the specific limit and which plan unlocks it. Mirror the existing patterns (`ActivityLocked` card, near-limit banner) so it feels native.

**Two forms:**
- **Inline banner** (soft, non-blocking) — e.g. the near-limit contacts warning: *"You're using 480 / 500 contacts on the Free plan."* + **Upgrade** link. Amber wash, dismissible.
- **Locked-state card** (blocking, replaces the gated content) — e.g. the Activity tab on Free: icon, "Activity log is a Pro feature", value sentence, **Upgrade to Pro** (blue) → opens the comparison modal (§3) or `/pricing`.

**Copy must match the real gates** (these strings exist in `billing.ts` — keep the prompt consistent):
| Gate | Trigger | Unlocks at |
|---|---|---|
| Contacts limit | 500 reached (Free) | Pro+ (unlimited) |
| Monthly imports | 3/mo reached (Free) | Pro+ (unlimited) |
| CardDAV sync / sync-account limit | connect sync (Free), or > limit | Pro+ (5) |
| Device app passwords | > limit | Pro+ (5) |
| vCard export | (Free) | Pro+ |
| Advanced merge / bulk accept | (Free) | Pro+ |
| Activity log feed | (Free) | Pro+ |
| Live / static sharing | (Free) | Pro+ |
| Shared address books | (Free/Pro) | **Family / Teams** |

Each prompt should state the limit, the unlocking tier, and offer one primary action (Upgrade) + a quiet dismiss/"not now". For the shared-books gate, the unlocking tier is **Family/Teams**, not Pro — the prompt must say so.

### States
Default · hover · dismissed (banner only) · the blocking card has no dismiss (it's the gated surface).

---

## 3. Plan comparison modal (current vs. suggested)

Launched from an upgrade prompt. Shows **only the two relevant tiers** — the user's current plan and the suggested one — not all four (that's the full pricing page).

```
┌────────────────────────────────────────────┐
│  Upgrade to Pro                        [×]  │
│  Unlock the activity log and more           │
│                                             │
│   Free (current)        Pro                 │
│   500 contacts          Unlimited           │
│   No activity feed   →  365-day feed        │
│   1 sync account        5 sync accounts     │
│   …the few rows that differ…                │
│                                             │
│  [ Monthly ◐ Annual ]   £X / mo             │
│  [ See all plans ]      [ Upgrade to Pro ]  │
└────────────────────────────────────────────┘
```

- Title names the destination tier and the **specific feature** that triggered it ("Unlock the activity log").
- Show the **delta** — the rows that change between current and suggested — with the triggering feature first, highlighted.
- Monthly/annual toggle + price (placeholder).
- Primary **Upgrade to [tier]** (blue) → checkout. Secondary **"See all plans"** → `/pricing`. Close (×).
- Centred modal, dim backdrop `rgba(20,30,25,0.4)`, white card, locked palette.

### States
loading (price) · default · upgrading (button spinner).

---

## 4. Family invite (overview only — detail in Phase 13)

Just enough to represent on the pricing/settings path; the real flow is Phase 13.
- After choosing **Family**, the owner sees a simple "invite your family" step: add member emails (up to the 6-slot limit), each row showing a **Pending** state until accepted.
- Invitees join by email; an invited user already on a paid plan is told their individual plan is superseded while in the family.
- **Mock only the entry point and the pending-invite list** — member management, acceptance, and the shared book live in Phase 13. Don't over-design here.

---

## 5. Downgrade warning

Before confirming any downgrade, show exactly **what will be lost or limited** — no silent data loss (this is a hard requirement from P11-03).

```
┌────────────────────────────────────────────┐
│  Downgrade to Free?                         │
│                                             │
│  You'll keep all your contacts, but:        │
│  • Contacts over 500 become read-only       │
│    (you can't add new ones until under)     │
│  • The activity feed will be locked;        │
│    history shows only the last 3 events     │
│  • Extra sync accounts / app passwords stop │
│  • Live shares convert to static snapshots  │
│                                             │
│  Your data is never deleted by downgrading. │
│                                             │
│  [ Keep my plan ]      [ Downgrade ]        │
└────────────────────────────────────────────┘
```

- A clear, scannable **list of affected features/data**, derived from the current→target tier delta. Reassure: *nothing is deleted* (over-limit data is retained read-only; old activity is only pruned later by the retention job).
- **Family → Pro / lower** and **Teams → lower** carry extra consequences (shared book is exported to the owner as a read-only snapshot; members revert to Free; team books archived after a 30-day export grace) — surface those specifically when downgrading from a group plan. See the matrix's "Group Ownership Rules" for the exact behaviour.
- Primary (safe) action is **"Keep my plan"**; the destructive **Downgrade** is the secondary/ghost (red text), never pre-focused.

### States
default · per-source variants (Free / Pro / Family / Teams as the *current* plan) · confirming (spinner).

---

## Tone

Transparent and fair, not pushy. Lead with **what the user gets**, not what they're blocked from. Family and Teams should read as *solving a real coordination problem* (a household / a team keeping one shared address book current), not "more of the same." Avoid dark patterns: the downgrade path is always clearly available, "Keep my plan" is the calm default, and no countdowns or fake scarcity.

---

## Deliverables checklist

- [ ] Pricing page — 4-tier comparison, category-grouped rows (matrix values), recommended (Pro) highlight, monthly/annual toggle, state-aware CTAs (Current / Upgrade / Downgrade / Contact sales), logged-in vs logged-out, mobile accordion
- [ ] Upgrade prompt — inline banner + blocking locked-card, per-gate copy matching `billing.ts`, shared-books → Family/Teams
- [ ] Plan comparison modal — current vs suggested delta, toggle + price, Upgrade / See all plans
- [ ] Family invite — entry point + pending list only (overview)
- [ ] Downgrade warning — affected-features list per current→target delta, group-plan consequences, "no data deleted" reassurance
- [ ] All states: default / hover / loading / confirming / dismissed; placeholder pricing throughout
