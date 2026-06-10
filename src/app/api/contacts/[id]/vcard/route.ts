import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  contactsToVCard,
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";

// Direct .vcf download of a single owned contact (all plans). Distinct from the
// premium bulk export — this is just downloading your own contact card.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const contact = await db.contact.findFirst({
    where: { id, userId },
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
      address: true,
      postalAddresses: true,
      notes: true,
    },
  });

  if (!contact) {
    return new Response("Not found", { status: 404 });
  }

  const body = contactsToVCard([
    {
      ...contact,
      emailAddresses: parseContactStringArray(contact.emailAddresses),
      phoneNumbers: parseContactStringArray(contact.phoneNumbers),
      postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
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
