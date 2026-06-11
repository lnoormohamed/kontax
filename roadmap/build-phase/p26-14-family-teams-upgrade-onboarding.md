# P26-14 — Family/Teams Upgrade Onboarding

## Purpose

Trigger a dedicated 3-step onboarding flow immediately after a user upgrades to Family or creates a Teams group, guiding them through: inviting members, setting up the shared address book, and configuring permissions. Users who complete this flow have dramatically higher retention on Family/Teams plans — the shared book is the core value and it requires a collaborator to feel useful.

## Background

The P26-DB07 design brief specifies this flow in detail. The trigger is the Stripe checkout success event (Phase 19 webhook). The flow uses the existing Phase 13 (Family) and Phase 14 (Teams) infrastructure for creating groups and inviting members — this ticket adds only the onboarding wrapper UI and state tracking on top.

## Scope

**In scope:**
- `UserOnboardingState.upgradedToFamily` / `upgradedToTeams` timestamp fields — set by the Stripe webhook when a first Family/Teams subscription activates
- 3-step onboarding flow for Family (invite members → set up shared book → done) and Teams (invite members → create first book → configure permissions → done)
- `UserOnboardingState.familyOnboardingCompletedAt` / `teamsOnboardingCompletedAt` for tracking completion
- Route: `/onboarding/family` and `/onboarding/teams` — full-screen pages, no sidebar
- Stripe webhook extension: on `customer.subscription.created` for a Family/Teams plan, set the `upgradedToFamily/Teams` timestamp and redirect to the onboarding route

**Out of scope:**
- The Family group creation and invite server actions (Phase 13)
- The Teams group and address book creation server actions (Phase 14)
- These tickets implement the data model and actions; this ticket wraps them in the onboarding UI

---

## Design / Implementation Spec

### Schema additions

```prisma
// On UserOnboardingState:
upgradedToFamilyAt         DateTime?
upgradedToTeamsAt          DateTime?
familyOnboardingCompletedAt DateTime?
teamsOnboardingCompletedAt  DateTime?
```

Run: `prisma migrate dev --name add-onboarding-upgrade-state`

### Stripe webhook extension

In `src/server/stripe-handlers.ts`, after `handleSubscriptionUpserted` when `plan === "FAMILY"` or `"TEAMS"`:

```typescript
if (planInfo.plan === "FAMILY" || planInfo.plan === "TEAMS") {
  const isFirstUpgrade = await db.userOnboardingState.findFirst({
    where: {
      userId,
      [planInfo.plan === "FAMILY" ? "upgradedToFamilyAt" : "upgradedToTeamsAt"]: null,
    },
  });

  if (isFirstUpgrade) {
    await db.userOnboardingState.update({
      where: { userId },
      data: {
        [planInfo.plan === "FAMILY" ? "upgradedToFamilyAt" : "upgradedToTeamsAt"]: new Date(),
      },
    });
    // The checkout success redirect (P19-02 callbackUrl) should route to /onboarding/family or /onboarding/teams
  }
}
```

### Onboarding route redirect

In `POST /api/billing/checkout-success` (P19-02), after the session is confirmed:
```typescript
const onboardingState = await db.userOnboardingState.findUnique({ where: { userId } });
if (onboardingState?.upgradedToFamilyAt && !onboardingState?.familyOnboardingCompletedAt) {
  return redirect("/onboarding/family");
}
if (onboardingState?.upgradedToTeamsAt && !onboardingState?.teamsOnboardingCompletedAt) {
  return redirect("/onboarding/teams");
}
return redirect("/contacts");
```

### Family onboarding — 3 steps

`src/app/onboarding/family/page.tsx` — full-screen, centred card, no sidebar.

**Step 1 — Invite members:**
```tsx
<OnboardingStep step={1} total={3} title="Welcome to Kontax Family 🎉"
  subtitle="Invite your family members">
  <InviteByEmailForm onInvite={sendFamilyInvite} maxMembers={5} /> {/* owner is 1 of 6 */}
  <p style={{ color: "#8b938c", fontSize: 13 }}>
    You can invite up to 5 members. They'll receive an email and can accept from any device.
  </p>
  <OnboardingActions
    primary={{ label: "Continue →", onClick: goToStep2 }}
    secondary={{ label: "Skip for now", onClick: goToStep2 }}
  />
</OnboardingStep>
```

**Step 2 — Set up shared book:**
```tsx
<OnboardingStep step={2} total={3} title="Set up your shared address book"
  subtitle="Your family will all see this book">
  <input placeholder="Family Contacts" value={bookName} onChange={setBookName}
    style={{ height: 44, borderRadius: 12, border: "1px solid #d8ddd6", padding: "0 16px",
      fontSize: 14, width: "100%" }} />
  <div style={{ marginTop: 16 }}>
    <label>Who can edit?</label>
    <RadioGroup value={canEdit} onChange={setCanEdit}>
      <Radio value="all">Everyone (recommended)</Radio>
      <Radio value="admins">Admins only</Radio>
    </RadioGroup>
  </div>
  <OnboardingActions
    primary={{ label: "Create book →", onClick: handleCreateBook }}
    secondary={{ label: "Skip for now", onClick: goToStep3 }}
  />
</OnboardingStep>
```

**Step 3 — Done:**
```tsx
<OnboardingStep step={3} total={3} title="✓ Your family group is ready!">
  <ul style={{ color: "#5c655e", fontSize: 14 }}>
    {invitedCount > 0 && <li>{invitedCount} invite{invitedCount > 1 ? "s" : ""} sent</li>}
    {bookCreated && <li>Shared address book "{bookName}" created</li>}
    <li>You can manage your group in Settings → Family</li>
  </ul>
  <OnboardingActions primary={{ label: "Go to contacts →", href: "/contacts" }} />
</OnboardingStep>
```

On completion, set `familyOnboardingCompletedAt`.

### `OnboardingStep` reusable component

```tsx
function OnboardingStep({ step, total, title, subtitle, children }: ...) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ fontSize: 13, color: "#8b938c", marginBottom: 8 }}>
        Step {step} of {total}
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1d2823", marginBottom: 8 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 15, color: "#5c655e", marginBottom: 24 }}>{subtitle}</p>}
      {children}
    </div>
  );
}
```

### Teams onboarding (4 steps)

Same pattern as Family but with 4 steps: invite members → create first address book → assign member roles → done. The 4-step indicator replaces the 3-step one.

---

## Acceptance Criteria

- The Stripe webhook sets `upgradedToFamilyAt` / `upgradedToTeamsAt` on the first Family/Teams subscription.
- After checkout success, users with an incomplete upgrade onboarding are redirected to `/onboarding/family` or `/onboarding/teams`.
- All 3 Family onboarding steps render; the progress indicator reflects the current step.
- Inviting a member from the onboarding step calls the Phase 13 `inviteFamilyMember` server action.
- Creating the shared book from the onboarding step calls the Phase 13 `createSharedAddressBook` action.
- Each step has a "Skip for now" option that advances to the next step.
- Completing or skipping all steps sets `familyOnboardingCompletedAt`.
- Revisiting `/onboarding/family` after completion redirects to `/contacts`.
- The onboarding renders correctly on mobile (single column, full-screen).

---

## Risks and Open Questions

- **Phase 13/14 dependency:** the invite and book creation server actions are implemented in Phase 13 (Family) and Phase 14 (Teams). If Phase 26 ships before those phases, the onboarding buttons should show a "Coming soon" disabled state rather than failing. Add a feature flag check (`FEATURES.FAMILY_ONBOARDING`) to conditionally enable the invite and book creation buttons.
- **Checkout success redirect timing:** the Stripe webhook fires asynchronously — the `upgradedToFamilyAt` field may not be set by the time the user returns from the Stripe checkout redirect. Add a 1-second delay or a polling check on the checkout success page before attempting the redirect. Alternatively, the checkout success page reads the Stripe session directly to confirm the plan change, without depending on the webhook.
