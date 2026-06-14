# P34D-04 — Smoke Test: Sharing and Family/Teams

## Purpose

Verify one-time contact share links, family group creation and membership, shared
contact books, and team roles (owner, editor, viewer). Confirm that the Sharing tab
on a shared contact shows correct member and role information.

## Background

Kontax has two sharing models:
1. **One-time / expiring vCard links**: generate a link → recipient downloads a vCard
   without needing a Kontax account.
2. **Family/Team books**: a group book where members see and optionally edit shared
   contacts in real time.

Both flows involve email delivery (invitation emails via SES) and cross-account
visibility. This test requires two test accounts: a "owner" account and a "member"
account (use two browser profiles or an incognito window for the second).

## Scope

**In scope**
- One-time share link creation, use, and expiry (1-use and 7-day)
- Family group: create, invite, accept invitation, shared book visibility
- Shared contact: add, edit by member, owner sees edit
- Remove member from family group
- Team: create, invite with edit role, invite with view-only role, verify permissions
- Sharing tab on contact detail

**Out of scope**
- Live share propagation reliability / conflict resolution (P12-08)
- Sharing with non-Kontax users via vCard (that is the one-time link, covered here)

## Design / Implementation Spec

Prepare two accounts before the test session:
- **Owner account**: main tester's account with some existing contacts
- **Member account**: a second email address registered and verified in Kontax

Run TC-01 through TC-04 with a single browser (one-time link is anonymous for the
recipient). TC-05 onwards require two browser profiles open simultaneously.

Record results in `roadmap/runbooks/smoke-test-results-v1.md` → Sharing section.

## Test Cases

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| TC-01 | Generate one-time share link | Open a contact. Go to Sharing tab → "Share via link". Select "One-time use". Generate link. Copy to clipboard. | Link generated. URL starts with https://kontax.vexon.co/s/ (or /share/). | |
| TC-02 | One-time link — vCard download | Open the copied link in an incognito/private browser window (not logged in). | vCard file download triggers automatically (or a download button appears and clicking it downloads the file). No Kontax login required. | |
| TC-03 | One-time link used — link expired | Try to open the same link again in incognito after TC-02. | Link is expired or returns a "This link has already been used" message. vCard does NOT download again. | |
| TC-04 | 7-day link | Generate another share link, this time with expiry "7 days". Note the URL. Open in incognito. | vCard downloads. (Time-expiry cannot be fast-forwarded in smoke test — note this as verified by config; the 7-day expiry is tested as a unit/integration concern.) | |
| TC-05 | Create family group | As owner account: Settings → Family & Groups → New Family Group. Set name "Test Family". Save. | Group appears in sidebar with a "Family" badge. | |
| TC-06 | Invite family member | In the Family group settings, click "Invite". Enter the member account's email. Send. | Invitation email arrives at the member account within 60s. | |
| TC-07 | Accept family invitation | Log in as member account. Click the invitation link in the email (or find a notification in Kontax). Accept. | "Test Family" shared book appears in the member's sidebar with a "Family" badge. | |
| TC-08 | Shared book visible to both | Both accounts open Kontax side by side. | "Test Family" shared book appears in both accounts. It is currently empty. | |
| TC-09 | Add contact to shared family book | As owner: open a contact → Sharing tab → Add to "Test Family" book. | Contact appears in the "Test Family" book in both accounts. | |
| TC-10 | Member edits shared contact | As member account: open the shared contact. Edit the notes field. Save. | Edit is saved without error. | |
| TC-11 | Owner sees member's edit | As owner account: open the same shared contact. | The notes edit from TC-10 is visible. (May require a page refresh if not real-time.) | |
| TC-12 | Remove member from family group | As owner: go to Family group settings. Remove the member. Confirm. | A confirmation dialog appears. After confirm: shared book disappears from the member's sidebar. | |
| TC-13 | Shared book gone from member | Log in as member. Check sidebar. | "Test Family" book is no longer in the member's sidebar. | |
| TC-14 | Create team | As owner: Settings → Teams → New Team. Set name "Test Team". Save. | Team appears in sidebar. | |
| TC-15 | Invite with edit role | In Test Team settings, invite member account with "Editor" role. Member accepts. | Member account sees Test Team book. | |
| TC-16 | Editor can edit shared team contact | Owner adds a contact to Test Team book. Member opens it and edits a field. | Edit saves successfully. | |
| TC-17 | Invite with view-only role | Invite a third account (or re-invite with role change) as "Viewer". | Third account sees Test Team book. | |
| TC-18 | Viewer cannot edit | As viewer account, open a contact in the Test Team book. Attempt to edit a field. | Edit controls are disabled, hidden, or the save fails with "insufficient permissions". No silent data corruption. | |
| TC-19 | Sharing tab shows members and roles | As owner: open a contact that is in the Test Team book. Go to Sharing tab. | All team members shown with correct role badges (Editor, Viewer). Owner marked as Owner. | |

## Acceptance Criteria

- All 19 test cases pass.
- Invitation emails arrive within 60 seconds.
- Shared book changes are visible to both accounts (within one page refresh maximum).
- Role enforcement (TC-18) is a hard check — viewer must not be able to edit. A
  failure here is P0.
- Results recorded in `roadmap/runbooks/smoke-test-results-v1.md`.

## Risks / Open Questions

- TC-03 (one-time link expiry on second use) depends on the link-use flag being set
  atomically. If the first request is slow and a second request hits simultaneously,
  both might succeed — this edge case is out of scope for smoke testing but should
  be flagged if TC-03 unexpectedly passes on the second try.
- Real-time propagation (TC-10 → TC-11): if the app uses polling rather than
  WebSockets for shared book updates, a page refresh may be needed. The test should
  note whether the update appeared automatically or required a reload.
- Confirm the invitation email includes a deep link that works for both logged-in and
  logged-out recipients (if not logged in, should redirect through login then to the
  accept flow).

## Documentation

- [ ] External · users — in-app Help: sharing flows are complex; confirm help article
      exists or flag for P34 docs sprint
- [ ] External · developers — /developers: no changes needed
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: record results here
- [ ] Internal · engineering — docs/: no code changes in this ticket
