# P34D-07 — Smoke Test: Public Card, Developer API, and Notifications

## Purpose

Verify that public contact cards are correctly gated by field-visibility settings,
that the developer API (v1) accepts Bearer tokens and returns correct responses with
rate limit headers, and that birthday reminders and notification bell behaviour work
end-to-end.

## Background

Kontax has three features covered here:
1. **Public card** (`/u/{username}`): a shareable page showing only the fields the
   user has configured as visible. No login required.
2. **Developer API** (`api.getkontax.com/v1`): REST API with Bearer token auth.
   Tokens are created in Settings → Developer.
3. **Notifications**: birthday reminders triggered by a scheduled job, plus in-app
   notifications for sharing events. A bell icon with unread badge sits in the top
   bar.

## Scope

**In scope**
- Claim a username, verify public card is accessible
- Field visibility toggle — immediate effect on public card
- "Add to Kontax" button behaviour for logged-in vs logged-out visitors
- Create an API token, use it for GET /contacts and POST /contacts
- Rate limit headers on v1 responses
- Birthday reminder notification (manual job trigger for smoke test)
- Notification bell badge count and mark-all-read

**Out of scope**
- API pagination edge cases (load testing)
- Webhook delivery for API events (not in scope for v1)
- Push notification delivery to mobile (separate PWA concern)

## Design / Implementation Spec

The API base URL is `https://api.getkontax.com/v1` in production. On staging, use
`https://kontax.vexon.co/api/v1` (or however the staging API is routed — confirm
before running TC-08).

For TC-10 (birthday reminder), if the scheduled job cannot be triggered via a UI
button, trigger it by calling the job endpoint directly:
```
POST /api/jobs/birthday-reminders
Authorization: Bearer <admin-token>
```
or by temporarily setting a contact's birthday to today's date and running the job
manually. Document the trigger method in the test results.

Record results in `roadmap/runbooks/smoke-test-results-v1.md` → Public Card, API &
Notifications section.

## Test Cases

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| TC-01 | Claim a username | Go to Settings → Public Profile. Enter a username (e.g. "smoketest42"). Save. | Username is claimed. No conflict error. A URL is shown: https://kontax.vexon.co/u/smoketest42. | |
| TC-02 | Public card accessible without login | Open the public card URL in an incognito browser. | Page loads without requiring login. Contact's configured public fields are shown. | |
| TC-03 | Only configured fields shown | Configure: show email, hide phone, hide address. Open public card in incognito. | Email is visible. Phone number is NOT shown. Address is NOT shown. | |
| TC-04 | Toggle field off → hidden on public card | Toggle email visibility off. Reload public card. | Email is no longer visible on the public card. No page rebuild required (dynamic). | |
| TC-05 | "Add to Kontax" — logged in | Open the public card while logged in to a DIFFERENT Kontax account (second browser). Click "Add to Kontax". | A create-contact form opens pre-filled with the public card's visible fields (name, email, etc.). | |
| TC-06 | "Add to Kontax" — logged out | Open the public card in incognito (not logged in). Click "Add to Kontax". | A vCard file download is triggered. The vCard contains the same visible fields. No login prompt for this action. | |
| TC-07 | Create API token | Log in. Go to Settings → Developer (or API Tokens). Click "Create token". Enter a label. | Token is displayed once in a modal. Copy it. A new token row appears in the token list with the label. | |
| TC-08 | GET /contacts with Bearer token | Run: `curl -H "Authorization: Bearer <token>" https://kontax.vexon.co/api/v1/contacts` | Response is 200 JSON with an array of contacts. `Content-Type: application/json` header present. | |
| TC-09 | POST /contacts with Bearer token | Run: `curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"firstName":"APICreated","lastName":"Contact"}' https://kontax.vexon.co/api/v1/contacts` | Response is 201. The new contact appears in Kontax app. | |
| TC-10 | Rate limit headers present | Check the response headers from TC-08 or TC-09. | Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` (or equivalent) are present on every v1 response. | |
| TC-11 | Birthday reminder job | Find or create a contact with birthday = tomorrow's date. Trigger the birthday reminders job (via admin endpoint or manual script). | A notification appears in the notification bell for the contact's upcoming birthday. | |
| TC-12 | Notification bell badge count | After TC-11, look at the bell icon in the top navigation bar. | The bell shows a badge with the unread notification count (≥1). | |
| TC-13 | Mark all notifications read | Click the bell. In the notification dropdown/panel, click "Mark all as read" (or equivalent). | All notifications are marked read. The badge disappears from the bell icon. | |

## Acceptance Criteria

- All 13 test cases pass.
- TC-03 and TC-04 (field visibility) are P0: if a field marked "hidden" is visible on
  the public card, that is a privacy failure and blocks go-live.
- TC-10 (rate limit headers): absence of rate limit headers is P1 (required for API
  consumers to self-regulate).
- Results recorded in `roadmap/runbooks/smoke-test-results-v1.md`.

## Risks / Open Questions

- API subdomain (`api.getkontax.com`) requires a separate DNS CNAME and Coolify
  routing rule. Confirm this is set up in P34D-14/15 before running TC-08 on the
  production domain.
- The birthday job may need a test double or manual trigger — confirm the mechanism
  with the infra owner before the test session.
- Public card caching: if the public card page is cached at the CDN or Next.js cache
  level, TC-04 (immediate field visibility change) may not take effect instantly.
  Test with a hard refresh or cache-busting URL.
- Username availability: if "smoketest42" is taken, use a different handle. The
  username claim should be idempotent for the same owner.

## Documentation

- [ ] External · users — in-app Help: public card and API token creation should be
      documented
- [x] External · developers — /developers: API v1 reference should be live before
      go-live (P29-07); confirm it is updated
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: record results here
- [ ] Internal · engineering — docs/: no code changes in this ticket
