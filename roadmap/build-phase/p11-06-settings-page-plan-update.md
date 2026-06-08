# P11-06 Update Settings Page to Reflect New Plans

## Purpose
This ticket updates the settings page plan section to accurately reflect the four-tier plan structure (Free, Pro, Family, Teams), show live usage against all relevant limits, surface group membership status for Family and Teams users, and link to the pricing page. It replaces the current static plan label and limit display with a complete, plan-aware UI that matches the entitlement model established in P11-01 through P11-05.

## Background
The current settings page (`src/app/settings/page.tsx`) renders a plan section with four usage tiles: "Contacts used", "Monthly imports", "Export access", and "Sync accounts". These tiles show live data from `getUserPlanSummary` and the `lifecyclePolicy` description. The implementation has several gaps relative to what Phase 11 requires:

- The plan name displayed is `planSummary.lifecyclePolicy.label` which returns the lifecycle state (Active, Grace, etc.), not the plan name (Free, Pro, etc.). Plan name is available as `planSummary.planLabel` but is not shown.
- The sync accounts tile shows "X available on plan" (the limit) without showing how many are currently used.
- App passwords are not surfaced at all.
- There is no link to a pricing page.
- There is no group membership section for Family and Teams users.
- The "Monthly imports" tile shows `importedThisMonth` which was previously a contact count total — this must be updated to show completed import job count after the P11-03 change.
- The tile labels use the old entitlement labels (e.g., "Export access" as a binary) instead of the feature-grouped layout appropriate for four tiers.

This ticket also depends on P11-05 having shipped: the `getUserPlanSummary` function and related queries must return the updated fields (`importJobsUsedThisMonth` instead of `importedThisMonth`, live sync account count, live app password count).

## Scope
### In scope
- Settings page plan section: plan name + tier badge, lifecycle state, feature summary per plan, link to pricing page.
- Usage bars for all four gated limits: contacts, imports, sync accounts, app passwords.
- Group membership status block for Family and Teams users (owner and member views).
- "Manage group" link placeholder ("coming soon") until Phase 13/14.
- Live data for all usage figures (no cached values).
- Updated error states and edge cases (canceled, grace, locked).
- Responsive layout adjustments if needed.

### Out of scope
- Pricing page itself — covered in P11-04.
- Group management functionality — Phase 13 and 14.
- Billing history, invoice UI, payment method management.
- The "Phonetic names" section — unchanged by Phase 11.
- The "Quick links" sidebar — unchanged by Phase 11 except to add a pricing link.

---

## Design / Implementation Spec

### 1. Data requirements: updated getUserPlanSummary

The settings page calls `getUserPlanSummary(session.user.id)` to get plan data. After P11-02 and P11-03, this function must return additional fields. The settings page may need to augment the call with additional queries if `getUserPlanSummary` does not include them all.

Required data for the settings page:

```typescript
type SettingsPlanData = {
  // From getUserPlanSummary / getUserBillingContext
  plan: SubscriptionPlan;           // "FREE" | "PRO" | "FAMILY" | "TEAMS"
  planLabel: string;                // "Free" | "Pro" | "Family" | "Teams"
  lifecycleState: BillingLifecycleState;
  lifecyclePolicy: LifecycleAccessPolicy;
  entitlements: PlanEntitlements;   // all fields including new ones from P11-02

  // Usage counters (live, not cached)
  contactsUsed: number;
  importJobsUsedThisMonth: number;  // count of completed ImportJob rows this calendar month
  syncAccountsUsed: number;         // count of SyncAccount rows with status not PAUSED/deleted
  appPasswordsUsed: number;         // count of active app passwords (stub: 0 until AppPassword model)

  // Group membership (nullable for Free/Pro)
  groupMembership?: {
    groupId: string;
    groupName: string;
    groupType: "FAMILY" | "TEAM";
    role: "OWNER" | "ADMIN" | "MEMBER";
    memberCount: number;
    memberSlotsLimit: number;
  };
};
```

The settings page server component should load this data using a combination of `getUserPlanSummary` (which returns billing context and contact count) and additional database queries for sync account count, app password count, and group membership.

For app passwords: if the `AppPassword` model does not yet exist, set `appPasswordsUsed = 0` and annotate with a TODO comment.

For group membership: query `GroupMember` for the current user with `inviteStatus: "ACCEPTED"`, then load the group's `name`, `type`, and a count of ACCEPTED members.

### 2. Plan section header

Replace the current usage block header with a proper plan name and status display:

```tsx
<div className="flex items-start justify-between gap-3">
  <div>
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
      Your plan
    </p>
    <h2 className="mt-1 text-xl font-semibold text-slate-900">
      {planData.planLabel}
    </h2>
    {/* Lifecycle state badge — shown below plan name, not instead of it */}
    <div className="mt-2 flex items-center gap-2">
      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${lifecycleTone}`}>
        {planData.lifecyclePolicy.label}
      </span>
      {/* Show trial end date if in TRIALING state */}
      {planData.lifecycleState === "TRIALING" && subscription?.trialEndsAt && (
        <span className="text-xs text-slate-500">
          Trial ends {formatDate(subscription.trialEndsAt)}
        </span>
      )}
    </div>
  </div>
  <Link
    href="/pricing"
    className="text-sm font-medium text-[#4158f4] hover:text-[#3248db] whitespace-nowrap"
  >
    See plans
  </Link>
</div>
```

The plan name and lifecycle state are now separate. Previously only the lifecycle state was shown (as the badge), which meant a user had to infer their plan from context.

### 3. Feature summary by plan

Below the plan header, show a brief one-line summary of what the plan includes. This replaces the `lifecyclePolicy.description` paragraph which described billing access state rather than plan features:

```typescript
const PLAN_FEATURE_SUMMARY: Record<SubscriptionPlan, string> = {
  FREE: "Up to 500 contacts, 1 sync account, 3 imports per month, CSV and vCard export.",
  PRO: "Unlimited contacts, 5 sync accounts, unlimited imports, all export formats, advanced merge, 90-day activity log.",
  FAMILY: "Everything in Pro for up to 6 members, plus 1 shared family address book with 1-year activity log.",
  TEAMS: "Everything in Pro for up to 25 members, multiple shared address books, Admin and Member roles, unlimited audit log.",
};
```

Render as a small paragraph below the lifecycle badge.

For lifecycle states other than ACTIVE, also render the `lifecyclePolicy.description` as a secondary note (amber for GRACE, rose for CANCELED/LOCKED) below the feature summary.

### 4. Usage bars — all four limits

Replace the current four-tile grid with a unified usage section that shows progress bars for all four gated resources. Progress bars communicate usage more clearly than raw numbers for limits with hard ceilings.

Each bar row has:
- Label (e.g., "Contacts")
- Used / Limit values (e.g., "342 / 500" or "342 / Unlimited")
- Progress bar. Width: `(used / limit) * 100%`. If limit is null (unlimited), show full bar in a muted color (not filled — indicates no ceiling).
- Warning state: when usage >= 80% of limit, bar turns amber. When usage >= 95%, bar turns rose.

```tsx
type UsageBarProps = {
  label: string;
  used: number;
  limit: number | null;  // null = unlimited
  unit?: string;         // e.g., "this month" for imports
};

const UsageBar = ({ label, used, limit, unit }: UsageBarProps) => {
  const percentage = limit === null ? null : Math.min((used / limit) * 100, 100);
  const isWarning = percentage !== null && percentage >= 80;
  const isDanger = percentage !== null && percentage >= 95;

  const barColor = isDanger
    ? "bg-rose-400"
    : isWarning
    ? "bg-amber-400"
    : "bg-[#4158f4]";

  const limitLabel = limit === null ? "Unlimited" : limit.toLocaleString();

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span className="font-medium text-slate-700">{label}</span>
        <span>
          {used.toLocaleString()} / {limitLabel}
          {unit && <span className="ml-1 text-slate-400">{unit}</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        {percentage !== null ? (
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        ) : (
          <div className="h-full rounded-full bg-slate-200 w-full" />
        )}
      </div>
    </div>
  );
};
```

Usage section layout:

```tsx
<div className="mt-5 grid gap-4">
  <UsageBar
    label="Contacts"
    used={planData.contactsUsed}
    limit={planData.entitlements.contactsLimit}
  />
  <UsageBar
    label="Imports"
    used={planData.importJobsUsedThisMonth}
    limit={planData.entitlements.monthlyImportLimit}
    unit="this month"
  />
  <UsageBar
    label="Sync accounts"
    used={planData.syncAccountsUsed}
    limit={planData.entitlements.syncAccountsLimit}
  />
  <UsageBar
    label="App passwords"
    used={planData.appPasswordsUsed}
    limit={planData.entitlements.appPasswordsLimit}
  />
</div>
```

For Pro, Family, and Teams where `contactsLimit` and `monthlyImportLimit` are null (unlimited), the bar renders as a flat muted track with "Unlimited" as the limit label. The bar does not animate or show a fill — it is clearly "no ceiling" rather than "100% full."

### 5. Upgrade/downgrade link

Below the usage bars, add a contextual CTA row:

```tsx
<div className="mt-5 flex items-center gap-3">
  <Link
    href="/pricing"
    className="text-sm font-medium text-[#4158f4] hover:text-[#3248db]"
  >
    View all plans →
  </Link>
  {planData.plan === "FREE" && (
    <span className="text-xs text-slate-400">
      Upgrade to Pro for unlimited contacts and sync accounts.
    </span>
  )}
</div>
```

For users already on a paid plan, the "View all plans" link is the only element. No upsell copy for users on Pro, Family, or Teams.

### 6. Group membership section (Family and Teams)

This section appears only when `planData.groupMembership` is defined (i.e., the user is on Family or Teams and has an ACCEPTED group membership, whether as owner or member).

Place this as a separate card below the plan section card, not embedded within it:

```tsx
{planData.groupMembership && (
  <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          {planData.groupMembership.groupType === "FAMILY" ? "Family" : "Team"}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          {planData.groupMembership.groupName}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {planData.groupMembership.memberCount} of {planData.groupMembership.memberSlotsLimit} members
          {" · "}
          <span className="capitalize">{planData.groupMembership.role.toLowerCase()}</span>
        </p>
      </div>
      <ManageGroupLink role={planData.groupMembership.role} groupType={planData.groupMembership.groupType} />
    </div>
  </div>
)}
```

#### ManageGroupLink component

The manage group link leads to the group management page (Phase 13/14). Until that page is built, it renders a "coming soon" tooltip state:

```tsx
const ManageGroupLink = ({
  role,
  groupType,
}: {
  role: "OWNER" | "ADMIN" | "MEMBER";
  groupType: "FAMILY" | "TEAM";
}) => {
  const label =
    groupType === "FAMILY"
      ? role === "OWNER" || role === "ADMIN"
        ? "Manage family"
        : "View family"
      : role === "OWNER" || role === "ADMIN"
      ? "Manage team"
      : "View team";

  return (
    <span
      className="relative group cursor-default text-sm font-medium text-slate-400"
      title="Group management is coming soon"
    >
      {label} ↗
      <span className="absolute top-full right-0 mt-1 hidden group-hover:block text-xs bg-slate-800 text-white rounded-md px-2 py-1 whitespace-nowrap z-10">
        Coming in a future update
      </span>
    </span>
  );
};
```

Important: this must be a `<span>` or non-interactive element, not an `<a>` or `<Link>`, because the destination does not exist yet. A dead link (404) is worse than a clearly labeled "coming soon" placeholder. When Phase 13 ships, this component is replaced with a real `<Link>` to `/family` or `/teams/[groupId]`.

#### Example displays by scenario

**Scenario A — Family owner, 4 of 6 members:**
> **Family** · Smith Family
> 4 of 6 members · Owner
> [Manage family — coming soon tooltip]

**Scenario B — Family member (not owner), 4 of 6 members:**
> **Family** · Smith Family
> 4 of 6 members · Member
> [View family — coming soon tooltip]

**Scenario C — Teams admin, 12 of 25 members:**
> **Team** · Acme Corp
> 12 of 25 members · Admin
> [Manage team — coming soon tooltip]

**Scenario D — Teams member:**
> **Team** · Acme Corp
> 12 of 25 members · Member
> [View team — coming soon tooltip]

### 7. Live data guarantee

All usage figures displayed in the settings page must reflect live database queries, not cached values from a previous request. The settings page is a Next.js Server Component and does not use a cache layer for the plan summary queries. Confirm:

- `db.contact.count({ where: { userId } })` — no caching.
- `db.importJob.count({ where: { userId, status: "COMPLETED", createdAt: { gte: monthStart } } })` — no caching.
- `db.syncAccount.count({ where: { userId, status: { not: "PAUSED" } } })` — no caching. Note: only active (non-paused) sync accounts should count toward the "used" display, because paused accounts after a downgrade are not actively consuming the slot in a meaningful sense to the user. However, they still count against the limit for gate enforcement purposes. Consider showing paused accounts separately (e.g., "2 active, 1 paused" for a user who had 3 and downgraded to Pro).
- `db.appPassword.count({ where: { userId } })` — stub returning 0 until model exists.

The settings page is a frequently-visited page. If contact count queries become slow at scale, consider a periodic background counter on the User model (e.g., `contactCount Int @default(0)`) that is incremented/decremented on contact create/delete. For Phase 11, live counts are sufficient.

### 8. Sync account count detail

Expand the sync accounts usage bar to handle the paused-after-downgrade case. After a Pro-to-Free downgrade, a user may have 3 sync accounts where 2 are PAUSED (status = PAUSED) and 1 is ACTIVE. The display should be:

- Used (for gate enforcement): count all SyncAccount rows regardless of status.
- Displayed as: "1 active · 2 paused / 1 account on this plan"

This requires a grouped count query:

```typescript
const syncAccountsByStatus = await db.syncAccount.groupBy({
  by: ["status"],
  where: { userId },
  _count: { _all: true },
});

const syncAccountsActive = syncAccountsByStatus.find((g) => g.status === "ACTIVE")?._count._all ?? 0;
const syncAccountsPaused = syncAccountsByStatus.find((g) => g.status === "PAUSED")?._count._all ?? 0;
const syncAccountsTotal = syncAccountsActive + syncAccountsPaused;
```

Display:

```tsx
<UsageBar
  label="Sync accounts"
  used={syncAccountsTotal}
  limit={planData.entitlements.syncAccountsLimit}
/>
{syncAccountsPaused > 0 && (
  <p className="text-xs text-amber-600 mt-1">
    {syncAccountsPaused} account{syncAccountsPaused > 1 ? "s" : ""} paused due to plan change.{" "}
    <Link href="/sync" className="underline">
      Manage in Sync center
    </Link>
  </p>
)}
```

### 9. "See plans" link in Quick Links sidebar

The existing Quick Links aside in the settings page has links to Import and export, Sync center, and Manual merge. Add a "Pricing and plans" link:

```tsx
<Link
  className="rounded-[1.3rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
  href="/pricing"
>
  Pricing and plans
</Link>
```

Place it after the existing links or as the first link in the list (proximity to billing context).

### 10. Full page structure after changes

The settings page grid structure after this ticket's changes:

```
<main>
  <section> <!-- Account header (unchanged) -->
  <section class="grid gap-6 lg:grid-cols-[1fr_320px]">
    <div class="grid gap-6">
      <div> <!-- Plan and limits card (updated) -->
      <div> <!-- Group membership card (new, conditional) -->
      <div> <!-- Phonetic names (unchanged) -->
    </div>
    <aside>
      <div> <!-- Quick links (updated with pricing link) -->
      <div> <!-- Session (unchanged) -->
    </aside>
  </section>
</main>
```

### 11. TypeScript type update for settings page

The settings page server component currently accesses `planSummary.importedThisMonth`. After P11-03, the field is renamed to `importJobsUsedThisMonth`. Update the destructuring in the settings page accordingly. Confirm the field name used in `getUserPlanSummary`'s return type matches exactly.

### 12. Accessibility notes

- The progress bar `<div>` elements must have `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, and `aria-valuemax` (set to the limit or "unlimited" label for null limits).
- The group membership "coming soon" tooltip must be keyboard-accessible (focus state should show the tooltip).
- The plan name and tier must be in the page's landmark structure (use a proper heading level, not just styled text).

---

## Acceptance Criteria
- The settings plan section displays the correct plan name ("Free", "Pro", "Family", or "Teams") for each of the four tiers — not the lifecycle state label alone.
- All four usage bars (Contacts, Imports, Sync accounts, App passwords) are present and show live data.
- Null limits (unlimited) render correctly as "Unlimited" with a flat muted bar, not a filled or errored bar.
- Sync account tiles distinguish between active and paused accounts, with a note linking to Sync center when paused accounts exist.
- The "See plans" link is present in the plan section header and leads to `/pricing`.
- A "Pricing and plans" quick link is present in the aside.
- The group membership card appears for Family and Teams users with correct group name, role, and member count.
- Group management links render as non-interactive "coming soon" elements (not dead links) until Phase 13/14.
- All usage figures are loaded from live database queries, not cached state.
- The `importJobsUsedThisMonth` field (completed import job count) is used, not the old contact-count total.
- CANCELED account state renders a portability-focused note ("your contacts are always exportable").
- The page renders without TypeScript errors and without referencing removed fields from the old plan model (`PLUS` plan, old import count field).
- The app password bar shows 0 used with the correct plan limit (stub behavior is acceptable while the `AppPassword` model does not exist, with a TODO comment).

## Risks and Open Questions
- `GroupMember` query for membership resolution adds a DB round-trip to the settings page load. For Phase 11 user counts this is acceptable. If settings page load time becomes a concern, the group membership can be denormalized onto the `User` model as a `currentGroupId` field.
- The `ManageGroupLink` "coming soon" state must be replaced in Phase 13 (Family) and Phase 14 (Teams) as part of those tickets. Add a `// TODO: Phase 13 — replace with real Link` comment so it is not forgotten.
- The sync account "active vs paused" distinction in the display requires a `groupBy` query that is more complex than a simple count. If `groupBy` is unavailable in the Prisma version being used, use two separate `count` queries instead.
- App passwords are referenced in this ticket but the model has not yet been confirmed to exist. The ticket must ship with a documented stub (count = 0, TODO comment) — it must not silently display incorrect data.
- The per-contact history limit (10 events for Free) is enforced in the contact detail server action per P11-05. The settings page does not need to show this limit explicitly, but the plan feature summary text for Free should mention "last 10 events per contact" to set expectations.

## Outcome
The settings page accurately reflects the user's current plan, shows live usage against all four gated limits with clear progress bars, surfaces group membership for Family and Teams users, and provides direct navigation to the pricing page.
