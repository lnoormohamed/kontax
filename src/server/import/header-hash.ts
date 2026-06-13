import { createHash } from "crypto";

export function computeHeaderHash(headers: string[]): string {
  const normalised = headers
    .map((h) => h.trim().toLowerCase())
    .sort()
    .join(",");
  return createHash("sha256").update(normalised).digest("hex");
}
