import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { PendingDeletionPanel } from "./pending-deletion-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account scheduled for deletion",
  robots: { index: false, follow: false },
};

/**
 * P48-02: the landing page for a pending-deletion session.
 *
 * `auth()` now returns these sessions (the account stays ACTIVE with a
 * `scheduledDeleteAt`), so this page can read the real deletion date instead of
 * hard-coding "30 days" and can offer the cancel button the rest of the UI has
 * always promised.
 */
export default async function AccountPendingDeletionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { scheduledDeleteAt: true },
  });

  // Nothing pending (already cancelled, or the user navigated here directly) —
  // send them back to the app rather than showing a scary empty screen.
  if (!user?.scheduledDeleteAt) redirect("/contacts");

  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10"
      style={{ backgroundColor: "#eef1ec" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#17352e] text-[19px] font-bold text-[#dff0e7]">
          K
        </span>
        <span className="text-[20px] font-semibold tracking-[-0.018em] text-[#17352e]">Kontax</span>
      </div>

      <PendingDeletionPanel scheduledDeleteAt={user.scheduledDeleteAt.toISOString()} />
    </main>
  );
}
