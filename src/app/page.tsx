import { PublicLanding } from "~/app/_components/public-landing";
import { auth } from "~/server/auth";

export default async function HomePage() {
  const session = await auth();
  return <PublicLanding isAuthenticated={!!session?.user?.id} />;
}
