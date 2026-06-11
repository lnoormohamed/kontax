# P27-02 — Google Sync Field Mapping

## Purpose

Map Google People API contact fields to the Kontax canonical contact schema so imported Google contacts appear with the correct structure — names, emails, phones, addresses, birthdays, and organisations in the right places. Google's field model has quirks (multi-value arrays with metadata, `type` labels, `formattedType` strings) that need explicit normalisation.

## Background

The Google People API returns contacts as `Person` objects with arrays of typed sub-objects. For example, a phone number is `{ value: "+1 415 555 0100", type: "mobile", formattedType: "Mobile" }`. Kontax stores phones as `[{ value, label }]`. This ticket handles the translation in both directions: Google → Kontax (on import/pull) and Kontax → Google (on push).

## Scope

**In scope:**
- `mapGooglePersonToContact(person: GooglePerson): ContactCreateInput` — Google → Kontax direction
- `mapContactToGooglePerson(contact: Contact): GooglePersonUpdate` — Kontax → Google direction
- Label normalisation: Google `formattedType` → Kontax label (and reverse)
- Handling Google-specific fields: `biographies` (→ `notes`), `relations` (→ `customFields.relations`), `occupations` (→ `customFields.occupations`)
- Tombstone detection: Google marks deleted contacts with `metadata.deleted: true`
- `resourceName` storage: Google contact ID (e.g. `people/c12345`) stored in `SyncLink.remoteId`

**Out of scope:**
- Conflict handling (P27-03)
- Photo/avatar sync (deferred — avatars are a separate concern)

---

## Design / Implementation Spec

### `mapGooglePersonToContact`

```typescript
import type { people_v1 } from "googleapis";
type GooglePerson = people_v1.Schema$Person;

export function mapGooglePersonToContact(
  person: GooglePerson,
): ContactCreateInput | null {
  // Deleted contacts — return null to trigger tombstone handling
  if (person.metadata?.deleted) return null;

  const primaryName = person.names?.[0];
  const firstName = primaryName?.givenName ?? null;
  const lastName = primaryName?.familyName ?? null;
  const fullName = primaryName?.displayName ?? null;
  const middleName = primaryName?.middleName ?? null;
  const namePrefix = primaryName?.honorificPrefix ?? null;
  const nameSuffix = primaryName?.honorificSuffix ?? null;

  const emails = (person.emailAddresses ?? []).map((e) => ({
    value: e.value ?? "",
    label: normaliseGoogleLabel(e.formattedType ?? e.type),
    isPrimary: !!e.metadata?.primary,
  }));

  const phones = (person.phoneNumbers ?? []).map((p) => ({
    value: p.value ?? "",
    label: normaliseGoogleLabel(p.formattedType ?? p.type),
    isPrimary: !!p.metadata?.primary,
  }));

  const addresses = (person.addresses ?? []).map((a) => ({
    street: a.streetAddress ?? null,
    city: a.city ?? null,
    state: a.region ?? null,
    postalCode: a.postalCode ?? null,
    country: a.country ?? null,
    label: normaliseGoogleLabel(a.formattedType ?? a.type),
  }));

  const org = person.organizations?.[0];
  const company = org?.name ?? null;
  const jobTitle = org?.title ?? null;
  const department = org?.department ?? null;

  const birthday = parseBirthday(person.birthdays?.[0]);

  const notes = person.biographies?.[0]?.value ?? null;

  const urls = (person.urls ?? []).map((u) => ({
    value: u.value ?? "",
    label: normaliseGoogleLabel(u.formattedType ?? u.type),
  }));

  const customFields: Record<string, unknown> = {};
  if (person.relations?.length) {
    customFields.relations = person.relations.map((r) => ({
      name: r.person, type: r.type,
    }));
  }

  return {
    firstName, lastName, fullName, middleName, namePrefix, nameSuffix,
    emails, phones, addresses, company, jobTitle, department,
    birthday, notes, urls, customFields,
  };
}

function normaliseGoogleLabel(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const MAP: Record<string, string> = {
    mobile: "Mobile", home: "Home", work: "Work", other: "Other",
    homeFax: "Home Fax", workFax: "Work Fax",
    MOBILE: "Mobile", HOME: "Home", WORK: "Work", OTHER: "Other",
  };
  return MAP[raw] ?? raw;
}

function parseBirthday(b: people_v1.Schema$Birthday | undefined): string | null {
  if (!b) return null;
  const d = b.date;
  if (!d?.month || !d?.day) return null;
  // Store as MM-DD or YYYY-MM-DD if year is available
  if (d.year) return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  return `--${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}
```

### `mapContactToGooglePerson`

The reverse mapping for the push phase:

```typescript
export function mapContactToGooglePerson(
  contact: Contact,
): people_v1.Schema$Person {
  return {
    names: [{
      givenName: contact.firstName ?? undefined,
      familyName: contact.lastName ?? undefined,
      middleName: contact.middleName ?? undefined,
      honorificPrefix: contact.namePrefix ?? undefined,
      honorificSuffix: contact.nameSuffix ?? undefined,
    }],
    emailAddresses: contact.emails?.map((e) => ({
      value: e.value,
      type: normaliseKontaxLabelToGoogle(e.label),
    })),
    phoneNumbers: contact.phones?.map((p) => ({
      value: p.value,
      type: normaliseKontaxLabelToGoogle(p.label),
    })),
    organizations: contact.company ? [{
      name: contact.company,
      title: contact.jobTitle ?? undefined,
      department: contact.department ?? undefined,
    }] : undefined,
    birthdays: contact.birthday ? [{
      date: parseBirthdayToGoogle(contact.birthday),
    }] : undefined,
    biographies: contact.notes ? [{ value: contact.notes }] : undefined,
  };
}
```

### `resourceName` and `SyncLink`

On import, store the Google `resourceName` as the `SyncLink.remoteId`:

```typescript
await db.syncLink.upsert({
  where: { syncAccountId_remoteId: { syncAccountId, remoteId: person.resourceName! } },
  create: {
    syncAccountId,
    contactId,
    remoteId: person.resourceName!,
    remoteEtag: person.etag,
  },
  update: {
    remoteEtag: person.etag,
    lastSyncedAt: new Date(),
  },
});
```

---

## Acceptance Criteria

- `mapGooglePersonToContact` correctly maps names, emails, phones, addresses, birthday, company, job title, notes, and URLs from a `Person` object.
- `mapGooglePersonToContact` returns `null` for `metadata.deleted: true` contacts.
- `mapContactToGooglePerson` produces a valid Google `Person` patch object for the push phase.
- Google label types (`mobile`, `home`, `work`, `other`) are normalised to Kontax labels (`Mobile`, `Home`, `Work`, `Other`).
- Birthdays without year are stored as `--MM-DD`; birthdays with year as `YYYY-MM-DD`.
- `SyncLink.remoteId` stores the Google `resourceName` (e.g. `people/c12345678`).
- `SyncLink.remoteEtag` stores the Google `etag` for conflict detection (P27-03).

---

## Risks and Open Questions

- **Multi-organisation contacts:** the People API allows multiple `organizations` per contact. Kontax stores one `company` field. Map only the first organisation and store any additional ones in `customFields.additionalOrganizations`. Document this limitation.
- **Photo mapping:** Google returns `photos[].url` — a CDN URL that expires. Kontax does not currently support contact avatars from URLs (only uploaded images). Skip photo import in v1; add to P27-02 follow-up when avatar support is added.
