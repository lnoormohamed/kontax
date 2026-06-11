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

// ── Primitives ────────────────────────────────────────────────────────────────

function GroupLabel({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-3 pb-1 pt-4">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#8b938c]">
        {children}
      </p>
      {note ? <span className="text-[11px] font-medium text-[#aeb4ac]">{note}</span> : null}
    </div>
  );
}

function IconTile({ icon, tone = "default" }: { icon: string; tone?: "green" | "default" }) {
  return tone === "green" ? (
    <span className="grid size-9 shrink-0 place-items-center rounded-[9px] border border-[#cfe3d6] bg-[#eef5ef] text-[#17352e]">
      <WorkspaceIcon name={icon} size={18} strokeWidth={1.6} />
    </span>
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-[9px] border border-[#e9ece7] bg-[#f2f4f0] text-[#5c655e]">
      <WorkspaceIcon name={icon} size={18} strokeWidth={1.6} />
    </span>
  );
}

// Status pill — used in recipient rows.
function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string; dot: string }> = {
    Pending:  { bg: "#f2f4f0", fg: "#5c655e",  dot: "#aeb4ac" },
    Accepted: { bg: "#eef5ef", fg: "#1c6b48",  dot: "#1f8a5b" },
    Live:     { bg: "#eef5ef", fg: "#17352e",  dot: "#1f8a5b" },
    Declined: { bg: "#f2f4f0", fg: "#8b938c",  dot: "#aeb4ac" },
    Revoked:  { bg: "#f3e1da", fg: "#b5472f",  dot: "#b5472f" },
    Expired:  { bg: "#f2f4f0", fg: "#8b938c",  dot: "#aeb4ac" },
  };
  const s = styles[status] ?? styles["Pending"]!;
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-[11.5px] font-bold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      <span
        className={`inline-block size-[6px] shrink-0 rounded-full${status === "Live" ? " live-pulse" : ""}`}
        style={{ background: s.dot }}
      />
      {status}
    </span>
  );
}

// Expand/collapse action row.
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
    <div
      className="rounded-[12px] border transition"
      style={{
        background: open ? "#fff" : "transparent",
        borderColor: open ? "#e9ece7" : "transparent",
      }}
    >
      <button
        aria-expanded={open}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${!open ? "hover:bg-[#f6f7f4] rounded-[12px]" : ""}`}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <IconTile icon={icon} tone={active ? "green" : "default"} />
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
      className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition hover:bg-[#f6f7f4]"
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

// Shared book row (Phase 13 — Add button disabled).
function BookRow({ book }: { book: SharedBook }) {
  const isFamily = book.type === "FAMILY";
  return (
    <div className="flex items-center gap-3 rounded-[12px] px-3 py-2.5">
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

// Amber upgrade prompt with lock icon.
function UpgradeNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[#ecdcb6] bg-[#f6edd9] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#7a5a1a]">
      <span className="flex items-center gap-2">
        <WorkspaceIcon name="lock" size={14} strokeWidth={1.8} className="shrink-0 text-[#bf8526]" />
        {children}
      </span>
      <Link className="shrink-0 font-semibold text-[#bf8526] underline" href="/pricing">
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

// Sent-share rows with status pills.
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
    <ul className="mt-3 grid gap-0">
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
          : "Pending";
        return (
          <li
            className="flex items-center justify-between gap-3 border-b border-[#edf0ea] py-2.5 text-[13px] last:border-b-0"
            key={share.id}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-[#1d2823]">{share.recipientEmail}</span>
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
            <span className="flex shrink-0 items-center gap-2.5">
              <StatusPill status={statusLabel} />
              {share.status === "ACTIVE" && (live || !share.accepted) ? (
                <form action={revokeShare}>
                  <input name="shareId" type="hidden" value={share.id} />
                  <input name="contactId" type="hidden" value={contactId} />
                  <button className="text-[13px] font-semibold text-[#b5472f] hover:underline" type="submit">
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

// Green-wash "Live from [owner]" panel — visually distinct from neutral sync badges.
function LiveFromPanel({ owner, contactId }: { owner: string; contactId: string }) {
  const initials = owner
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <section
      className="rounded-[14px] border"
      style={{ background: "#eef5ef", borderColor: "#cfe3d6" }}
    >
      <div className="p-4">
        {/* Owner identity + Live pill */}
        <div className="flex items-center gap-3">
          <span
            className="grid size-[42px] shrink-0 place-items-center rounded-full text-sm font-semibold"
            style={{ background: "#d6e7dc", color: "#17352e" }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-[#17352e]">Live from {owner}</h3>
              <StatusPill status="Live" />
            </div>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "#3f5f54" }}>
              Stays in sync with the owner
            </p>
          </div>
        </div>

        {/* Explainer */}
        <p className="mt-3 text-[13.5px] leading-[1.55]" style={{ color: "#28473d" }}>
          This contact stays in sync with its owner —{" "}
          <strong className="font-semibold">shared fields are read-only</strong>. Your notes stay
          private. Unlink to keep a frozen copy you can edit.
        </p>

        {/* Unlink action */}
        <div className="mt-3.5">
          <form action={unlinkLiveShare}>
            <input name="contactId" type="hidden" value={contactId} />
            <button
              className="inline-flex items-center gap-2 rounded-[9px] border border-[#d8ddd6] bg-white px-3.5 py-2 text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
              type="submit"
            >
              <WorkspaceIcon name="link" size={15} strokeWidth={1.8} className="text-[#5c655e]" />
              Unlink (keep a static copy)
            </button>
          </form>
        </div>
      </div>
    </section>
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

  return (
    <section className="rounded-[14px] border border-[#d8ddd6] bg-white" id="contact-sharing">
      <h3 className="px-5 pt-4 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
        Share this contact
      </h3>
      <div className="mt-3 h-px bg-[#e9ece7]" />

      <div className="px-2 py-2">

        {/* ── vCard link (all plans) ── */}
        <GroupLabel note="all plans">vCard link</GroupLabel>

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
                    <button className="mt-1.5 text-[13px] font-semibold text-[#b5472f] hover:underline" type="submit">
                      Revoke link
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </ActionRow>

        {/* ── Share with a Kontax user (Pro+) ── */}
        <GroupLabel note="Pro & above">Share with a Kontax user</GroupLabel>

        {/* Live-received: show the green-wash panel instead of a send form */}
        {isLiveReceived ? (
          <LiveFromPanel
            contactId={contactId}
            owner={liveOwnerLabel ?? "a Kontax user"}
          />
        ) : null}

        {/* Send a static copy */}
        <ActionRow
          active={hasStatic}
          defaultOpen={hasStatic}
          icon="send"
          subtitle="A one-time snapshot — the recipient's edits stay separate"
          title="Send a copy"
        >
          {staticShareEnabled ? (
            <EmailForm action={createStaticShare} contactId={contactId} cta="Send copy" />
          ) : (
            <UpgradeNote>Sharing with another Kontax user is a Pro feature</UpgradeNote>
          )}
          <RecipientList contactId={contactId} shares={staticShares} />
        </ActionRow>

        {/* Share live (hidden when the contact IS a live-received copy) */}
        {!isLiveReceived ? (
          <ActionRow
            active={hasLive}
            defaultOpen={hasLive}
            icon="live"
            subtitle="A linked copy that updates whenever you edit"
            title="Share live"
          >
            {liveShareEnabled ? (
              <>
                <p className="mb-2.5 text-[12.5px] leading-[1.5] text-[#8b938c]">
                  The recipient gets a linked copy that updates whenever you edit. Both of you must
                  be on a paid plan.
                </p>
                <EmailForm action={createLiveShare} contactId={contactId} cta="Share live" />
              </>
            ) : (
              <UpgradeNote>
                Live sharing is a Pro feature — both people need a paid plan
              </UpgradeNote>
            )}
            <RecipientList contactId={contactId} live shares={liveShares} />
          </ActionRow>
        ) : null}

        {/* ── Add to a shared book (Phase 13) ── */}
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
      </div>
    </section>
  );
}
