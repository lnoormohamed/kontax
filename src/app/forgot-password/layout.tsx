import { type Metadata } from "next";

const description = "Request a secure password reset link for your Kontax account.";

export const metadata: Metadata = {
  title: "Reset password",
  description,
  alternates: { canonical: "/forgot-password" },
  openGraph: {
    title: "Reset password | Kontax",
    description,
    url: "/forgot-password",
  },
  twitter: {
    card: "summary",
    title: "Reset password | Kontax",
    description,
  },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
