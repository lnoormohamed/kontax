"use client";

import Link from "next/link";
import { useState } from "react";

import { CopyField } from "~/app/_components/copy-field";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import {
  createLiveShare,
  createStaticShare,
  createVcardShareLink,
  revokeShare,
  unlinkLiveShare,
} from "~/app/actions/shares";

export type ShareItem = {
  id: string;
  status: string;
  recipientEmail: string | null;
  accepted: boolean;
  lastPushedAt: string | null;
  lastErrorCode: string | null;
};

export type VcardLinkItem = {
  id: string;
  token: string | null;
  downloadCount: number;
  expiresAt: string | null;
};

export type SharedBook = {
  id: string;
  name: string;
  type: "FAMILY" | "TEAM";
  memberCount: number;
};

type Props = {
  contactId: string;
  shareOrigin: string;
  isFree: boolean;
  staticShareEnabled: boolean;
  liveShareEnabled: boolean;
  isLiveReceived: boolean;
  liveOwnerLabel: string | null;
  vcardLinks: VcardLinkItem[];
  staticShares: ShareItem[];
  liveShares: ShareItem[];
  books: SharedBook[];
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-3.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#8b938c]">
      {children}
    </p>
  );
}

function IconTile({ icon }: { icon: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-[9px] border border-[#e9ece7] bg-[#f2f4f0] text-[#5c655e]">
      <WorkspaceIcon name={icon} size={18} strokeWidth={1.6} />
    </span>
  );
}

// Expanding action row. Trailing slot follows the design rule: when collapsed
// the trailing icon is check (active) or chevronRight (inactive); when expanded
// it is always a rotated chevron so users can collapse the panel.
function ActionRow({
  icon,
  title,
  subtitle,
  active,
  defaultOpen,
  children,
}: {
  icon: string;
  title: string;
  subtitle: React.ReactNode;
  active?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const trailing = open ? (
    <WorkspaceIcon
      className="shrink-0 rotate-90 text-[#aeb4ac] transition-transform"
      name="chevronRight"
      size={16}
      strokeWidth={1.9}
    />
  ) : active ? (
    <WorkspaceIcon className="shrink-0 text-[#1f8a5b]" name="check" size={16} strokeWidth={2} />
  ) : (
    <WorkspaceIcon className="shrink-0 text-[#aeb4ac]" name="chevronRight" size={16} strokeWidth={1.9} />
  );
  return (
    <div className="rounded-[10px] transition hover:bg-[#f6f7f4]">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <IconTile icon={icon} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#1d2823]">{title}</span>
          <span className="mt-px block text-xs leading-[1.45] text-[#8b938c]">{subtitle}</span>
        </span>
        {trailing}
      </button>
      {open ? <div className="px-3 pb-3 pl-[60px]">{children}</div> : null}
    </div>
  );
}

// A row that is a plain link (no expand) — used for direct .vcf download.
function LinkRow({
  icon,
  title,
  subtitle,
  href,
  download,
}: {
  icon: string;
  title: string;
  subtitle: React.ReactNode;
  href: string;
  download?: boolean;
}) {
  return (
    <a
      className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition hover:bg-[#f6f7f4]"
      download={download}
      href={href}
    >
      <IconTile icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#1d2823]">{title}</span>
        <span className="mt-px block text-xs leading-[1.45] text-[#8b938c]">{subtitle}</span>
      </span>
      <WorkspaceIcon className="shrink-0 text-[#aeb4ac]" name="chevronRight" size={16} strokeWidth={1.9} />
    </a>
  );
}

// A configured shared book in the "Add to a shared book" group.
function BookRow({ book }: { book: SharedBook }) {
  const isFamily = book.type === "FAMILY";
  return (
    <div className="flex items-center gap-3 rounded-[10px] px-3 py-2.5">
      <IconTile icon={isFamily ? "users" : "team"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[#1d2823]">{book.name}</span>
          <span className="shrink-0 rounded-[5px] bg-[#f2f4f0] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#5c655e]">
            {book.type}
          </span>
        </span>
        <span className="mt-px block text-xs text-[#8b938c]">
          {book.memberCount} {book.memberCount === 1 ? "member" : "members"} ·{" "}
          {isFamily ? "anyone in the family can view & edit" : "members get edit or view access"}
        </span>
      </span>
      <button
        className="shrink-0 cursor-not-allowed rounded-[8px] border border-[#d8ddd6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#aeb4ac]"
        disabled
        title="Adding contacts to a book arrives with Family & Team (Phase 13)"
        type="button"
      >
        Add
      </button>
    </div>
  );
}

function UpgradeNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f6edd9] px-3.5 py-2.5 text-[13px] text-[#7a5a1a]">
      <span>{children}</span>
      <Link className="shrink-0 font-semibold underline" href="/pricing">
        Upgrade
      </Link>
    </div>
  );
}

function EmailForm({
  action,
  contactId,
  cta,
}: {
  action: (formData: FormData) => void | Promise<void>;
  contactId: string;
  cta: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="contactId" type="hidden" value={contactId} />
      <input
        className="min-w-[200px] flex-1 rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-2 text-sm text-[#1d2823] outline-none focus:border-[#4158f4]"
        name="recipientEmail"
        placeholder="name@email.com"
        required
        type="email"
      />
      <button
        className="rounded-[9px] bg-[#4158f4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3248db]"
        type="submit"
      >
        {cta}
      </button>
    </form>
  );
}

function RecipientList({
  shares,
  contactId,
  live,
}: {
  shares: ShareItem[];
  contactId: string;
  live?: boolean;
}) {
  if (shares.length === 0) return null;
  return (
    <ul className="mt-3 grid gap-2">
      {shares.map((share) => {
        const statusLabel = share.recipientEmail
          ? share.status === "REVOKED"
            ? "Revoked"
            : share.status === "DECLINED"
              ? "Declined"
              : share.accepted
                ? live
                  ? "Live"
                  : "Accepted"
                : "Pending"
          : "";
        return (
          <li
            className="flex items-center justify-between gap-3 border-b border-[#e9ece7] pb-2 text-[13px] last:border-b-0"
            key={share.id}
          >
            <span className="min-w-0">
              <span className="block truncate text-[#1d2823]">{share.recipientEmail}</span>
              {live && share.accepted && share.status === "ACTIVE" ? (
                share.lastErrorCode === "RECIPIENT_LOCKED" ? (
                  <span className="block text-[12px] text-[#bf8526]">
                    Sync paused — recipient account issue
                  </span>
                ) : share.lastErrorCode ? (
                  <span className="block text-[12px] text-[#bf8526]">Sync error — will retry</span>
                ) : share.lastPushedAt ? (
                  <span className="block text-[12px] text-[#8b938c]">
                    Last synced {formatDate(share.lastPushedAt)}
                  </span>
                ) : null
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-[#8b938c]">{statusLabel}</span>
              {share.status === "ACTIVE" && (live || !share.accepted) ? (
                <form action={revokeShare}>
                  <input name="shareId" type="hidden" value={share.id} />
                  <input name="contactId" type="hidden" value={contactId} />
                  <button className="font-semibold text-[#b5472f]" type="submit">
                    Revoke
                  </button>
                </form>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ContactSharing({
  contactId,
  shareOrigin,
  isFree,
  staticShareEnabled,
  liveShareEnabled,
  isLiveReceived,
  liveOwnerLabel,
  vcardLinks,
  staticShares,
  liveShares,
  books,
}: Props) {
  const hasStatic = staticShares.some((s) => s.status === "ACTIVE");
  const hasLive = liveShares.some((s) => s.status === "ACTIVE");
  const isShared = isLiveReceived || hasStatic || hasLive || vcardLinks.length > 0;

  return (
    <section className="rounded-[14px] border border-[#d8ddd6] bg-white" id="contact-sharing">
      <h3 className="px-5 pt-4 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
        Share this contact
      </h3>
      <div className="mt-3 h-px bg-[#e9ece7]" />

      <div className="px-2 py-2">
        {/* Intro (only when nothing is shared yet) */}
        {!isShared ? (
          <div className="flex items-start gap-3 px-3 pb-1 pt-2">
            <IconTile icon="share" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1d2823]">This contact isn&rsquo;t shared yet</p>
              <p className="mt-0.5 text-[12.5px] leading-[1.45] text-[#8b938c]">
                Add it to a family or team book so others can help keep it current, send someone a
                copy, or share a read-only live link.
              </p>
            </div>
          </div>
        ) : null}

        {/* Add to a shared book — books are configured; adding a contact to a
            book lands with Family & Team (Phase 13). */}
        <GroupLabel>Add to a shared book</GroupLabel>
        {books.length > 0 ? (
          books.map((book) => <BookRow book={book} key={book.id} />)
        ) : (
          <div className="mx-3 my-1 rounded-[12px] border border-dashed border-[#d8ddd6] px-4 py-4 text-center">
            <p className="text-[13.5px] font-semibold text-[#1d2823]">No shared books yet</p>
            <p className="mx-auto mt-0.5 max-w-sm text-[12.5px] text-[#8b938c]">
              Family &amp; team books are coming soon — everyone in a book can help keep shared
              contacts up to date.
            </p>
          </div>
        )}

        {/* Share with a Kontax user */}
        <GroupLabel>Share with a Kontax user</GroupLabel>

        {isLiveReceived ? (
          <ActionRow
            active
            defaultOpen
            icon="live"
            subtitle="A read-only mirror kept in sync by its owner"
            title={`Live from ${liveOwnerLabel ?? "another Kontax user"}`}
          >
            <p className="mb-3 text-[12.5px] leading-[1.45] text-[#8b938c]">
              Shared fields are read-only and stay in sync with the owner. Your notes stay private.
              Unlink to keep a frozen copy you can edit.
            </p>
            <form action={unlinkLiveShare}>
              <input name="contactId" type="hidden" value={contactId} />
              <button
                className="rounded-[9px] border border-[#d8ddd6] bg-white px-3.5 py-2 text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                type="submit"
              >
                Unlink (keep a static copy)
              </button>
            </form>
          </ActionRow>
        ) : null}

        <ActionRow
          active={hasStatic}
          defaultOpen={hasStatic}
          icon="send"
          subtitle="A snapshot — recipient's edits stay separate"
          title="Send a copy"
        >
          {staticShareEnabled ? (
            <EmailForm action={createStaticShare} contactId={contactId} cta="Send copy" />
          ) : (
            <UpgradeNote>Sending a copy to another Kontax user is a Pro feature.</UpgradeNote>
          )}
          <RecipientList contactId={contactId} shares={staticShares} />
        </ActionRow>

        {!isLiveReceived ? (
          <ActionRow
            active={hasLive}
            defaultOpen={hasLive}
            icon="live"
            subtitle="A read-only mirror — they see your updates"
            title="Share a live link"
          >
            {liveShareEnabled ? (
              <EmailForm action={createLiveShare} contactId={contactId} cta="Share live" />
            ) : (
              <UpgradeNote>Live sharing is a Pro feature (both people need a paid plan).</UpgradeNote>
            )}
            <RecipientList contactId={contactId} live shares={liveShares} />
          </ActionRow>
        ) : null}

        {/* Export as vCard */}
        <GroupLabel>Export as vCard</GroupLabel>
        <LinkRow
          download
          href={`/api/contacts/${contactId}/vcard`}
          icon="download"
          subtitle="Works with any contacts app"
          title="Download .vcf"
        />
        <ActionRow
          active={vcardLinks.length > 0}
          defaultOpen={vcardLinks.length > 0}
          icon="link"
          subtitle={
            isFree
              ? "Anyone with the link, no account needed · free links expire after 7 days"
              : "Anyone with the link, no account needed"
          }
          title="Copy vCard link"
        >
          {vcardLinks.length === 0 ? (
            <form action={createVcardShareLink}>
              <input name="contactId" type="hidden" value={contactId} />
              <button
                className="rounded-[9px] bg-[#4158f4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3248db]"
                type="submit"
              >
                Create share link
              </button>
            </form>
          ) : (
            <div className="grid gap-3">
              {vcardLinks.map((link) => (
                <div key={link.id}>
                  <CopyField
                    helper={`${link.downloadCount} download${link.downloadCount === 1 ? "" : "s"}${
                      link.expiresAt ? ` · expires ${formatDate(link.expiresAt)}` : " · no expiry"
                    }`}
                    label="Share link"
                    value={`${shareOrigin}/share/${link.token}`}
                  />
                  <form action={revokeShare}>
                    <input name="shareId" type="hidden" value={link.id} />
                    <input name="contactId" type="hidden" value={contactId} />
                    <button className="mt-1.5 text-[13px] font-semibold text-[#b5472f]" type="submit">
                      Revoke link
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </ActionRow>
      </div>
    </section>
  );
}
