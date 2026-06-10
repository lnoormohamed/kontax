import { redirect } from "next/navigation";

import { CreateContactForm } from "~/app/_components/create-contact-form";
import { auth } from "~/server/auth";

export default async function NewContactPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return <CreateContactForm />;
}
