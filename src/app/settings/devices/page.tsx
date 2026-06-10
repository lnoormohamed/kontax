import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppPasswordManager } from "~/app/_components/app-password-manager";
import { ConnectionGuides } from "~/app/_components/connection-guides";
import { CopyField } from "~/app/_components/copy-field";
import { SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { canCreateAppPassword, listUserAppPasswords } from "~/server/app-passwords";
import { auth } from "~/server/auth";

const getPublicOrigin = async () => {
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const forwardedProto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost ?? "localhost:3000";
  const proto = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
};

export default async function SettingsDevicesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const [appPasswords, appPasswordAllowance, carddavServerUrl] = await Promise.all([
    listUserAppPasswords(userId),
    canCreateAppPassword(userId),
    getPublicOrigin(),
  ]);
  const email = session.user.email ?? "";

  return (
    <>
      <SettingsPageHead
        title="Devices & app passwords"
        sub="Add Kontax to your iPhone, Mac, or Android as a contacts account. Your contacts then stay in sync automatically — no app required."
      />

      <div className="grid gap-[18px]">
        <SettingsCard>
          <p className="text-[15px] font-semibold text-[#1d2823]">Connection details</p>
          <p className="mt-1 text-[14px] leading-6 text-[#5c655e]">
            Enter these during CardDAV setup on your device.
          </p>
          <div className="mt-4 grid gap-3">
            <CopyField
              helper="Enter this as the server address during CardDAV setup on your device."
              label="Server URL"
              value={carddavServerUrl}
            />
            <CopyField label="Username" value={email} />
          </div>
        </SettingsCard>

        <SettingsCard>
          <p className="text-[15px] font-semibold text-[#1d2823]">App passwords</p>
          <p className="mt-1 text-[14px] leading-6 text-[#5c655e]">
            Each device uses its own app password instead of your Kontax login, so you can revoke a single
            device without affecting the others.
          </p>
          <div className="mt-4">
            <AppPasswordManager allowance={appPasswordAllowance} appPasswords={appPasswords} />
          </div>
        </SettingsCard>

        <SettingsCard>
          <p className="text-[15px] font-semibold text-[#1d2823]">Step-by-step setup</p>
          <p className="mt-1 text-[14px] leading-6 text-[#5c655e]">
            Pick your device and follow the steps. The server URL and username are already filled in for you.
          </p>
          <div className="mt-4">
            <ConnectionGuides email={email} serverUrl={carddavServerUrl} />
          </div>
        </SettingsCard>
      </div>
    </>
  );
}
