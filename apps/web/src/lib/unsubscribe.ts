import "server-only";
import { SignJWT, jwtVerify } from "jose";

// Signed, no-login unsubscribe tokens (for the List-Unsubscribe header + footer
// link on nudge emails). No expiry — an unsubscribe link should always work.
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "dev-insecure-secret-change-me");

export async function unsubscribeToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, purpose: "unsub" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().sign(secret());
}

export async function verifyUnsubscribeToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.purpose === "unsub" && payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}
