import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";

import { ImpersonationBanner } from "~/app/_components/impersonation-banner";
import { PwaRegister } from "~/app/_components/pwa-register";
import { WebVitalsReporter } from "~/app/_components/web-vitals-reporter";
import { SITE_URL } from "~/lib/site-url";

const DESCRIPTION =
  "One address book, always up to date — synced across every device over CardDAV, with full import, activity history, and sharing. Free for up to 500 contacts.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kontax — Your contacts, synced everywhere",
    template: "%s · Kontax",
  },
  description: DESCRIPTION,
  applicationName: "Kontax",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kontax",
  },
  openGraph: {
    type: "website",
    siteName: "Kontax",
    title: "Kontax — Your contacts, synced everywhere",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kontax — Your contacts, synced everywhere",
    description: DESCRIPTION,
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
        <WebVitalsReporter />
        <ImpersonationBanner />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
