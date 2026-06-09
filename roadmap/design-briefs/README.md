# Kontax Design Briefs

One brief per page or major surface. Each brief describes the purpose, layout, visual direction, states, and interaction details the designer needs to produce high-fidelity mockups.

## Pages

| Brief | Route | Priority |
|---|---|---|
| [01 — Contacts List](./01-contacts-list.md) | `/` (logged in) | P0 — core product surface |
| [02 — Contact Detail](./02-contact-detail.md) | `/contacts/[id]` | P0 |
| [03 — Create & Edit Contact](./03-create-edit-contact.md) | `/contacts/new`, `/contacts/[id]/edit` | P0 |
| [04 — Login & Register](./04-login-register.md) | `/login`, `/register` | P1 |
| [05 — Public Landing](./05-public-landing.md) | `/` (logged out) | P1 |
| [06 — Settings](./06-settings.md) | `/settings` | P1 |
| [07 — Sync & Connections](./07-sync-connections.md) | `/sync` | P1 |
| [08 — Import & Export](./08-import-export.md) | `/import-export` | P1 |
| [09 — Merge & Duplicates](./09-merge-duplicates.md) | `/merge-suggestions/[id]`, `/merge/manual` | P2 |
| [10 — Activity Log & Source](./10-activity-log-and-source.md) | `/contacts/[id]` (source/history), `/?tab=activity`, `/?tab=duplicates` | P2 |

## Design Principles

**1. Phone-book first.**
The contacts list is the product. Every design decision should make it faster and more pleasant to scan, find, and open a contact. If something competes with the list for attention, it probably does not belong on the main page.

**2. Familiar, not novel.**
Users already understand Google Contacts and the iOS Contacts app. Lean into those patterns rather than inventing new ones. Save creative decisions for Kontax-specific features (sync status, sharing badges, family book indicators).

**3. Dense but calm.**
Contacts are a long list. The design should handle 500+ names without feeling overwhelming. Use tight vertical rhythm, clear typographic hierarchy, and restrained colour. Avoid cards with heavy borders for every row — rows should breathe, not feel boxed.

**4. One primary action per page.**
Each page has one obvious next step. On the contacts list it is "find a contact." On the contact detail it is "see the details or edit." Do not let secondary actions (export, settings, sync) compete visually with the primary one.

**5. Subtle affordances, not cluttered toolbars.**
Hover states, swipe actions (mobile), and contextual menus reveal actions without cluttering every row. Row-level actions appear on hover/focus, not permanently.

## Colour Direction
The app currently uses a green-tinted neutral palette with a deep green brand colour (`#17352e`), a blue CTA (`#4158f4`), and warm off-white backgrounds. The designer should treat this as a starting point and refine, not as locked values.

## Typography Direction
- Headings: tight tracking, semibold weight, slate-900
- Body / list rows: regular weight, slate-700/600
- Labels / meta: uppercase, wide tracking, slate-400/500, 11–12px
- No serifs. System font stack or a clean geometric sans (Inter, Geist, or similar).

## Responsive Targets
- Desktop: ≥1280px — primary design target. Full sidebar, multi-column detail.
- Tablet: 768–1279px — collapsible sidebar, single-column detail.
- Mobile: <768px — bottom nav or hamburger, full-screen list, detail as full-screen sheet.
