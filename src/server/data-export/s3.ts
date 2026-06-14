import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const EXPORT_LINK_TTL_SECONDS = 48 * 60 * 60;

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

export async function uploadExportZip(userId: string, zipBuffer: Buffer): Promise<string> {
  const s3 = getS3();
  if (!s3) throw new Error("MinIO is not configured — set MINIO_ENDPOINT.");

  const key = `exports/${userId}-${Date.now()}.zip`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: zipBuffer,
      ContentType: "application/zip",
    }),
  );

  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: EXPORT_LINK_TTL_SECONDS },
  );
}
