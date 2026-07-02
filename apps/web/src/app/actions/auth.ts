"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  verifyPassword,
} from "@/lib/auth";
import { getConfig, checkAccessPassword } from "@/lib/config";

const creds = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** A post-auth redirect target is only honoured if it's a same-origin path
 *  (starts with a single "/") — never an absolute URL, to avoid open redirects. */
function safeNext(formData: FormData): string | null {
  const raw = String(formData.get("next") || "");
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return null;
}

/** Signup is gated whenever a shared access password is set — the credit gate
 *  (readings require an account). The admin sets it in Claude mode to keep signups
 *  invite-only, and clears it to open the door (e.g. in the free fixture mode). */
export async function signupGated(): Promise<boolean> {
  return (await getConfig()).hasPassword;
}

export async function signupAction(_prev: unknown, formData: FormData) {
  const parsed = creds.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (await signupGated()) {
    const ok = await checkAccessPassword(String(formData.get("access_password") || ""));
    if (!ok) return { error: "That access password isn't right. Ask your steward for the current one." };
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) return { error: "An account with that email already exists." };

  const user = await createUser(parsed.data.email, parsed.data.password);
  await createSession(user.id);
  redirect(safeNext(formData) || "/onboarding");
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const parsed = creds.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await findUserByEmail(parsed.data.email);
  if (!user || !verifyPassword(parsed.data.password, user.encrypted_password)) {
    return { error: "Invalid email or password." };
  }
  await createSession(user.id);
  redirect(safeNext(formData) || "/profile");
}

export async function logoutAction() {
  destroySession();
  redirect("/");
}
