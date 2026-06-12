import "~/styles/globals.css";

import { type Metadata } from "next";

import { ImpersonationBanner } from "~/app/_components/impersonation-banner";

export const metadata: Metadata = {
  title: "Kontax",
  description: "Kontax is a consumer-friendly contact app built on the T3 stack.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ImpersonationBanner />
        {children}
      </body>
    </html>
  );
}
