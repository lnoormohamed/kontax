# P26-02 — Login Page Rebuild

## Purpose

Replace the current basic login page with the locked `04-login-register.md` design: a centred card on a light green background, branded with the Kontax identity, with fully-accessible form fields, password show/hide, "Forgot password?" link, 2FA challenge routing, OAuth sign-in slot (reserved, off by default), and a smooth success state.

## Background

The current `/login` page predates Phase 18's auth hardening and uses the old dark theme. All Phase 18 features (password reset P18-05, 2FA challenge P18-07, OAuth providers P18-08, rate limiting P18-10, session version P18-02) must be wired in before this page ships — Phase 26 is where the polished UI is built on top of the working auth infrastructure.

The design is locked in `04-login-register.md`. This ticket implements it exactly.

## Scope

**In scope:**
- `/login` page to the locked design spec: background, card, brand mark, heading, email + password fields, show/hide toggle, strength meter absent (login only), "Forgot password?" link, CTA, error alert, mode switch, success state
- 2FA challenge routing: after successful credential check, if TOTP is enabled, route to the 2FA step (existing P18-07 flow) rather than completing the session
- OAuth sign-in slot: reserved but hidden by default (`ENABLE_OAUTH=false`); when `P18-08` OAuth ships and the flag is enabled, the slot renders Google + Apple buttons
- Rate limiting feedback: after 5 failed attempts, show "Too many attempts. Please wait N minutes."
- `next` support: redirect to the originally requested URL after successful login (the app's redirect param is `next`, not NextAuth's `callbackUrl`)

**Out of scope:**
- 2FA challenge UI (P18-07)
- OAuth buttons (P18-08)
- The register page (P26-03)

---

## Design / Implementation Spec

### Page background

```css
/* login-bg.css */
.login-bg {
  background-color: #eef1ec;
  background-image:
    radial-gradient(ellipse 70% 55% at 50% 36%, rgba(23,53,46,0.10) 0%, rgba(23,53,46,0) 70%),
    radial-gradient(ellipse 90% 70% at 50% 110%, rgba(23,53,46,0.07) 0%, rgba(23,53,46,0) 60%);
  position: fixed;
  inset: 0;
}
```

Grain texture: SVG `<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>` at `opacity: 0.4` overlay.

Card: `max-width: 440px`, `padding: 40px`, `background: #ffffff`, `border-radius: 24px`, `border: 1px solid rgba(216,221,214,0.7)`, `box-shadow: 0 18px 50px rgba(29,40,35,0.12), 0 2px 8px rgba(29,40,35,0.06)`.

Vertical centering: `min-height: 100dvh`, flexbox. Below 600px viewport height: `justify-content: flex-start; padding-top: 32px`.

### Form implementation

```tsx
// src/app/(public)/login/page.tsx — client component for form interactivity
"use client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // The app's redirect param is `next` (the middleware sets ?next=<path>; the
  // server login page reads `next`). NOT NextAuth's `callbackUrl`. Validate it is
  // a same-origin relative path to prevent open-redirect, then default to /contacts.
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/contacts";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error === "2FA_REQUIRED") {
      router.push(`/login/2fa?email=${encodeURIComponent(email)}`);
      return;
    }

    if (result?.error) {
      setError(result.error === "RATE_LIMITED"
        ? "Too many attempts. Please wait a few minutes before trying again."
        : "Incorrect email or password. Please try again.");
      setIsSubmitting(false);
      return;
    }

    setSuccess(true);
    // Hard navigation (NOT router.push): guarantees the freshly-set session
    // cookie is sent and the server re-renders the destination. A soft client
    // navigation can render a stale logged-out view (learned the hard way — see
    // the P18 auth fixes). `next` is already validated to a relative path above.
    window.location.assign(next);
  };
  // ...
}
```

### Field specs (from locked design brief)

- **Email:** `type="email"`, `autocomplete="email"`, `height: 44px`, `border-radius: 12px`.
- **Password:** `type={showPassword ? "text" : "password"}`, `autocomplete="current-password"`. Show/hide toggle: eye icon, `38×38px`, right inside the input.
- **"Forgot password?" link:** right-aligned below the password field, `font-size: 13px`, `color: #5c655e`, links to `/forgot-password`.
- **CTA:** "Log in", full-width, `height: 48px`, `background: #4158f4`. Loading spinner while `isSubmitting`.
- **Mode switch:** "Don't have an account? Create one →" below the card.

### 2FA routing

When `signIn` returns `error: "2FA_REQUIRED"`, the credentials provider (P18-07) should return this error code instead of completing the session. Route to `/login/2fa?email=...` which shows the TOTP 6-digit input (P18-07 implements this route).

### Success state

When `result` is successful:
```tsx
{success ? (
  <div style={{ textAlign: "center" }}>
    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e7efe9",
      display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
      <Check size={24} strokeWidth={2.4} color="#17352e" />
    </div>
    <h2>Welcome back</h2>
    <p>Taking you to your contacts…</p>
  </div>
) : (
  <form>{/* ... */}</form>
)}
```

### OAuth slot (reserved)

```tsx
{process.env.NEXT_PUBLIC_ENABLE_OAUTH === "true" && (
  <>
    <OAuthButtons />
    <OrDivider />
  </>
)}
```

Hidden until P18-08 ships and the flag is enabled.

---

## Acceptance Criteria

- The login page matches the `04-login-register.md` design spec: background, card, brand mark, fields, CTA, error states, success state.
- Correct credentials redirect to `/contacts` (or the `next` path if set).
- Incorrect credentials show the error alert box: "Incorrect email or password."
- After 5 failed attempts, the rate-limited message is shown.
- "Forgot password?" links to `/forgot-password` (P18-05).
- If 2FA is enabled for the account, a successful credential check routes to `/login/2fa`.
- Show/hide toggle works on the password field; accessible with keyboard.
- The page is fully responsive per the mobile spec in the design brief.
- All form inputs have explicit `<label>` elements and `aria-describedby` for error messages.

---

## Risks and Open Questions

- **`signIn` returning custom error codes:** the NextAuth `authorize` callback must return a specific error code (`2FA_REQUIRED`, `RATE_LIMITED`) for the client to handle them distinctly. Verify these error codes are consistently returned by P18-07 and P18-10 before this ticket ships.
- **`next` open-redirect security:** the app uses a **custom** `next` param, not NextAuth's `callbackUrl`, so NextAuth's built-in redirect validation does **not** apply — the app must validate it itself. Only same-origin relative paths may be honoured: reject anything not starting with `/` (and reject `//` / `/\` protocol-relative forms) and fall back to `/contacts`. This mirrors the existing check in the server `src/app/login/page.tsx` (`next.startsWith("/")`).
