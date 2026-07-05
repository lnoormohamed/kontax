// P45: load a contact's avatar bytes for export. The stored `avatarUrl` is
// infrastructure (MinIO public URL) — the exported datum is the image itself
// (spec §3.6). Fetch via S3 when the URL points at our bucket, HTTP otherwise.

import { createHash } from "crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

export type ExportPhoto = {
  bytes: Buffer;
  sha256: string;
  mediaType: string;
  extension: string;
  width?: number;
  height?: number;
};

const MEDIA_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const EXT_BY_MEDIA_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function getS3(): S3Client | null {
  if (!process.env.MINIO_ENDPOINT) return null;
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT,
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  });
}

const bucket = () => process.env.MINIO_BUCKET ?? "kontax-uploads";

/** Extract the S3 object key from an avatar URL when it points at our storage. */
const avatarKeyFromUrl = (avatarUrl: string): string | null => {
  const match = /\/(avatars\/[^?]+)/.exec(avatarUrl);
  return match?.[1] ?? null;
};

const streamToBuffer = async (body: unknown): Promise<Buffer> => {
  if (body instanceof Buffer) return body;
  if (body && typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  throw new Error("Unsupported S3 body stream");
};

export async function loadContactPhoto(avatarUrl: string): Promise<ExportPhoto | null> {
  try {
    let bytes: Buffer | null = null;
    let mediaType: string | null = null;

    const key = avatarKeyFromUrl(avatarUrl);
    const s3 = getS3();
    if (key && s3) {
      const result = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
      bytes = await streamToBuffer(result.Body);
      mediaType = result.ContentType ?? null;
    } else {
      const response = await fetch(avatarUrl);
      if (!response.ok) return null;
      bytes = Buffer.from(await response.arrayBuffer());
      mediaType = response.headers.get("content-type");
    }

    if (!bytes || bytes.length === 0) return null;

    const extFromUrl = /\.([a-z0-9]+)(?:\?|$)/i.exec(avatarUrl)?.[1]?.toLowerCase() ?? null;
    if (!mediaType || mediaType === "application/octet-stream") {
      mediaType = (extFromUrl && MEDIA_TYPE_BY_EXT[extFromUrl]) ?? "image/jpeg";
    }
    const extension = EXT_BY_MEDIA_TYPE[mediaType] ?? extFromUrl ?? "jpg";

    const sha256 = createHash("sha256").update(bytes).digest("hex");

    let width: number | undefined;
    let height: number | undefined;
    try {
      const meta = await sharp(bytes).metadata();
      width = meta.width ?? undefined;
      height = meta.height ?? undefined;
    } catch {
      // Dimensions are optional (spec §3.6) — a corrupt-but-typed image still exports.
    }

    return { bytes, sha256, mediaType, extension, width, height };
  } catch (error) {
    console.warn("[Kontax] export photo load failed — exporting without photo", error);
    return null;
  }
}
