import "server-only";
import { cookies } from "next/headers";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { withService } from "./db";

const COOKIE = "eco_session";
const secret = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET || "dev-insecure-secret-change-me");

// ---- password hashing (scrypt; format: salt:hash, both hex) ----
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// ---- session cookie (JWT) ----
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function destroySession(): void {
  cookies().delete(COOKIE);
}

export type SessionUser = { id: string; email: string };

/** Returns the logged-in user, or null. Reads + verifies the signed cookie. */
export async function getUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = payload.sub;
    if (!id) return null;
    const { rows } = await withService((c) =>
      c.query("select id, email from auth.users where id = $1", [id]),
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// ---- credential storage (auth.users, mirrors Supabase shape) ----
export async function findUserByEmail(email: string) {
  const { rows } = await withService((c) =>
    c.query("select id, email, encrypted_password from auth.users where email = $1", [
      email.toLowerCase(),
    ]),
  );
  return rows[0] ?? null;
}

export async function createUser(email: string, password: string): Promise<SessionUser> {
  const enc = hashPassword(password);
  const { rows } = await withService((c) =>
    c.query(
      `insert into auth.users (email, encrypted_password, email_confirmed_at)
       values ($1, $2, now()) returning id, email`,
      [email.toLowerCase(), enc],
    ),
  );
  return rows[0];
}
