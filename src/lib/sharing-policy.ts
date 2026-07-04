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
