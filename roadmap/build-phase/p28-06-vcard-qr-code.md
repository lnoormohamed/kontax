# P28-06 — vCard QR Code

## Purpose

Generate a QR code for any contact's vCard so the user can share a contact by showing their screen — the recipient scans the QR code with their phone camera and the contact is added to their address book. This is the fastest possible contact sharing: no accounts, no links, no forms.

## Background

Phase 12 (P12-02) created vCard share links (`/share/{token}`) — a URL that serves the contact's vCard file. A QR code is a visual encoding of that URL. The recipient's phone scans the code, the browser opens the share page, and the phone offers to save the contact. No Kontax account is needed to receive a QR-shared contact.

## Scope

**In scope:**
- "Share → QR code" button in the contact detail page (the `…` menu and/or a dedicated share button)
- QR code generation client-side using `qrcode` npm package (no server round-trip for the image)
- QR code modal per P28-DB09 design: 200×200px code, contact name, "Download QR", "Copy link" actions
- Reuses the existing vCard share link: if the contact already has a non-expired share link, use it; otherwise create one via `createVCardShareLink` (P12-02)
- Download: generates `{contact-name}-qr.png` using Canvas

**Out of scope:**
- Animated or branded QR codes (standard black-and-white QR only)
- QR code for bulk contacts or address book

---

## Design / Implementation Spec

### Install QR code library

```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

### QR code modal component

`src/app/contacts/_components/qr-code-modal.tsx`:

```tsx
"use client";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

interface QrCodeModalProps {
  contact: { id: string; fullName: string | null };
  onClose: () => void;
}

export function QrCodeModal({ contact, onClose }: QrCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Get or create the share link
    getOrCreateVCardShareLink(contact.id).then((url) => {
      setShareUrl(url);
      setLoading(false);
    });
  }, [contact.id]);

  useEffect(() => {
    if (!shareUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, shareUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#1d2823", light: "#ffffff" },
    });
  }, [shareUrl]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${(contact.fullName ?? "contact").toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title={`Share ${contact.fullName ?? "contact"}`} onClose={onClose} maxWidth={340}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0 24px" }}>
        {loading ? (
          <div style={{ width: 200, height: 200, display: "flex", alignItems: "center",
            justifyContent: "center", background: "#f2f4f0", borderRadius: 12 }}>
            <Spinner size={24} />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ borderRadius: 12, border: "1px solid #d8ddd6" }}
          />
        )}

        <p style={{ fontSize: 13, color: "#5c655e", marginTop: 16, textAlign: "center" }}>
          Scan to add {contact.fullName ?? "this contact"} to any phone.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <Button variant="secondary" onClick={handleDownload} disabled={loading}>
            <Download size={14} />
            Download QR
          </Button>
          <Button variant="secondary" onClick={handleCopyLink} disabled={loading}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

### `getOrCreateVCardShareLink` server action

```typescript
export async function getOrCreateVCardShareLink(contactId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://kontax.app";

  // Check for an existing non-expired share link
  const existing = await db.contactShare.findFirst({
    where: {
      contactId,
      shareType: "VCARD_LINK",
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: { token: true },
  });

  if (existing) {
    return `${APP_URL}/share/${existing.token}`;
  }

  // Create a new one via P12-02's logic
  const share = await createVCardShare(contactId, session.user.id);
  return `${APP_URL}/share/${share.token}`;
}
```

### Placement in contact detail

In the contact detail `…` menu (P17-02) and in the Sharing tab action area:

```tsx
<button onClick={() => setShowQrModal(true)}>
  <QrCode size={14} />
  Show QR code
</button>

{showQrModal && (
  <QrCodeModal contact={contact} onClose={() => setShowQrModal(false)} />
)}
```

---

## Acceptance Criteria

- "Show QR code" appears in the contact detail page's share or action menu.
- Clicking it opens the QR code modal with the contact's name and a 200×200px QR code.
- The QR code encodes the vCard share URL (`/share/{token}`).
- Scanning the QR code on an iPhone or Android device opens the share page and offers to save the contact.
- "Download QR" downloads a PNG file named `{contact-name}-qr.png`.
- "Copy link" copies the share URL to the clipboard and shows a "Copied!" confirmation for 2 seconds.
- If the contact already has a non-expired share link, it is reused (no duplicate links created).
- The QR code modal renders correctly on mobile (full-screen sheet per P28-DB09 mobile spec).

---

## Risks and Open Questions

- **Free plan share link expiry in QR context:** Free users' vCard share links expire after 7 days (P11-01). A QR code with an expired link shows an error page. Consider: (1) regenerating the link when the QR modal is opened (current approach), or (2) warning the user in the modal that the link expires in N days. Implement option (2) — show an expiry note below the QR code for Free users: "This link expires in 7 days. Upgrade to Pro for permanent links."
