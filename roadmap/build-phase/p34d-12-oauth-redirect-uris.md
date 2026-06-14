# P34D-12 — Add Production Domain to OAuth App Registrations

## Purpose

Register `https://getkontax.com` as an authorised redirect URI in every OAuth
application used by Kontax (Google Cloud Console for Google Contacts sync, Azure
Portal for Outlook sync), without removing the staging URIs until the migration is
complete.

## Background

OAuth providers validate the `redirect_uri` in every authorisation request against a
registered allowlist. If `https://getkontax.com/api/auth/callback/google` is not
registered, the Google OAuth flow will fail with "redirect_uri_mismatch" the moment a
user on the production domain tries to connect Google Contacts.

Kontax uses OAuth for sync only (not for login). Per the "P27 Google sync OAuth"
memory note, the sync OAuth is independent of any login OAuth but shares the same
`GOOGLE_CLIENT_ID`. The Azure AD app is used for Outlook / Microsoft Graph sync.

The staging URIs (`kontax.vexon.co/...`) must remain registered during the
transition period — users on staging must not be broken while production is being
validated.

## Scope

**In scope**
- Add production redirect URI to the Google OAuth client (sync app)
- Add production redirect URI to the Azure AD app (Outlook sync)
- Verify that staging URI is still present and not removed
- Document which client ID / app serves which purpose

**Out of scope**
- Login OAuth (not implemented — Credentials provider only)
- Any future Google Sign-In OAuth app (if added, it needs its own registration)
- Apple Sign-In or other providers

## Design / Implementation Spec

### Google Cloud Console

1. Navigate to: https://console.cloud.google.com → APIs & Services → Credentials
2. Find the OAuth 2.0 Client ID used for Google Contacts sync. Confirm it matches
   `GOOGLE_CLIENT_ID` in the staging environment.
3. Click "Edit". Under "Authorised redirect URIs", add:
   ```
   https://getkontax.com/api/auth/callback/google
   ```
4. Confirm the following URIs are still present (do not remove them):
   ```
   https://kontax.vexon.co/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google   (development)
   ```
5. Click "Save". The change takes effect within a few minutes.

**Scopes to verify**: confirm the OAuth client has the following scopes authorised:
- `https://www.googleapis.com/auth/contacts` (read/write for sync)
- `https://www.googleapis.com/auth/contacts.readonly` (read-only fallback)

If the app is in "Testing" mode in Google Cloud Console and only test users can
authorise it, it must be moved to "Production" status before go-live. This may
require a Google OAuth verification submission. Check the OAuth consent screen status.

### Azure Portal — App Registration

1. Navigate to: https://portal.azure.com → Azure Active Directory → App registrations
2. Find the Kontax sync app. Confirm it matches `AZURE_AD_CLIENT_ID` in staging.
3. In the app → Authentication → Redirect URIs (Web platform), add:
   ```
   https://getkontax.com/api/auth/callback/azure-ad
   ```
4. Confirm the following URIs remain:
   ```
   https://kontax.vexon.co/api/auth/callback/azure-ad
   http://localhost:3000/api/auth/callback/azure-ad
   ```
5. Click "Save".

**API permissions to verify**: the app must have Microsoft Graph permissions:
- `Contacts.ReadWrite` (for bidirectional sync)
- `User.Read` (basic profile)
These must be "Granted" (not just requested) — check the API permissions panel for
the green "Granted" checkmark.

### Documentation table

Add or update a table in `roadmap/runbooks/oauth-apps.md` (create if it doesn't
exist):

| Provider | Purpose | Client ID | Staging URI | Production URI |
|----------|---------|-----------|-------------|----------------|
| Google | Contacts sync | GOOGLE_CLIENT_ID value | kontax.vexon.co/... | getkontax.com/... |
| Microsoft Azure AD | Outlook sync | AZURE_AD_CLIENT_ID value | kontax.vexon.co/... | getkontax.com/... |

(Do not record client secrets in this table — secrets are in the secrets manager only.)

## Acceptance Criteria

- [ ] `https://getkontax.com/api/auth/callback/google` is registered in Google Cloud
      Console for the sync OAuth client.
- [ ] `https://kontax.vexon.co/api/auth/callback/google` is still registered (not
      removed).
- [ ] Google OAuth consent screen is in "Production" status (not "Testing"), or test
      users include the go-live tester.
- [ ] `https://getkontax.com/api/auth/callback/azure-ad` is registered in Azure Portal.
- [ ] `https://kontax.vexon.co/api/auth/callback/azure-ad` is still registered.
- [ ] Microsoft Graph `Contacts.ReadWrite` is granted (not just requested).
- [ ] `roadmap/runbooks/oauth-apps.md` documents which client ID serves which purpose.
- [ ] After P34D-23 cutover: the Google Contacts sync flow on getkontax.com completes
      without a `redirect_uri_mismatch` error (verified in the post-cutover check in
      P34D-23 step 7).

## Risks / Open Questions

- **Google OAuth verification**: if the Google OAuth app was created with test user
  restrictions and has never been through the Google verification process, external
  users will see a warning screen ("This app isn't verified") and may be blocked
  from authorising. Submit for verification early — Google's review takes 1–7
  business days. If verification is not complete by go-live, only test users can
  connect Google Contacts.
- **Azure AD multi-tenant vs single-tenant**: if the app is single-tenant (only
  users from a specific directory), Outlook sync will only work for users in that
  directory. For a consumer product, the app must be multi-tenant
  (`/common` endpoint). Verify the "Supported account types" setting in Azure.
- **Redirect URI format**: Google is strict about trailing slashes and HTTP vs HTTPS.
  The URI must exactly match `https://getkontax.com/api/auth/callback/google`
  (no trailing slash, HTTPS).

## Documentation

- [ ] External · users — in-app Help: note that Google sync may show a "not verified"
      warning until verification is approved
- [ ] External · developers — /developers: no changes needed
- [x] Internal · ops — `roadmap/runbooks/oauth-apps.md`: create or update with the
      table above
- [ ] Internal · engineering — docs/: no code changes; env vars updated in P34D-11
