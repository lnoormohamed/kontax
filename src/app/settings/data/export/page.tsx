import { type Metadata } from "next";

import { SettingsPageHead } from "~/app/_components/settings-ui";
import { redirectToLogin } from "~/server/auth/require-page-auth";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { DataExportSection } from "../_components/data-export-section";

export const metadata: Metadata = { title: "Download your data — Kontax" };

// P46-14 / DB07 — "Download your data" lives with the data surfaces (it sat
// on the Account page before; P45 built the export system this fronts).
export default async function SettingsDataExportPage() {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings/data/export");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  return (
    <>
      <SettingsPageHead
        title="Download your data"
        sub="A full export of your account — contacts, books, labels and settings."
      />
      <DataExportSection hasPassword={!!user?.password} />
    </>
  );
}
