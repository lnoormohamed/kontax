# P34D-02 — Smoke Test: Contacts CRUD and Search

## Purpose

Verify that contacts can be created with all field types, viewed, edited, archived,
restored, and permanently deleted; and that the unified search (P33) behaves
correctly across all field groups, keyboard navigation, and mobile overlay.

## Background

The contacts feature is the core of Kontax. P33 unified the search core and added
per-group result UI, in-list snippets, keyboard navigation, and a mobile overlay.
This smoke test validates the full contacts lifecycle and the entire search surface
in an integrated way — not unit by unit, but as a user would encounter it.

## Scope

**In scope**
- Contact creation with all field types (name parts, multi-value phone/email,
  company, job title, address, birthday, significant dates, notes, labels, website)
- Contact detail view (all field tabs, correct tab count)
- Inline editing of every field type on the detail page
- Archive, restore, permanent delete
- Search: name, email, phone, company, label, notes keyword
- Search keyboard navigation and global shortcut
- Recently viewed and recent searches
- Mobile search overlay
- In-list snippet rendering for notes keyword matches

**Out of scope**
- Sharing tab behaviour (covered in P34D-04)
- Sync badge on contacts (covered in P34D-03)
- Bulk edit, smart lists (tested in P28 acceptance; re-test if regressions found)

## Design / Implementation Spec

Run all test cases in a logged-in session on kontax.vexon.co. Use a fresh test
contact created in TC-01 for subsequent TC cases; do not rely on existing seed data
which may vary between test runs.

For search test cases, the contact created in TC-01 (with all field types populated)
is the primary test target. TC-16 onwards require clearing and re-typing in the
search input — use the Esc key or clear button.

Record results in `roadmap/runbooks/smoke-test-results-v1.md` → Contacts section.

## Test Cases

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| TC-01 | Create contact with all field types | Click "New Contact". Fill: first name "Smoke", last name "Test", phonetic first "Smo-k". Add 3 phones: mobile 555-0001, work 555-0002, other 555-0003. Add 2 emails: personal smoke@example.com, work smoke@corp.com. Company "Test Corp". Job title "QA Lead". Address: 123 Main St, Springfield, IL 62701, US. Birthday 1990-03-15. Significant date "Anniversary" 2015-06-01. Notes "This is a smoke test contact with notes". Labels: add "VIP" and "Test". Website https://example.com. Save. | Contact saved. Redirected to contact detail. All fields visible. No validation errors. | |
| TC-02 | View contact detail — all fields visible | Open the contact from TC-01. | Name, phonetic, all phones (with labels), all emails, company, job title, address, birthday, anniversary, notes, VIP + Test label chips, website all visible on the Details tab. | |
| TC-03 | View contact detail — tabs present | Check tabs on contact detail. | "Details", "Sharing", and "History" tabs are all present and clickable. | |
| TC-04 | Edit first name inline | Click to edit first name field. Change "Smoke" to "SmokeEdited". Save. | Name updates on detail page and in the contact list without a page reload error. | |
| TC-05 | Edit phone number | Click edit on the first phone. Change to 555-9999. Save. | Phone shows 555-9999 on detail page. | |
| TC-06 | Edit notes | Click edit on notes. Append " — updated". Save. | Notes field shows appended text. | |
| TC-07 | Archive contact | From the contact list, open the kebab menu on the test contact. Choose "Archive". | Contact disappears from the People tab. A toast or confirmation appears. | |
| TC-08 | Archived contact appears in Archived tab | Click the "Archived" tab (or filter). | Test contact appears in Archived tab. Does not appear in People tab. | |
| TC-09 | Restore contact | From Archived tab, open test contact. Click "Restore". | Contact moves back to People tab. No longer in Archived tab. | |
| TC-10 | Delete contact permanently | Archive the test contact again. In Archived tab, open kebab → "Delete permanently". Confirm. | Contact is gone from all tabs (People, Archived). Searching by name returns no result. | |
| TC-11 | Search by name | Create a fresh contact "Phoenix Reyes". Type "Phoenix" in search. | Dropdown shows a "People" group containing "Phoenix Reyes". | |
| TC-12 | Search by email | Type "smoke@corp.com" in search (if TC-01 contact still exists; else create a contact with that email). | "Email" group shows the matching contact with email snippet. | |
| TC-13 | Search by phone digit | Type "5550001" in search. | "Phone" group shows the matching contact with phone snippet showing the matched digits. | |
| TC-14 | Search by company | Type "Test Corp" in search. | "Company" group shows the matching contact. | |
| TC-15 | Search by label name | Type "VIP" in search. | "Label" group shows contacts tagged VIP with the label chip. | |
| TC-16 | Search by notes keyword | Type "smoke test contact" in search. | "Notes" group shows the contact with an excerpt containing the matched keywords. | |
| TC-17 | Global shortcut "/" opens search | Press "/" on any page (not in a text input). | Search input receives focus. | |
| TC-18 | Keyboard navigation ↓↑↵ | Open search with results showing. Press ↓ to move to first result, ↓ again for second, ↑ to go back. Press ↵ on a highlighted result. | Keyboard moves the highlight correctly. ↵ opens the contact detail page. | |
| TC-19 | Esc clears search | Type in search, then press Esc. | Search input cleared, dropdown closed. | |
| TC-20 | Recently viewed in blank search | Open a contact directly. Navigate away. Click search with empty query. | The recently-opened contact appears in a "Recently viewed" section in the dropdown. | |
| TC-21 | Recent searches in blank search | Search "phoenix", open the result, navigate away. Click search with empty query. | "Phoenix" appears in a "Recent searches" section in the dropdown. | |
| TC-22 | Mobile search overlay | On a mobile viewport (or real device), tap the search icon. Type "phoenix". | Full-screen overlay opens. Results grouped correctly (People group with Phoenix Reyes). Tap the result — contact detail opens. | |
| TC-23 | In-list snippet for notes match | In the main contact list with search active (notes keyword), verify the list row. | The contact list row shows a notes excerpt snippet beneath the name, highlighting the matched keyword. | |

## Acceptance Criteria

- All 23 test cases pass.
- No JavaScript console errors during contact creation or search.
- Results recorded in `roadmap/runbooks/smoke-test-results-v1.md`.

## Risks / Open Questions

- TC-01 is comprehensive by design; if a field fails to save, the root cause should
  be identified (validation, DB schema, UI bug) and classified P0 or P1.
- The in-list snippet (TC-23) is a P33-05 feature; if it regressed, it is P1.
- Mobile overlay (TC-22) cannot be fully verified in DevTools — use a real device
  per the "Touch gestures: verify on device" memory note.
- Recent searches persistence: confirm these are stored in the DB (not localStorage)
  so they survive cross-device use.

## Documentation

- [ ] External · users — in-app Help: no changes needed
- [ ] External · developers — /developers: no changes needed
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: record results here
- [ ] Internal · engineering — docs/: no code changes in this ticket
