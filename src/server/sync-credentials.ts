import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { env } from "~/env";

const ENVELOPE_PREFIX = "kontax-sync-v1";
const AAD_CONTEXT = "kontax-sync-credentials";

export type SyncCredentialPayload = {
  username: string;
  password: string;
  note?: string;
  provider: "CARDDAV";
  version: 1;
};

type SyncCredentialEncryptionStatus = {
  available: boolean;
  keyRef: string | null;
  mode: "dedicated" | "auth-secret-fallback" | "missing";
};

const getEncryptionSecret = () => {
  if (env.SYNC_CREDENTIAL_ENCRYPTION_KEY) {
    return {
      secret: env.SYNC_CREDENTIAL_ENCRYPTION_KEY,
      keyRef:
        env.SYNC_CREDENTIAL_ENCRYPTION_KEY_ID ?? "env:SYNC_CREDENTIAL_ENCRYPTION_KEY",
      mode: "dedicated" as const,
    };
  }

  if (env.AUTH_SECRET) {
    return {
      secret: env.AUTH_SECRET,
      keyRef: "env:AUTH_SECRET:fallback",
      mode: "auth-secret-fallback" as const,
    };
  }

  return {
    secret: null,
    keyRef: null,
    mode: "missing" as const,
  };
};

const getDerivedKey = () => {
  const config = getEncryptionSecret();

  if (!config.secret || !config.keyRef) {
    throw new Error(
      "Credential encryption is not configured. Set SYNC_CREDENTIAL_ENCRYPTION_KEY or AUTH_SECRET.",
    );
  }

  return {
    key: createHash("sha256").update(config.secret).digest(),
    keyRef: config.keyRef,
    mode: config.mode,
  };
};

const encodeEnvelope = (payload: Record<string, string>) =>
  `${ENVELOPE_PREFIX}:${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;

const decodeEnvelope = (reference: string) => {
  const [prefix, encoded] = reference.split(":", 2);

  if (prefix !== ENVELOPE_PREFIX || !encoded) {
    throw new Error("Credential reference is not a valid Kontax sync envelope.");
  }

  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<
    string,
    string
  >;

  return parsed;
};

export const getSyncCredentialEncryptionStatus = (): SyncCredentialEncryptionStatus => {
  const config = getEncryptionSecret();

  return {
    available: Boolean(config.secret && config.keyRef),
    keyRef: config.keyRef,
    mode: config.mode,
  };
};

export const encryptSyncCredentialPayload = (payload: SyncCredentialPayload) => {
  const { key, keyRef } = getDerivedKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(AAD_CONTEXT, "utf8"));

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    credentialReference: encodeEnvelope({
      iv: iv.toString("base64url"),
      tag: tag.toString("base64url"),
      payload: encrypted.toString("base64url"),
    }),
    encryptionKeyRef: keyRef,
  };
};

export const decryptSyncCredentialPayload = (credentialReference: string): SyncCredentialPayload => {
  const { key } = getDerivedKey();
  const envelope = decodeEnvelope(credentialReference);

  if (!envelope.iv || !envelope.tag || !envelope.payload) {
    throw new Error("Credential envelope is missing required encrypted fields.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(AAD_CONTEXT, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.payload, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(decrypted) as SyncCredentialPayload;
};
