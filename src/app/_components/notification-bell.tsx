"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
import {
  SecurityAlertDrawer,
  type SecurityAlertView,
} from "~/app/_components/security-alert-drawer";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

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

  const unread = items.filter((n) => !n.read).length;
  const display = unread > 9 ? "9+" : String(unread);

  const openRow = async (n: FeedItem) => {
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    void markNotificationReadAction(n.id).then(() => router.refresh());
    setOpen(false);
    if (n.category === "SECURITY" && n.securityAlertId) {
      const a = await fetchSecurityAlertAction(n.securityAlertId);
      if (a) setAlert(a);
    } else if (n.actionUrl) {
      router.push(n.actionUrl);
    }
  };

  const dismiss = (id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    void dismissNotificationAction(id).then(() => router.refresh());
  };

  const markAll = () => {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    void markAllNotificationsReadAction().then(() => router.refresh());
  };

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
          className="absolute right-[-4px] top-[50px] z-[65] flex max-h-[480px] w-[360px] flex-col overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white shadow-[0_8px_32px_rgba(29,40,35,0.12)] max-md:fixed max-md:inset-0 max-md:top-0 max-md:h-screen max-md:max-h-none max-md:w-screen max-md:rounded-none"
          role="dialog"
        >
          <div className="flex h-11 flex-none items-center gap-2.5 border-b border-[#f2f4f0] px-3.5">
            <span className="text-[14px] font-bold text-[#1d2823]">Notifications</span>
            <button
              aria-label="Close"
              className="ml-auto grid h-[30px] w-[30px] place-items-center rounded-lg text-[#3a4540] hover:bg-[#f2f4f0] md:hidden"
              onClick={() => setOpen(false)}
              type="button"
            >
              <WorkspaceIcon name="x" size={18} />
            </button>
            {unread > 0 && (
              <button
                className="ml-auto p-1 text-[13px] font-medium text-[#4158f4] hover:underline max-md:ml-0"
                onClick={markAll}
                type="button"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-[100px] flex-col items-center justify-center p-4">
                <span className="text-[#d8ddd6]">
                  <WorkspaceIcon name="bell" size={32} strokeWidth={1.6} />
                </span>
                <div className="mt-3 text-[13px] text-[#8b938c]">No notifications</div>
              </div>
            ) : (
              <>
                {items.map((n) => (
                  <div
                    className="group relative flex min-h-[72px] cursor-pointer items-start gap-3 border-b border-[#f2f4f0] py-3 pl-4 pr-3.5 transition hover:bg-[#fbfcfa] data-[unread=true]:bg-[#f9faf8] data-[unread=true]:hover:bg-[#f4f6f2]"
                    data-unread={!n.read}
                    key={n.id}
                    onClick={() => openRow(n)}
                  >
                    {!n.read && (
                      <span className="absolute left-1.5 top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full bg-[#4158f4]" />
                    )}
                    <CategoryTile category={n.category} />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-[13px] text-[#1d2823] ${
                          n.read ? "font-semibold" : "font-bold"
                        }`}
                      >
                        {n.title}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[12px] leading-[1.4] text-[#5c655e]">
                        {n.body}
                      </div>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-1.5">
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
                  </div>
                ))}
                <div className="py-4 text-center text-[12px] text-[#aeb4ac]">
                  No more notifications
                </div>
              </>
            )}
          </div>

          <Link
            className="flex h-10 flex-none items-center justify-center gap-1.5 border-t border-[#f2f4f0] bg-white text-[13px] font-medium text-[#4158f4] hover:bg-[#fafbf9]"
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
