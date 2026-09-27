import { MULTI_VALUE_ENTRY_SELECT, readDerivedLegacyFields } from "~/server/contact-multi-values";
import {
  contactsToVCard,
  parseContactDateEntries,
} from "~/server/contact-portability";
import { findShareByToken } from "~/server/capability-tokens";
import { db } from "~/server/db";

import type { Prisma } from "../../../../../generated/prisma";

const VCARD_SHARE_SELECT = {
  id: true,
  shareType: true,
  status: true,
  expiresAt: true,
  downloadCount: true,
  maxDownloads: true,
  contact: {
    select: {
      fullName: true,
      firstName: true,
      lastName: true,
      phoneticFirstName: true,
      phoneticLastName: true,
      nickname: true,
      email: true,
      emailAddresses: true,
      phone: true,
      phoneNumbers: true,
      company: true,
      phoneticCompany: true,
      jobTitle: true,
      website: true,
      birthday: true,
      significantDates: true,
      address: true,
      postalAddresses: true,
      notes: true,
      ...MULTI_VALUE_ENTRY_SELECT,
    },
  },
} satisfies Prisma.ContactShareSelect;

// Public, unauthenticated vCard download for a share link (P12-02).
// /share/{token}/vcard → resolves the token, validates the share, serves a .vcf.
// (P26-10 moved this under /vcard so /share/{token} can be a previewable page.)
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // P48-18: hash-first lookup with the legacy plaintext fallback.
  const share = await findShareByToken(token, (where) =>
    db.contactShare.findUnique({ where, select: VCARD_SHARE_SELECT }),
  );

  if (share?.shareType !== "VCARD_LINK") {
    return new Response("Share link not found.", { status: 404 });
  }
  if (share.status === "REVOKED") {
    return new Response("This share link has been revoked.", { status: 410 });
  }
  const isExpired =
    share.status === "EXPIRED" || (share.expiresAt != null && share.expiresAt.getTime() < Date.now());
  if (isExpired) {
    if (share.status !== "EXPIRED") {
      await db.contactShare.update({ where: { id: share.id }, data: { status: "EXPIRED" } });
    }
    return new Response("This share link has expired.", { status: 410 });
  }
  // Single-use enforcement: if maxDownloads is set and already reached, block.
  if (share.maxDownloads != null && share.downloadCount >= share.maxDownloads) {
    return new Response("This share link has already been used.", { status: 410 });
  }
  if (!share.contact) {
    // Source contact was deleted — nothing to serve.
    return new Response("Share link not found.", { status: 404 });
  }

  // P49A-13: claim the download atomically. The check above and a plain
  // `update` were two steps, so concurrent requests for a single-use link could
  // all pass the check and all get the card. The claim only matches while the
  // share is still ACTIVE and under its limit; a request that loses the race
  // gets the same 410 as one that arrives afterwards.
  const claimed = await db.contactShare.updateMany({
    where: {
      id: share.id,
      status: "ACTIVE",
      ...(share.maxDownloads != null ? { downloadCount: { lt: share.maxDownloads } } : {}),
    },
    data: { downloadCount: { increment: 1 } },
  });
  if (claimed.count === 0) {
    return new Response("This share link has already been used.", { status: 410 });
  }
  if (share.maxDownloads != null) {
    // Expire single-use links immediately after serving (whoever took the last
    // download does this; the row's own count decides, not our stale read).
    await db.contactShare.updateMany({
      where: { id: share.id, status: "ACTIVE", downloadCount: { gte: share.maxDownloads } },
      data: { status: "EXPIRED" },
    });
  }

  const c = share.contact;
  // P49A-10: the flat values are derived from the typed entries.
  const multiValues = readDerivedLegacyFields(c);
  const vcard = contactsToVCard([
    {
      fullName: c.fullName,
      firstName: c.firstName,
      lastName: c.lastName,
      phoneticFirstName: c.phoneticFirstName,
      phoneticLastName: c.phoneticLastName,
      nickname: c.nickname,
      email: multiValues.email,
      emailAddresses: multiValues.emailAddresses,
      phone: multiValues.phone,
      phoneNumbers: multiValues.phoneNumbers,
      company: c.company,
      phoneticCompany: c.phoneticCompany,
      jobTitle: c.jobTitle,
      website: multiValues.website,
      birthday: c.birthday,
      significantDates: parseContactDateEntries(c.significantDates),
      address: multiValues.address,
      postalAddresses: multiValues.postalAddresses,
      notes: c.notes,
    },
  ]);

  const safeName = (c.fullName || "contact").replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "contact";

  return new Response(vcard, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
