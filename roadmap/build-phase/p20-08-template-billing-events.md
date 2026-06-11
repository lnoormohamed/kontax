# P20-08 — Template: Billing Event Emails

## Purpose

Users need email notifications for billing events they must act on: payment failure, trial ending, and successful plan changes. These emails are triggered from the Stripe webhook handler (P19-03/P19-04) and the trial-ending event. This ticket creates the templates and the callable functions Phase 19 stubs need.

## Scope

**In scope:**
- `PaymentFailedTemplate` — payment failed, link to update payment method
- `TrialEndingTemplate` — trial ends in N days, link to add payment method
- `PlanChangedTemplate` — upgrade or downgrade confirmation
- `AccountDeletionScheduledTemplate` — 30-day deletion countdown (P18-09)
- `AccountSuspendedTemplate` — admin suspension notice with appeal link (called by P21-05)
- Callable functions for each that Phase 19 and Phase 21 stubs call

---

## Design / Implementation Spec

### `PaymentFailedTemplate`

```tsx
// src/emails/billing-event.tsx (all billing templates in one file)

export function PaymentFailedTemplate({
  planName, graceEndsAt, updatePaymentUrl,
}: { planName: string; graceEndsAt: Date; updatePaymentUrl: string }) {
  const daysLeft = Math.ceil((graceEndsAt.getTime() - Date.now()) / 86400000);
  return (
    <EmailLayout preview={`Action required: your Kontax payment failed`}>
      <Text style={headingStyle}>Payment failed</Text>
      <Text style={bodyStyle}>
        We couldn't process your payment for Kontax {planName}. Please update your
        payment method within {daysLeft} day{daysLeft !== 1 ? "s" : ""} to keep your plan active.
      </Text>
      <Section style={{ marginBottom: "24px" }}>
        <EmailButton href={updatePaymentUrl}>Update payment method →</EmailButton>
      </Section>
      <Text style={mutedStyle}>
        If your payment isn't updated by {graceEndsAt.toLocaleDateString()}, your account
        will move to the Free plan.
      </Text>
    </EmailLayout>
  );
}
```

### `TrialEndingTemplate`

```tsx
export function TrialEndingTemplate({
  daysLeft, addPaymentUrl,
}: { daysLeft: number; addPaymentUrl: string }) {
  return (
    <EmailLayout preview={`Your Kontax Pro trial ends in ${daysLeft} days`}>
      <Text style={headingStyle}>Your trial ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</Text>
      <Text style={bodyStyle}>
        You've been enjoying Kontax Pro free during your trial. Add a payment method before
        your trial ends to continue with Pro features.
      </Text>
      <Section style={{ marginBottom: "24px" }}>
        <EmailButton href={addPaymentUrl}>Add payment method →</EmailButton>
      </Section>
      <Text style={mutedStyle}>
        If you don't add a payment method, your account will move to the Free plan at the
        end of your trial. Your contacts will not be deleted.
      </Text>
    </EmailLayout>
  );
}
```

### `PlanChangedTemplate`

```tsx
export function PlanChangedTemplate({
  fromPlan, toPlan, effectiveDate,
}: { fromPlan: string; toPlan: string; effectiveDate?: Date }) {
  const isUpgrade = /* determine from plan rank */ true;
  return (
    <EmailLayout preview={`Your Kontax plan has been updated`}>
      <Text style={headingStyle}>
        {isUpgrade ? `Welcome to ${toPlan}` : `Plan changed to ${toPlan}`}
      </Text>
      <Text style={bodyStyle}>
        {isUpgrade
          ? `Your Kontax account has been upgraded from ${fromPlan} to ${toPlan}. Your new features are active now.`
          : `Your Kontax plan has been changed from ${fromPlan} to ${toPlan}${effectiveDate ? ` effective ${effectiveDate.toLocaleDateString()}` : ""}.`
        }
      </Text>
    </EmailLayout>
  );
}
```

### `AccountDeletionScheduledTemplate`

```tsx
export function AccountDeletionScheduledTemplate({
  scheduledDeleteAt, cancelUrl,
}: { scheduledDeleteAt: Date; cancelUrl: string }) {
  return (
    <EmailLayout preview="Your Kontax account is scheduled for deletion">
      <Text style={headingStyle}>Account deletion scheduled</Text>
      <Text style={bodyStyle}>
        Your Kontax account is scheduled to be permanently deleted on{" "}
        {scheduledDeleteAt.toLocaleDateString()}. All your contacts and data will be removed.
      </Text>
      <Text style={bodyStyle}>
        Changed your mind? Sign back in to cancel the deletion.
      </Text>
      <Section style={{ marginBottom: "24px" }}>
        <EmailButton href={cancelUrl}>Cancel deletion →</EmailButton>
      </Section>
    </EmailLayout>
  );
}
```

### `AccountSuspendedTemplate`

```tsx
export function AccountSuspendedTemplate({
  reason, supportUrl,
}: { reason: string; supportUrl: string }) {
  return (
    <EmailLayout preview="Your Kontax account has been suspended">
      <Text style={{ color: tokens.red, fontSize: "13px", fontWeight: "600",
        textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
        Account suspended
      </Text>
      <Text style={headingStyle}>Your account has been suspended</Text>
      <Text style={bodyStyle}>
        Your Kontax account has been temporarily suspended. You will not be able to sign in
        while the suspension is active.
      </Text>
      <Section style={{ backgroundColor: "#f4f4f5", borderRadius: "6px",
        padding: "12px 16px", marginBottom: "24px" }}>
        <Text style={{ color: tokens.secondary, fontSize: "13px", margin: "0" }}>
          Reason: {reason}
        </Text>
      </Section>
      <Text style={bodyStyle}>
        If you believe this is an error, please contact Kontax support.
      </Text>
      <Section style={{ marginBottom: "24px" }}>
        <EmailButton href={supportUrl}>Contact support →</EmailButton>
      </Section>
    </EmailLayout>
  );
}
```

### `sendAccountSuspendedEmail` callable

```typescript
export async function sendAccountSuspendedEmail(params: {
  userId: string;
  reason: string;
}): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { email: true },
  });
  if (!user) return;

  const { html, text } = await renderEmail(
    <AccountSuspendedTemplate
      reason={params.reason}
      supportUrl={`${process.env.APP_URL}/support`}
    />
  );

  // Bypasses suppression check — user must be notified even if emailStatus is BOUNCED
  await sendEmail({ to: user.email, subject: "Your Kontax account has been suspended", html, text });
}
```

P21-05 (`suspendAccount`) calls `sendAccountSuspendedEmail` after the DB update. The email is fire-and-forget — a send failure does not prevent the suspension from taking effect.

---

### Wire into Phase 19 stubs

In `src/server/stripe-handlers.ts`, fill in `handleTrialWillEnd`:
```typescript
await sendTrialEndingEmail({ userId: customer.userId, daysLeft: 3 });
```

In `handleInvoicePaymentFailed`, after setting GRACE:
```typescript
await sendPaymentFailedEmail({ userId: customer.userId, graceEndsAt, planName });
```

In `handleSubscriptionUpserted`, on plan change:
```typescript
if (fromPlan !== planInfo.plan) {
  await sendPlanChangedEmail({ userId, fromPlan, toPlan: planInfo.plan });
}
```

---

## Acceptance Criteria

- All five templates (`PaymentFailed`, `TrialEnding`, `PlanChanged`, `AccountDeletionScheduled`, `AccountSuspended`) render correctly in the React Email dev server.
- `sendPaymentFailedEmail` is called from the Stripe webhook handler on `invoice.payment_failed`.
- `sendTrialEndingEmail` is called from `handleTrialWillEnd`.
- `sendPlanChangedEmail` is called when a plan upgrade or downgrade is applied.
- `sendAccountSuspendedEmail` is callable by P21-05 (`suspendAccount`); bypasses suppression check.
- Billing emails respect the notification suppression check (`sendEmail` handles this); suspension email does not.

---

## Risks and Open Questions

- **Suspended user receiving email:** if `emailStatus = BOUNCED`, the `sendEmail` suppression check prevents delivery. `sendAccountSuspendedEmail` intentionally bypasses suppression because the user must be notified — but if the address hard-bounced, the notification won't reach them anyway. Accept this as a known limitation for v1; document it as a support case.
- **`isUpgrade` determination in `PlanChangedTemplate`:** the template currently has a placeholder comment. Implement plan rank comparison using the `PLAN_RANK` constant from `src/server/billing.ts` (or equivalent) so the upgrade/downgrade determination is not duplicated across callers.
- **Trial ending email timing:** `trial_will_end` Stripe events fire 3 days before the trial ends. Confirm the `daysLeft: 3` value passed to `sendTrialEndingEmail` is computed from the webhook payload (`subscription.trial_end`), not hard-coded, so it remains accurate if the trial period length ever changes.
