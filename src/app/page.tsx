import { type Metadata } from "next";

import {
  JsonLd,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "~/app/_components/json-ld";
import { PublicLanding } from "~/app/_components/public-landing";
import { auth } from "~/server/auth";

export const metadata: Metadata = {
  title: { absolute: "Kontax — Your contacts, synced everywhere" },
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const session = await auth();
  return (
    <>
      <JsonLd data={[organizationSchema(), softwareApplicationSchema(), websiteSchema()]} />
      <PublicLanding isAuthenticated={!!session?.user?.id} />
    </>
  );
}
