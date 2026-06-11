# Runbook — Amazon SES Setup (P20-01)

Step-by-step guide to provision Amazon SES for Kontax transactional email
(verification, password reset, share invites, billing, security alerts).

The app runs **without** SES — when the env vars below are absent, `sendEmail`
([src/server/email.ts](../../src/server/email.ts)) logs to the console and the
product falls back to in-app notifications. Follow this runbook only to enable
real delivery.

---

## 1. Verify the sending domain

1. AWS Console → **SES → Verified identities → Create identity → Domain**.
2. Enter `kontax.app`. Enable **Easy DKIM** (RSA 2048-bit).
3. SES generates DNS records. Add them to the `kontax.app` zone:

**DKIM — three CNAME records** (tokens from the SES console):

```
{token1}._domainkey.kontax.app  CNAME  {token1}.dkim.amazonses.com
{token2}._domainkey.kontax.app  CNAME  {token2}.dkim.amazonses.com
{token3}._domainkey.kontax.app  CNAME  {token3}.dkim.amazonses.com
```

**SPF** — add to the existing root TXT record, or create one:

```
TXT  kontax.app  "v=spf1 include:amazonses.com ~all"
```

**DMARC** (recommended):

```
TXT  _dmarc.kontax.app  "v=DMARC1; p=quarantine; rua=mailto:dmarc@kontax.app"
```

> DKIM CNAMEs can take up to **72 hours** to propagate. Start this early — it can
> run in parallel with the rest of Phase 20. Identity status flips to *Verified*
> once SES sees the records.

## 2. Create the IAM sender

IAM → Users → **Create user** `kontax-ses-sender` (programmatic access). Attach
this inline policy (substitute `{region}` and `{account-id}`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "arn:aws:ses:{region}:{account-id}:identity/kontax.app"
    },
    {
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "arn:aws:sns:{region}:{account-id}:kontax-email-events"
    }
  ]
}
```

Generate an access key pair and store it as the env vars in §4.

## 3. SNS topic for bounces & complaints

1. SNS → **Create topic** (Standard) named `kontax-email-events` in the SES region.
2. SES → Verified identity `kontax.app` → **Notifications** → set **Bounce** and
   **Complaint** feedback to publish to `kontax-email-events`.
3. Add an HTTPS subscription to the topic pointing at
   `{APP_URL}/api/ses/events` — the endpoint lands in **P20-10**. (Confirm the
   subscription after that endpoint is deployed; SNS sends a one-time
   confirmation request the endpoint must echo back.)

## 4. Application env vars

Set these (see [.env.example](../../.env.example)). All four are required for
`SES_CONFIGURED` to be true — if any is missing, email stays in console mode.

```
AWS_ACCESS_KEY_ID=AKIA…
AWS_SECRET_ACCESS_KEY=…
AWS_SES_REGION=us-east-1          # region the identity was verified in
EMAIL_FROM=no-reply@kontax.app    # must be on the verified domain
```

Validation: start the app. With the vars set you should **not** see
`[email] SES not configured` in the logs.

## 5. Sandbox → production lift

New SES accounts are sandboxed — they can only send to **verified** addresses.

1. SES → **Account dashboard → Request production access**.
2. Mail type: **Transactional**.
3. Use case: "Transactional email for a SaaS contacts product — email
   verification, password reset, and contact-share notifications. Recipients are
   account holders who opted in by signing up."
4. Requested sending rate: start at the default (14 msg/s is plenty).
5. AWS typically reviews within 24 hours.

No code changes are needed — the SDK behaves identically in sandbox and
production. While sandboxed, add your own address as a verified identity to test
end to end.

## 6. Credential rotation

The `kontax-ses-sender` IAM user is scoped to email only, so a leaked key's blast
radius is limited to sending mail. Rotate keys ~every 90 days:

1. IAM → `kontax-ses-sender` → create a **second** access key.
2. Update `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` and redeploy.
3. Confirm sends succeed, then **deactivate and delete** the old key.

---

## Acceptance checklist

- [ ] `kontax.app` shows **Verified** in SES; DKIM CNAMEs live in DNS.
- [ ] SPF and DMARC TXT records present.
- [ ] IAM user `kontax-ses-sender` exists with the policy above.
- [ ] `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SES_REGION` /
      `EMAIL_FROM` documented in `.env.example` and set in the deploy environment.
- [ ] SNS topic `kontax-email-events` created; SES bounce/complaint feedback
      points at it.
- [ ] Test email sent from the SES console to a verified address in sandbox.
