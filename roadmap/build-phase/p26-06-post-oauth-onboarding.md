# P26-06 — Post-OAuth Signup Onboarding

## Purpose

Users who sign up via Google or Apple Sign-In skip email verification (their email is already verified by the OAuth provider). Route them directly to onboarding after account creation, and surface a "Your Google/Apple contacts are ready to import" suggestion as their first action rather than the generic "add a contact" prompt.

## Background

P18-08 (OAuth providers) creates a new user account when a new OAuth identity signs up. Without a tailored post-OAuth flow, these users land on the same blank contacts page as credential-registered users — except they never saw the email verification step. This ticket customises the onboarding flow for OAuth users and surfaces an import suggestion for Google/Apple contacts since the user likely has them.

## Scope

**In scope:**
- OAuth registration creates `UserOnboardingState` with `accountCreatedAt` and `emailVerifiedAt` pre-set (no verification step needed)
- Modified onboarding checklist step 1 for OAuth users: "✓ Signed in with Google" instead of "✓ Create your account"
- Modified step 2 for Google sign-up: "Import your Google Contacts" CTA — links to `/import-export` with `?source=google` pre-selecting the Google source profile
- Modified step 2 for Apple sign-up: "Import your Apple Contacts" CTA — links to `/import-export` with `?source=apple`
- `OAuthProvider` stored on `UserOnboardingState` so the checklist can customise copy

**Out of scope:**
- Google Contacts OAuth direct sync (P27-01 — that is a live two-way sync; this is a one-time CSV import suggestion)
- Actual OAuth connector (P18-08)

---

## Design / Implementation Spec

### Schema addition

```prisma
// On UserOnboardingState:
oauthProvider String? // "google" | "apple" — set at OAuth registration
```

Run: `prisma migrate dev --name add-onboarding-oauth-provider`

### OAuth registration hook

In the P18-08 OAuth account creation flow (NextAuth `signIn` event or `createUser` callback):

```typescript
// After creating the user via OAuth:
await db.userOnboardingState.create({
  data: {
    userId: user.id,
    oauthProvider: provider, // "google" or "apple"
    // Email is already verified by OAuth provider — mark as verified immediately
  },
});

// Mark email as verified (no verification email needed)
await db.user.update({
  where: { id: user.id },
  data: { emailVerified: new Date() },
});
```

### Customised checklist for OAuth users

```tsx
// In OnboardingChecklist, detect OAuth user:
const isGoogleUser = onboarding.oauthProvider === "google";
const isAppleUser = onboarding.oauthProvider === "apple";

const steps = [
  {
    key: "account",
    label: isGoogleUser ? "Signed in with Google" : isAppleUser ? "Signed in with Apple" : "Create your account",
    completedAt: onboarding.accountCreatedAt,
    cta: null,
  },
  {
    key: "contact",
    label: isGoogleUser
      ? "Import your Google Contacts"
      : isAppleUser
      ? "Import your Apple Contacts"
      : "Add your first contact",
    completedAt: onboarding.firstContactCreatedAt,
    cta: {
      label: isGoogleUser ? "Import from Google"
           : isAppleUser  ? "Import from Apple"
           :                "Add contact",
      href: isGoogleUser ? "/import-export?source=google"
          : isAppleUser  ? "/import-export?source=apple"
          :                "/contacts/new",
    },
  },
  // steps 3 and 4 unchanged
];
```

### Import pre-selection via query param

In the import page (`/import-export`), read the `source` query param to pre-select the source profile chip:

```typescript
// In the ImportCard component:
const searchParams = useSearchParams();
const preselectedSource = searchParams.get("source"); // "google" | "apple" | null

const [sourceProfile, setSourceProfile] = useState<SourceProfile>(
  preselectedSource === "google" ? "GOOGLE"
: preselectedSource === "apple"  ? "APPLE"
: "GENERIC"
);
```

Also show a contextual hint above the drop zone:
```
💡 We've pre-selected Google Contacts format for you.
   Export your contacts from Google Takeout, then upload the CSV here.
   [How to export Google Contacts →]  ← links to /help#google-export
```

---

## Acceptance Criteria

- OAuth-registered users have `UserOnboardingState` created with `oauthProvider` set.
- OAuth-registered users' emails are marked as verified at account creation — no verification email is sent.
- The onboarding checklist shows "Signed in with Google/Apple" for step 1 (always pre-checked).
- The step 2 CTA for Google users links to `/import-export?source=google` with Google source profile pre-selected.
- The step 2 CTA for Apple users links to `/import-export?source=apple` with Apple source profile pre-selected.
- The import page shows a contextual hint when the `source` query param is present.
- Credential-registered users see the unchanged checklist.

---

## Risks and Open Questions

- **P18-08 dependency:** this ticket depends on P18-08 (OAuth providers). If P18-08 ships after P26-04, the `oauthProvider` field defaults to null and OAuth users see the standard checklist. The customisation activates automatically once P18-08 sets the field. No blocking dependency.
- **Google Takeout vs direct sync:** some Google users may expect "Import from Google" to be a live OAuth sync (P27-01), not a CSV export. The import page copy should be clear: "Export a CSV from Google Takeout first." Link to `/help#google-export` which explains the manual export process and notes that live Google sync is coming in a future update.
