# P30-03 — Visibility Controls

## Purpose

Let users control which fields appear on their public contact card. Name and photo are always shown; email, phone, company, job title, website, and social links are opt-in per-field. Changes take effect immediately — the public card reflects the latest settings on the next page load.

## Background

`User.publicCardFields Json?` (introduced in this ticket) stores a per-user JSON object of visibility flags. `getPublicCard` (P30-02) reads this object to decide which fields to render. The settings UI (at `/settings/profile/card` or inline in `/settings/profile`) writes to this field via a server action.

## Scope

**In scope:**
- `User.publicCardFields Json?` schema field (nullable — null means card uses sensible defaults)
- `PublicCardFieldConfig` TypeScript interface defining all toggleable fields
- Default config: `showEmail: true`, `showPhone: false`, `showCompany: true`, `showJobTitle: true`, `showWebsite: false`, no social fields shown by default
- `updateCardVisibility(fields)` server action
- Settings UI at `/settings/profile/card`: per-field checkboxes per P30-DB11 spec, immediate save (no "Save" button needed — each toggle saves on change)
- "Card is hidden" toggle: `fields.hidden = true` hides the card entirely (returns 404)
- Preview link: "View card" → opens `/u/{username}` in a new tab

**Out of scope:**
- Avatar upload (deferred — photos are a future ticket)
- Per-email / per-phone granular visibility (v1: show all or none per field type)

---

## Design / Implementation Spec

### Schema change

```prisma
// On User model:
publicCardFields Json? // PublicCardFieldConfig | null
```

Run: `prisma migrate dev --name add-public-card-fields`

### `PublicCardFieldConfig` type

```typescript
interface PublicCardFieldConfig {
  hidden?: boolean;       // if true, card returns 404
  showEmail?: boolean;    // default: true
  showPhone?: boolean;    // default: false
  showCompany?: boolean;  // default: true
  showJobTitle?: boolean; // default: true
  showWebsite?: boolean;  // default: false
  showLinkedIn?: boolean; // default: false
  showTwitter?: boolean;  // default: false
}

const CARD_FIELD_DEFAULTS: Required<Omit<PublicCardFieldConfig, "hidden">> = {
  showEmail: true,
  showPhone: false,
  showCompany: true,
  showJobTitle: true,
  showWebsite: false,
  showLinkedIn: false,
  showTwitter: false,
};

export function resolveCardFields(stored: PublicCardFieldConfig | null): Required<PublicCardFieldConfig> {
  return { ...CARD_FIELD_DEFAULTS, hidden: false, ...stored };
}
```

### `updateCardVisibility` server action

```typescript
export async function updateCardVisibility(
  patch: Partial<PublicCardFieldConfig>,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { publicCardFields: true },
  });

  const current = (user.publicCardFields ?? {}) as PublicCardFieldConfig;
  const updated = { ...current, ...patch };

  await db.user.update({
    where: { id: session.user.id },
    data: { publicCardFields: updated },
  });
}
```

### Settings page UI

`src/app/settings/profile/card/page.tsx`:

```tsx
export default async function CardSettingsPage() {
  const session = await auth();
  const user = await db.user.findUniqueOrThrow({
    where: { id: session!.user!.id },
    select: { username: true, publicCardFields: true },
  });

  const fields = resolveCardFields(user.publicCardFields as PublicCardFieldConfig | null);

  return (
    <SettingsPage title="Public card">
      {user.username && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: "#5c655e" }}>
            Your card is live at{" "}
            <a href={`/u/${user.username}`} target="_blank" style={{ color: "#4158f4" }}>
              kontax.app/u/{user.username}
            </a>
          </p>
        </div>
      )}

      {!user.username && (
        <p style={{ fontSize: 14, color: "#8b938c", marginBottom: 24 }}>
          Claim a username in profile settings to get your public card URL.
        </p>
      )}

      <VisibilityToggle
        label="Hide my card"
        description="Nobody can view your card"
        checked={fields.hidden}
        onChange={(v) => updateCardVisibility({ hidden: v })}
      />

      <Divider />

      <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase",
        color: "#8b938c", letterSpacing: "0.06em", marginBottom: 12 }}>
        Fields visible on your card
      </p>

      <VisibilityToggle label="Name" description="Always shown" checked={true} disabled />
      <VisibilityToggle label="Photo" description="Always shown if uploaded" checked={true} disabled />

      {[
        { key: "showEmail",    label: "Email address" },
        { key: "showPhone",    label: "Phone number" },
        { key: "showCompany",  label: "Company" },
        { key: "showJobTitle", label: "Job title" },
        { key: "showWebsite",  label: "Website" },
        { key: "showLinkedIn", label: "LinkedIn" },
        { key: "showTwitter",  label: "Twitter / X" },
      ].map(({ key, label }) => (
        <VisibilityToggle
          key={key}
          label={label}
          checked={fields[key as keyof typeof fields] as boolean}
          onChange={(v) => updateCardVisibility({ [key]: v })}
        />
      ))}
    </SettingsPage>
  );
}
```

`VisibilityToggle` is a simple row with a label and a checkbox (or toggle switch). Changes are saved immediately via `updateCardVisibility` — no "Save" button. The server action is called `onChange` with a 200ms debounce.

---

## Acceptance Criteria

- `User.publicCardFields` field exists; migration applied.
- `resolveCardFields(null)` returns the default config (email shown, phone hidden, company/jobTitle shown).
- `updateCardVisibility` merges the patch into the existing config and saves.
- The settings page shows all toggleable fields with their current state.
- Name and photo toggles are rendered but disabled (always-on).
- The "Hide my card" toggle returns 404 on `/u/{username}` when enabled.
- Changes take effect immediately — the public card reflects the latest settings on the next page load.
- Users without a username see a "claim a username first" prompt instead of the toggle panel.

---

## Risks and Open Questions

- **Missing field data:** if a user enables "Show phone" but has no phone number on their profile, the card renders with no phone row (not an error). The settings UI should show a hint: "Add a phone number in your profile to show it here." This requires a check of whether the underlying profile data exists.
- **"Show email" and spam:** showing an email address publicly exposes it to scrapers. The card should use a `mailto:` link with `rel="nofollow"` but render the address as plaintext (not obfuscated) — email obfuscation via CSS is unreliable and breaks accessibility. Document this trade-off in the settings UI tooltip.
