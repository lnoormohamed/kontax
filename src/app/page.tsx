import { type Metadata } from "next";

import { PublicLanding } from "~/app/_components/public-landing";
import { auth } from "~/server/auth";

export const metadata: Metadata = {
  title: { absolute: "Kontax — Your contacts, synced everywhere" },
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const session = await auth();
  return <PublicLanding isAuthenticated={!!session?.user?.id} />;
}
