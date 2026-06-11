# P30-04 — "Add to Kontax" Flow

## Purpose

The "Add to Kontax" button on the public card page (`/u/{username}`) gives recipients a one-tap path to save the contact. For non-Kontax users it triggers a vCard download (saves to the phone's native contacts app). For signed-in Kontax users it pre-fills the create-contact form with the card's visible fields — a single click saves the contact to their Kontax library.

## Background

P30-02 renders the card page and places an `<AddToKontaxButton>` component. This ticket implements the two behaviour paths for that button. The acquisition angle is explicit: the button for non-users links to `/register?prefill={encodedData}` — after signing up, the pre-filled contact data is waiting to be saved.

## Scope

**In scope:**
- **Path A (non-Kontax user / logged out):** "Add Jane to Kontax" button → triggers vCard download of the card's public fields as a `.vcf` file
- **Path B (signed-in Kontax user):** "Save to Kontax" button → navigates to `/contacts/new?prefill={base64}` with the card's public fields pre-filled in the create form
- vCard generation from public card fields (subset of the existing vCard exporter from P3-03)
- Pre-fill URL encoding: a base64-encoded JSON object of the visible contact fields
- `/contacts/new` reads the `prefill` query param and populates the form fields on mount
- `AddedFromCard` source attribution: contacts created via this flow get `source: "CARD_IMPORT"` and `sourceCardUsername` set

**Out of scope:**
- OAuth sign-up with pre-filled contact (P26-06 covers OAuth onboarding; the pre-fill here is for credential sign-up)
- Duplicate detection before saving (the user sees the filled form and can decide)

---

## Design / Implementation Spec

### `AddToKontaxButton` component

```tsx
"use client";

interface AddToKontaxButtonProps {
  card: PublicCardData;
  isLoggedIn: boolean; // passed as a prop from the server component
}

export function AddToKontaxButton({ card, isLoggedIn }: AddToKontaxButtonProps) {
  if (isLoggedIn) {
    // Path B: pre-fill the Kontax create form
    const prefillData = buildPrefillData(card);
    const prefillParam = btoa(JSON.stringify(prefillData));

    return (
      <Link
        href={`/contacts/new?prefill=${encodeURIComponent(prefillParam)}`}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", height: 48, borderRadius: 12,
          background: "#4158f4", color: "#ffffff",
          fontSize: 15, fontWeight: 600, textDecoration: "none",
        }}
      >
        Save to Kontax
      </Link>
    );
  }

  // Path A: vCard download
  return (
    <button
      onClick={() => downloadVCard(card)}
      style={{
        width: "100%", height: 48, borderRadius: 12,
        background: "#4158f4", color: "#ffffff",
        fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer",
      }}
    >
      Add {card.displayName.split(" ")[0]} to Kontax
    </button>
  );
}
```

### vCard download (Path A)

```typescript
function downloadVCard(card: PublicCardData): void {
  const vcf = buildVCardFromPublicCard(card);
  const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${card.displayName.replace(/\s+/g, "-")}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildVCardFromPublicCard(card: PublicCardData): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    `FN:${card.displayName}`,
  ];

  const nameParts = card.displayName.split(" ");
  const lastName = nameParts.slice(1).join(" ");
  const firstName = nameParts[0] ?? "";
  lines.push(`N:${lastName};${firstName};;;`);

  if (card.jobTitle) lines.push(`TITLE:${card.jobTitle}`);
  if (card.company) lines.push(`ORG:${card.company}`);

  card.emails.forEach((e) => {
    lines.push(`EMAIL;TYPE=${e.label.toUpperCase()}:${e.value}`);
  });
  card.phones.forEach((p) => {
    lines.push(`TEL;TYPE=${p.label.toUpperCase()}:${p.value}`);
  });
  card.websites.forEach((w) => {
    lines.push(`URL:${w.value}`);
  });

  lines.push(`URL:https://kontax.app/u/${card.username}`);
  lines.push("END:VCARD");

  return lines.join("\r\n");
}
```

### Pre-fill data encoding (Path B)

```typescript
interface PrefillData {
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  emails?: Array<{ value: string; label: string }>;
  phones?: Array<{ value: string; label: string }>;
  websites?: Array<{ value: string; label: string }>;
  sourceCardUsername: string;
}

function buildPrefillData(card: PublicCardData): PrefillData {
  const parts = card.displayName.split(" ");
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || undefined,
    company: card.company ?? undefined,
    jobTitle: card.jobTitle ?? undefined,
    emails: card.emails,
    phones: card.phones,
    websites: card.websites,
    sourceCardUsername: card.username,
  };
}
```

### `/contacts/new` prefill reading

In the create contact page (P17-01), read the `prefill` query param on mount:

```typescript
// In the contact creation form component:
const searchParams = useSearchParams();
const prefillParam = searchParams.get("prefill");

const prefillData = useMemo<PrefillData | null>(() => {
  if (!prefillParam) return null;
  try {
    return JSON.parse(atob(prefillParam));
  } catch {
    return null;
  }
}, [prefillParam]);

// Pre-populate form state from prefillData on mount
useEffect(() => {
  if (!prefillData) return;
  if (prefillData.firstName) setFirstName(prefillData.firstName);
  if (prefillData.lastName) setLastName(prefillData.lastName);
  if (prefillData.company) setCompany(prefillData.company);
  if (prefillData.jobTitle) setJobTitle(prefillData.jobTitle);
  if (prefillData.emails?.length) setEmails(prefillData.emails);
  if (prefillData.phones?.length) setPhones(prefillData.phones);
  if (prefillData.websites?.length) setWebsites(prefillData.websites);
}, [prefillData]);
```

A subtle banner at the top of the form:
```
Pre-filled from {displayName}'s Kontax card   [×]
```

### Source attribution

When the contact is created from a pre-filled form, pass the source:

```typescript
await createContact({
  ...formData,
  source: prefillData?.sourceCardUsername ? "CARD_IMPORT" : "USER",
  // Add SourceType.CARD_IMPORT to the enum if not present
});
```

`SourceType.CARD_IMPORT` attribute displays as "Saved from Kontax card" in the source badge on the contact detail page.

---

## Acceptance Criteria

- Non-logged-in users clicking "Add to Kontax" download a `.vcf` file with the card's public fields.
- The vCard is valid (parseable by iPhone Contacts, Google Contacts, Apple Contacts).
- Logged-in Kontax users see "Save to Kontax" instead, which navigates to `/contacts/new?prefill={data}`.
- The create form is pre-populated with the card's name, company, job title, emails, phones, and websites.
- A banner in the create form confirms the pre-fill source.
- Saving the pre-filled contact creates a contact with `source: CARD_IMPORT`.
- The vCard includes the card owner's Kontax card URL as a URL field.
- A signed-in Kontax user visiting their own card sees a "This is your card" message instead of the CTA.

---

## Risks and Open Questions

- **Mobile vCard download on iOS Safari:** iOS Safari opens `.vcf` files inline in the browser rather than downloading them — triggering the system "Add contact" sheet. This is actually better UX than a download. Test on real iOS to confirm the behaviour. On Android Chrome, the `.vcf` triggers a download followed by the system contacts import prompt.
- **`atob` security:** the `prefill` param is base64-encoded JSON. It is not signed or authenticated — a malicious URL could pre-fill arbitrary data into the create form. Mitigate by sanitising all pre-fill values (trim, max length) before setting them in form state. The user sees the pre-filled form before saving — they are the last line of defence.
