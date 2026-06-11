# P29-02 — Data Export Job Model

## Purpose

Define the `DataExportJob` Prisma model that tracks async export generation: status (`PENDING`, `PROCESSING`, `READY`, `EXPIRED`, `FAILED`), the download URL, and expiry metadata. Run the export generation as a background job — not inline on the HTTP request — so users with large contact libraries are not blocked waiting for a multi-second ZIP assembly.

## Background

P29-01 defines the export generation logic. This ticket defines the data model and the job execution infrastructure: the server action that queues the job, the background runner that generates the ZIP and updates the job status, and the expiry job that marks ready exports as expired after 48 hours.

## Scope

**In scope:**
- `DataExportJob` Prisma model with status enum, download URL, requested/completed/expires timestamps
- `requestDataExport()` server action — creates a `PENDING` job and queues the generation
- Background job runner (CRON or queue-based): picks up `PENDING` jobs, calls `generateDataExport`, uploads the ZIP, sets status to `READY`
- Expiry CRON: marks `READY` jobs as `EXPIRED` after 48 hours
- Deduplication: only one active (PENDING or READY) export per user at a time

**Out of scope:**
- Settings UI (P29-03)
- The `generateDataExport` function itself (P29-01)

---

## Design / Implementation Spec

### Schema

```prisma
enum DataExportStatus {
    PENDING     // queued, not yet started
    PROCESSING  // generation in progress
    READY       // ZIP ready for download
    EXPIRED     // download link has expired (48 hours)
    FAILED      // generation failed
}

model DataExportJob {
    id          String           @id @default(cuid())
    userId      String
    status      DataExportStatus @default(PENDING)
    downloadUrl String?          // null until READY
    fileSizeBytes Int?           // set when READY
    requestedAt DateTime         @default(now())
    startedAt   DateTime?
    completedAt DateTime?
    expiresAt   DateTime?        // set to requestedAt + 48h when READY
    errorMessage String?

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, status])
    @@index([status, expiresAt]) // for the expiry CRON
}
```

Run: `prisma migrate dev --name add-data-export-job`

### `requestDataExport` server action

```typescript
export async function requestDataExport(): Promise<{ jobId: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  const userId = session.user.id;

  // Deduplication: only one active export per user
  const existing = await db.dataExportJob.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "PROCESSING", "READY"] },
    },
  });

  if (existing) {
    return { jobId: existing.id };
  }

  const job = await db.dataExportJob.create({
    data: { userId },
  });

  // Queue the generation job (see below)
  await queueExportGeneration(job.id);

  return { jobId: job.id };
}
```

### Background job runner

`src/app/api/cron/data-export/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Pick up the oldest PENDING job (process one at a time to avoid resource contention)
  const job = await db.dataExportJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { requestedAt: "asc" },
    include: { user: { select: { email: true } } },
  });

  if (!job) return NextResponse.json({ message: "No pending jobs" });

  // Mark as PROCESSING
  await db.dataExportJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  try {
    const zipBuffer = await generateDataExport(job.userId);
    const downloadUrl = await uploadExportZip(job.userId, zipBuffer);

    await db.dataExportJob.update({
      where: { id: job.id },
      data: {
        status: "READY",
        downloadUrl,
        fileSizeBytes: zipBuffer.length,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    // Notify the user
    await sendDataExportReadyEmail(job.userId, job.user.email);
  } catch (err) {
    await db.dataExportJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: String(err) },
    });
  }

  return NextResponse.json({ processed: job.id });
}
```

Register in `vercel.json` (run every minute to pick up pending jobs promptly):
```json
{ "path": "/api/cron/data-export", "schedule": "* * * * *" }
```

### Expiry CRON

`src/app/api/cron/expire-exports/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  // ...CRON_SECRET check...

  const expired = await db.dataExportJob.updateMany({
    where: {
      status: "READY",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  return NextResponse.json({ expired: expired.count });
}
```

Register: `{ "path": "/api/cron/expire-exports", "schedule": "0 * * * *" }` (hourly).

### `getDataExportStatus` for the UI

```typescript
export async function getDataExportStatus(userId: string): Promise<DataExportJob | null> {
  return db.dataExportJob.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "PROCESSING", "READY"] },
    },
    orderBy: { requestedAt: "desc" },
  });
}
```

The settings page (P29-03) polls this every 5 seconds while status is `PENDING` or `PROCESSING`.

---

## Acceptance Criteria

- `DataExportJob` model exists; migration applied.
- `requestDataExport()` creates a `PENDING` job; returns the same job ID if one is already active.
- The CRON runner picks up the oldest `PENDING` job, marks it `PROCESSING`, generates the ZIP (P29-01), uploads it, then sets status to `READY` with a download URL and `expiresAt = requestedAt + 48h`.
- If generation fails, the job is set to `FAILED` with an `errorMessage`.
- The expiry CRON marks `READY` jobs with `expiresAt < now()` as `EXPIRED`.
- `getDataExportStatus` returns the most recent active job for the user.

---

## Risks and Open Questions

- **CRON frequency vs Vercel limits:** Vercel's free plan limits cron jobs to once per day; Pro allows up to once per minute. Confirm the project's Vercel plan before setting `"* * * * *"` frequency. An alternative: trigger the export generation synchronously via a background `fetch` call inside `requestDataExport` using a Next.js Route Handler with `waitUntil` (Vercel Edge Runtime) to avoid CRON dependency entirely.
- **Concurrent CRON runs:** if two CRON invocations pick up the same job simultaneously, both will try to generate the export. Mitigate with a database-level advisory lock or by atomically transitioning from `PENDING` to `PROCESSING` using a conditional update: `UPDATE ... WHERE status = 'PENDING' AND id = ? RETURNING id` — only one runner proceeds.
