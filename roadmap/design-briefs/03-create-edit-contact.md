# Design Brief: Create Contact Form

**Route:** `/contacts/new`
**Phase:** P0 core surface
**Last updated:** 2026-06-10

> **Scope: CREATE only.** This brief covers the net-new contact form at `/contacts/new`. **Editing an existing contact is *not* a separate form** — it happens inline on the contact detail page (see brief **02 — Contact Detail**, which is LOCKED on an inline-edit, auto-save-on-blur model with no separate edit route). There is intentionally no `/contacts/[id]/edit`. Anything in earlier drafts about "edit mode", a pre-populated form, or a delete action on this form is superseded by brief 02 — deletion/archiving lives on the detail page, not here.

> **Design language:** follow the locked Kontax system used in briefs 01/02 — ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, brand green `#17352e`, blue CTA `#4158f4`, red `#b5472f`, Geist. Where this brief still shows generic Tailwind tokens (`slate-*`, `border-red-400`, `bg-slate-100`), treat them as placeholders and map to the locked palette (e.g. error border → `#b5472f`, label-pill surface → `#f2f4f0`).

---

## Purpose

This is the primary data-*entry* surface in Kontax: creating a net-new contact from scratch. The audience is anyone capturing a new person — adding a colleague, saving someone from a business card, jotting a number during a call. Speed matters: the happy path (a name + one contact method) must be frictionless, while the depth of fields stays available for power users one tap away. On save, the user lands on the new contact's detail page, where any further changes happen inline.

---

## Progressive Disclosure Model

The form is split into two tiers, matching the Google Contacts pattern:

**Core fields** — always visible. These cover the vast majority of use cases. A user adding a contact from a business card or their phone should be able to fill in everything they need without ever scrolling past the notes field.

**Extended fields** — hidden behind a single "Show more" link at the very bottom of the form. One tap reveals everything. One tap hides it again ("Show less"). There is no per-section toggle — just one global expander at the bottom.

### Core fields (always visible)
- Avatar
- First name / Surname
- Company / Job title
- Email (+ Add email)
- Phone with country flag/code (+ Add phone)
- + Add address
- Birthday (Day / Month / Year)
- Notes

### Extended fields (revealed by "Show more")
- Name prefix, suffix, middle name
- Phonetic first name, phonetic last name, phonetic company name
- Nickname
- + Add website
- + Add significant date
- + Add related person
- + Add custom field

This matches exactly how Google Contacts handles it. The result is a form that looks approachable for casual users (not overwhelming) while giving power users full access with one tap.

---

## Layout (Desktop ≥ 1280px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STICKY ACTION BAR (top)                                                    │
│  ← [Cancel]          New contact / [Contact name]      [Save contact] btn  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  AVATAR BLOCK                                                       │   │
│  │  [Avatar 80px + "+" add photo button]                               │   │
│  │  + Label chip                                                       │   │
│  │  Save to: [Private ▾] (if family/team — future, hidden until ready) │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ── CORE FIELDS ─────────────────────────────────────────────────────────  │
│                                                                             │
│  [person icon]  First name  [                                    ] [▾]     │
│                 Surname     [                                    ]         │
│                                                                             │
│  [grid icon]    Company     [                                    ] [▾]     │
│                 Job title   [                                    ]         │
│                                                                             │
│  [mail icon]    Email       [                                    ]         │
│                 + Add email                                                 │
│                                                                             │
│  [phone icon]   [🇬🇧 ▾]     Phone  [                             ]         │
│                 + Add phone                                                 │
│                                                                             │
│  [pin icon]     + Add address                                               │
│                                                                             │
│  [cake icon]    Day [  ]  Month [      ▾]  Year (optional) [    ]         │
│                                                                             │
│  [notes icon]   Notes [                                                ]   │
│                       [                                                ]   │
│                                                                             │
│  ── SHOW MORE ───────────────────────────────────────────────────────────  │
│                                                                             │
│  + Show more    (text link, bottom of core fields, blue)                   │
│                                                                             │
│  ── EXTENDED FIELDS (visible only after "Show more") ───────────────────  │
│                                                                             │
│  [calendar icon]  + Add significant date                                    │
│  [link icon]      + Add website                                             │
│  [person+ icon]   + Add related person                                      │
│  [tag icon]       + Add custom field                                        │
│                                                                             │
│  − Show less    (collapses back)                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

(No delete action on this form — deleting/archiving a contact happens on the detail page, per brief 02.)

### Layout notes
- The form is **not split into section cards**. It is a single flat scrollable form, matching Google Contacts' clean borderless style. Section groupings are indicated by the left-column icon changing — not by card borders or section header labels.
- Each field row has a **left icon column** (~32px wide) and a **field column** that fills the remaining width. The icon appears only once per logical group (e.g. the mail icon appears next to the first email row; additional email rows have no icon, just indented alignment).
- Max-width: 600px, centred on the page. Background: plain white or the app's off-white (`#f9faf6`).
- Spacing between field rows: 12–16px. Compact but not cramped.
- The "+ Add email", "+ Add phone", "+ Add address" links are full-width pill-shaped buttons with a light blue/grey fill — the same style as Google Contacts' add buttons. Not plain text links.

---

## Sticky Action Bar

Sits at the very top of the viewport. Height: 56px. Background: `rgba(249,250,246,0.96)`, `backdrop-filter: blur(8px)`, border-bottom `#d8ddd6`.

- **Left:** "Cancel" — a text link in `text-slate-500`. Clicking triggers the unsaved-changes check (see States), then navigates back.
- **Centre:** Page title — "New contact". (Optional nicety: once the user has typed a name, the title can echo the composing display name.)
- **Right:** "Save contact" — primary CTA button. `bg-[#4158f4] text-white rounded-xl px-5 py-2 text-sm font-semibold`. Disabled state when: form is pristine (no changes), full name is empty and organisation name is empty. Loading state during save.

The action bar must remain visible at all scroll positions. On mobile it collapses slightly (48px) but retains all three zones.

---

## Key Components

### Avatar Block

Not a form section card — it sits above the section cards, visually connected to the identity of the record being created.

- Avatar circle 80×80px. In create mode: empty initials placeholder (grey circle with a "+" icon), clicking opens file picker.
- Once a name is typed, initials render immediately using the same colour-hash algorithm as the contact detail page.
- If a photo is uploaded, it previews in the circle. A "Remove photo" option appears on hover.
- **Person / Organisation toggle:** a small two-state segmented control ("Person · Organisation") below the avatar. Toggling to Organisation hides the first/middle/last name split fields and makes company name the primary required field. The avatar initials use the company name initial instead.
- **Save to selector (future, Phase 13):** a dropdown below the toggle: "Save to: Private ▾". Options will be: Private, Family address book, [Team name]. Placeholder exists now but is hidden (`display: none`) until the family/team feature is available.

### Identity Fields

**Required field:** First name or Surname (at least one). In Organisation mode, Company name is required instead. Validation runs on save — not on blur. The empty required field gets a red border and an inline error message below it: "Enter a name or company".

**Core identity rows (always visible):**
- First name (full width, with expand arrow [▾] to reveal middle name inline)
- Surname (full width)

**Extended identity fields (revealed by global "Show more"):**
- Name prefix (Mr / Mrs / Dr / etc.)
- Middle name (or reveal inline via the [▾] on First name row)
- Name suffix
- Phonetic first name
- Phonetic last name
- Nickname

In Organisation mode: First name and Surname rows are replaced by a single Company name row. Phonetic company name is revealed by "Show more".

### Contact Methods Section

**Multi-value fields** — emails, phone numbers, and websites each have their own sub-group within this section, separated by a 1px rule.

Each value row:
```
┌─────────────────────────────────────────────────────────┐
│  [Label pill ▾]   [Input field                    ] [×] │
└─────────────────────────────────────────────────────────┘
```

- **Label pill:** rounded rectangle button, `bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md`. Clicking opens a small dropdown list of standard labels. Email labels: Home, Work, iCloud, Other, Custom. Phone labels: Mobile, Home, Work, Main, iPhone, Home Fax, Work Fax, Pager, Other, Custom. Website labels: Homepage, Home, Work, Other, Custom.
- **Input field:** standard text input, full-width within the available space (after label, before ×). Email fields use `type="email"`, phone fields use `type="tel"`, website fields use `type="url"`.
- **Remove button (×):** 20×20px icon button in `text-slate-400`. Hover: `text-red-500`. Removes the row immediately (no confirmation — it's a form, not a save).
- **"+ Add [field type]" link:** `text-[#4158f4] text-sm font-medium`. Appears below the last row for each field type. Clicking appends a new empty row with the most recently used label pre-selected.

**Initial state:** One empty email row and one empty phone row are present when the form loads. This is the fastest path for the most common case: a new contact usually has at least one of each.

### Work Fields (Core)

- Company name — single-line, always visible.
- Job title — single-line, always visible.
- Department and Phonetic company name are in the extended section (revealed by global "Show more").

### Personal Section

**Birthday:** a single-line date input rendered as: `[Month ▾] [Day ▾] [Year ___]` — three separate selects/inputs rather than a native date picker. This avoids the inconsistent native date picker UI across browsers and is more forgiving for partial dates (some users only know the month and day). Each sub-field is independently optional.

**Addresses (multi-value):** clicking "+ Add address" expands an address entry block:
```
┌──────────────────────────────────────────────────┐
│  [Label: Home ▾]                         [×]     │
│  Street line 1  [                              ] │
│  Street line 2  [                              ] │
│  City           [              ]                 │
│  State/Region   [          ]  Postcode [       ] │
│  Country        [              ]                 │
└──────────────────────────────────────────────────┘
```

Multiple addresses are stacked vertically with the same card inset treatment.

Related people, significant dates, and custom fields are in the extended section revealed by the global "Show more" at the bottom of the form.

### Notes Section

- Auto-growing `<textarea>`. Min-height: 80px. Grows to content.
- Font: same 14px regular as all body text — do not use a monospace font.
- Placeholder: "Add any notes about this contact…"
- Character counter appears in the bottom-right corner of the textarea when within 200 characters of the 4000 character limit: shown as `3812 / 4000` in `text-slate-400 text-xs`.

### (No delete on this form)

There is no delete/archive action on the create form. Those actions live on the contact detail page (brief 02): Archive in the header, "Delete permanently" in the ⋯ menu. Nothing to design here.

---

## States

### Empty / Initial

The form loads with: one empty email row, one empty phone row, all other fields blank. Placeholders visible. The avatar circle shows a "+" prompt. "Save contact" is disabled until at least a name (or, in Organisation mode, a company) is entered.

### Field Validation Errors

Validation runs on form submit, not on blur. This avoids premature error messages while the user is still filling in the form.

- Empty required field (full name or company): the input border turns red (`border-red-400`), a small inline error message appears below: "Name is required".
- Invalid email format: "Enter a valid email address".
- Invalid URL: "Enter a valid URL (include https://)".
- Errors are cleared as soon as the user starts typing in the offending field.

### Loading / Saving

When "Save contact" is clicked, the button transitions to a loading state: spinner icon replaces the label text, button is disabled, the form is not disabled (user can read while it saves). Duration is typically <500ms. On success, navigate to the contact detail page. On failure, show an error toast and re-enable the form.

### Unsaved Changes Warning

If the user clicks Cancel (or navigates away via browser back) after entering anything:
- A modal appears: "Discard new contact? Your unsaved changes will be lost." with buttons "Keep editing" (dismisses modal) and "Discard" (proceeds with navigation).
- Applies only if the form is dirty — any input at all counts.

### Save Error

If the save request fails, keep the form intact (no data loss), re-enable the "Save contact" button, and show an error toast: "Couldn't save this contact. Check your connection and try again." The user can retry the save directly. (There is no "load existing data" state — this form never pre-loads a record; that's the detail page's job.)

---

## Form Behaviour Details

### Label Auto-suggestion

When the user adds a second email or phone row, the label defaults to the next most common label in sequence (e.g. first email defaults to "Home", second to "Work"). This reduces the friction of the label picker for the common case.

### Display Name Auto-composition

As the user types in first/last name fields, the "Full name" field is automatically composed ("John Smith"). If the user manually edits the Full name field, it detaches from auto-composition for the rest of the session.

### Organisation Mode Behaviour

In Organisation mode:
- Company name becomes the required field (labelled with `*`).
- First/Middle/Last fields are hidden.
- The display name auto-composes from Company name only.
- Work section fields (job title, department) remain visible but are labelled without the company context since the contact *is* the company.

### Tab Order

Tab order follows visual reading order: Avatar → Full name → First → Middle → Last → (advanced if expanded) → Email rows → Phone rows → Website rows → Company → Job title → (advanced work if expanded) → Birthday → Addresses → (advanced personal if expanded) → Notes → Save button. The Cancel link is not in the standard tab order (it requires deliberate interaction).

---

## Mobile Layout (< 768px)

On mobile, the layout is identical in structure — single column always — but with tighter spacing.

```
┌──────────────────────────────┐
│  ← Cancel    New contact     │  ← sticky top bar, no right CTA
├──────────────────────────────┤
│  [Avatar 64px]               │
│  [person / org toggle]       │
│                              │
│  [Identity section card]     │
│  [Contact methods card]      │
│  [Work card]                 │
│  [Personal card]             │
│  [Notes card]                │
│                              │
├──────────────────────────────┤
│  [Save contact]  ← full-width sticky bottom bar                │
└──────────────────────────────┘
```

- The "Save contact" button moves to a sticky footer bar on mobile. Full width, 52px tall, `bg-[#4158f4]`.
- Cancel moves to the top-left of the header. Page title in the centre.
- The form adds `padding-bottom: 72px` to prevent content being hidden behind the sticky footer.
- When the keyboard is open (a field is focused), the sticky footer is temporarily suppressed (set to `position: static` inside the `form`) to avoid it obscuring content above the keyboard. The Save action is still accessible via keyboard toolbar.
- Multi-value rows: the label pill and remove button are on a second sub-line on very small screens (< 375px) to prevent overflow.
- Date picker for birthday: tap-friendly, uses native `<input type="date">` on mobile where the OS-level picker is superior.

---

## Future Additions

### Save-to Target Selector (Phase 13)

The "Save to: Private ▾" dropdown in the avatar block becomes functional when family/team groups are available. Options rendered as a clean dropdown:
- Private (locked icon)
- Family address book (family icon)
- [Team name] (team icon)

Default selection should persist as the user's last-used target. Design the selector affordance now (it currently renders as `display: none`) so the layout is already accounted for.

### Custom Field Types (Phase 10+)

Custom fields in the Personal "show more" section will eventually support typed values: text, URL, date, phone. When this is added, each custom field row will have a type selector in addition to the label. The row structure should be extensible.

### Import Suggestion Banner (Phase 10)

When creating a new contact, if there are likely duplicates detected server-side (similar name), a dismissible banner may appear at the top of the form: "A contact named [Name] already exists — view it or continue creating." Design the form to accommodate a banner zone directly above the Identity section card.

### Attachment Support (Later)

The Notes section may eventually support file attachments (PDFs, images). Reserve a "Attach file" link at the bottom of the Notes card for this purpose, initially hidden.
