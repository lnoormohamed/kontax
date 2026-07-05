# P47-07 — OAuth redirect URIs: Google (+ People-API verification) & Microsoft

**Phase:** 47 · **Workstream:** B · **Priority:** P1 · **Depends on:** —

## Objective

Re-point the Google and Microsoft OAuth apps at the production origin and start
Google's sensitive-scope verification — the **longest external pole in the
phase**. Start on day one; it does not block other tickets.

## Google Contacts sync (P27-01)

1. In Google Cloud Console → Credentials, add the prod authorised redirect URI.
   Decide the origin **once** (P47-11): the app currently references both
   `app.getkontax.com/api/sync/google/callback` (`.env.example`) and
   `getkontax.com` (infra memory). Set `GOOGLE_REDIRECT_URI` to match the chosen
   origin exactly — a mismatch is `redirect_uri_mismatch` at connect time.
2. **People-API sensitive-scope verification** — the `contacts` scope is
   sensitive and requires Google app verification for general availability
   (**2–6 weeks**). Submit the OAuth consent screen for verification now; add
   the real users as test users so QA can proceed meanwhile.
3. Enable the People API on the prod project if using a separate project.
4. Confirm `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` are set in Coolify (P47-05) —
   the connector is only shown to users when all three are present.

## Microsoft Outlook sync (P27-04)

1. In Azure → App registrations, add the prod redirect URI; set
   `MICROSOFT_REDIRECT_URI` to match.
2. Confirm delegated Graph permissions: `Contacts.ReadWrite`, `User.Read`,
   `offline_access`.
3. `MICROSOFT_TENANT_ID` = `common` (personal + work) unless restricting.
4. Confirm all four `MICROSOFT_*` vars set in Coolify.

## Acceptance

- Google + Microsoft "Connect" flows complete on the live origin with no
  `redirect_uri_mismatch`; a test connection pulls contacts.
- Google verification **submitted** (status recorded; general availability may
  land after go-live — note the test-user workaround in the checklist).
- Redirect URIs recorded on the P47-01 checklist with the chosen canonical origin.

## References

- `.env.example` §Google/Microsoft OAuth · env-secrets §Google/Microsoft sync
- Depends on the origin decision in [P47-11](p47-11-url-host-audit-security-headers.md)
</content>
