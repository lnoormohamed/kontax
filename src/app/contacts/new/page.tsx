import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { CreateContactForm } from "~/app/_components/create-contact-form";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";
import { getUserFamilyMembership } from "~/server/family-access";
import { getAccessibleTeamBooks } from "~/server/team-access";

export default async function NewContactPage() {
  const session = await auth();

  if (!session?.user?.id) {
    const h = await headers();
    const next = h.get("x-pathname") ?? "/contacts/new";
    redirect(`/login?next=${encodeURIComponent(next)}`);
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

  const [familyMembership, teamBooks] = await Promise.all([
    getUserFamilyMembership(userId),
    getAccessibleTeamBooks(userId),
  ]);
  // Show the family option when the user is in a family book (owner or member).
  // canEdit drives the save-to selector vs. the view-only locked note.
  const familyTarget = familyMembership?.bookId ? familyMembership.groupName : null;
  const familyCanEdit = !!familyMembership?.canEdit;
  const editableTeamBooks = teamBooks
    .filter((b) => b.permission === "EDIT")
    .map((b) => ({ id: b.id, name: b.name }));

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
      mobileTitle="New contact"
      mobileBackHref="/contacts"
      mobileBackLabel="Contacts"
    >
      <CreateContactForm familyBookName={familyTarget} familyCanEdit={familyCanEdit} teamBooks={editableTeamBooks} />
    </AppShell>
  );
}
