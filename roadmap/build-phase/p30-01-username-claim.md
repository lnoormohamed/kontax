# P30-01 — Username Claim

## Purpose

Add `User.username` as a unique, URL-safe identifier that powers the public contact card at `/u/{username}`. Users claim their username from profile settings or during the onboarding flow. Reserved words and a profanity blocklist prevent squatting on system routes and brand names.

## Background

Without a unique username, public cards cannot have persistent, memorable URLs. The username is the user's public identity on Kontax — it appears in their card URL, in the "Shared via" attribution on cards they share, and potentially in future @-mentions. It must be immutable once set (or at most changeable once per 30 days) to prevent URL hijacking.

## Scope

**In scope:**
- `User.username String? @unique` field (nullable — users who never claim a username have no public card)
- `User.usernameClaimedAt DateTime?` — for the 30-day change cooldown
- `checkUsernameAvailability(username)` server action — returns `available | taken | reserved | invalid`
- `claimUsername(username)` server action — sets the username if available
- Profile settings UI: "Public card URL" field with real-time availability check
- Reserved word list: system routes + common squatting targets
- Profanity filter: reject usernames containing a blocklist of offensive terms
- Onboarding integration: optional username claim step in P26-04

**Out of scope:**
- Username change after claiming (v1: username is permanent once set; change requires contacting support)
- Username transfer between accounts

---

## Design / Implementation Spec

### Schema change

```prisma
// On User model:
username          String?   @unique
usernameClaimedAt DateTime?
```

Run: `prisma migrate dev --name add-user-username`

Username constraints:
- 3–30 characters
- Allowed characters: `a-z`, `0-9`, `-` (hyphen), `_` (underscore)
- Must start and end with a letter or number (no leading/trailing hyphens)
- Case-insensitive: stored and compared lowercase

### Reserved words list

`src/server/username/reserved.ts`:

```typescript
export const RESERVED_USERNAMES = new Set([
  // System routes
  "admin", "api", "app", "auth", "blog", "cron", "dav", "dev", "developers",
  "help", "login", "logout", "onboarding", "pricing", "privacy", "register",
  "settings", "share", "signup", "sitemap", "support", "terms", "u", "users",
  // Brand protection
  "kontax", "kontaxapp", "kontax-app", "team", "official",
  // Common squatting
  "me", "about", "home", "index", "null", "undefined", "root", "contact", "contacts",
]);
```

### `checkUsernameAvailability`

```typescript
export async function checkUsernameAvailability(
  username: string,
): Promise<"available" | "taken" | "reserved" | "invalid"> {
  const normalised = username.toLowerCase().trim();

  // Validate format
  if (!/^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/.test(normalised) && normalised.length < 3) {
    return "invalid";
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]?$/.test(normalised)) {
    return "invalid";
  }
  if (normalised.length < 3 || normalised.length > 30) {
    return "invalid";
  }

  // Reserved words check
  if (RESERVED_USERNAMES.has(normalised)) return "reserved";

  // Profanity check (using a lightweight library)
  if (containsProfanity(normalised)) return "reserved";

  // Database availability check
  const existing = await db.user.findUnique({
    where: { username: normalised },
    select: { id: true },
  });

  return existing ? "taken" : "available";
}
```

For the profanity check, use a lightweight npm package like `bad-words` or a custom list. The username itself may not be offensive but may contain an offensive substring — check both.

### `claimUsername`

```typescript
export async function claimUsername(username: string): Promise<{
  success: boolean;
  error?: "TAKEN" | "RESERVED" | "INVALID" | "COOLDOWN";
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const normalised = username.toLowerCase().trim();

  // Check cooldown (30-day change restriction)
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { username: true, usernameClaimedAt: true },
  });

  if (user.username && user.usernameClaimedAt) {
    const daysSinceClaim = (Date.now() - user.usernameClaimedAt.getTime()) / 86_400_000;
    if (daysSinceClaim < 30) {
      return { success: false, error: "COOLDOWN" };
    }
  }

  const availability = await checkUsernameAvailability(normalised);
  if (availability !== "available") {
    return {
      success: false,
      error: availability === "taken" ? "TAKEN"
           : availability === "reserved" ? "RESERVED"
           : "INVALID",
    };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { username: normalised, usernameClaimedAt: new Date() },
  });

  return { success: true };
}
```

### Profile settings UI

In `/settings/profile`, the "Public card URL" section:

```tsx
function UsernameClaimInput() {
  const [value, setValue] = useState(currentUsername ?? "");
  const [status, setStatus] = useState<"idle" | "available" | "taken" | "reserved" | "invalid">("idle");

  // Debounced availability check
  useEffect(() => {
    if (!value || value === currentUsername) { setStatus("idle"); return; }
    const timer = setTimeout(async () => {
      const result = await checkUsernameAvailability(value);
      setStatus(result);
    }, 400);
    return () => clearTimeout(timer);
  }, [value]);

  const statusMessages = {
    available: { icon: "✓", color: "#2f8f63", text: `kontax.app/u/${value} is available` },
    taken:     { icon: "✗", color: "#b5472f", text: `${value} is already taken. Try ${value}2.` },
    reserved:  { icon: "✗", color: "#b5472f", text: "This username is reserved." },
    invalid:   { icon: "✗", color: "#b5472f", text: "3–30 characters, letters, numbers, hyphens, underscores only." },
    idle:      null,
  };

  return (
    <SettingsRow label="Public card URL">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, color: "#8b938c" }}>kontax.app/u/</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          style={{ width: 160, height: 36, borderRadius: 8,
            border: "1px solid #d8ddd6", padding: "0 10px", fontSize: 14 }}
          maxLength={30}
        />
        <Button variant="primary" size="sm"
          disabled={status !== "available"}
          onClick={() => claimUsername(value)}>
          Save
        </Button>
      </div>
      {status !== "idle" && statusMessages[status] && (
        <p style={{ fontSize: 13, color: statusMessages[status]!.color, margin: "6px 0 0" }}>
          {statusMessages[status]!.icon}  {statusMessages[status]!.text}
        </p>
      )}
    </SettingsRow>
  );
}
```

---

## Acceptance Criteria

- `User.username` field is unique, nullable, and case-insensitively compared.
- `checkUsernameAvailability` returns the correct status for valid, taken, reserved, and invalid usernames.
- All entries in `RESERVED_USERNAMES` return `"reserved"`.
- `claimUsername` sets the username and `usernameClaimedAt`; returns `COOLDOWN` if the user changes within 30 days.
- The profile settings UI shows real-time availability feedback (debounced 400ms).
- Usernames are stored lowercase; mixed-case input is normalised on save.
- Users without a username (`username: null`) have no public card page (P30-02 returns 404).

---

## Risks and Open Questions

- **Username squatting on launch:** early users may claim common names. Consider requiring email verification before a username can be claimed (already a prerequisite for Pro features in this roadmap, so this is implicitly handled).
- **Username change and SEO:** if a user changes their username, the old URL (`/u/oldname`) returns a 404. This breaks any links the user has shared. For v1, usernames are immutable after claiming (the 30-day cooldown plus a support step is the change path). Document this prominently in the UI: "Choose carefully — your URL cannot be changed easily."
