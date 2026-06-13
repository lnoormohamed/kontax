"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  dismissNotificationAction,
  fetchSecurityAlertAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "~/app/actions/notifications";
import {
  CATEGORY_TILE,
  type NotificationCategory,
  relativeTime,
} from "~/app/_components/notification-categories";
import type { SecurityAlertView } from "~/app/_components/security-alert-drawer";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

const SecurityAlertDrawer = dynamic(
  () => import("~/app/_components/security-alert-drawer").then((mod) => mod.SecurityAlertDrawer),
  { ssr: false },
);

export type FeedItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  read: boolean;
  actionUrl: string | null;
  securityAlertId: string | null;
  createdAt: string;
};

function CategoryTile({ category }: { category: NotificationCategory }) {
  const tile = CATEGORY_TILE[category] ?? CATEGORY_TILE.PRODUCT_UPDATES;
  return (
    <span
      className="grid h-8 w-8 flex-none place-items-center rounded-lg"
      style={{ background: tile.bg, color: tile.fg }}
    >
      <WorkspaceIcon name={tile.icon} size={16} strokeWidth={1.9} />
    </span>
  );
}

function NotificationSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[0.06em] text-[#8b938c] md:hidden">
      {children}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="md:hidden">
      {[0, 1, 2].map((index) => (
        <div className="flex min-h-[72px] items-start gap-3 border-b border-[#f2f4f0] px-4 py-3" key={index}>
          <span className="h-9 w-9 flex-none animate-pulse rounded-xl bg-[#f2f4f0]" />
          <span className="min-w-0 flex-1 space-y-2 pt-1">
            <span className="block h-3.5 w-3/5 animate-pulse rounded-full bg-[#f2f4f0]" />
            <span className="block h-3 w-4/5 animate-pulse rounded-full bg-[#f2f4f0]" />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * P22-DB05 surfaces 1 + 2: header bell with unread badge + dropdown feed.
 * Replaces the legacy pending-shares bell (Resolution 1). SECURITY rows open the
 * anomaly drawer; rows with an actionUrl navigate.
 */
export function NotificationBell({ initialItems }: { initialItems: FeedItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [alert, setAlert] = useState<SecurityAlertView | null>(null);
  const [loadingSecurityId, setLoadingSecurityId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Re-seed from server props after router.refresh().
  useEffect(() => setItems(initialItems), [initialItems]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;
  const display = unread > 9 ? "9+" : String(unread);
  const grouped = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      fresh: items.filter((n) => !n.read || new Date(n.createdAt).getTime() >= dayAgo),
      earlier: items.filter((n) => n.read && new Date(n.createdAt).getTime() < dayAgo),
    };
  }, [items]);
  const showLoading = isPending || Boolean(loadingSecurityId);

  const openRow = async (n: FeedItem) => {
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    if (n.category === "SECURITY" && n.securityAlertId) {
      setLoadingSecurityId(n.id);
      void markNotificationReadAction(n.id).then(() => router.refresh());
      const a = await fetchSecurityAlertAction(n.securityAlertId);
      setLoadingSecurityId(null);
      setOpen(false);
      if (a) setAlert(a);
    } else if (n.actionUrl) {
      void markNotificationReadAction(n.id);
      setOpen(false);
      router.push(n.actionUrl);
    } else {
      startTransition(async () => {
        await markNotificationReadAction(n.id);
        router.refresh();
      });
    }
  };

  const dismiss = (id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    void dismissNotificationAction(id).then(() => router.refresh());
  };

  const markAll = () => {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  };

  const renderRows = (rows: FeedItem[]) =>
    rows.map((n) => (
      <div
        className="group relative flex min-h-[72px] cursor-pointer items-start gap-3 border-b border-[#f2f4f0] py-3 pl-4 pr-3.5 transition hover:bg-[#fbfcfa] data-[unread=true]:bg-[#f9faf8] data-[unread=true]:hover:bg-[#f4f6f2] max-md:min-h-[76px] max-md:border-[#e9ece7] max-md:bg-white max-md:px-4 max-md:py-3.5 max-md:data-[unread=true]:bg-[#f8faf7]"
        data-unread={!n.read}
        key={n.id}
        onClick={() => openRow(n)}
      >
        {!n.read && (
          <span className="absolute left-1.5 top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full bg-[#4158f4] max-md:left-auto max-md:right-4 max-md:top-4 max-md:h-2 max-md:w-2 max-md:translate-y-0" />
        )}
        <CategoryTile category={n.category} />
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-[13px] text-[#1d2823] max-md:text-[14.5px] ${
              n.read ? "font-semibold" : "font-bold max-md:font-semibold"
            }`}
          >
            {n.title}
          </div>
          <div className="mt-0.5 line-clamp-2 text-[12px] leading-[1.4] text-[#5c655e] max-md:mt-1 max-md:text-[13px] max-md:text-[#8b938c]">
            {n.body}
          </div>
          <div className="mt-1 hidden items-center gap-1.5 text-[11.5px] font-medium text-[#8b938c] max-md:flex">
            <span>{relativeTime(n.createdAt)}</span>
            {n.category === "SECURITY" ? (
              <>
                <span aria-hidden>·</span>
                <span>Security review</span>
              </>
            ) : n.actionUrl ? (
              <>
                <span aria-hidden>·</span>
                <span>Open</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5 max-md:hidden">
          <span className="text-[11px] text-[#8b938c] tabular-nums">
            {relativeTime(n.createdAt)}
          </span>
          <button
            aria-label="Dismiss"
            className="grid h-5 w-5 place-items-center rounded-md text-[#8b938c] opacity-0 transition hover:bg-black/5 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              dismiss(n.id);
            }}
            type="button"
          >
            <WorkspaceIcon name="x" size={13} strokeWidth={2} />
          </button>
        </div>
        <WorkspaceIcon name="chevronRight" size={15} strokeWidth={2} className="mt-1 hidden flex-none text-[#aeb4ac] max-md:block" />
      </div>
    ));

  return (
    <div className="relative" ref={wrapRef}>
      <button
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid h-[38px] w-[38px] place-items-center rounded-[9px] text-[#5c655e] transition hover:bg-black/5 hover:text-[#1d2823]"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <WorkspaceIcon name="bell" size={20} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute right-[3px] top-[3px] grid h-[18px] w-[18px] place-items-center rounded-full bg-[#b5472f] text-[11px] font-bold leading-none text-white">
            {display}
          </span>
        )}
        {open && (
          <span className="absolute bottom-[3px] left-[9px] right-[9px] h-0.5 rounded-sm bg-[#17352e]" />
        )}
      </button>

      {open && (
        <div
          aria-label="Notifications"
          className="absolute right-[-4px] top-[50px] z-[65] flex max-h-[480px] w-[360px] flex-col overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white shadow-[0_8px_32px_rgba(29,40,35,0.12)] max-md:fixed max-md:inset-0 max-md:top-0 max-md:z-[100] max-md:h-[100dvh] max-md:max-h-none max-md:w-screen max-md:rounded-none max-md:border-0"
          role="dialog"
        >
          <div className="flex h-11 flex-none items-center gap-2.5 border-b border-[#f2f4f0] px-3.5 max-md:h-[52px] max-md:border-[#d8ddd6] max-md:bg-white max-md:px-3">
            <span className="text-[14px] font-bold text-[#1d2823] max-md:text-[19px] max-md:font-bold">Notifications</span>
            <button
              aria-label="Close"
              className="ml-auto grid h-[44px] w-[44px] place-items-center rounded-xl text-[#3a4540] hover:bg-[#f2f4f0] md:hidden"
              onClick={() => setOpen(false)}
              type="button"
            >
              <WorkspaceIcon name="x" size={18} />
            </button>
            {unread > 0 && (
              <button
                className="ml-auto p-1 text-[13px] font-medium text-[#4158f4] hover:underline max-md:ml-0 max-md:text-[13.5px] max-md:font-semibold"
                disabled={isPending}
                onClick={markAll}
                type="button"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto max-md:bg-white">
            {showLoading ? <LoadingRows /> : null}
            {items.length === 0 && !showLoading ? (
              <div className="flex h-[100px] flex-col items-center justify-center p-4 max-md:h-full max-md:px-8">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f2f4f0] text-[#aeb4ac] md:bg-transparent md:text-[#d8ddd6]">
                  <WorkspaceIcon name="bell" size={32} strokeWidth={1.6} />
                </span>
                <div className="mt-3 text-[15px] font-semibold text-[#1d2823] md:text-[13px] md:font-normal md:text-[#8b938c]">No notifications</div>
                <p className="mt-1 hidden max-w-[240px] text-center text-[12.5px] leading-5 text-[#8b938c] max-md:block">
                  Security, sharing, sync, billing, reminders, and product updates will appear here.
                </p>
              </div>
            ) : (
              <>
                {grouped.fresh.length > 0 ? (
                  <>
                    <NotificationSectionLabel>New</NotificationSectionLabel>
                    {renderRows(grouped.fresh)}
                  </>
                ) : null}
                {grouped.earlier.length > 0 ? (
                  <>
                    <NotificationSectionLabel>Earlier</NotificationSectionLabel>
                    {renderRows(grouped.earlier)}
                  </>
                ) : null}
                <div className="py-4 text-center text-[12px] text-[#aeb4ac]">
                  No more notifications
                </div>
              </>
            )}
          </div>

          <Link
            className="flex h-10 flex-none items-center justify-center gap-1.5 border-t border-[#f2f4f0] bg-white text-[13px] font-medium text-[#4158f4] hover:bg-[#fafbf9] max-md:h-[52px] max-md:border-[#d8ddd6] max-md:text-[14px] max-md:font-semibold"
            href="/settings/notifications"
            onClick={() => setOpen(false)}
          >
            Notification settings
            <WorkspaceIcon name="chevronRight" size={14} strokeWidth={2} />
          </Link>
        </div>
      )}

      {alert && (
        <SecurityAlertDrawer
          alert={alert}
          onClose={() => setAlert(null)}
          onResolved={() => router.refresh()}
        />
      )}
    </div>
  );
}
