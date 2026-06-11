# P18-08 — OAuth Login Providers (Google Sign-In, Apple Sign-In) — DEFERRED TO TBD

## Purpose

Offering Google and Apple as login options reduces signup and login friction — users do not need to remember a password, and they arrive with a verified email address. This ticket adds OAuth-based authentication alongside the existing Credentials provider, with careful account-linking logic to avoid creating duplicate accounts when a user signs up with OAuth after having previously registered with their email and password.

## Background

The current NextAuth config (`src/server/auth/config.ts`) uses only the Credentials provider. NextAuth supports OAuth providers natively. However, the app uses a custom Prisma schema (not the NextAuth Prisma adapter), so OAuth account records and the linking logic must be implemented manually.

The account-linking decision: if a user signs in with Google and the Google account's verified email matches an existing `User.email`, link the OAuth account to that user rather than creating a new one. This requires that the email from the OAuth provider is verified (Google always provides verified emails; Apple sometimes does not).

This ticket is P2 (lower priority) and depends on P18-03 (email change flow being stable) because email-change and OAuth-linking interact on the same `User.email` field.

## Scope

**In scope:**
- `OAuthAccount` Prisma model
- Add `GoogleProvider` and `AppleProvider` to NextAuth config
- Custom `signIn` callback: link-or-create logic based on email match
- `linkOAuthAccount(provider)` server action — for existing Credentials users to link an OAuth provider
- `unlinkOAuthAccount(accountId)` server action — unlink; requires at least one remaining sign-in method
- Settings UI: "Connected accounts" section showing linked providers + link/unlink buttons
- Ensure users with only an OAuth account (no password) cannot access the password-change form

**Out of scope:**
- Additional providers (GitHub, Microsoft) — same pattern applies; add as needed
- OAuth account's access/refresh tokens for API calls (Kontax does not call Google/Apple APIs on behalf of users — the OAuth is for auth only)
- SSO / enterprise SAML

---

## Design / Implementation Spec

### Schema change

Add to `prisma/schema.prisma`:

```prisma
model OAuthAccount {
    id                String   @id @default(cuid())
    userId            String
    provider          String   // "google" | "apple"
    providerAccountId String
    createdAt         DateTime @default(now())
    user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@unique([provider, providerAccountId])
    @@index([userId, provider])
}
```

Add to `User`:
```prisma
oauthAccounts OAuthAccount[]
```

Also add:
```prisma
passwordSet Boolean @default(true)
```

`passwordSet` is `false` for users who signed up via OAuth and never set a password. It gates the "Change password" form — a user without a password cannot "change" it; instead they see "Set a password" (which doesn't require a current-password input).

Run: `prisma migrate dev --name add-oauth-accounts`

### NextAuth config changes

Add providers to `src/server/auth/config.ts`:

```typescript
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";

providers: [
  Credentials({ ... }), // existing
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
  Apple({
    clientId: process.env.APPLE_CLIENT_ID!,
    clientSecret: process.env.APPLE_CLIENT_SECRET!, // Apple requires a JWT secret
  }),
],
```

Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.

### Custom `signIn` callback

The `signIn` callback runs before a JWT is issued for OAuth sign-ins. It receives the OAuth `account` and `profile` objects.

```typescript
signIn: async ({ user, account, profile }) => {
  if (account?.provider === "google" || account?.provider === "apple") {
    const email = profile?.email ?? user.email;
    if (!email) return false; // Cannot sign in without an email

    // Is this email verified by the provider?
    const emailVerified = profile?.email_verified !== false; // Google always true; Apple may be false
    if (!emailVerified) return false;

    // Does an account with this email already exist?
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      // Link this OAuth account to the existing user (if not already linked)
      const existingOAuth = await db.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
      });
      if (!existingOAuth) {
        await db.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        });
      }
      // Override the user.id that NextAuth will embed in the JWT
      user.id = existingUser.id;
    } else {
      // Create a new user
      const newUser = await db.user.create({
        data: {
          email: email.toLowerCase(),
          name: profile?.name ?? user.name ?? null,
          password: "", // no password — passwordSet remains false
          passwordSet: false,
          emailVerified: new Date(), // OAuth email is pre-verified
        },
      });
      await db.oAuthAccount.create({
        data: {
          userId: newUser.id,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      });
      user.id = newUser.id;
    }
  }
  return true;
},
```

### Link/unlink server actions

#### `linkOAuthAccount`

Redirect the user through the OAuth flow with a `?link=true` query param. After OAuth callback, detect the link flag and call the link logic instead of the full sign-in flow. The simplest implementation: a dedicated NextAuth sign-in call from the settings page that sets a callback URL to a `/settings/security?linked=google` page; the `signIn` callback detects that the user is already authenticated and links rather than creates.

Full implementation detail is left to the engineer — the key constraint is: **only link to the currently authenticated user; never create a new account via the link flow.**

#### `unlinkOAuthAccount`

```typescript
export async function unlinkOAuthAccount(
  accountId: string,
): Promise<{ success: true } | { error: string }>
```

Steps:
1. Assert authenticated session.
2. Fetch the `OAuthAccount` where `id = accountId AND userId = session.user.id`.
3. Count remaining sign-in methods: `User.passwordSet` (Credentials available) + remaining `OAuthAccount` count after deletion. If the total would drop to 0, return `{ error: "CANNOT_REMOVE_LAST_AUTH_METHOD" }`.
4. Delete the `OAuthAccount` record.
5. Emit `ACCOUNT_UPDATED` ActivityEvent with `payload: { field: "oauthUnlinked", provider }`.
6. Return `{ success: true }`.

### Password form behaviour for OAuth-only users

In the password change section (P18-02), check `User.passwordSet`:
- `passwordSet: true` → show the normal "current password + new password + confirm" form.
- `passwordSet: false` → show a "Set a password" form with only "new password + confirm" fields and no current-password input. On success, set `User.passwordSet = true` and hash + save the password.

### Settings UI — Connected accounts section

Location: `/settings/security`, below active sessions.

```
Connected accounts

[Google logo]  Google
               signed in as john@gmail.com        [Disconnect]

[Apple logo]   Apple
               not connected                      [Connect]
```

- "Connect" triggers an OAuth sign-in flow with the link intent.
- "Disconnect" calls `unlinkOAuthAccount`; if it would remove the last auth method, shows: "You must set a password before disconnecting your last login method."

---

## Acceptance Criteria

- `OAuthAccount` model exists in the schema; `User.passwordSet` field exists; migration applied.
- Signing in with Google creates a new `User` (with `passwordSet: false`) if no account exists for that email.
- Signing in with Google links to an existing `User` if the email matches.
- The same Google account cannot be linked to two different Kontax users.
- A user can link a Google or Apple account from the settings page.
- A user can unlink an OAuth account as long as at least one other sign-in method remains.
- Attempting to unlink the last auth method returns `CANNOT_REMOVE_LAST_AUTH_METHOD`.
- `User.passwordSet: false` users see "Set a password" instead of "Change password."
- Setting a password on an OAuth-only account sets `passwordSet: true`.
- Apple sign-in with an unverified email returns false from the `signIn` callback (user is not created).

---

## Risks and Open Questions

- **Apple's private email relay:** Apple provides a "Hide my email" option that gives users a relay address (e.g. `abc123@privaterelay.appleid.com`). This can cause account-linking issues if the user later tries to use their real email. For v1, treat relay addresses as valid emails — they are unique and stable per user+app combination. Document the limitation.
- **Google client ID / secret on Vercel:** Ensure redirect URIs are configured correctly in the Google Cloud Console: `{APP_URL}/api/auth/callback/google`. The same applies to Apple: `{APP_URL}/api/auth/callback/apple`.
- **Apple's client secret:** Apple uses a JWT as the client secret, generated from a private key. The secret expires and must be regenerated periodically (up to 6 months). Add a monitoring alert or calendar reminder to regenerate before expiry. The `APPLE_CLIENT_SECRET` env var holds the pre-generated JWT.
- **Existing Credentials users linking Google:** If a Credentials user opens the settings "Connect Google" button, they go through the OAuth flow while already signed in. NextAuth's default behaviour is to sign them in (creating a new account if the emails differ). The link intent detection (via the `?link=true` flag and session check in `signIn` callback) must be robust to avoid accidentally creating duplicate accounts.
