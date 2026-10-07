// Run: npx tsx src/lib/crypto.test.mts   (from apps/web)
import assert from "node:assert";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt, keyIdOf, resetKeyring, JournalKeyError } from "./crypto.ts";

(process.env as any).NODE_ENV = "test";
const k1 = randomBytes(32).toString("base64");
const k2 = randomBytes(32).toString("base64");

// Round trip, unicode, empty.
process.env.JOURNAL_KEYS = `1:${k1}`;
resetKeyring();
for (const s of ["", "a", "My prayer: may the commons heal 🌱 — ¿sí?", "x".repeat(20000)]) {
  if (!s) { assert.equal(decrypt(null), ""); continue; }
  const e = encrypt(s);
  assert.equal(decrypt(e), s);
  if (s.length >= 8) assert.ok(!e.includes(Buffer.from(s.slice(0, 8))), "ciphertext must not contain plaintext");
}
// Random IV: same plaintext → different envelopes.
assert.notDeepEqual(encrypt("same"), encrypt("same"));

// Tamper detection (GCM auth tag).
{
  const e = encrypt("do not touch");
  e[e.length - 1] ^= 0xff;
  assert.throws(() => decrypt(e));
}

// Rotation: old envelopes still open after adding key 2; new ones use key 2.
const old = encrypt("sealed under key 1");
process.env.JOURNAL_KEYS = `1:${k1},2:${k2}`;
resetKeyring();
assert.equal(decrypt(old), "sealed under key 1");
const fresh = encrypt("sealed under key 2");
assert.equal(keyIdOf(fresh), 2);
// Dropping key 1 makes old envelopes unreadable (so rotation must re-encrypt first).
process.env.JOURNAL_KEYS = `2:${k2}`;
resetKeyring();
assert.throws(() => decrypt(old), JournalKeyError);
assert.equal(decrypt(fresh), "sealed under key 2");

// Bad key spec is rejected loudly.
process.env.JOURNAL_KEYS = "1:short";
resetKeyring();
assert.throws(() => encrypt("x"), JournalKeyError);

// Production without keys refuses.
delete process.env.JOURNAL_KEYS;
(process.env as any).NODE_ENV = "production";
resetKeyring();
assert.throws(() => encrypt("x"), JournalKeyError);
(process.env as any).NODE_ENV = "test";
resetKeyring();
assert.equal(decrypt(encrypt("derived dev key works")), "derived dev key works");

console.log("crypto tests passed");
