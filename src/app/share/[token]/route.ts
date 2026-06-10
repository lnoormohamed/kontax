import {
  contactsToVCard,
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";
import { db } from "~/server/db";

// Public, unauthenticated vCard download for a share link (P12-02).
// /share/{token} → resolves the token, validates the share, serves a .vcf.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const share = await db.contactShare.findUnique({
    where: { token },
    select: {
      id: true,
      shareType: true,
      status: true,
      expiresAt: true,
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
          address: true,
          postalAddresses: true,
          notes: true,
        },
      },
    },
  });

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
    return new Response("This share link has expired.", { status: 404 });
  }
  if (!share.contact) {
    // Source contact was deleted — nothing to serve.
    return new Response("Share link not found.", { status: 404 });
  }

  await db.contactShare.update({
    where: { id: share.id },
    data: { downloadCount: { increment: 1 } },
  });

  const c = share.contact;
  const vcard = contactsToVCard([
    {
      fullName: c.fullName,
      firstName: c.firstName,
      lastName: c.lastName,
      phoneticFirstName: c.phoneticFirstName,
      phoneticLastName: c.phoneticLastName,
      nickname: c.nickname,
      email: c.email,
      emailAddresses: parseContactStringArray(c.emailAddresses),
      phone: c.phone,
      phoneNumbers: parseContactStringArray(c.phoneNumbers),
      company: c.company,
      phoneticCompany: c.phoneticCompany,
      jobTitle: c.jobTitle,
      website: c.website,
      birthday: c.birthday,
      address: c.address,
      postalAddresses: parseContactPostalAddresses(c.postalAddresses),
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
