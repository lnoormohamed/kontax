"use client";

import { useEffect, useState, useTransition } from "react";

import { toggleFavoriteContact } from "~/app/actions/contacts";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { ROW_BADGE_CAP, resolveContactBadges } from "~/lib/contact-badges";

export type ContactBadgeFlags = {
  isFavorite: boolean;
  isEmergency?: boolean;
  isLiveShared?: boolean;
  inFamilyBook?: boolean;
  inTeamBook?: boolean;
};

// The single inline context-icon cluster for a contact row (P15-01): an
// interactive favorite toggle plus the governed, capped set of membership /
// designation badges from the registry. The only place row context icons render.
export function ContactBadgeCluster({
  contactId,
  flags,
}: {
  contactId: string;
  flags: ContactBadgeFlags;
  /** @deprecated favorite toggles no longer redirect in the PWA flow */
  redirectTo?: string;
}) {
  const [, startTransition] = useTransition();
  const [optimisticFavorite, setOptimisticFavorite] = useState(flags.isFavorite);
  const optimisticFlags = { ...flags, isFavorite: optimisticFavorite };
  const badges = resolveContactBadges(optimisticFlags);
  const visible = badges.slice(0, ROW_BADGE_CAP);
  const overflow = badges.length - visible.length;

  useEffect(() => {
    setOptimisticFavorite(flags.isFavorite);
  }, [flags.isFavorite]);

  const handleFavoriteToggle = () => {
    setOptimisticFavorite((current) => !current);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("contactId", contactId);
      await toggleFavoriteContact(fd);
    });
  };

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span className="inline-flex">
        <button
          aria-label={optimisticFavorite ? "Unfavorite" : "Favorite"}
          aria-pressed={optimisticFavorite}
          className={`grid place-items-center rounded-md transition hover:bg-[rgba(0,0,0,0.06)] -m-[11px] size-[44px] md:m-0 md:size-[22px] ${
            optimisticFavorite
              ? "text-[#e0a31c]"
              : "pointer-events-none text-[#c2c8bf] opacity-0 md:pointer-events-auto md:group-hover:opacity-100"
          }`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleFavoriteToggle();
          }}
          title={optimisticFavorite ? "Unfavorite" : "Favorite"}
          type="button"
        >
          <WorkspaceIcon
            fill={optimisticFavorite ? "#e0a31c" : "none"}
            name="star"
            size={14}
          />
        </button>
      </span>

      {visible.map((badge) => (
        <span
          aria-label={badge.label}
          className="grid size-[18px] place-items-center"
          key={badge.id}
          style={{ color: badge.tint }}
          title={badge.label}
        >
          <WorkspaceIcon name={badge.icon} size={14} strokeWidth={1.7} />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="text-[11px] font-semibold text-[#8b938c]"
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
