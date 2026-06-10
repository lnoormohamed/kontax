"use client";

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
  redirectTo,
}: {
  contactId: string;
  flags: ContactBadgeFlags;
  /** where the favorite toggle returns to */
  redirectTo: string;
}) {
  const badges = resolveContactBadges(flags);
  const visible = badges.slice(0, ROW_BADGE_CAP);
  const overflow = badges.length - visible.length;

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <form action={toggleFavoriteContact} className="inline-flex">
        <input name="contactId" type="hidden" value={contactId} />
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <button
          aria-label={flags.isFavorite ? "Unfavorite" : "Favorite"}
          aria-pressed={flags.isFavorite}
          className={`grid size-[22px] place-items-center rounded-md transition hover:bg-[rgba(0,0,0,0.06)] ${
            flags.isFavorite
              ? "text-[#e0a31c]"
              : "text-[#c2c8bf] opacity-0 group-hover:opacity-100"
          }`}
          title={flags.isFavorite ? "Unfavorite" : "Favorite"}
          type="submit"
        >
          <WorkspaceIcon
            fill={flags.isFavorite ? "#e0a31c" : "none"}
            name="star"
            size={14}
          />
        </button>
      </form>

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
