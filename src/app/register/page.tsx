import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { RegisterForm } from "~/app/_components/register-form";
import { authOptions } from "~/server/auth";

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }

  return <RegisterForm />;
}
