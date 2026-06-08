# P9-05 Device Connections Settings UI

## Purpose
The CardDAV server (P9-01 through P9-04) provides the protocol layer, but users cannot use it without knowing their server URL, username, and how to create an app password. This ticket builds the settings UI that surfaces those credentials, guides users through the native device setup process step by step, and lets them manage (create and revoke) app passwords. Without this UI, the CardDAV server is invisible to users and useless regardless of technical correctness.

## Background
The existing settings page is at `src/app/settings/page.tsx`. Phase 9 adds a new "Connect a device" section. The UI is informed by the app password model from P9-02 (creation, listing, revocation server actions) and the URL structure from P9-01 (server URL to display to the user).

The existing settings page has an established component style (sections with headings, form inputs, button patterns) visible in the current codebase. New UI components in this ticket should follow that style rather than introducing new patterns.

The design brief for this section is a separate deliverable (P9-06). This ticket implements the code based on that brief, or in parallel using reasonable defaults if the design is not yet complete.

## Scope

**In scope:**
- New "Connect a device" section in settings (or new `/settings/devices` route)
- Display of server URL and username (email) with copy buttons
- App password creation flow: label input → generate → show-once plaintext with copy button → confirmation
- App password list: label, created date, last used date, revoke button per row
- Revoke confirmation dialog
- Step-by-step connection guide for iPhone, macOS, and Android (DAVx⁵)
- Plan limit display: current count / limit and upgrade prompt if at limit
- Responsive layout

**Out of scope:**
- The CardDAV server endpoints themselves (P9-02, P9-03, P9-04)
- Design direction (P9-06)
- Compatibility testing (P9-07)
- Multiple address books per user — v1 shows a single "default" address book URL

---

## Design / Implementation Spec

### Route Placement

Add the device connections section to the existing settings page at `/settings`. If the settings page is becoming too long, consider extracting to `/settings/devices` with a sidebar link labeled "Devices". For v1, prefer adding it to the existing page to reduce navigation complexity — users will set this up once and rarely return.

If extracted to a separate route:
- File: `src/app/settings/devices/page.tsx`
- Add a sidebar entry in the settings navigation component

### Section: Server Connection Details

Display the following read-only information at the top of the section:

**Server URL:**
```
https://kontax.app/dav/
```
(Or `https://dav.kontax.app/` if the subdomain topology is chosen in P9-01.)

This is the URL the user enters into their device's "Server" field during CardDAV account setup.

**Username:**
```
{user.email}
```

Both values should have a copy-to-clipboard button (icon button, not a labeled button). Show a brief confirmation ("Copied") after clicking.

### Section: App Passwords

#### Empty State

When the user has no app passwords:

- Illustration or icon (platform icons: iPhone, Android, Mac)
- Heading: "Connect your first device"
- Body copy: "Create an app password to connect your iPhone, Mac, or Android phone. App passwords are separate from your Kontax login — you can revoke them at any time."
- Primary button: "Create app password"

#### App Password Creation Form

The creation flow has three states:

**State 1 — Label input:**
- Input field labeled "Device name" with placeholder "e.g. iPhone, Work Mac, Pixel 8"
- Max length: 64 characters
- "Generate password" button (primary action)
- Submits the `createAppPassword` server action with the entered label

**State 2 — Show-once plaintext:**
- Triggered immediately after successful creation response
- Display the token in a monospace font in a visually distinct container (e.g. a grey box or card)
- Token formatted with hyphens every 4 characters for readability: `a3Kx-mP9q-bNRt-vZ7w-hYcJ-kWQd`
- "Copy password" button (icon + text)
- Warning banner: "Save this password now. You won't be able to see it again."
- "I've copied this password" button — clicking this transitions to State 3
- No dismiss without confirmation — the user must explicitly acknowledge they have copied the token

**State 3 — Password saved:**
- Brief confirmation message: "Password saved. Your device is ready to connect."
- The new password appears at the top of the password list (see below) showing label, creation date, and last used date (which will be "Never" initially)
- The creation form is closed or reset to State 1

**Error states:**
- Plan limit reached: show inline error message "You've reached the limit of {limit} app password(s) on the Free plan. Upgrade to Pro for more." with an upgrade link.
- Label too short or empty: inline validation before submit.
- Server error: generic inline error message with retry button.

#### App Password List

After at least one app password exists, show a list below the creation form:

Each row contains:
- Platform icon (inferred from label keywords: "iphone" → iPhone icon, "mac" / "macos" → Mac icon, "android" / "davx" → Android icon, anything else → generic device icon)
- Label (bold)
- "Created {date}" in secondary text (relative date: "3 days ago", or absolute date if older than 30 days)
- "Last used {date}" or "Never used" in secondary text
- "Revoke" button (destructive, tertiary style — small, text-only button in red or grey)

Platform icon inference is done client-side based on simple keyword matching in the label string. It is cosmetic and does not affect functionality.

**Revoke confirmation:** Clicking "Revoke" opens a confirmation dialog:
- Title: "Revoke this password?"
- Body: "The device connected with "{label}" will stop syncing immediately. This cannot be undone."
- Confirm button: "Revoke password" (destructive)
- Cancel button: "Cancel"
- On confirm: calls the `revokeAppPassword` server action, removes the row from the list

**Plan limit indicator:**
- Show below the list (or below the create button): "Using {current} of {limit} app passwords" with a simple bar or text count
- If at limit: highlight in amber, show upgrade link
- PRO users: show "Unlimited" instead of a count

### Section: Connection Guides

A tabbed or accordion section with per-platform instructions. Tabs: "iPhone / iPad", "macOS", "Android (DAVx⁵)".

**iPhone / iPad:**
1. Open the Settings app
2. Scroll down and tap "Contacts"
3. Tap "Accounts"
4. Tap "Add Account"
5. Tap "Other"
6. Tap "Add CardDAV Account"
7. Enter the following details:
   - Server: `{serverUrl}` [copy button]
   - User Name: `{user.email}` [copy button]
   - Password: *(your app password)*
   - Description: "Kontax" (or any name you like)
8. Tap "Next" — your contacts will start syncing

**macOS:**
1. Open System Settings
2. Click "Internet Accounts"
3. Click "Add Account..."
4. Click "Other Accounts..."
5. Click "CardDAV account"
6. Enter:
   - Account Type: "Advanced"
   - User Name: `{user.email}`
   - Password: *(your app password)*
   - Server Address: `{serverUrl}`
7. Click "Sign In"

**Android (DAVx⁵):**
1. Install DAVx⁵ from the Play Store
2. Open DAVx⁵ and tap the + button
3. Select "Login with URL and user name"
4. Base URL: `{serverUrl}`
5. User name: `{user.email}`
6. Password: *(your app password)*
7. Tap "Login"
8. Select the "Contacts" address book and tap "Synchronize"

All occurrences of `{serverUrl}` and `{user.email}` in the guides should be pre-filled with the actual values (not placeholder text), so the user can follow the guide step by step without context-switching to copy values.

### Component Structure

```
DeviceConnectionsSection
  ServerDetailsCard
    ServerUrlRow (copy button)
    UsernameRow (copy button)
  AppPasswordManager
    AppPasswordCreateForm (States 1, 2, 3)
    AppPasswordList
      AppPasswordRow (×N)
      PlanLimitIndicator
  ConnectionGuides
    GuideTabSelector (iPhone, macOS, Android)
    GuideContent (per platform)
```

### Server Actions Integration

This UI uses the following server actions from P9-02:

- `createAppPassword(label: string)` → called on "Generate password" submit
- `listAppPasswords()` → called on page load to populate the list
- `revokeAppPassword(appPasswordId: string)` → called on revoke confirmation
- `canCreateAppPassword(userId: string)` → called to show/hide the plan limit state

Use React's `useOptimistic` or `useTransition` where appropriate to give instant feedback while server actions are in-flight.

### State Management

Use local component state (useState) for:
- Creation form state machine (State 1 / 2 / 3)
- The plaintext token returned from `createAppPassword` — stored in memory only, never in localStorage or sessionStorage
- Revoke confirmation dialog open/close
- Copy confirmation flash ("Copied!" toast)

Do not persist the plaintext token in any browser storage. The token exists in component state only for the duration of the "show-once" state (State 2). When the user navigates away or the component unmounts, the token is gone.

### Loading and Error States

- On initial load: show a skeleton loader for the app password list while `listAppPasswords()` fetches
- On create: show a loading spinner on the "Generate password" button
- On revoke: show a loading spinner on the revoke button for the affected row
- If `createAppPassword` fails with `APP_PASSWORD_LIMIT_REACHED`: show an inline error banner below the form
- If `revokeAppPassword` fails: show an inline error banner in the dialog

### Accessibility

- The copy button must have an accessible label: `aria-label="Copy server URL"` (not just an icon)
- The show-once token container must be a `<div role="status">` so screen readers announce it when it appears
- The revoke confirmation dialog must use the `<dialog>` element or equivalent ARIA modal pattern with focus trap
- All form inputs must have associated `<label>` elements

### Security Notes

- The plaintext app password token is never written to the DOM as an attribute, data attribute, or server-rendered HTML. It is returned from the `createAppPassword` server action response body and stored in React state only.
- Do not use `dangerouslySetInnerHTML` for any part of the connection guide content.
- The copy-to-clipboard action uses `navigator.clipboard.writeText()` (requires HTTPS — acceptable in production).

---

## Acceptance Criteria

- The "Connect a device" section is accessible from the settings page without requiring a URL change (or via a clearly labeled sidebar link if extracted to `/settings/devices`).
- The server URL and username (email) are displayed and can be copied with one click.
- A user with zero app passwords sees the empty state with a "Create app password" call to action.
- Clicking "Create app password" shows a label input form.
- Entering a label and clicking "Generate password" calls `createAppPassword`, shows the token in the show-once state, and provides a copy button.
- The token is not visible again after the user clicks "I've copied this password".
- The newly created app password appears in the list with its label, creation date, and "Never used" last-used status.
- The app password list shows label, creation date, last-used date, and a revoke button for each entry.
- Clicking "Revoke" opens a confirmation dialog that names the specific password being revoked.
- Confirming revocation removes the password from the list and calls `revokeAppPassword`.
- The plan limit indicator is displayed and updates when a password is created or revoked.
- A FREE user who already has 1 app password sees the plan limit reached state when trying to create another.
- The connection guide shows accurate server URL and email pre-filled in the steps for all three platforms.
- The UI is usable on mobile viewport sizes (the user may be using the settings page on their phone while setting up CardDAV on the same phone).
- All interactive elements have accessible labels.

---

## Risks and Open Questions

- **"Show once" security model:** The most common failure mode is the user closing the tab before copying the token. The current design requires the user to click "I've copied this password" — if they close the tab instead, the token is lost and they must revoke and recreate. This is intentional (security > convenience) but the copy tone should clearly communicate the consequence before the token is shown.
- **Mobile usability of connection guide:** The step-by-step guide references Settings menus that may look slightly different across iOS versions. Screenshots would help but are expensive to maintain. For v1, text-only steps with clear menu path notation (using `>` separator) are acceptable.
- **Deep link from guide to app password creation:** Consider whether the connection guide step for "Password: your app password" should have a "Create one now" link that jumps to the creation form within the same page. This reduces friction for users who open the guide tab before creating a password.
- **Token clipboard persistence:** After the user copies the token, it lives in the clipboard indefinitely (until overwritten). There is no way to programmatically clear the clipboard in a cross-browser-compatible way. This is acceptable — document it in the security review.
- **DAVx⁵ auto-discovery:** DAVx⁵ supports auto-discovery via `/.well-known/carddav`. The Android guide can mention that users who type just the domain (`kontax.app`) may have auto-discovery work automatically, reducing the number of fields they need to enter. Verify this in P9-07 before adding it to the guide.
- **Upgrade prompt UX:** The upgrade prompt when the plan limit is reached should be unobtrusive but visible. It must not block the user from seeing their existing app passwords or the connection guide. An inline callout (not a modal) is the right pattern.

---

## Outcome
This ticket is done when a non-technical user can open the settings page, read the connection guide for their platform, create an app password, copy it, follow the guide steps, and successfully connect their device — all without needing to consult external documentation.
