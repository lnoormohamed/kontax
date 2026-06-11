# P29-03 — Data Export Settings UI

## Purpose

Surface the data export request flow in account settings: a "Request data export" button, a status indicator that polls while the export is being prepared, and a "Download your data" button when the export is ready. This is the primary UI for the GDPR right of access — it must be discoverable, clear, and trustworthy.

## Background

P29-01 generates the ZIP. P29-02 defines the job model and runner. This ticket is the user-facing surface that calls `requestDataExport()` and polls `getDataExportStatus()` until the job is ready, then presents the download link.

## Scope

**In scope:**
- "Your data" section in `/settings/account` (or a dedicated `/settings/privacy` page)
- Request button → PENDING/PROCESSING polling state → READY download state → EXPIRED state
- 5-second poll while PENDING or PROCESSING (cancels on unmount)
- Direct download link (browser downloads the file from the stored URL)
- Error state if the job fails
- "Include archived contacts" checkbox (passed to `requestDataExport`)
- Link to `/help#data-export` for context

**Out of scope:**
- The ZIP generation and job model (P29-01, P29-02)

---

## Design / Implementation Spec

### Component

`src/app/settings/account/_components/data-export-section.tsx`:

```tsx
"use client";

export function DataExportSection() {
  const [job, setJob] = useState<DataExportJob | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Poll while PENDING or PROCESSING
  useEffect(() => {
    if (!job || job.status === "READY" || job.status === "FAILED" || job.status === "EXPIRED") return;

    const interval = setInterval(async () => {
      const updated = await getDataExportStatus();
      setJob(updated);
    }, 5_000);

    return () => clearInterval(interval);
  }, [job?.status]);

  // Load current job status on mount
  useEffect(() => {
    getDataExportStatus().then(setJob);
  }, []);

  const handleRequest = async () => {
    setRequesting(true);
    const { jobId } = await requestDataExport({ includeArchived });
    const updated = await getDataExportStatus();
    setJob(updated);
    setRequesting(false);
  };

  return (
    <SettingsSection title="Your data">
      <p style={{ fontSize: 14, color: "#5c655e", margin: "0 0 16px" }}>
        Export all your Kontax data as a ZIP file.
        Includes contacts (vCard + CSV), activity log, billing summary, and account metadata.{" "}
        <Link href="/help#data-export" style={{ color: "#4158f4" }}>
          What's included? →
        </Link>
      </p>

      {/* Idle — no active job */}
      {(!job || job.status === "EXPIRED") && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8,
            fontSize: 14, color: "#5c655e", marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Include archived contacts
          </label>
          {job?.status === "EXPIRED" && (
            <p style={{ fontSize: 13, color: "#b5472f", marginBottom: 8 }}>
              ⚠ Your previous export has expired. Request a new one.
            </p>
          )}
          <Button variant="primary" onClick={handleRequest} loading={requesting}>
            Request data export
          </Button>
        </>
      )}

      {/* PENDING or PROCESSING */}
      {(job?.status === "PENDING" || job?.status === "PROCESSING") && (
        <div style={{ display: "flex", alignItems: "center", gap: 12,
          background: "#f2f4f0", borderRadius: 10, padding: "14px 16px" }}>
          <Spinner size={16} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1d2823", margin: 0 }}>
              Preparing your export…
            </p>
            <p style={{ fontSize: 12, color: "#8b938c", margin: "2px 0 0" }}>
              This usually takes less than a minute.
            </p>
          </div>
        </div>
      )}

      {/* READY */}
      {job?.status === "READY" && (
        <div style={{ background: "#e3efe7", border: "1px solid #b6d9c0",
          borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1d2823", margin: "0 0 4px" }}>
                ✓ Your export is ready
              </p>
              <p style={{ fontSize: 12, color: "#5c655e", margin: 0 }}>
                Prepared {formatRelativeTime(job.completedAt!)} ·{" "}
                Expires {formatRelativeTime(job.expiresAt!)}
                {job.fileSizeBytes && ` · ${formatFileSize(job.fileSizeBytes)}`}
              </p>
            </div>
            <a
              href={job.downloadUrl!}
              download="kontax-data-export.zip"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#17352e", color: "#ffffff",
                borderRadius: 8, padding: "8px 14px",
                fontSize: 13, fontWeight: 600, textDecoration: "none",
              }}
            >
              <Download size={14} />
              Download
            </a>
          </div>
        </div>
      )}

      {/* FAILED */}
      {job?.status === "FAILED" && (
        <div style={{ background: "#f7e9e4", border: "1px solid #ecd0c7",
          borderRadius: 10, padding: "14px 16px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#8f3320", margin: "0 0 4px" }}>
            Export failed
          </p>
          <p style={{ fontSize: 13, color: "#5c655e", margin: "0 0 12px" }}>
            Something went wrong. Please try again.
          </p>
          <Button variant="primary" onClick={handleRequest}>
            Try again
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}
```

### `requestDataExport` client-callable server action

The server action accepts an `includeArchived` parameter (to be forwarded to `generateDataExport` in P29-01):

```typescript
export async function requestDataExport(params: {
  includeArchived?: boolean;
} = {}): Promise<{ jobId: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  // Deduplication + job creation (P29-02)
  return createOrReturnExistingJob(session.user.id, params.includeArchived);
}
```

---

## Acceptance Criteria

- The "Your data" section renders in `/settings/account` (or `/settings/privacy`).
- "Request data export" button creates a job and transitions the UI to the polling state.
- While PENDING or PROCESSING, the UI polls every 5 seconds and updates automatically.
- When READY, the download button links directly to the ZIP file with a `download` attribute.
- When EXPIRED, the section shows the expiry notice and re-enables the request button.
- When FAILED, the section shows an error message with a retry button.
- "Include archived contacts" checkbox is available and passed to the export function.
- Navigating away and back to the page shows the current job status (loaded on mount).
- File size is shown when the export is READY.

---

## Risks and Open Questions

- **Download URL security:** the download URL points directly to the ZIP file on Vercel Blob or S3. The URL is unguessable (contains the user ID and a timestamp hash) but is not authenticated — anyone with the URL can download it for 48 hours. For higher security, generate a server-side redirect route (`/api/data-export/download?jobId={id}`) that validates the session before redirecting to the blob URL. This is a P2 hardening step.
