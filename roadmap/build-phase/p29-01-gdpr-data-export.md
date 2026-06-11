# P29-01 — GDPR Data Export

## Purpose

Allow users to request a full export of all data Kontax holds about them: contacts (vCard + CSV), activity log (JSON), billing history summary, and account metadata — delivered as a single downloadable ZIP file. This satisfies the GDPR right of data portability (Article 20) and gives users confidence that their data is never locked in.

## Background

GDPR Article 20 requires that data controllers allow subjects to receive their personal data in a structured, commonly used, machine-readable format. Kontax's relevant data is: contacts (the primary corpus), the activity log (all mutations), billing records (subscription history), and account metadata (email, name, registration date). The export must be complete — nothing omitted — and must not require a support request.

The export is also offered as a pre-deletion suggestion in P18-09 (account deletion). The same generation logic is reused there.

## Scope

**In scope:**
- `DataExportJob` Prisma model (P29-02 defines this)
- `generateDataExport(userId)` function — assembles the ZIP contents
- ZIP structure: `contacts.vcf`, `contacts.csv`, `activity.json`, `billing-summary.txt`, `account.json`
- `contacts.vcf`: all non-archived contacts in vCard 4.0 format (reuses the existing vCard export logic from P3-03)
- `contacts.csv`: all non-archived contacts in CSV format (reuses P3-03)
- `activity.json`: all `ActivityEvent` rows for the user, ordered by `createdAt` desc
- `billing-summary.txt`: human-readable billing history (subscription plan, status, period history)
- `account.json`: `{ email, name, createdAt, emailVerified, plan, lifecycleState }`
- ZIP stored on self-hosted MinIO (S3-compatible) with a 48-hour pre-signed URL
- Email notification when ready (P20-02 `sendEmail`)

**Out of scope:**
- The settings UI (P29-03)
- Including archived contacts (opt-in via a checkbox in the UI, not implemented here)
- Exporting sync account credentials

---

## Design / Implementation Spec

### ZIP assembly

Install:
```bash
npm install archiver
npm install --save-dev @types/archiver
```

`src/server/data-export/generate-export.ts`:

```typescript
import archiver from "archiver";
import { PassThrough } from "stream";

export async function generateDataExport(userId: string): Promise<Buffer> {
  const [contacts, activityEvents, subscription, user] = await Promise.all([
    db.contact.findMany({
      where: { userId, archivedAt: null },
      orderBy: { fullName: "asc" },
    }),
    db.activityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10_000, // cap to avoid massive exports; document this
    }),
    db.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "CANCELED", "GRACE"] } },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true, createdAt: true, emailVerified: true, lifecycleState: true },
    }),
  ]);

  return new Promise((resolve, reject) => {
    const passThrough = new PassThrough();
    const chunks: Buffer[] = [];
    passThrough.on("data", (chunk) => chunks.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(passThrough);

    // contacts.vcf
    const vcfContent = exportContactsAsVCard(contacts); // reuses P3-03 exporter
    archive.append(vcfContent, { name: "contacts.vcf" });

    // contacts.csv
    const csvContent = exportContactsAsCsv(contacts); // reuses P3-03 exporter
    archive.append(csvContent, { name: "contacts.csv" });

    // activity.json
    const activityJson = JSON.stringify(
      activityEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        actor: e.actor,
        createdAt: e.createdAt.toISOString(),
        payload: e.payload,
      })),
      null,
      2,
    );
    archive.append(activityJson, { name: "activity.json" });

    // billing-summary.txt
    const billingText = generateBillingSummary(subscription, user);
    archive.append(billingText, { name: "billing-summary.txt" });

    // account.json
    const accountJson = JSON.stringify({
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      emailVerified: user.emailVerified?.toISOString() ?? null,
      plan: subscription?.plan ?? "FREE",
      lifecycleState: user.lifecycleState,
      exportedAt: new Date().toISOString(),
    }, null, 2);
    archive.append(accountJson, { name: "account.json" });

    archive.finalize();
  });
}

function generateBillingSummary(
  sub: Subscription | null,
  user: Pick<User, "email" | "name" | "createdAt">,
): string {
  const lines = [
    "Kontax Billing Summary",
    "======================",
    `Account: ${user.email}`,
    `Member since: ${user.createdAt.toLocaleDateString()}`,
    "",
    sub
      ? [
          `Current plan: ${sub.plan}`,
          `Status: ${sub.status}`,
          sub.currentPeriodEnd ? `Current period ends: ${sub.currentPeriodEnd.toLocaleDateString()}` : "",
          sub.cancelAtPeriodEnd ? "Cancels at period end: Yes" : "",
        ].filter(Boolean).join("\n")
      : "Plan: Free (no active subscription)",
    "",
    "For full invoice history, visit your billing portal.",
  ];
  return lines.join("\n");
}
```

### Upload to MinIO

After generating the ZIP buffer, store it in MinIO and return a 48-hour pre-signed download URL:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,      // e.g. https://minio.yourdomain.com
  region: "us-east-1",                       // MinIO ignores region but SDK requires it
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,                      // required for MinIO
});

export async function uploadExportZip(
  userId: string,
  zipBuffer: Buffer,
): Promise<string> {
  const key = `exports/${userId}-${Date.now()}.zip`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.MINIO_BUCKET!,
    Key: key,
    Body: zipBuffer,
    ContentType: "application/zip",
  }));

  // Pre-signed URL valid for 48 hours
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: process.env.MINIO_BUCKET!,
    Key: key,
  }), { expiresIn: 48 * 60 * 60 });
}
```

The pre-signed URL is stored on `DataExportJob.downloadUrl`. It is only accessible to someone who has the URL — the key includes a timestamp and user ID making it unguessable.

### Email notification

After the ZIP is generated and uploaded:

```typescript
await sendEmail({
  to: user.email,
  subject: "Your Kontax data export is ready",
  html: renderSimpleEmail({
    heading: "Your data export is ready",
    body: "Your Kontax data export has been prepared. Download it within 48 hours.",
    ctaLabel: "Download your data →",
    ctaHref: `${APP_URL}/settings/account?section=data-export`,
  }),
  text: `Your Kontax data export is ready. Download within 48 hours at: ${APP_URL}/settings/account?section=data-export`,
});
```

---

## Acceptance Criteria

- `generateDataExport(userId)` returns a valid ZIP buffer containing all 5 files.
- `contacts.vcf` contains all non-archived contacts in valid vCard 4.0 format.
- `contacts.csv` contains all non-archived contacts with correct column headers.
- `activity.json` contains up to 10,000 most recent activity events as a JSON array.
- `billing-summary.txt` is a human-readable plain text file with account and plan details.
- `account.json` contains the user's email, name, registration date, plan, and export timestamp.
- The ZIP is uploaded and a signed download URL is returned.
- A notification email is sent when the export is ready.
- The function is idempotent — calling it twice creates two separate exports, not errors.

---

## Risks and Open Questions

- **Large contact libraries:** for users with 10,000+ contacts, ZIP generation may take 30–60 seconds. Run export generation as a background job (P29-02 handles this). Never run it in-process on an HTTP request.
- **Activity log cap at 10,000 events:** the export caps activity events to prevent multi-GB exports. For Teams users (unlimited retention), this may exclude old events. Consider a paginated export for large logs in a future iteration, or increase the cap to 100,000 for Teams.
- **MinIO bucket policy:** the exports bucket should have private access (no public read). Access is via pre-signed URLs only. Ensure the MinIO LXC is reachable from the app server. If MinIO is unavailable, export jobs will fail at the upload step — surface this as a `FAILED` status on the job so the user can retry.
