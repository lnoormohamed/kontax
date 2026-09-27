import { db } from "~/server/db";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";
import { deriveCardAnalytics } from "./analytics-utils";

// Known bot patterns to suppress from view counts.
const BOT_PATTERNS =
  /googlebot|bingbot|slurp|duckduckbot|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|discordbot|applebot|semrushbot|ahrefsbot|yandexbot/i;

/**
 * P49A-13: every unauthenticated page load used to insert a PublicCardView row
 * and bump the counter, so a loop of GETs grew the table without bound and made
 * the analytics meaningless. A view now counts once per (IP, card) per 30
 * minutes, and one IP can add at most 120 counted views an hour across all
 * cards. `ip` is null only off the Cloudflare path (dev), where those views
 * share one bucket.
 */
export async function recordCardView(
  userId: string,
  referrer?: string,
  userAgent?: string,
  ip?: string | null,
): Promise<void> {
  if (userAgent && BOT_PATTERNS.test(userAgent)) return;

  const ipKey = ip ?? "unknown";
  const perCard = await checkRateLimit(rateLimiters.cardViewPerIpCard, `${ipKey}:${userId}`);
  if (!perCard.allowed) return;
  const perIp = await checkRateLimit(rateLimiters.cardViewPerIp, ipKey);
  if (!perIp.allowed) return;

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
