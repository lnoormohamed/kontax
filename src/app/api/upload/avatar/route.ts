import { createId } from "@paralleldrive/cuid2";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { auth } from "~/server/auth";
import { getAvatarThumbUrl } from "~/lib/avatar-thumb";

// P38-08: list rows render 32–40px avatars; ship a small square variant so
// they never download the full upload. 96px covers 2× DPR at 48px.
const THUMB_SIZE = 96;

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
  const bucket = process.env.MINIO_BUCKET ?? "kontax-uploads";

  // P38-08: 96×96 webp sibling at `<key minus ext>-thumb.webp` (derivation
  // convention in src/lib/avatar-thumb.ts). Thumbnailing failure (corrupt but
  // correctly-typed file) must not block the upload — renderers fall back to
  // the original when the thumb 404s.
  let thumbBody: Buffer | null = null;
  try {
    thumbBody = await sharp(Buffer.from(bytes))
      .rotate() // respect EXIF orientation
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    console.warn("[Kontax] avatar thumbnail generation failed — serving original only", error);
  }

  await Promise.all([
    s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type,
    })),
    thumbBody
      ? s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key.replace(/\.[a-z0-9]+$/i, "-thumb.webp"),
          Body: thumbBody,
          ContentType: "image/webp",
        }))
      : Promise.resolve(),
  ]);

  const publicUrl = `${process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT}/${key}`;
  return NextResponse.json({ url: publicUrl, thumbUrl: getAvatarThumbUrl(publicUrl) });
}
