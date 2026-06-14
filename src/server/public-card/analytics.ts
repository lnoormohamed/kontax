import { db } from "~/server/db";

// Known bot patterns to suppress from view counts.
const BOT_PATTERNS =
  /googlebot|bingbot|slurp|duckduckbot|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|discordbot|applebot|semrushbot|ahrefsbot|yandexbot/i;

export async function recordCardView(
  userId: string,
  referrer?: string,
  userAgent?: string,
): Promise<void> {
  if (userAgent && BOT_PATTERNS.test(userAgent)) return;

  // Fire-and-forget — failures must never surface to the card page render.
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { publicCardViews: { increment: 1 } },
    }),
    db.publicCardView.create({
      data: { userId, referrer: referrer?.slice(0, 500) ?? null },
    }),
  ]).catch(() => {});
}

export async function getCardAnalytics(userId: string) {
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
  return {
    totalViews: user.publicCardViews,
    views30d,
    ctaClicks: user.addToKontaxClicks,
  };
}
