import Link from "next/link";

import { ResendVerificationButton } from "~/app/_components/resend-verification-button";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import type { InviteRecipientCheck } from "~/server/invite-recipient";

// P49A-13 (Fable re-check, B): the join pages show why the signed-in user
// can't accept an invite *before* they press Accept. The server actions still
// enforce it, but a thrown server-action message is redacted in production, so
// without this the normal new-invitee path (register → back here) ended on the
// generic error page.
export function InviteRecipientNotice({
  check,
  email,
  kind,
}: {
  check: Exclude<InviteRecipientCheck, "ok">;
  email: string;
  kind: "family" | "team";
}) {
  const noun = kind === "family" ? "family book" : "team";
  if (check === "unverified") {
    return (
      <>
        <span className="mx-auto mb-1 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-[#f6edd9] text-[#7c5511]">
          <WorkspaceIcon name="mail" size={28} strokeWidth={1.8} />
        </span>
        <h1 className="mt-3 text-[20px] font-semibold">Verify your email to join</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-[1.6] text-[#5c655e]">
          Before you can join this {noun}, confirm that{" "}
          <strong className="font-semibold text-[#1d2823]">{email}</strong> is yours. Use the link we
          emailed you, then open this invite again.
        </p>
        <ResendVerificationButton />
      </>
    );
  }
  return (
    <>
      <span className="mx-auto mb-1 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-[#f6edd9] text-[#7c5511]">
        <WorkspaceIcon name="warning" size={28} strokeWidth={1.8} />
      </span>
      <h1 className="mt-3 text-[20px] font-semibold">This invite is for someone else</h1>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-[1.6] text-[#5c655e]">
        It was sent to a different email address than{" "}
        <strong className="font-semibold text-[#1d2823]">{email}</strong>. Sign in with the invited
        address to accept it, or ask the sender to invite this one.
      </p>
      <Link
        className="mt-6 flex items-center justify-center rounded-[10px] border border-[#d8ddd6] bg-white px-4 py-3 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
        href="/contacts"
      >
        Go to Kontax
      </Link>
    </>
  );
}
