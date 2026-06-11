# P30-06 — Card Analytics

## Purpose

Show card owners how many people have viewed their public card and clicked "Add to Kontax," giving them a feedback signal on the card's reach. Analytics are visible only to the card owner in their settings. No third-party tracking — all counts are stored in Kontax's own database.

## Background

`User.publicCardViews Int @default(0)` (a simple counter) is referenced in the roadmap. This ticket adds the counter increment, a `PublicCardView` log table for the 30-day breakdown, and the analytics display in the settings panel per P30-DB11.

## Scope

**In scope:**
- `User.publicCardViews` counter field (total views, incremented on each card page load)
- `PublicCardView` model: `userId`, `viewedAt`, `referrer String?` — logged per view for the 30-day breakdown
- `addToKontaxClicks Int @default(0)` on `User` — incremented when the CTA button is clicked
- `recordCardView(userId, referrer?)` — called by P30-02 on each page load
- `recordAddToKontaxClick(username)` — called when the CTA button is clicked (client-side event)
- Analytics display in `/settings/profile/card`: total views, last-30-day views, CTA click count
- CRON cleanup: delete `PublicCardView` rows older than 90 days

**Out of scope:**
- Geographic or device breakdown of views (deferred)
- Per-day time series chart (deferred — summary counts only in v1)
- Public analytics (views are private to the card owner)

---

## Design / Implementation Spec

### Schema changes

```prisma
// On User model (additions):
publicCardViews      Int @default(0)
addToKontaxClicks    Int @default(0)

model PublicCardView {
    id         String   @id @default(cuid())
    userId     String
    viewedAt   DateTime @default(now())
    referrer   String?  @db.VarChar(500)

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, viewedAt])
}
```

Run: `prisma migrate dev --name add-card-analytics`

### `recordCardView`

Called by the public card page (P30-02) as a fire-and-forget server action:

```typescript
export async function recordCardView(
  userId: string,
  referrer?: string,
): Promise<void> {
  // Increment total counter and log the view — both in a transaction
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { publicCardViews: { increment: 1 } },
    }),
    db.publicCardView.create({
      data: {
        userId,
        referrer: referrer?.slice(0, 500) ?? null,
      },
    }),
  ]);
}
```

The `referrer` is extracted from the `Referer` request header in the page server component:

```typescript
// In /u/[username]/page.tsx:
const headersList = headers();
const referrer = headersList.get("referer") ?? undefined;
void recordCardView(card.userId, referrer);
```

### `recordAddToKontaxClick`

Called client-side when the CTA button is clicked (before navigation):

```typescript
// API route: POST /api/card/[username]/click
export async function POST(
  req: NextRequest,
  { params }: { params: { username: string } },
) {
  // Find the user by username and increment the counter
  await db.user.update({
    where: { username: params.username.toLowerCase() },
    data: { addToKontaxClicks: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
```

Called from `AddToKontaxButton` before navigating:
```typescript
// In AddToKontaxButton, before vCard download or navigation:
void fetch(`/api/card/${card.username}/click`, { method: "POST" });
```

### Analytics display in settings

In `/settings/profile/card` (P30-03), below the visibility controls:

```tsx
export async function CardAnalyticsSection({ userId }: { userId: string }) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [user, views30d] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { publicCardViews: true, addToKontaxClicks: true },
    }),
    db.publicCardView.count({
      where: { userId, viewedAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  return (
    <SettingsSection title="Your card's performance">
      <AnalyticRow icon={<Eye size={16} />}
        label="Total views" value={user.publicCardViews.toLocaleString()} />
      <AnalyticRow icon={<Calendar size={16} />}
        label="Views in last 30 days" value={views30d.toLocaleString()} />
      <AnalyticRow icon={<UserPlus size={16} />}
        label='"Add to Kontax" clicks' value={user.addToKontaxClicks.toLocaleString()} />
    </SettingsSection>
  );
}
```

### CRON cleanup — delete old `PublicCardView` rows

`src/app/api/cron/cleanup-card-views/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  // ...CRON_SECRET check...
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
  const result = await db.publicCardView.deleteMany({
    where: { viewedAt: { lt: ninetyDaysAgo } },
  });
  return NextResponse.json({ deleted: result.count });
}
```

Register: `{ "path": "/api/cron/cleanup-card-views", "schedule": "0 3 * * *" }` (daily at 3 AM UTC).

---

## Acceptance Criteria

- `PublicCardView` model exists; `publicCardViews` and `addToKontaxClicks` fields on `User`; migration applied.
- `recordCardView` increments the total counter and creates a `PublicCardView` row on each card page load.
- `recordAddToKontaxClick` increments `addToKontaxClicks` when the CTA is clicked.
- The analytics section in settings shows total views, 30-day views, and CTA click count.
- The CRON cleanup deletes `PublicCardView` rows older than 90 days.
- `recordCardView` is fire-and-forget — a failure never blocks or delays the card page render.

---

## Risks and Open Questions

- **Bot traffic inflating view counts:** search engine crawlers and link-preview bots will trigger the page's server component and inflate view counts. Mitigate by checking the `User-Agent` header in `recordCardView` and skipping recording for known bot patterns. Add `if (isBot(userAgent)) return;` before the DB write. A simple bot detection list (Googlebot, bingbot, twitterbot, facebookexternalhit, etc.) is sufficient for v1.
- **Self-view inflation:** a user viewing their own card in settings or while testing will inflate their view count. Suppress self-views by checking if the logged-in session user ID matches the card owner: if `session?.user?.id === card.userId`, skip `recordCardView`.
