# P21-01 — Admin Role & Route Guard

## Purpose

Add a `role` field to `User` that distinguishes regular users from admins, and protect all `/admin/**` routes so only users with `role = ADMIN` can access them. Without this, admin tooling built in subsequent tickets would be accessible to any authenticated user.

## Background

The middleware (`src/middleware.ts`, P18-10) already guards authenticated routes. Admin protection extends this with a role check. The middleware must also allow admins to access `/admin/**` without triggering the standard app redirect.

## Scope

**In scope:**
- `UserRole` enum (`USER`, `ADMIN`) and `User.role` field
- Middleware update — redirect non-admins who access `/admin/**` to `/404`
- `assertAdmin()` server-side utility for use in server actions and route handlers
- First admin seeding: document how to promote the first user to admin via a DB query
- Admin layout shell (`src/app/admin/layout.tsx`) — minimal nav, admin badge

**Out of scope:**
- Any admin UI beyond the layout shell (subsequent tickets)
- Admin-specific authentication (uses the same NextAuth session — just a role check)

---

## Design / Implementation Spec

### Schema change

Add to `prisma/schema.prisma`:

```prisma
enum UserRole {
    USER
    ADMIN
}

// On User model:
role UserRole @default(USER)
```

Run: `prisma migrate dev --name add-user-role`

### Middleware update

In `src/middleware.ts` (P18-10), add admin route protection:

```typescript
const ADMIN_PATHS = ["/admin"];

// In the middleware function, after the session check:
if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // Check role from JWT — extend Session type to include role
  if ((session as { role?: string }).role !== "ADMIN") {
    return NextResponse.redirect(new URL("/404", req.url));
  }
}
```

Extend the NextAuth `Session` type and `jwt` callback to include `role`:
```typescript
// In auth/config.ts jwt callback:
if (user) {
  token.role = (user as { role?: string }).role ?? "USER";
}
// On update trigger, re-fetch role from DB
```

### `assertAdmin` utility

`src/server/admin.ts`:

```typescript
import { auth } from "~/server/auth";

export async function assertAdmin(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  if ((session as { role?: string }).role !== "ADMIN") throw new Error("FORBIDDEN");
  return { userId: session.user.id };
}
```

All admin server actions and route handlers call `assertAdmin()` at the top.

### First admin seeding

Promote the first admin via a one-time DB query (run in a migration or manually via Prisma Studio):

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@yourcompany.com';
```

Document this in the README as the onboarding step for setting up the first admin account.

### Admin layout shell

`src/app/admin/layout.tsx`:

```tsx
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Role check is handled by middleware — this is a belt-and-suspenders check
  if ((session as { role?: string })?.role !== "ADMIN") redirect("/404");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AdminSidebar />
      <main style={{ flex: 1, padding: "24px" }}>{children}</main>
    </div>
  );
}
```

`AdminSidebar` links: Users, Metrics, Feature Flags, Audit Log. Displays "Admin" badge in the header.

---

## Acceptance Criteria

- `User.role` field exists with `@default(USER)`; migration applied.
- A non-admin user accessing `/admin` is redirected to `/404`.
- An unauthenticated user accessing `/admin` is redirected to `/login`.
- `assertAdmin()` throws `FORBIDDEN` for non-admin sessions.
- `User.role` is included in the JWT and accessible in server components via `auth()`.
- The admin layout shell renders with a sidebar for an admin user.
- Promoting a user to admin via the DB query is documented.
