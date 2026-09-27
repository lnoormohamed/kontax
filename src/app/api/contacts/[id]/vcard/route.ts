import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { db } from "~/server/db";
import { MULTI_VALUE_ENTRY_SELECT, withDerivedLegacyFields } from "~/server/contact-multi-values";
import {
  contactsToVCard,
  parseContactDateEntries,
} from "~/server/contact-portability";

// Direct .vcf download of a single owned contact (all plans). Distinct from the
// premium bulk export — this is just downloading your own contact card.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if (isSessionError(err)) {
      return new Response("Unauthorized", { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const contact = await db.contact.findFirst({
    where: { id, userId, deletedAt: null },
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
  });

  if (!contact) {
    return new Response("Not found", { status: 404 });
  }

  const body = contactsToVCard([
    {
      // P49A-10: the flat values are derived from the typed entries.
      ...withDerivedLegacyFields(contact),
      significantDates: parseContactDateEntries(contact.significantDates),
    },
  ]);

  const safeName = (contact.fullName || "contact").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.vcf"`,
    },
  });
}
