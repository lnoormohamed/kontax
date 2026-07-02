# SEC-03 — Verify SNS Signatures on the SES Events Webhook (Blind SSRF)

> Severity: **MEDIUM** · unauthenticated, blind, attacker controls full URL
> Status: **DONE** — implemented in `src/server/sns-verify.ts` + the events route.

## Outcome

Added `verifySnsSignature()` (Node `crypto`, no new dependency): rebuilds the
canonical SNS string-to-sign, fetches the signing cert **only** from an
`https://sns.<region>.amazonaws.com` host, and verifies the RSA signature
(SHA1 for SignatureVersion 1, SHA256 for 2). The route now:
- rejects any message that isn't signature-valid with `403` before acting on it
  (closes forged bounce/complaint tampering), and
- fetches `SubscribeURL` only when it passes the same AWS-SNS host allowlist
  (`isSnsHttpsUrl`), closing the SSRF even though the URL is already
  signature-covered.

Verified locally: valid signatures verify and tampered messages are rejected for
both signature versions (throwaway-cert test); the host allowlist rejects
internal IPs and suffix/infix/path spoofing while accepting real SNS URLs;
`tsc` clean; production build passes. Fails closed on any error.

## Purpose

Stop an unauthenticated caller from making the server issue arbitrary outbound
HTTP GET requests to attacker-chosen hosts via the SES/SNS webhook.

## Background

The SES events endpoint is public (`src/middleware.ts:41`) and performs **no SNS
signature verification** — the code comment explicitly defers it to "production
hardening". On a `SubscriptionConfirmation` message it fetches a fully
attacker-controlled URL:

```ts
// src/app/api/ses/events/route.ts:55
if (messageType === "SubscriptionConfirmation") {
  if (body.SubscribeURL) {
    await fetch(body.SubscribeURL).catch(...);
  }
}
```

The URL's host **and** protocol are attacker-controlled, so this is a genuine
SSRF (not merely path control). It is blind — the response body is not returned
to the caller — but it still lets an external actor trigger requests from inside
the deployment's network segment.

### Exploit

Anyone POSTs:

```json
{ "Type": "SubscriptionConfirmation", "SubscribeURL": "http://192.168.1.193:5432/" }
```

and the server issues a GET to that internal address. Given the documented
internal topology (DB at `192.168.1.193`, MinIO, cron LXC, Coolify), this can be
used to probe/reach internal-only services and cloud metadata endpoints from the
app container.

## Scope

**In scope**
- SNS message authentication on `src/app/api/ses/events/route.ts`
- Constraining the `SubscribeURL` fetch to legitimate AWS SNS hosts

**Out of scope**
- Reworking the bounce/complaint handling logic itself
- Other webhooks (Stripe already verifies its signature)

## Dependencies

- None functionally, but validate against a real SNS subscription-confirmation
  payload in a non-prod topic before shipping.

## Design / Implementation Spec

### Desired behavior
- Only genuine, signature-valid SNS messages are processed.
- The `SubscribeURL` is only fetched when it points at an AWS SNS endpoint.

### Suggested implementation direction
- Verify the SNS message signature before acting on any message:
  - confirm `SigningCertURL` is an `https://sns.<region>.amazonaws.com/...` host
    (reject anything else outright),
  - fetch and cache the signing cert, validate the message signature over the
    canonical string per the SNS signature spec.
  - The `sns-validator` library (or an equivalent verified in-house
    implementation) covers this.
- Independently, restrict the `SubscribeURL` fetch to hosts matching
  `^https://sns\.[a-z0-9-]+\.amazonaws\.com/` even after signature validation, as
  belt-and-braces.
- Optionally require a shared-secret path segment on the webhook URL as an extra
  gate, though signature verification is the real fix.

### Engineering notes
- Keep returning `2xx` for malformed/ignored messages so SNS doesn't hot-loop
  retries, but reject signature failures explicitly.
- The bounce/complaint DB updates (`emailStatus`) should only run for verified
  `Notification` messages.

## Acceptance Criteria
- A forged POST with an arbitrary `SubscribeURL` (e.g. an internal IP) is
  rejected and triggers no outbound fetch.
- A genuine SNS `SubscriptionConfirmation` (valid signature, SNS host) still
  confirms the subscription.
- Real bounce/complaint notifications still suppress the affected recipients.

## Documentation
- [ ] External · users
- [x] Internal · engineering
- [x] Internal · QA
