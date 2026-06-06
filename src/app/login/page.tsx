import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { LoginForm } from "~/app/_components/login-form";
import { authOptions } from "~/server/auth";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }

  return <LoginForm />;
}
