import { type NextRequest } from "next/server";

import { findUserByCalToken } from "~/server/capability-tokens";
import { db } from "~/server/db";
import { buildVCalendar } from "~/server/ical";

export const dynamic = "force-dynamic";

/**
 * P22-11: public subscribable iCal feed. Authenticated by the per-user calToken
 * query param (a revocable credential — no session). Returns an RFC 5545
 * VCALENDAR with a yearly-recurring all-day VEVENT per contact date.
 */
export async function GET(req: NextRequest) {
  const calToken = new URL(req.url).searchParams.get("calToken");
  if (!calToken) {
    return new Response("Missing calToken", { status: 401 });
  }

  // P48-18: looked up by sha256(calToken); pre-deploy tokens still resolve via
  // the legacy plaintext fallback until the backfill has run.
  const user = await findUserByCalToken(calToken, (where) =>
    db.user.findUnique({ where, select: { id: true } }),
  );
  if (!user) {
    return new Response("Invalid or revoked token", { status: 401 });
  }

  const contacts = await db.contact.findMany({
    where: { userId: user.id, archivedAt: null },
    select: { id: true, fullName: true, firstName: true, birthday: true, significantDates: true },
  });
  // Only contacts that actually have a date contribute events; buildVCalendar
  // skips those without parseable birthday/significantDates.
  const withDates = contacts.filter(
    (c) => c.birthday != null || (Array.isArray(c.significantDates) && c.significantDates.length > 0),
  );

  const ics = buildVCalendar(withDates);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kontax-birthdays.ics"',
      // P48-11 item 5: this feed is keyed by a revocable calToken, not a
      // session — a shared/CDN cache keying only on the URL would leak one
      // user's contact dates to whoever else requests the same cache slot.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
