import { db } from "~/server/db";
import { deriveCardAnalytics } from "./analytics-utils";

// Known bot patterns to suppress from view counts.
const BOT_PATTERNS =
  /googlebot|bingbot|slurp|duckduckbot|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|discordbot|applebot|semrushbot|ahrefsbot|yandexbot/i;

const ONE_DAY_MS = 86_400_000;

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
  ]).catch(() => undefined);
}

export async function getCardAnalytics(userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const [user, views30d] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { publicCardViews: true, addToKontaxClicks: true },
    }),
    db.publicCardView.findMany({
      where: { userId, viewedAt: { gte: thirtyDaysAgo } },
      orderBy: { viewedAt: "desc" },
      select: { viewedAt: true, referrer: true },
    }),
  ]);
  return deriveCardAnalytics(
    {
      totalViews: user.publicCardViews,
      ctaClicks: user.addToKontaxClicks,
    },
    views30d,
  );
}
