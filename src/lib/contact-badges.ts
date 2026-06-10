// Single registry for contact row/detail context badges (Phase 15, P15-01).
// Every place that renders a context icon — list rows, the detail page, future
// sidebar groupings — reads glyph/label/tint/priority from here so the
// vocabulary stays identical end to end.
//
// Priority ranking (lower = higher priority, shown first when the cluster caps):
// emergency > live-shared > family > team > favorite.

export type ContactBadgeId = "emergency" | "live" | "family" | "team" | "favorite";

export type ContactBadgeDef = {
  id: ContactBadgeId;
  /** WorkspaceIcon glyph name */
  icon: string;
  /** Accessible label + tooltip text */
  label: string;
  /** Icon tint (quiet by default; colour reserved for urgent states) */
  tint: string;
  /** Priority rank — lower shows first when the cluster overflows */
  rank: number;
  /** "designation" (user state) vs "membership" (where it lives) */
  category: "designation" | "membership";
};

export const CONTACT_BADGES: Record<ContactBadgeId, ContactBadgeDef> = {
  emergency: {
    id: "emergency",
    icon: "emergency",
    label: "Emergency contact",
    tint: "#b5472f",
    rank: 1,
    category: "designation",
  },
  live: {
    id: "live",
    icon: "live",
    label: "Live-shared",
    tint: "#1f8a5b",
    rank: 2,
    category: "membership",
  },
  family: {
    id: "family",
    icon: "users",
    label: "In a family book",
    tint: "#4158f4",
    rank: 3,
    category: "membership",
  },
  team: {
    id: "team",
    icon: "team",
    label: "In a team book",
    tint: "#4158f4",
    rank: 4,
    category: "membership",
  },
  favorite: {
    id: "favorite",
    icon: "star",
    label: "Favorite",
    tint: "#e0a31c",
    rank: 5,
    category: "designation",
  },
};

// Max non-favorite badges shown inline on a row before collapsing to "+N".
export const ROW_BADGE_CAP = 2;

// Resolve the applicable membership/designation badges for a contact (excludes
// favorite, which is rendered as its own interactive toggle), sorted by rank.
export function resolveContactBadges(flags: {
  isEmergency?: boolean;
  isLiveShared?: boolean;
  inFamilyBook?: boolean;
  inTeamBook?: boolean;
}): ContactBadgeDef[] {
  const out: ContactBadgeDef[] = [];
  if (flags.isEmergency) out.push(CONTACT_BADGES.emergency);
  if (flags.isLiveShared) out.push(CONTACT_BADGES.live);
  if (flags.inFamilyBook) out.push(CONTACT_BADGES.family);
  if (flags.inTeamBook) out.push(CONTACT_BADGES.team);
  return out.sort((a, b) => a.rank - b.rank);
}
