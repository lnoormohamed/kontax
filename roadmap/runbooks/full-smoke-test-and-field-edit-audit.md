# Full Smoke Test and Field Edit Audit

Purpose: run one complete product smoke test and one focused field-edit audit before release. This is intentionally broader than the phase smoke logs in `roadmap/runbooks/smoke-test-results-v1.md`: it covers every major feature surface and every editable field class, including cursor-position regressions in controlled inputs.

Legend: `[ ]` Not run | `[x]` Pass | `[!]` Fail | `[~]` Blocked | `[skip]` Intentionally skipped

## Test Run Header

| Item | Value |
|---|---|
| Environment | Local / Staging / Production |
| Base URL | |
| Tester | |
| Date | |
| Browser + version | |
| Desktop viewport | 1440 x 900 |
| Mobile viewport | 390 x 844 |
| Test account | |
| Admin account | |
| Notes | |

## Release Gate

Do not sign off if any of these fail:

- [ ] Register, verify email, log in, log out, password reset, and password change all work.
- [ ] Create, edit, search, archive, restore, and delete contacts work.
- [ ] Every contact field can be edited at the beginning, middle, and end without the cursor jumping to the end while typing.
- [ ] Phone fields allow editing the country code and the middle of the number without losing caret position.
- [ ] Shared/read-only contacts prevent owner-only field edits but still allow private notes.
- [ ] Import/export does not corrupt contact data.
- [ ] Settings save correctly and survive refresh.
- [ ] Mobile layouts have no clipped controls, overlapping text, or blocked save actions.
- [ ] No unexpected console errors, server errors, auth redirects, or failed network calls on the critical path.

## Universal Field Edit Audit

Run this mini-test on every editable text input, numeric input, URL input, email input, password input, textarea, token/name field, search field, and inline editor.

Use realistic values, then repeat with a short value and a long value.

| Check | Expected Result | Result | Notes |
|---|---|---|---|
| Click at the beginning and type `X` | Character appears at the beginning; cursor stays after inserted character. | | |
| Click in the middle and type `X` | Character appears at the selected middle position; cursor does not jump to the end. | | |
| Click before the final character and type `X` | Character appears before the final character. | | |
| Backspace in the middle | Previous character is removed; cursor stays in the middle. | | |
| Delete in the middle | Next character is removed; cursor stays in the middle. | | |
| Select a middle range and replace it | Only selected text is replaced. | | |
| Paste text in the middle | Pasted text lands at caret position. | | |
| Arrow keys left/right | Caret moves predictably; no field value reset. | | |
| Blur and refocus | Value persists; formatting, if any, is expected and documented. | | |
| Save and refresh | Saved value persists exactly or in the documented normalized format. | | |
| Cancel/discard | Previous saved value returns; unsaved value is not persisted. | | |
| Mobile keyboard entry | Same behavior on mobile viewport and real device if available. | | |

### Phone-Specific Cursor Audit

Run this anywhere `PhoneCountryInput` or a `tel` input appears: new contact, edit contact, bulk edit if phone is available, import preview/mapping if phone values are editable.

Use these values:

- `+1 415 555 0199`
- `+44 20 7946 0958`
- `+234 803 123 4567`
- `020 7946 0958`

| Check | Expected Result | Result | Notes |
|---|---|---|---|
| Put cursor after `+` and type a digit | Country code can be edited without caret jumping to the end. | | |
| Put cursor inside the country code, e.g. `+4|4` | Insert/delete works in the country code. | | |
| Put cursor in the middle of the local number | Insert/delete works in the local number. | | |
| Replace only the country code | Local number remains intact where possible. | | |
| Choose a country from the dropdown | Calling code changes and focus returns to the phone input. | | |
| Type an unformatted number, blur | Normalization happens only after blur; typing is not disrupted. | | |
| Type `+` then digits slowly | Field does not repeatedly reset or reorder characters while typing. | | |
| Paste a full international number | Country indicator and value update correctly. | | |
| Save and refresh | Saved phone remains correct and searchable. | | |

## Smoke Test Data

Create at least these contacts:

| Contact | Purpose |
|---|---|
| `Smoke Person Alpha` | Full person record with all field types. |
| `Smoke Org Beta Ltd` | Organisation-mode create flow. |
| `Smoke Shared Gamma` | Sharing, permissions, shared/read-only edit behavior. |
| `Smoke Merge Duplicate A/B` | Duplicate/merge flow. |
| `Smoke Import Delta` | Import/export round-trip. |

Use at least one contact with:

- [ ] Multiple emails, phones, websites, addresses, related people, significant dates, custom fields, notes, labels.
- [ ] International phone number with editable country code.
- [ ] Birthday with year and birthday without year.
- [ ] Long notes with line breaks.
- [ ] Long company and job title.

## Auth and Account Access

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| AUTH-01 | Register with display name, email, password | Account created; verification email sent; redirected correctly. | | |
| AUTH-02 | Verify email | Email becomes verified; verification page has no redirect loop. | | |
| AUTH-03 | Log in with valid credentials | User lands in `/contacts`. | | |
| AUTH-04 | Log out | Session clears; protected pages redirect to login. | | |
| AUTH-05 | Wrong password rate limit | Repeated failures are blocked or throttled. | | |
| AUTH-06 | Forgot password request | Reset email arrives; generic response does not leak account existence. | | |
| AUTH-07 | Reset password | New password works; old password fails. | | |
| AUTH-08 | Enable 2FA | QR/manual code flow works; recovery codes shown. | | |
| AUTH-09 | 2FA login | Login requires and accepts a valid TOTP code. | | |
| AUTH-10 | Disable 2FA | Password/TOTP confirmation works; next login skips 2FA. | | |
| AUTH-11 | Active sessions | Sessions show device/IP/time. | | |
| AUTH-12 | Revoke session | Revoked browser is forced back to login. | | |

## Contacts: Core Workflow

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| CON-01 | Open contacts list | Active contacts load; default sort/view preferences apply. | | |
| CON-02 | Create person contact | Saves and opens detail page. | | |
| CON-03 | Create organisation contact | Company is primary display name; person-only fields do not corrupt name. | | |
| CON-04 | View detail tabs | Details, Sharing, History are available where expected. | | |
| CON-05 | Edit contact with buffered editor | Save persists all changed fields together. | | |
| CON-06 | Cancel dirty edit | Discard confirmation appears; saved values remain unchanged. | | |
| CON-07 | Edit private notes on live shared contact | Notes save; owner-controlled fields remain read-only. | | |
| CON-08 | Add/remove multi-value rows | Emails, phones, websites, addresses, dates, related people update correctly. | | |
| CON-09 | Change multi-value labels | Labels persist and display correctly. | | |
| CON-10 | Archive contact | Contact leaves active list and appears in archived view. | | |
| CON-11 | Restore archived contact | Contact returns to active list. | | |
| CON-12 | Permanently delete contact | Contact detail 404s or redirects; search no longer finds it. | | |
| CON-13 | Print contacts | Print page renders selected/expected contacts. | | |
| CON-14 | QR/vCard action | QR/vCard opens or downloads and contains expected contact data. | | |

## Contacts: Field Matrix

Run the Universal Field Edit Audit for every text-like field below on create and edit surfaces.

| Surface | Field | Field Type | Result | Notes |
|---|---|---|---|---|
| New contact | Save to target: Private / Family / Team | Segmented buttons | | |
| New contact | Person / Organisation | Segmented buttons | | |
| New contact | Company name, organisation mode | Text | | |
| New contact | First name | Text | | |
| New contact | Surname | Text | | |
| New contact | Company | Text | | |
| New contact | Job title | Text | | |
| New contact | Email label | Select | | |
| New contact | Email value | Email | | |
| New contact | Additional email rows | Email | | |
| New contact | Phone label | Select | | |
| New contact | Phone value and country selector | Phone | | Must include country-code cursor audit. |
| New contact | Additional phone rows | Phone | | Must include country-code cursor audit. |
| New contact | Address label | Select | | |
| New contact | Street address | Text | | |
| New contact | City | Text | | |
| New contact | Postcode | Text/Numeric | | |
| New contact | Country | Text | | |
| New contact | Birthday month | Select | | |
| New contact | Birthday day | Numeric | | Mid-value edit must not jump. |
| New contact | Birthday year | Numeric | | Mid-value edit must not jump. |
| New contact | Notes | Textarea | | |
| New contact | Prefix | Text | | |
| New contact | Middle | Text | | |
| New contact | Suffix | Text | | |
| New contact | Nickname | Text | | |
| New contact | Phonetic first | Text | | |
| New contact | Phonetic last | Text | | |
| New contact | Phonetic company | Text | | |
| New contact | Website label | Select | | |
| New contact | Website value | URL | | |
| New contact | Related person relationship | Text | | |
| New contact | Related person name | Text | | |
| New contact | Significant date label | Text | | |
| New contact | Significant date value | Date/Text | | |
| New contact | Custom field label | Text | | |
| New contact | Custom field value | Text | | |
| Contact detail edit | First, middle, last, prefix, suffix | Text | | |
| Contact detail edit | Phonetic first, phonetic last, nickname | Text | | |
| Contact detail edit | Company, phonetic company, job title, department | Text | | |
| Contact detail edit | Email rows and labels | Email/Select | | |
| Contact detail edit | Phone rows and labels | Phone/Select | | Must include country-code cursor audit. |
| Contact detail edit | Website rows and labels | URL/Select | | |
| Contact detail edit | Birthday | Date/Text | | |
| Contact detail edit | Address label, street, city, state, postcode, country | Text/Select | | |
| Contact detail edit | Related people | Text/Select | | |
| Contact detail edit | Significant dates | Date/Text/Select | | |
| Contact detail edit | Notes | Textarea | | |

## Search, Filters, Labels, and Bulk Edit

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| SRCH-01 | Search by first/last name | Correct contact appears. | | |
| SRCH-02 | Search by email including TLD | Correct contact appears. | | |
| SRCH-03 | Search by phone digits | Correct contact appears. | | |
| SRCH-04 | Search by company | Correct contact appears. | | |
| SRCH-05 | Search by label | Correct labelled contacts appear. | | |
| SRCH-06 | Search by notes keyword | Correct contact appears with useful snippet. | | |
| SRCH-07 | `/` keyboard shortcut | Search opens/focuses. | | |
| SRCH-08 | Arrow/Enter keyboard navigation | Result selection works. | | |
| SRCH-09 | Escape | Search closes or clears as designed. | | |
| SRCH-10 | Manage labels: create, rename, recolor, delete | Label UI and contact chips update. | | Include field audit for label name. |
| SRCH-11 | Bulk add/remove labels | Selected contacts update. | | Include field audit for label search/create input. |
| SRCH-12 | Bulk edit company | Selected contacts update company. | | Include field audit for company input. |
| SRCH-13 | Merge duplicate contacts | Primary selection, field comparison, and final merged contact are correct. | | |

## Sharing, Family, and Teams

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| SHARE-01 | Create static public share link | Link opens expected contact fields. | | |
| SHARE-02 | Create live Kontax-to-Kontax share | Recipient can accept and view contact. | | |
| SHARE-03 | Revoke share | Recipient loses access. | | |
| SHARE-04 | Shared-with card | Owner sees recipient/access state. | | |
| SHARE-05 | Family create flow | Family group/book created. | | Include field audit for family name. |
| SHARE-06 | Invite family member | Invite email/form works. | | Include field audit for email input. |
| SHARE-07 | Toggle family edit permission | View-only member cannot edit shared fields. | | |
| SHARE-08 | Leave family | Private copy is created; original shared book remains. | | |
| SHARE-09 | Team create flow | Team group created or checkout route starts as expected. | | Include field audit for team name/description. |
| SHARE-10 | Team invite member | Invite, role, and accept flow work. | | Include field audit for invite email. |
| SHARE-11 | Team role changes | Member/admin/owner controls work and audit entries are written. | | |
| SHARE-12 | Team books | Create book, set description, assign permissions. | | Include field audit for book name/description. |
| SHARE-13 | Team audit filters/export | Member/book/type/date filters work; export downloads. | | |

## Sync

Core sync account connection can be smoke-tested when credentials are available. The advanced account sync settings section is included below but may be marked `[skip]` for a normal smoke test.

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| SYNC-01 | `/sync` loads with no accounts | Empty state and add account CTA render. | | |
| SYNC-02 | Add CardDAV account form | Presets update label/server URL; validation errors display inline. | | Include field audit for label, server URL, username, password. |
| SYNC-03 | Add invalid CardDAV credentials | Error appears; user remains signed in. | | |
| SYNC-04 | Add Google OAuth account | OAuth starts and returns to `/sync` if configured. | | |
| SYNC-05 | Add Outlook OAuth account | OAuth starts or shows configured/unconfigured error clearly. | | |
| SYNC-06 | Sync now | Job queues/runs and history updates. | | |
| SYNC-07 | Pause/resume account | Status changes correctly. | | |
| SYNC-08 | Edit CardDAV credentials | Username/password update works. | | Include field audit for username/password. |
| SYNC-09 | Disconnect account | Account removed; imported contacts remain unless design says otherwise. | | |

### Optional: Account Sync Settings

Mark this entire section `[skip]` when the release smoke test is only covering critical paths.

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| ASYNC-01 | Open account Settings panel | Panel opens for selected account; Edit credentials closes if open. | | |
| ASYNC-02 | Direction: Two-way / Import only / Export only | Visibility of conflict/export/address-book sections updates correctly. | | |
| ASYNC-03 | Sync frequency | Plan default, manual only, and allowed intervals save. | | |
| ASYNC-04 | Conflict policy | Remote wins, Kontax wins, Ask me save and display. | | |
| ASYNC-05 | Address books | CardDAV book allowlist saves; read-only books are disabled. | | |
| ASYNC-06 | Auto-label on import | Label selection saves; no-label state works. | | |
| ASYNC-07 | Deletion safety threshold | Numeric field supports middle edits and disabled state. | | Numeric cursor audit required. |
| ASYNC-08 | Sync window | Start/end select controls save; no restriction works. | | |
| ASYNC-09 | Field exclusions | Notes, birthdays, addresses, custom fields toggles save. | | |
| ASYNC-10 | Export filter | Label checkboxes save and empty state means all contacts. | | |
| ASYNC-11 | Notifications | Failure notification toggle saves. | | |
| ASYNC-12 | Retry sensitivity | Default, numeric choices, and never auto-pause save. | | |
| ASYNC-13 | Cancel dirty settings | Changes are discarded. | | |

## Import and Export

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| IE-01 | Upload CSV import | Preview loads; errors/warnings are visible. | | |
| IE-02 | Paste CSV import | Preview loads from textarea. | | Include textarea field audit. |
| IE-03 | Map fields | Standard and custom mappings save for preview. | | Include field audit for custom field name. |
| IE-04 | Multi-value columns | Additional emails/phones/websites import correctly. | | |
| IE-05 | Commit import | Contacts created/updated as previewed. | | |
| IE-06 | Roll back import | Imported contacts revert as designed. | | |
| IE-07 | Save import preset | Preset name saves; can rename/delete later. | | Include field audit for preset name. |
| IE-08 | Export CSV | Download contains selected fields and rows. | | |
| IE-09 | Export vCard | Download imports into a contacts app or parser cleanly. | | |
| IE-10 | Save export preset | Preset name saves; can rename/delete later. | | Include field audit for preset name. |
| IE-11 | Account data export | Request creates job and status updates. | | |

## Settings

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| SET-01 | Profile photo upload/replace/remove | Avatar updates or clear error appears. | | |
| SET-02 | Display name | Saves, validates empty/too long, updates session UI. | | Include field audit. |
| SET-03 | Public card URL claim/change | Availability, invalid chars, confirm modal, cooldown messaging work. | | Include field audit for mid-string handle edits. |
| SET-04 | Change email | Verification email sent; old email remains until verified. | | Include field audit. |
| SET-05 | Change password | Current/new/confirm fields validate; password changes. | | Include field audit plus show/hide buttons. |
| SET-06 | Display preferences | Sort, view mode, date format, name order, week start save and reset. | | |
| SET-07 | Notification preferences | Toggles, digest radios, reminder lead time save. | | |
| SET-08 | Calendar feed | Token create/copy/reset behavior works. | | |
| SET-09 | Public card visibility | Hide card and field toggles affect `/u/{username}`. | | |
| SET-10 | Devices/security sessions | Active session list and revoke work. | | |
| SET-11 | Account deletion flow | Confirmation path works in staging/test only. | | Do not run on production personal account. |

## Contact Photos

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| CPHOTO-01 | Create contact with photo URL | Photo renders in contacts list and detail surfaces after save. | | |
| CPHOTO-02 | Edit contact photo URL (mobile sheet) | Updated photo renders after save and refresh. | | |
| CPHOTO-03 | Replace photo URL | New photo replaces the previous image across list/detail/public views. | | |
| CPHOTO-04 | Clear photo URL | Initials fallback returns everywhere the contact is shown. | | |
| CPHOTO-05 | Public card with visible photo | Public card uses circular crop and matches the saved contact photo. | | |
| CPHOTO-06 | Broken image URL | Layout remains stable; capture console/network notes if image fetch fails. | | |

## Billing and Plans

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| BILL-01 | Pricing page | Plan names/prices/feature matrix render. | | |
| BILL-02 | Checkout starts | Stripe test checkout opens for paid plan. | | Staging/test mode only. |
| BILL-03 | Checkout success | Plan updates and success banner appears. | | |
| BILL-04 | Customer portal | Portal opens for current subscription. | | |
| BILL-05 | Downgrade/cancel | Confirmation and resulting plan state are correct. | | |
| BILL-06 | Failed payment | Banner/notification appears after webhook. | | |
| BILL-07 | Teams billing manager | Owner/billing manager/member visibility and access are correct. | | |
| BILL-08 | Owner transfer | Ownership and billing access move correctly. | | |

## Developer and API

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| DEV-01 | Developer page loads | API docs/token UI visible for eligible plan. | | |
| DEV-02 | Create read-only token | Token shown once; copy works; token can list/read contacts. | | Include field audit for token name. |
| DEV-03 | Create read/write token | Token can create/update/delete via API. | | |
| DEV-04 | Revoke token | Token immediately stops working. | | |
| DEV-05 | API rate limits | Excess requests get expected limit behavior. | | |

## Admin

Run only with an admin account in staging or a safe admin test environment.

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| ADM-01 | Admin route guard | Admin can enter; non-admin gets 403/redirect. | | |
| ADM-02 | User search | Search by email/name works. | | Include field audit. |
| ADM-03 | User detail | Plan/status/activity visible. | | |
| ADM-04 | Plan override | Override applies and audit row is written. | | |
| ADM-05 | Suspend/unsuspend | Suspended user cannot log in; unsuspend restores login. | | |
| ADM-06 | Impersonation | Starts/stops safely and banner is visible. | | |
| ADM-07 | Feature flags | Create/edit/toggle flags safely. | | Include textarea/value field audit. |
| ADM-08 | Broadcast notification | Title/body/link fields validate and send to test target. | | Include field audit. |
| ADM-09 | Admin audit filters | Type/date/user filters work. | | |
| ADM-10 | Metrics page | Loads without server errors. | | |

## Marketing and Public Surfaces

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| PUB-01 | Home page | Loads, nav works, logged-out state correct. | | |
| PUB-02 | Features, security, changelog, about, privacy, terms | Pages load with correct metadata and no layout break. | | |
| PUB-03 | Contact form | Required fields validate; valid submission succeeds. | | Include field audit. |
| PUB-04 | Public card `/u/{username}` | Visible/hidden fields match settings. | | |
| PUB-05 | Public card add-to-Kontax | Prefill opens new contact and can be dismissed. | | |
| PUB-06 | Share token page | Shared contact renders; vCard download works. | | |
| PUB-07 | 404/expired share | Safe error state, no data leak. | | |
| PUB-08 | SEO basics | Canonical URL, title, description, OG image, robots, sitemap. | | |

## Mobile and Responsive Audit

Run the critical path on mobile viewport and at least one tablet width.

| ID | Test | Expected Result | Result | Notes |
|---|---|---|---|---|
| MOB-01 | Login/register/reset | Forms fit; keyboard does not hide submit permanently. | | |
| MOB-02 | Contacts list | Bottom nav, search overlay, row actions work. | | |
| MOB-03 | Create contact | All sections reachable; save bar usable. | | Run field cursor audit on phone, birthday, notes. |
| MOB-04 | Contact detail edit | Header actions fit; save/cancel accessible. | | |
| MOB-05 | Settings pages | Back nav, sidebar/mobile nav, forms fit. | | |
| MOB-06 | Sync page | Account list/detail/settings panels fit. | | Optional if sync skipped. |
| MOB-07 | Family/Teams | Invite/member/book controls fit. | | |
| MOB-08 | Import/export | Upload/paste/preview/mapping usable. | | |
| MOB-09 | Modals and bottom sheets | No clipped buttons; Escape/backdrop behavior okay. | | |
| MOB-10 | Offline/PWA shell | Offline page and manifest icons load. | | |

## Error and Observability Checks

| ID | Check | Expected Result | Result | Notes |
|---|---|---|---|---|
| OBS-01 | Browser console during smoke | No unexpected errors/warnings. | | |
| OBS-02 | Server logs during smoke | No unhandled exceptions. | | |
| OBS-03 | Network tab | No unexpected 4xx/5xx on successful actions. | | |
| OBS-04 | Auth redirects | No accidental logout during server actions. | | |
| OBS-05 | Activity/history | Contact mutations, team/admin actions appear in logs. | | |
| OBS-06 | Email delivery | Verification/reset/invite/security emails arrive within target. | | |

## Bug Report Template

Use one row per issue found.

| Severity | Area | Repro Steps | Expected | Actual | Browser/Viewport | Evidence | Owner |
|---|---|---|---|---|---|---|---|
| P0/P1/P2/P3 | | | | | | | |

For cursor bugs, include:

- Field name and route.
- Initial value.
- Exact caret position before typing.
- Key typed or pasted text.
- Actual final value.
- Actual final caret position.
- Whether the jump happens on each keystroke, after debounce, on blur, or after save.

## Staging Run: June 21, 2026

Environment: `https://kontax.vexon.co`  
Scope: focused field-edit audit only; full smoke test intentionally not run in this pass.  
Account sync: intentionally skipped for this pass.

### What We Verified

- [x] Staging site reachable and serving authenticated routes.
- [x] Login works for the documented smoke account.
- [x] `/contacts`, `/settings/account`, `/settings/profile/card`, `/sync`, and `/u/smoketest42` load successfully.
- [x] Contact detail edit mode opens on staging.
- [x] New contact form exposes the expected editable surfaces, including:
  `First name`, `Surname`, `Company`, `Job title`, `Email`, `Phone`, `Address`, `Birthday`, `Notes`, `Prefix`, `Middle`, `Suffix`, `Nickname`, `Phonetic first`, `Phonetic last`, `Phonetic company`, `Website`, `Related person`, `Significant date`, and `Custom field`.

### Current Blocker

- [~] Mid-string caret verification is blocked in this environment.

The in-app browser runtime available to this run can type into staging inputs, but it does not reliably move the caret away from the end of the field. On plain text inputs in `/contacts/new`, the following all left `selectionStart` at the end of the value:

- `ArrowLeft`
- `Home`
- click-near-start and click-near-middle attempts

Because of that runtime limitation, this pass could not conclusively prove or disprove mid-string editing behavior on staging for generic text fields. Any automated result that looked like `value + typedText` for every field was discarded as non-authoritative because the browser tool itself was not repositioning the caret.

### Phone Field Risk

- [!] Phone country-code edit remains high risk and likely still affected.

Local code inspection strongly matches the bug you described:

- `src/app/_components/phone-country-input.tsx`
- `src/lib/phone-normalization.ts`

`PhoneCountryInput` reparses and rewrites the whole field value on every `onChange` via `emit(event.target.value, false)` and `parsePhoneValue(...)`. That parse path normalizes through `normalizePhoneCandidate(...)`, which can rewrite the displayed phone string while the user is typing. The component only explicitly restores selection after country dropdown changes, and it restores it to the end of the input.

That does not by itself prove the live staging bug without a browser that can place the caret correctly, but it is consistent with:

- cursor jumping to the end while editing the country code
- inability to insert in the middle of the number
- trouble editing partially formatted international numbers

### Practical Outcome

- [~] Full field cursor audit on staging: blocked by browser-runtime caret limitation.
- [~] Phone country-code cursor audit on staging: blocked for live interaction, but code review indicates a likely real defect in `PhoneCountryInput`.
- [skip] Account sync settings section: intentionally skipped.

### Rerun Result

Re-ran the staging check on June 21, 2026 from the in-app browser already open on `/contacts/new`, this time using direct browser-protocol input so the caret could be placed in the middle of fields without relying on the weaker click simulation.

#### Controls That Passed

- `First name`
  - Base: `Alicia`
  - Caret forced to position `2`
  - Typed: `Z`
  - Result: `AlZicia`
  - Final caret: `3`

- `Year (optional)`
  - Base: `2026`
  - Caret forced to position `2`
  - Typed: `9`
  - Result: `20926`
  - Final caret: `3`

These controls show that ordinary text and numeric inputs on staging can preserve a middle caret position under the same test method.

#### Phone Field Reproduced

- `Phone`
  - Base entered: `+44 20 7946 0958`
  - Field normalized before edit to: `+44 2079 460958`
  - Caret forced to position `2` inside the country code
  - Typed: `9`
  - Actual result: `+49 42079460958`
  - Final caret: `15` (end of field)

- `Phone`
  - Base entered: `+44 20 7946 0958`
  - Field normalized before edit to: `+44 2079 460958`
  - Caret forced to position `8` in the local number
  - Typed: `7`
  - Actual result: `+4420797460958`
  - Final caret: `14` (end of field)

#### Conclusion

- [x] Generic text input mid-string editing works on staging.
- [x] Generic numeric input mid-string editing works on staging.
- [!] `PhoneCountryInput` on staging reproduces the bug class the tester reported:
  mid-string edits trigger value rewriting and move the caret to the end.

### Recommended Follow-Up

1. Re-run the field-edit audit in a real desktop browser or a Playwright runtime that can move the caret within inputs.
2. Prioritize a fix in `PhoneCountryInput` so typing does not rewrite the visible value on every keystroke.
3. After the fix, re-run the phone-specific audit first on:
   - new contact
   - contact detail edit
   - second phone row
   - birthday/day/year numeric fields

## Sign-Off

| Criterion | Status | Notes |
|---|---|---|
| Full smoke test complete | | |
| Field edit audit complete | | |
| Phone country-code cursor audit complete | | |
| Account sync settings section skipped or complete | | |
| Mobile pass complete | | |
| P0/P1 issues resolved | | |
| Residual risks documented | | |

Signed off by: ____________________  Date: ____________________
