import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";

import { ImpersonationBanner } from "~/app/_components/impersonation-banner";
import { PwaRegister } from "~/app/_components/pwa-register";

export const metadata: Metadata = {
  title: "Kontax",
  description: "Kontax is a consumer-friendly contact app built on the T3 stack.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kontax",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#17352e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ImpersonationBanner />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
