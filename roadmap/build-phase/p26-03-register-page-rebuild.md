# P26-03 — Register Page Rebuild

## Purpose

Replace the current basic registration page with the locked `04-login-register.md` design: the same centred card shell as login, with an additional "Your name" field, a password strength meter, and a terms-of-service consent line. After submission, the email verification flow (P18-04) is triggered and the user sees a "Check your email" state in the card.

## Background

The current `/register` page uses the old dark theme and does not include the P18-04 email verification step. This ticket wires together: the new design, name requirement, password strength, P18-04 email verification dispatch, P18-08 OAuth sign-up slot (reserved), P18-10 rate limiting, and post-signup redirect to onboarding (P26-04).

## Scope

**In scope:**
- `/register` page to the locked design: same card as login, with name field, password strength meter, terms line
- Name is required; email uniqueness validation with "Log in instead" link on duplicate
- Password strength meter: 3-segment bar, weak/fair/strong colours
- `sendVerificationEmail` called after successful account creation (P18-04/P20-04)
- Post-submit "Check your email" card state (in-place replacement of form content)
- OAuth sign-up slot (reserved, same flag as P26-02)
- Rate limiting on the register endpoint (P18-10)
- `pendingShare` query param support: if `?pendingShare={id}` is present, preserved through registration and redirected to share acceptance after email verification

**Out of scope:**
- Email verification page (P18-04)
- OAuth account creation (P18-08)

---

## Design / Implementation Spec

### Form fields (from locked design brief)

1. **Your name** — required. `autocomplete="name"`. Validation: "Please enter your name." shown inline.
2. **Email address** — `type="email"`, `autocomplete="email"`. On duplicate email: field-level error "An account with this email already exists. [Log in instead →]" — link navigates to `/login?email={email}`.
3. **Password** — `autocomplete="new-password"`. Show/hide toggle. Password strength meter below.

### Password strength meter

```tsx
function PasswordStrengthMeter({ password }: { password: string }) {
  const score = getPasswordScore(password);
  // score 0: empty, 1: weak, 2: fair, 3: strong
  const colours = { 1: "#b5472f", 2: "#bf8526", 3: "#2f8f63" };
  const labels = { 0: "", 1: "Weak", 2: "Fair", 3: "Strong" };

  if (!password) return null;

  return (
    <div aria-live="polite">
      <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= score ? colours[score as 1|2|3] : "#e7eae4",
          }} />
        ))}
      </div>
      {score > 0 && (
        <span style={{ fontSize: 12, fontWeight: 600, color: colours[score as 1|2|3] }}>
          {labels[score as 0|1|2|3]}
        </span>
      )}
    </div>
  );
}

function getPasswordScore(password: string): number {
  if (password.length < 8) return 1;
  let score = 1;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}
```

### Register server action

```typescript
// src/app/actions/auth.ts
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  pendingShareId?: string;
}): Promise<{ success: boolean; error?: string }> {
  // Rate limit check (P18-10)
  const limited = await rateLimiters.register.limit(input.email);
  if (!limited.success) return { success: false, error: "RATE_LIMITED" };

  // Check email uniqueness
  const existing = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) return { success: false, error: "EMAIL_TAKEN" };

  // Validate password strength
  if (input.password.length < 8) return { success: false, error: "WEAK_PASSWORD" };

  // Create user
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await db.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      passwordHash,
    },
  });

  // Seed notification preferences (P22-01)
  await seedDefaultNotificationPreferences(user.id);

  // Send verification email (P18-04 / P20-04)
  await sendVerificationEmail(user, "SIGNUP");

  return { success: true };
}
```

### "Check your email" state

After successful registration, the card form is replaced in-place:

```tsx
{registrationComplete ? (
  <div style={{ textAlign: "center", padding: "20px 0" }}>
    <Mail size={48} color="#17352e" strokeWidth={1.5} style={{ marginBottom: 16 }} />
    <h2>Check your email</h2>
    <p>We sent a verification link to <strong>{email}</strong>.</p>
    <p style={{ color: "#8b938c", fontSize: 13, marginTop: 8 }}>
      Can't find it? Check your spam folder.
    </p>
    <button onClick={handleResend} style={{ marginTop: 16, color: "#4158f4", background: "none" }}>
      Resend email
    </button>
  </div>
) : (
  <form>{/* ... */}</form>
)}
```

### `pendingShare` preservation

If the register page is reached via `/register?pendingShare={id}` (from a share invite email, P12-06), preserve the `pendingShareId` through the registration and verification flow. After email verification completes, redirect to `/contacts/shares/pending?highlight={id}` instead of the onboarding flow.

Store `pendingShareId` in the `VerificationToken` record's `data` JSON field so it survives the email round-trip.

---

## Acceptance Criteria

- The register page matches the `04-login-register.md` spec: same card as login, name field above email, strength meter, terms line.
- All three fields are required; inline validation errors appear without form submission.
- Duplicate email shows a field-level error with "Log in instead →" link pre-filling the email.
- The strength meter renders in 3 levels; colour and label match the spec; `aria-live="polite"` announced.
- Successful registration dispatches the verification email (P18-04/P20-04) and shows the "Check your email" state.
- Rate limiting: > 5 registration attempts from the same IP shows the too-many-attempts error.
- `?pendingShare={id}` is preserved through the flow and redirected after verification.
- The OAuth slot is rendered only when `NEXT_PUBLIC_ENABLE_OAUTH=true`.

---

## Risks and Open Questions

- **Password strength validation server-side:** the client-side strength meter is UX feedback, not a security gate. The server action also validates `password.length >= 8` and rejects shorter passwords with `WEAK_PASSWORD`. Do not rely solely on the client-side check.
- **Name length limit:** store a maximum of 100 characters for `User.name`. The register form enforces `maxLength={100}` on the input and the server action trims and validates length.
