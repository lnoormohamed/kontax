/**
 * P40-03 — Sharing-policy resolution (source spec: phase-37/01 §3.3–3.4, §5).
 *
 * A sharing policy is a per-field-type map of "does this field flow into the
 * shared layer of a shared book?". It is decided once when a member creates or
 * joins a shared book and then applied silently on every edit — the
 * "no prompt on every edit" rule (§5).
 *
 * Two policies participate in a shared book:
 *   - GroupMember.sharingPolicy         — the member's own default (null = use
 *                                         DEFAULT_SHARING_POLICY).
 *   - GroupAddressBook.minimumSharingPolicy — a Teams-only floor (null on Family
 *                                         books). A field forced shared by the
 *                                         floor cannot be made private by the
 *                                         member.
 *
 * This module is pure — no DB, no I/O — so the resolution is unit-testable and
 * every consumer (edit-context resolution in P40-07, the projection in P41)
 * agrees on one implementation.
 */

/** Canonical policy keys. The label on a field entry maps onto one of these. */
export const SHARING_POLICY_KEYS = [
  "name",
  "company",
  "jobTitle",
  "workEmail",
  "workPhone",
  "personalEmail",
  "personalPhone",
  "homeAddress",
  "birthday",
  "notes",
  "labels",
  "customFields",
] as const;

export type SharingPolicyKey = (typeof SHARING_POLICY_KEYS)[number];

/** A share flag per policy key. Missing keys fall back to the default. */
export type SharingPolicy = Partial<Record<SharingPolicyKey, boolean>>;

/** A fully-resolved policy — every key present. */
export type EffectiveSharingPolicy = Record<SharingPolicyKey, boolean>;

/**
 * Default policy (§5): work-context fields shared, everything personal private.
 * Used when a member's sharingPolicy is null/absent for a key.
 */
export const DEFAULT_SHARING_POLICY: EffectiveSharingPolicy = {
  name: true,
  company: true,
  jobTitle: true,
  workEmail: true,
  workPhone: true,
  personalEmail: false,
  personalPhone: false,
  homeAddress: false,
  birthday: false,
  notes: false,
  labels: false,
  customFields: false,
};

/** A stored policy value is untrusted JSON — coerce it into a clean partial. */
export function normalizeSharingPolicy(raw: unknown): SharingPolicy {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const out: SharingPolicy = {};
  for (const key of SHARING_POLICY_KEYS) {
    const value = source[key];
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

/**
 * Resolve the member's effective policy in a book.
 *
 * Per §3.4: effective = per-field OR of the floor with the member policy. The
 * member fills any key their policy omits from DEFAULT_SHARING_POLICY; the floor
 * then forces any key it marks shared to stay shared (a member can restrict
 * further — turn an un-floored field private — but cannot loosen a floored one).
 */
export function resolveEffectiveSharingPolicy(
  memberPolicy: unknown,
  minimumPolicy: unknown = null,
): EffectiveSharingPolicy {
  const member = normalizeSharingPolicy(memberPolicy);
  const floor = normalizeSharingPolicy(minimumPolicy);
  const out = {} as EffectiveSharingPolicy;
  for (const key of SHARING_POLICY_KEYS) {
    const base = member[key] ?? DEFAULT_SHARING_POLICY[key];
    out[key] = floor[key] === true ? true : base;
  }
  return out;
}

/** Field families carried on a contact, before label-based refinement. */
export type SharingFieldType =
  | "NAME"
  | "COMPANY"
  | "JOB_TITLE"
  | "EMAIL"
  | "PHONE"
  | "ADDRESS"
  | "BIRTHDAY"
  | "NOTE"
  | "LABEL"
  | "CUSTOM";

/** Entry labels that read as "work context" and default a field to shared. */
const WORK_LABELS = new Set(["work", "office", "business", "company"]);

function isWorkLabel(label: string | null | undefined): boolean {
  return label ? WORK_LABELS.has(label.trim().toLowerCase()) : false;
}

/**
 * Map a concrete field entry (its family + label) onto the policy key that
 * governs it. The label drives the work/personal split for email and phone:
 * a phone tagged "work" → workPhone; anything else → personalPhone (§5).
 */
export function policyKeyForField(
  fieldType: SharingFieldType,
  label?: string | null,
): SharingPolicyKey {
  switch (fieldType) {
    case "NAME":
      return "name";
    case "COMPANY":
      return "company";
    case "JOB_TITLE":
      return "jobTitle";
    case "EMAIL":
      return isWorkLabel(label) ? "workEmail" : "personalEmail";
    case "PHONE":
      return isWorkLabel(label) ? "workPhone" : "personalPhone";
    case "ADDRESS":
      return "homeAddress";
    case "BIRTHDAY":
      return "birthday";
    case "NOTE":
      return "notes";
    case "LABEL":
      return "labels";
    case "CUSTOM":
      return "customFields";
  }
}

/**
 * Decide whether a specific field entry is shared under the member's effective
 * policy in a book — the seam the P40-07 edit-context rules call to route an
 * edit to the shared row vs the private overlay.
 */
export function isFieldShared(
  fieldType: SharingFieldType,
  label: string | null | undefined,
  effectivePolicy: EffectiveSharingPolicy,
): boolean {
  return effectivePolicy[policyKeyForField(fieldType, label)];
}

/**
 * P48-07 — sharing-policy projection for copies & snapshots.
 *
 * The paths that persist an INDEPENDENT COPY of a contact — "add to family
 * book", "add to team book", the "leave the family book" personal snapshot,
 * a static Kontax-to-Kontax share and the initial live-share snapshot — must
 * not carry the owner's policy-private fields into that copy. This is the one
 * function every one of those paths routes through before persisting.
 *
 * Two behaviours, by target:
 *   - "family" / "team": the effective policy (resolveEffectiveSharingPolicy)
 *     governs personalPhone / homeAddress / birthday / labels / customFields.
 *     Email and phone are split per entry by label (work vs personal) via
 *     isFieldShared; an entry with no label falls into the personal bucket
 *     (policyKeyForField's default), same as the live-edit routing in
 *     edit-context.ts.
 *   - "static-share" / "live-share": a deliberate one-to-one grant the owner
 *     made by typing a recipient's email — everything flows through, matching
 *     the already-established LIVE_FIELD_SELECT scope (contact-shares.ts) so
 *     the initial snapshot never disagrees with what ongoing live propagation
 *     sends.
 *
 * `notes` is dropped unconditionally, for every target, regardless of what
 * `policy.notes` says — this matches LIVE_FIELD_SELECT (which deliberately
 * excludes `notes`) and is a harder rule than the generic policy: a member
 * opting their *own* notes into the shared-book edit layer (edit-context.ts)
 * is a different concern from what a COPY of the contact carries.
 */
export type SharingTarget = "family" | "team" | "static-share" | "live-share";

/**
 * The union of contact fields any copy/snapshot SELECT constant fetches.
 * Callers pass whatever subset their own select actually fetched — a key
 * absent from the input (`undefined`) is left absent on the way out, so this
 * one type safely covers COPY_SELECT, TEAM_COPY_SELECT, family-snapshot's
 * COPY_SELECT and SNAPSHOT_SELECT despite their slightly different shapes.
 */
export type SharingContactInput = {
  fullName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  phoneticFirstName?: string | null;
  phoneticLastName?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
  nickname?: string | null;
  email?: string | null;
  emailAddresses?: unknown;
  emailEntries?: unknown;
  phone?: string | null;
  phoneNumbers?: unknown;
  phoneEntries?: unknown;
  company?: string | null;
  phoneticCompany?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  website?: string | null;
  websiteEntries?: unknown;
  birthday?: string | null;
  address?: string | null;
  postalAddresses?: unknown;
  addressEntries?: unknown;
  avatarUrl?: string | null;
  labels?: unknown;
  significantDates?: unknown;
  relatedPeople?: unknown;
  customFields?: unknown;
  notes?: string | null;
};

type Entry = Record<string, unknown> & { label?: unknown; isPrimary?: unknown; value?: unknown };

const toEntryArray = (value: unknown): Entry[] | null =>
  Array.isArray(value) ? (value as Entry[]) : null;

const entryLabel = (entry: Entry): string | null =>
  typeof entry.label === "string" ? entry.label : null;

/** The value carried into the recomputed scalar field after entries are filtered. */
const pickPrimaryValue = (entries: Entry[]): unknown => {
  if (entries.length === 0) return null;
  const primary = entries.find((entry) => entry.isPrimary === true) ?? entries[0]!;
  return "value" in primary ? (primary.value ?? null) : null;
};

/**
 * Apply the work/personal split (by entry label) to one EMAIL or PHONE field
 * family: the structured entries array, the recomputed scalar convenience
 * field, and the legacy plain-value list (kept in sync with the surviving
 * entries so it can never carry a value the entries array just dropped).
 */
function applyEntryFieldPolicy(
  out: Record<string, unknown>,
  scalarKey: string,
  entriesKey: string,
  legacyListKey: string,
  fieldType: "EMAIL" | "PHONE",
  policy: EffectiveSharingPolicy,
): void {
  const entriesValue = out[entriesKey];
  const scalarValue = out[scalarKey];
  const legacyValue = out[legacyListKey];
  const entries = toEntryArray(entriesValue);

  if (entries) {
    const kept = entries.filter((entry) => isFieldShared(fieldType, entryLabel(entry), policy));
    out[entriesKey] = kept;
    if (scalarValue !== undefined) out[scalarKey] = kept.length > 0 ? pickPrimaryValue(kept) : null;
    if (legacyValue !== undefined) {
      out[legacyListKey] = kept.length > 0 ? kept.map((entry) => entry.value ?? null) : [];
    }
    return;
  }

  // No entries to split by label (absent, or not an array) — the scalar and
  // legacy-list values carry no label metadata, so they fall into the
  // unlabeled bucket, same as policyKeyForField(type, null).
  const shared = isFieldShared(fieldType, null, policy);
  if (scalarValue !== undefined) out[scalarKey] = shared ? scalarValue : null;
  if (legacyValue !== undefined) out[legacyListKey] = shared ? legacyValue : null;
}

const dropIfPresent = (out: Record<string, unknown>, key: string): void => {
  if (out[key] !== undefined) out[key] = null;
};

export function projectContactForSharing<T extends SharingContactInput>(
  contact: T,
  policy: EffectiveSharingPolicy,
  target: SharingTarget,
): T {
  const out: Record<string, unknown> = { ...contact };

  // Never carried into a copy or snapshot, for any target.
  dropIfPresent(out, "notes");

  if (target === "static-share" || target === "live-share") {
    // A deliberate one-to-one grant: everything else flows through, matching
    // LIVE_FIELD_SELECT's existing scope.
    return out as T;
  }

  // "family" / "team": the full field-level policy applies.
  applyEntryFieldPolicy(out, "email", "emailEntries", "emailAddresses", "EMAIL", policy);
  applyEntryFieldPolicy(out, "phone", "phoneEntries", "phoneNumbers", "PHONE", policy);

  if (!policy.homeAddress) {
    dropIfPresent(out, "address");
    dropIfPresent(out, "addressEntries");
    dropIfPresent(out, "postalAddresses");
  }
  if (!policy.birthday) {
    dropIfPresent(out, "birthday");
  }
  if (!policy.labels) {
    dropIfPresent(out, "labels");
  }
  if (!policy.customFields) {
    dropIfPresent(out, "customFields");
  }

  return out as T;
}
