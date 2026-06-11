import { createId } from "@paralleldrive/cuid2";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/server/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function getS3(): S3Client | null {
  if (!process.env.MINIO_ENDPOINT) return null;
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT,
    region: "us-east-1", // MinIO ignores region but SDK requires it
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const s3 = getS3();
  if (!s3) {
    console.warn("[Kontax] MINIO_ENDPOINT not configured — avatar upload unavailable");
    return NextResponse.json({ error: "UPLOAD_NOT_CONFIGURED" }, { status: 503 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("avatar");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const ext = EXT_MAP[file.type] ?? "jpg";
  const key = `avatars/${session.user.id}/${createId()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.MINIO_BUCKET ?? "kontax-uploads",
    Key: key,
    Body: Buffer.from(bytes),
    ContentType: file.type,
  }));

  const publicUrl = `${process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT}/${key}`;
  return NextResponse.json({ url: publicUrl });
}
