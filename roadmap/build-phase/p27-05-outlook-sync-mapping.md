# P27-05 — Outlook Sync Field Mapping

## Purpose

Map Microsoft Graph contact fields (`/me/contacts`) to the Kontax canonical schema. Outlook's contact model has similar concepts to Google but different field names and structures: `givenName`/`surname` instead of `givenName`/`familyName`, `emailAddresses` as an array of `{name, address}` objects, and Outlook-specific fields like `categories` and `sensitivity`.

## Background

Same role as P27-02 (Google mapping) but for the Microsoft Graph `Contact` object. The mapping must handle both directions: Graph → Kontax (pull) and Kontax → Graph (push). Outlook's `@odata.etag` on each contact serves as the ETag for conflict detection in P27-06.

## Scope

**In scope:**
- `mapGraphContactToKontax(contact: GraphContact): ContactCreateInput` — Graph → Kontax
- `mapKontaxContactToGraph(contact: Contact): GraphContactUpdate` — Kontax → Graph
- Label normalisation: Outlook email `name` field and phone types → Kontax labels
- Outlook-specific fields: `categories` (→ `customFields.categories`), `sensitivity` (→ `customFields.sensitivity`), `businessHomePage` (→ `urls`)
- Tombstone detection: `@removed` marker in delta responses (P27-04)
- `id` storage: Outlook contact GUID stored in `SyncLink.remoteId`; `@odata.etag` in `SyncLink.remoteEtag`

**Out of scope:**
- Conflict handling (P27-06)
- Photo/avatar sync (deferred)

---

## Design / Implementation Spec

### Microsoft Graph `Contact` fields

`MICROSOFT_CONTACT_FIELDS` constant:
```typescript
export const MICROSOFT_CONTACT_FIELDS = [
  "id", "givenName", "surname", "displayName", "middleName",
  "title", "nickName", "jobTitle", "companyName", "department",
  "emailAddresses", "phones", "homeAddress", "businessAddress", "otherAddress",
  "birthday", "personalNotes", "businessHomePage",
  "categories", "sensitivity",
  "@odata.etag",
].join(",");
```

### `mapGraphContactToKontax`

```typescript
interface GraphContact {
  id: string;
  givenName?: string;
  surname?: string;
  displayName?: string;
  middleName?: string;
  title?: string;
  nickName?: string;
  jobTitle?: string;
  companyName?: string;
  department?: string;
  emailAddresses?: Array<{ name?: string; address?: string }>;
  phones?: Array<{ number?: string; type?: string }>;
  homeAddress?: GraphAddress;
  businessAddress?: GraphAddress;
  otherAddress?: GraphAddress;
  birthday?: string; // ISO date string
  personalNotes?: string;
  businessHomePage?: string;
  categories?: string[];
  sensitivity?: string;
  "@odata.etag"?: string;
  "@removed"?: { reason: string };
}

export function mapGraphContactToKontax(
  contact: GraphContact,
): ContactCreateInput | null {
  if (contact["@removed"]) return null; // tombstone

  const emails = (contact.emailAddresses ?? [])
    .filter((e) => e.address)
    .map((e) => ({
      value: e.address!,
      // Outlook email "name" field is often something like "Work Email" or just the email itself
      label: normaliseOutlookEmailName(e.name),
    }));

  const phones = (contact.phones ?? []).map((p) => ({
    value: p.number ?? "",
    label: normaliseOutlookPhoneType(p.type),
  }));

  const addresses = [
    contact.businessAddress && { ...mapGraphAddress(contact.businessAddress), label: "Work" },
    contact.homeAddress && { ...mapGraphAddress(contact.homeAddress), label: "Home" },
    contact.otherAddress && { ...mapGraphAddress(contact.otherAddress), label: "Other" },
  ].filter(Boolean);

  const customFields: Record<string, unknown> = {};
  if (contact.categories?.length) customFields.categories = contact.categories;
  if (contact.sensitivity && contact.sensitivity !== "normal") {
    customFields.sensitivity = contact.sensitivity;
  }

  const urls = contact.businessHomePage
    ? [{ value: contact.businessHomePage, label: "Work" }]
    : [];

  return {
    firstName: contact.givenName ?? null,
    lastName: contact.surname ?? null,
    fullName: contact.displayName ?? null,
    middleName: contact.middleName ?? null,
    namePrefix: contact.title ?? null,
    nickname: contact.nickName ?? null,
    jobTitle: contact.jobTitle ?? null,
    company: contact.companyName ?? null,
    department: contact.department ?? null,
    emails,
    phones,
    addresses,
    birthday: contact.birthday ? contact.birthday.substring(0, 10) : null, // "1990-01-15T00:00:00Z" → "1990-01-15"
    notes: contact.personalNotes ?? null,
    urls,
    customFields,
  };
}

function normaliseOutlookEmailName(name?: string): string {
  if (!name) return "Other";
  const lower = name.toLowerCase();
  if (lower.includes("work") || lower.includes("business")) return "Work";
  if (lower.includes("home") || lower.includes("personal")) return "Home";
  if (lower.includes("other")) return "Other";
  return name; // preserve custom names
}

function normaliseOutlookPhoneType(type?: string): string {
  if (!type) return "Other";
  const MAP: Record<string, string> = {
    business: "Work", home: "Home", mobile: "Mobile", other: "Other",
    businessFax: "Work Fax", homeFax: "Home Fax",
  };
  return MAP[type] ?? type;
}

function mapGraphAddress(addr: GraphAddress): Omit<AddressInput, "label"> {
  return {
    street: addr.street ?? null,
    city: addr.city ?? null,
    state: addr.state ?? null,
    postalCode: addr.postalCode ?? null,
    country: addr.countryOrRegion ?? null,
  };
}
```

### `mapKontaxContactToGraph`

```typescript
export function mapKontaxContactToGraph(contact: Contact): Partial<GraphContact> {
  return {
    givenName: contact.firstName ?? undefined,
    surname: contact.lastName ?? undefined,
    displayName: contact.fullName ?? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
    middleName: contact.middleName ?? undefined,
    title: contact.namePrefix ?? undefined,
    nickName: contact.nickname ?? undefined,
    jobTitle: contact.jobTitle ?? undefined,
    companyName: contact.company ?? undefined,
    department: contact.department ?? undefined,
    emailAddresses: contact.emails?.map((e) => ({
      name: e.label,
      address: e.value,
    })),
    phones: contact.phones?.map((p) => ({
      number: p.value,
      type: normaliseKontaxLabelToOutlook(p.label),
    })),
    businessAddress: contact.addresses?.find((a) => a.label === "Work")
      ? mapKontaxAddressToGraph(contact.addresses.find((a) => a.label === "Work")!)
      : undefined,
    homeAddress: contact.addresses?.find((a) => a.label === "Home")
      ? mapKontaxAddressToGraph(contact.addresses.find((a) => a.label === "Home")!)
      : undefined,
    personalNotes: contact.notes ?? undefined,
    businessHomePage: contact.urls?.find((u) => u.label === "Work")?.value ?? undefined,
  };
}
```

---

## Acceptance Criteria

- `mapGraphContactToKontax` correctly maps all specified fields from a Graph `Contact` object.
- Returns `null` for contacts with `@removed`.
- Outlook email `name` field is normalised to Work/Home/Other/custom where possible.
- All three address types (business, home, other) are mapped with correct labels.
- `customFields.categories` stores the Outlook `categories` array when present.
- `mapKontaxContactToGraph` produces a valid partial Graph `Contact` object for PATCH updates.
- `SyncLink.remoteId` stores the Outlook contact GUID; `SyncLink.remoteEtag` stores `@odata.etag`.
