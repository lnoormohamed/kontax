# P9-06 Design Brief: Device Connections and App Passwords UI

## Purpose
This ticket is a design brief — not a code implementation. It provides the designer with everything they need to produce high-fidelity mockups for the Device Connections section of the Kontax settings page. The brief covers every screen state, interactive flow, copy tone, component hierarchy, and edge case. The goal is zero follow-up questions between brief and first mockup pass.

## Background
Phase 9 turns Kontax into a CardDAV server so that users can add it as a native contacts account on iPhone, macOS, and Android. For this to be accessible, the settings page needs a dedicated section where users can:
1. See the server URL and username they need to enter on their device
2. Create an app password (device-specific credential — distinct from the Kontax login password)
3. Follow a step-by-step guide for their specific platform
4. View and manage (revoke) existing app passwords

App passwords are security-sensitive: the plaintext is shown exactly once at creation. The design must make this crystal clear without being alarming. The tone should be approachable and practical — "here's how to connect your iPhone" — not technical ("configure your CardDAV account endpoint").

The engineering spec for implementation is P9-05. This brief informs and precedes that work.

## Scope

**In scope:**
- All visual states for the Device Connections section within the settings page
- App password creation flow (all three states)
- App password list view (empty, one item, at plan limit)
- Revoke confirmation dialog
- Platform connection guide (iPhone/iPad, macOS, Android)
- Plan limit upgrade prompt
- Copy interaction feedback

**Out of scope:**
- Other settings page sections
- Billing or subscription pages
- CardDAV protocol internals — these do not appear in the UI
- Email or push notification design for device-related events

---

## Design Specification

### Information Architecture

The Device Connections section sits within the existing Settings page layout. Within this section, the visual order is:

1. Section header: "Connect a device"
2. Connection Details card (server URL + username)
3. App Password Manager (create form + list + plan limit)
4. Platform Connection Guide (tabbed)

This order follows the user's mental model: "Where do I connect? → What credential do I use? → How do I enter it on my device?"

---

### Surface 1: Connection Details Card

**Purpose:** Give the user the exact values they need to type into their device.

**Contents:**
- Heading: "Your connection details"
- Two rows:
  - Row 1: Label "Server" / Value `https://kontax.app/dav/` / Copy icon button
  - Row 2: Label "Username" / Value (user's email address, e.g. `alice@example.com`) / Copy icon button

**Visual style:** A lightly bordered card or a grey background block. Values should be in monospace or a slightly distinct typeface (not necessarily full code font, but visually distinct from prose). The copy icon should be a standard clipboard icon; after clicking, the icon briefly changes to a checkmark with the label "Copied" for 2 seconds.

**States:**
- Default (before copy): clipboard icon
- Copied: checkmark icon + "Copied" label, reverts after 2 seconds

**Notes for designer:**
- Do not show a "show/hide" toggle for the server URL or username — these are not sensitive values
- The user may be viewing this page on their phone while simultaneously navigating their iPhone Settings app; clarity and large tap targets matter

---

### Surface 2: App Password Manager — Empty State

**Trigger:** User has zero active app passwords.

**Contents:**
- Illustration or icon cluster: three overlapping platform icons (iPhone, Android, Mac), ideally in a subtle style that matches the Kontax visual language
- Heading: "Connect your first device"
- Body copy (2 sentences): "Create an app password to connect your iPhone, Mac, or Android. App passwords are separate from your Kontax login — you can revoke them any time."
- Primary CTA button: "Create app password"

**Notes for designer:**
- The illustration should feel welcoming and modern, not technical
- Do not use a generic "lock" or "key" metaphor — use device icons to immediately communicate what this feature does
- The body copy should not mention CardDAV, Basic Auth, or any protocol names

---

### Surface 3: App Password Creation — State 1 (Label Input)

**Trigger:** User clicks "Create app password" from empty state, or the "+ New app password" button from the list state.

**Contents:**
- Inline form (not a modal — keep the user in context so they can see the connection guide at the same time)
- Input field: Label "Device name", placeholder text: "e.g. iPhone, Work Mac, Pixel 8"
- Helper text below input: "This helps you identify which device each password belongs to."
- Primary button: "Generate password"
- Secondary link: "Cancel" (returns to empty state or list state without a confirmation dialog — no data entered yet)

**Validation states:**
- Default: standard input style
- Error (empty label on submit): input border turns red, inline error "Please enter a name for this device"
- Error (label too long): inline character count + error at 64 characters

**Notes for designer:**
- Keep the form compact — it should not take up the full viewport width on desktop
- The "Device name" label is intentionally not "Label" — "Device name" is clearer to non-technical users

---

### Surface 4: App Password Creation — State 2 (Show-Once Token)

**Trigger:** `createAppPassword` server action succeeds. This state appears immediately after the user submits the label.

**Purpose:** Show the generated password exactly once. The user must copy it now.

**Contents (strictly ordered):**
1. Warning banner — amber/yellow background: "Save this password now. You won't be able to see it again." Icon: warning triangle or info circle.
2. The password token in a distinct container:
   - Monospace font, large enough to read easily (at least 18px)
   - Formatted in groups of 4 separated by hyphens: `a3Kx-mP9q-bNRt-vZ7w-hYcJ-kWQd`
   - Background: light grey or a subtle highlight box
   - "Copy password" button directly below or beside the token (text + icon)
   - Optional: a second copy-to-clipboard icon button overlaid on the token box itself (makes it feel native to desktop UX)
3. After clicking "Copy password": the button changes to "Copied ✓" for 2 seconds, then reverts to "Copy password"
4. Confirmation button: "I've copied this password" — this is the only way to proceed
5. No "dismiss" or "skip" button. The back arrow / Cancel is hidden in this state.

**States of the confirmation button:**
- Before copy: disabled or de-emphasised, with tooltip "Copy the password first"
- After copying: enabled, full emphasis
- Alternatively (simpler): always enabled but with clear visual guidance to copy first

**Notes for designer:**
- The amber warning banner must be prominent but not panic-inducing. The tone of the warning text is informative, not alarming.
- The password token container should look secure and intentional — not like a form field the user should edit
- The "I've copied this password" button is the key UX moment: the user must click it consciously. This is not a checkbox or a dismissal — it is a deliberate action.
- Consider whether a countdown timer ("This screen will remain until you confirm...") adds helpful urgency or unnecessary anxiety — leave this to designer judgment
- On mobile, the copy button must have a minimum 44×44pt tap target

---

### Surface 5: App Password Creation — State 3 (Confirmed)

**Trigger:** User clicks "I've copied this password".

**Contents:**
- Brief success toast or inline message: "Password saved for {label}."
- The creation form area transitions back to the normal list view with the new password appearing at the top of the list
- No persistent confirmation state — the success is communicated by the new item in the list

**Transition:** A smooth appear animation on the new list row. The row enters the list at the top, with the label, creation date, and "Never used" in the last-used column.

---

### Surface 6: App Password List

**Trigger:** User has one or more active app passwords.

**Contents:**
- "Your devices" heading (or "Connected devices")
- Table or list of app passwords
- "+ New app password" secondary button (right-aligned or below the list)

**Per-row content:**
- Platform icon (16×16 or 20×20, left-aligned): iPhone icon if label contains "iphone" or "ios"; Mac icon if "mac" or "macos"; Android icon if "android" or "davx"; generic device icon otherwise
- Device name (bold, main text)
- "Created {relative date}" — secondary text, small (e.g. "Created 3 days ago")
- "Last used {relative date}" or "Never used" — secondary text, small
- "Revoke" — text button, destructive red or muted, right-aligned

**Date formatting:**
- Within 7 days: "3 days ago", "Yesterday", "Today"
- 7–30 days: "2 weeks ago"
- Over 30 days: absolute date, e.g. "Nov 3, 2025"

**Hover state (desktop):** Highlight the row on hover to make the revoke button easier to target.

**Mobile:**
- Stack the platform icon + device name on the first line
- Created and last-used dates on the second line (smaller text)
- Revoke as a full-width secondary button below the date text, or accessible via a three-dot menu button

**Notes for designer:**
- Do not use a toggle to show/hide revoked passwords — revoked passwords are permanently gone from the list
- The "Last used" date is the most important signal for users deciding which passwords to revoke (e.g. "I haven't used this on my old Android in 6 months")

---

### Surface 7: Revoke Confirmation Dialog

**Trigger:** User clicks "Revoke" on any row.

**Contents:**
- Modal dialog (not a full-page takeover)
- Title: "Revoke this password?"
- Body: "The device connected with {bold: label} will stop syncing immediately. This cannot be undone."
- Buttons (right-aligned):
  - "Cancel" (secondary, left)
  - "Revoke password" (destructive red, right)

**Loading state:** After clicking "Revoke password", show a loading spinner on the button and disable the Cancel button. On success, close the dialog and remove the row from the list with a brief fade-out animation.

**Error state:** If revocation fails, show an inline error message inside the dialog: "Something went wrong. Please try again." with a "Try again" button.

**Notes for designer:**
- This is a destructive action with immediate real-world consequences (the device loses sync access). The wording "This cannot be undone" must be present.
- Do not use the word "delete" — "revoke" is the correct term and is used consistently across the UI.
- The dialog must have a focus trap and close on Escape key press (cancelled, not confirmed).

---

### Surface 8: Plan Limit State

**Trigger:** User is at or near their app password limit.

**Near limit (one slot remaining):**
- A subtle indicator below the list or above the "+ New app password" button: "Using 2 of 3 app passwords"
- No blocking behaviour — user can still create one more

**At limit:**
- The "+ New app password" button is replaced with (or accompanied by) an upgrade prompt:
  - Amber callout: "You've reached your limit of {limit} app password(s) on the {plan} plan."
  - Link: "Upgrade to Pro for unlimited passwords →"
- The create form does not appear if the limit is reached

**PRO / unlimited state:**
- No limit indicator shown
- "+ New app password" button is always visible

**Notes for designer:**
- The at-limit state must not remove the user's access to their existing passwords or the connection guide
- The upgrade prompt is an opportunity, not a punishment — keep the tone positive ("Upgrade for unlimited") rather than restrictive ("You can't create more")
- On the FREE plan, limit = 1. The near-limit state does not apply (you either have 0 or 1). Simplify accordingly.

---

### Surface 9: Platform Connection Guide

**Structure:** Tabbed navigation with three tabs:
- "iPhone / iPad" (active by default)
- "macOS"
- "Android"

Each tab contains numbered step-by-step instructions.

**Visual style:** Clean numbered list. Each step is one action. The server URL and username that appear in the steps should be displayed as inline code-style values with a copy button (same copy button pattern as the Connection Details card above). This means the user can follow the guide and copy values directly from within the instructions.

**iPhone / iPad tab:**
- Steps 1–8 as specified in P9-05 (abbreviated here — see P9-05 for full step text)
- Screenshot placeholder areas (optional): if the designer wants to include device screenshots showing exactly where to tap, leave placeholder blocks. Engineering will source the screenshots separately.
- Final step links to the App Password Manager: "Need an app password? Create one above."

**macOS tab:**
- Steps 1–7 as specified in P9-05
- Note that "System Settings" is the current name (macOS Ventura+); older systems use "System Preferences > Internet Accounts". Consider a footnote or a collapsible "macOS Monterey and earlier" section.

**Android tab:**
- Steps 1–8 as specified in P9-05
- Include a direct link to DAVx⁵ on the Play Store
- Note that some Android manufacturers have built-in CardDAV support — the guide is written for DAVx⁵ as the recommended client

**Tab interactions:**
- Switching tabs should not reset any state in the App Password Manager above
- The selected tab is remembered during the session (if the user switched to Android and scrolls away, it stays on Android when they return)

**Copy interactions within the guide:**
- Same pattern as the Connection Details card: clipboard icon, "Copied" feedback on click

---

### Component Hierarchy Summary

```
DeviceConnectionsSection
  SectionHeader: "Connect a device"
  ConnectionDetailsCard
    ServerUrlRow
      Label: "Server"
      Value: {serverUrl} (monospace)
      CopyButton
    UsernameRow
      Label: "Username"
      Value: {email} (monospace)
      CopyButton
  AppPasswordManager
    [Empty state OR:]
    AppPasswordCreateForm
      State1_LabelInput
        DeviceNameInput
        GenerateButton
        CancelLink
      State2_ShowOnce
        WarningBanner
        TokenDisplay (monospace, formatted)
        CopyPasswordButton
        ConfirmCopiedButton
      State3_Confirmed
        [transitions to list]
    AppPasswordList
      AppPasswordRow (×N)
        PlatformIcon
        DeviceName
        CreatedDate
        LastUsedDate
        RevokeButton
      PlanLimitIndicator
      NewAppPasswordButton (disabled if at limit)
    RevokeConfirmationDialog
  PlatformConnectionGuide
    TabBar (iPhone, macOS, Android)
    GuideContent
      NumberedSteps (with inline CopyableValues)
```

---

### Copy Tone

The Device Connections section is one of the more technically complex features in Kontax, but the copy must never feel like it. Guidelines:

- **Use device names, not protocol names.** "Connect your iPhone" not "Configure a CardDAV account endpoint".
- **Use plain verbs.** "Create", "Revoke", "Copy", not "Generate credential", "Invalidate token", "Clipboard action".
- **Acknowledge the user's goal.** "Your iPhone contacts will appear alongside your Kontax contacts" rather than "CardDAV sync is bidirectional".
- **Be direct about security without being scary.** "Save this password now. You won't be able to see it again." — clear, calm, one sentence.
- **"Revoke" is the right word.** Don't substitute "delete", "remove", or "disable" — revoke is widely understood in a security context and is accurate.
- **Numbers are friends.** "Using 1 of 3 app passwords" is clearer than "You have used up some of your app password allocation".

---

### Interactive States Summary

| Component | States |
|---|---|
| Copy button | Default / Copied (2s) |
| Create form | State 1 (label input) / State 2 (show-once) / State 3 (confirmed) |
| Token confirm button | Enabled (always) or Disabled-until-copy (designer choice) |
| App password list | Empty / 1+ items / At plan limit |
| Password row | Default / Hover (desktop) / Revoke loading / Revoke error |
| Revoke dialog | Closed / Open / Loading / Error |
| New password button | Enabled / Disabled (at limit) |
| Guide tabs | Each tab selected state |

---

### Platform Icon Set Required

The designer must produce or source icons for:
- iPhone / iOS
- iPad (can share the iPhone icon if generic)
- macOS / Mac (Apple desktop/laptop)
- Android
- Generic device (fallback for unrecognised labels)

Icons should be 20×20 and work on both light and dark backgrounds. SVG format preferred.

---

## Acceptance Criteria

- The designer can proceed to high-fidelity mockups without any follow-up questions to engineering or product.
- All nine surfaces are covered with complete state inventories.
- The component hierarchy is documented and matches the engineering spec in P9-05.
- The copy tone guidelines are present and all UI text in the brief follows them.
- The platform icon set requirements are explicitly listed.
- The brief distinguishes clearly between the credential management UI (App Password Manager) and the informational content (Connection Guide).
- Every destructive action (revoke) has a confirmed destructive pattern (dialog with explicit confirmation).
- The show-once token pattern is fully specified including the transition in and out of that state.

---

## Risks and Open Questions

- **Show-once pattern edge cases:** What happens if the user's browser crashes or the page refreshes during State 2? They lose the token. The design cannot prevent this, but the copy tone and UX should minimise the chance (prominently placed copy button, clear warning). If this happens, the user must revoke and recreate — the design should make this recovery path easy to find.
- **Platform-specific UI differences:** iOS 17 and iOS 18 have slightly different paths to the CardDAV setup screen. The guide text references the most current path. Consider whether to add a "having trouble?" expandable section with alternative paths.
- **Dark mode:** Specify how the token display, warning banner, and platform icons should adapt to dark mode. The warning amber should remain readable in both modes.
- **Internationalisation:** The current brief is English-only. If Kontax later localises, all step-by-step instructions will need translation. The designer should avoid embedding critical values (URLs, usernames) as part of translated strings — they should remain as insertable parameters.
- **Tablet layout:** iPad users connecting their iPad to Kontax will access the settings page on their iPad. The two-column settings layout on larger screens should accommodate the device connections section gracefully.

---

## Outcome
This ticket is done when the designer has a complete, unambiguous brief covering all surfaces and states, and can begin high-fidelity mockups without additional input from engineering or product.
