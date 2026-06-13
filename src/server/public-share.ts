import { db } from "~/server/db";

// P26-10: shared, read-only resolver for the public vCard share link (P12-02),
// used by the landing page and its generated OG image. Mirrors the validation in
// the .vcf download route but returns only display fields (no mutation).

type Display = { name: string; secondary: string | null };
export type ShareDisplay =
  | ({ status: "ok" } & Display)
  | { status: "notfound" | "revoked" | "expired" };

export async function resolveShareForDisplay(token: string): Promise<ShareDisplay> {
  const share = await db.contactShare.findUnique({
    where: { token },
    select: {
      shareType: true,
      status: true,
      expiresAt: true,
      contact: {
        select: {
          fullName: true,
          firstName: true,
          lastName: true,
          nickname: true,
          company: true,
          jobTitle: true,
        },
      },
    },
  });

  if (share?.shareType !== "VCARD_LINK") return { status: "notfound" };
  if (share.status === "REVOKED") return { status: "revoked" };
  const expired =
    share.status === "EXPIRED" || (share.expiresAt != null && share.expiresAt.getTime() < Date.now());
  if (expired) return { status: "expired" };
  if (!share.contact) return { status: "notfound" };

  const c = share.contact;
  const nameCandidates = [
    c.fullName,
    [c.firstName, c.lastName].filter(Boolean).join(" "),
    c.nickname,
    c.company,
  ];
  const name = nameCandidates.map((v) => v?.trim()).find((v) => v) ?? "Shared contact";
  const secondaryParts = [c.jobTitle?.trim(), c.company?.trim()].filter(Boolean);
  const secondary = secondaryParts.length > 0 ? secondaryParts.join(" · ") : null;

  return { status: "ok", name, secondary };
}

export function shareInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((p) => p.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials.length > 0 ? initials : "?";
}
