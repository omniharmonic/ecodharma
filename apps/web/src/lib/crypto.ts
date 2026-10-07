// Encryption at rest for the journal and every intimate free-text field.
//
// AES-256-GCM, random 12-byte IV, 16-byte auth tag. Envelope (bytea):
//   [version:1][keyId:1][iv:12][tag:16][ciphertext…]
// Keys come from JOURNAL_KEYS="1:<base64 32B>,2:<base64 32B>": the HIGHEST id
// encrypts; any listed id decrypts — so rotation is "add key 2, re-encrypt, drop 1".
// Dev/test fall back to a key derived from SESSION_SECRET (with a warning);
// production refuses to run the journal without JOURNAL_KEYS.
// Pure node:crypto (no server-only) so it unit-tests directly.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = 1;

type Keyring = { current: number; keys: Map<number, Buffer> };
let ring: Keyring | null = null;

export class JournalKeyError extends Error {}

function loadKeyring(): Keyring {
  if (ring) return ring;
  const keys = new Map<number, Buffer>();
  const spec = process.env.JOURNAL_KEYS?.trim();
  if (spec) {
    for (const part of spec.split(",")) {
      const [idStr, b64] = part.split(":");
      const id = Number(idStr);
      const key = Buffer.from((b64 || "").trim(), "base64");
      if (!Number.isInteger(id) || id < 1 || id > 255 || key.length !== 32) {
        throw new JournalKeyError(`JOURNAL_KEYS entry "${idStr}:…" is invalid (need id 1–255 and a base64 32-byte key)`);
      }
      keys.set(id, key);
    }
  } else {
    if (process.env.NODE_ENV === "production" && process.env.ECODHARMA_ALLOW_DERIVED_JOURNAL_KEY !== "1") {
      throw new JournalKeyError("JOURNAL_KEYS is not set — refusing to store journal entries unencrypted or with a derived key in production.");
    }
    const secret = process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
    keys.set(1, createHash("sha256").update(`ecodharma-journal:${secret}`).digest());
    if (process.env.NODE_ENV !== "test") console.warn("[crypto] JOURNAL_KEYS unset — using a key derived from SESSION_SECRET (dev only).");
  }
  ring = { current: Math.max(...keys.keys()), keys };
  return ring;
}

/** For tests: forget the cached keyring so env changes take effect. */
export function resetKeyring(): void {
  ring = null;
}

export function encrypt(plain: string): Buffer {
  const { current, keys } = loadKeyring();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys.get(current)!, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION, current]), iv, cipher.getAuthTag(), ct]);
}

export function decrypt(envelope: Buffer | Uint8Array | null | undefined): string {
  if (!envelope || envelope.length === 0) return "";
  const buf = Buffer.from(envelope);
  if (buf.length < 30 || buf[0] !== VERSION) throw new JournalKeyError("not an EcoDharma journal envelope");
  const key = loadKeyring().keys.get(buf[1]);
  if (!key) throw new JournalKeyError(`journal key ${buf[1]} is not loaded`);
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(2, 14));
  decipher.setAuthTag(buf.subarray(14, 30));
  return Buffer.concat([decipher.update(buf.subarray(30)), decipher.final()]).toString("utf8");
}

/** Null-tolerant helpers for optional fields. */
export const encOpt = (s?: string | null): Buffer | null => (s && s.length ? encrypt(s) : null);
export const decOpt = (b?: Buffer | Uint8Array | null): string => {
  try {
    return decrypt(b);
  } catch (e) {
    console.error("[crypto] decrypt failed:", (e as Error).message);
    return "";
  }
};

/** Which key id sealed this envelope (for the rotation job). */
export const keyIdOf = (b: Buffer | Uint8Array): number => Buffer.from(b)[1];
