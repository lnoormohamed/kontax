import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { CreateContactForm } from "~/app/_components/create-contact-form";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";
import { getUserFamilyMembership } from "~/server/family-access";

export default async function NewContactPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const [planSummary, peopleCount, favoritesCount, archivedCount, duplicatesCount] =
    await Promise.all([
      getUserPlanSummary(userId),
      db.contact.count({ where: { userId, archivedAt: null } }),
      db.contact.count({ where: { userId, archivedAt: null, isFavorite: true } }),
      db.contact.count({ where: { userId, NOT: { archivedAt: null } } }),
      db.mergeSuggestion.count({ where: { userId, status: "OPEN" } }),
    ]);

  const familyMembership = await getUserFamilyMembership(userId);
  const familyTarget =
    familyMembership?.canEdit && familyMembership.bookId ? familyMembership.groupName : null;

  const name = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  return (
    <AppShell
      account={{ name, email: session.user.email ?? "", plan: planSummary.planLabel }}
      counts={{
        people: peopleCount,
        favorites: favoritesCount,
        archived: archivedCount,
        duplicates: duplicatesCount,
      }}
    >
      <CreateContactForm familyBookName={familyTarget} />
    </AppShell>
  );
}
