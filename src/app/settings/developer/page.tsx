import Link from "next/link";
import { redirect } from "next/navigation";

import { SettingsPageHead } from "~/app/_components/settings-ui";
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import { listUserApiTokens } from "~/server/api-tokens";
import { ApiTokenManager } from "./_components/api-token-manager";

export default async function DeveloperSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [context, tokens] = await Promise.all([
    getUserBillingContext(userId),
    listUserApiTokens(userId),
  ]);

  const apiEnabled = context.entitlements.apiAccessEnabled;

  return (
    <>
      <SettingsPageHead
        title="Developer"
        sub="Manage API tokens for programmatic access to your Kontax contacts."
      />

      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-[13px] text-[#8b938c]">
          Use the REST API to access your contacts programmatically from scripts and automations.
        </p>
        <Link
          className="shrink-0 text-[13px] font-medium text-[#4158f4] transition hover:underline"
          href="/developers"
          target="_blank"
        >
          Read the API docs →
        </Link>
      </div>

      {!apiEnabled ? (
        <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.04)]">
          <div className="mx-auto max-w-[420px] py-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f4f0]">
              <svg fill="none" height="22" stroke="#5c655e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="22">
                <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="text-[17px] font-semibold text-[#1d2823]">API access is a Pro feature</p>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-[#5c655e]">
              Upgrade to Pro to create API tokens and integrate Kontax with your own tools and automations.
            </p>
            <Link
              className="mt-5 inline-flex items-center rounded-[1.2rem] bg-[#17352e] px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
              href="/settings"
            >
              View plans →
            </Link>
          </div>
        </div>
      ) : (
        <ApiTokenManager tokens={tokens} />
      )}
    </>
  );
}
