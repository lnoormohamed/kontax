# P30-07 — Card Share Tools

## Purpose

Give card owners three ways to share their public card URL: a copy-link button, a QR code (reusing the P28-06 component), and an auto-generated HTML email signature snippet. These tools make it easy to put the card URL in every digital touchpoint — email signature, social profile, messaging — maximising acquisition reach.

## Background

The public card URL (`kontax.app/u/{username}`) is the shareable artefact. The three tools in this ticket serve different distribution channels: copy-link for direct messaging, QR for in-person exchanges, and email signature for professional correspondence. All are available from `/settings/profile/card`.

## Scope

**In scope:**
- **Copy link:** copies `https://kontax.app/u/{username}` to the clipboard with a brief "Copied!" confirmation
- **QR code:** reuses `QrCodeModal` (P28-06) with the card URL instead of a share-link URL
- **Email signature snippet:** generates a copy-ready HTML snippet with name, title, and the card URL; copy button + preview
- All three tools surface in `/settings/profile/card` per the P30-DB11 design spec

**Out of scope:**
- Native share API (Web Share API for mobile sharing) — deferred
- Social profile link (e.g. "Add to your LinkedIn bio") — deferred

---

## Design / Implementation Spec

### Copy link

```tsx
function CopyCardLinkButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://kontax.app/u/${username}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="secondary" onClick={handleCopy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied!" : "Copy link"}
    </Button>
  );
}
```

Displayed inline alongside the card URL in the settings panel:
```
Your card is live at kontax.app/u/janesmith
[Copy link]   [View card ↗]
```

### QR code

Reuses `QrCodeModal` from P28-06 with the card URL as the `shareUrl` prop:

```tsx
function CardQrButton({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const cardUrl = `https://kontax.app/u/${username}`;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <QrCode size={14} />
        QR code
      </Button>

      {open && (
        <QrCodeModal
          title="Your contact card"
          shareUrl={cardUrl}
          downloadFilename={`${username}-card-qr`}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

The `QrCodeModal` from P28-06 is parameterised to accept a `shareUrl` prop directly (instead of computing it from a contact ID), making it reusable here.

### Email signature snippet

```tsx
function EmailSignatureSnippet({ user }: {
  user: { username: string; name: string; jobTitle?: string; company?: string };
}) {
  const [copied, setCopied] = useState(false);

  const cardUrl = `https://kontax.app/u/${user.username}`;
  const subtitle = [user.jobTitle, user.company].filter(Boolean).join(" at ");

  const htmlSnippet = [
    `<table style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-spacing: 0; border-collapse: collapse;">`,
    `  <tr>`,
    `    <td style="padding: 0; vertical-align: top;">`,
    `      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1d2823;">${user.name}</p>`,
    subtitle ? `      <p style="margin: 2px 0 6px; font-size: 12px; color: #5c655e;">${subtitle}</p>` : "",
    `      <p style="margin: 0;">`,
    `        <a href="${cardUrl}" style="font-size: 12px; color: #8b938c; text-decoration: none;">`,
    `          kontax.app/u/${user.username}`,
    `        </a>`,
    `      </p>`,
    `    </td>`,
    `  </tr>`,
    `</table>`,
  ].filter(Boolean).join("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(htmlSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#1d2823", marginBottom: 8 }}>
        Email signature
      </p>
      <p style={{ fontSize: 13, color: "#5c655e", marginBottom: 12 }}>
        Paste this into your email client's signature settings.
      </p>

      {/* Live preview */}
      <div style={{
        background: "#f9faf8", border: "1px solid #d8ddd6", borderRadius: 10,
        padding: "16px 20px", marginBottom: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <p style={{ margin: "0", fontSize: 14, fontWeight: 600, color: "#1d2823" }}>
          {user.name}
        </p>
        {subtitle && (
          <p style={{ margin: "2px 0 6px", fontSize: 12, color: "#5c655e" }}>
            {subtitle}
          </p>
        )}
        <a href={cardUrl} style={{ fontSize: 12, color: "#8b938c", textDecoration: "none" }}>
          kontax.app/u/{user.username}
        </a>
      </div>

      <Button variant="secondary" onClick={handleCopy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied!" : "Copy HTML"}
      </Button>
    </div>
  );
}
```

### Full share tools section

In `/settings/profile/card`, after the analytics section:

```tsx
<SettingsSection title="Share your card">
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
    <CopyCardLinkButton username={user.username} />
    <CardQrButton username={user.username} />
  </div>
  <EmailSignatureSnippet user={user} />
</SettingsSection>
```

### `QrCodeModal` refactor for reuse

Extend the P28-06 `QrCodeModal` to accept an optional `shareUrl` prop that bypasses the share-link creation logic:

```typescript
interface QrCodeModalProps {
  // Option A: contact-based (P28-06 original)
  contact?: { id: string; fullName: string | null };
  // Option B: direct URL (P30-07 usage)
  shareUrl?: string;
  downloadFilename?: string;
  title?: string;
  onClose: () => void;
}
```

When `shareUrl` is provided, skip the `getOrCreateVCardShareLink` call and use the URL directly.

---

## Acceptance Criteria

- "Copy link" copies the card URL and shows a 2-second "Copied!" confirmation.
- "QR code" opens the QR modal with the card URL encoded; "Download QR" saves `{username}-card-qr.png`; "Copy link" in the modal also copies the card URL.
- The email signature HTML snippet renders a live preview in the settings panel.
- "Copy HTML" copies the raw HTML snippet to the clipboard.
- The HTML snippet is valid and renders correctly in Gmail, Apple Mail, and Outlook (table-based layout for Outlook compatibility).
- All three tools are accessible via keyboard (buttons are focusable and have aria-labels).
- On mobile, the three buttons stack vertically; the QR modal is a full-screen bottom sheet.

---

## Risks and Open Questions

- **Email signature HTML in Outlook:** Outlook's email renderer does not support `<p>` tags inside table cells reliably in some versions. The snippet uses `<table>` + `<td>` layout for maximum compatibility. Test the snippet in Outlook before marking this ticket done.
- **QrCodeModal coupling:** the P28-06 `QrCodeModal` was built specifically for contact-level sharing (it calls `getOrCreateVCardShareLink`). The refactor to support a direct `shareUrl` prop must not break the P28-06 contact usage. Add a test for both paths in the component.
