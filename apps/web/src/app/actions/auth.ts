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

const creds = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signupAction(_prev: unknown, formData: FormData) {
  const parsed = creds.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) return { error: "An account with that email already exists." };

  const user = await createUser(parsed.data.email, parsed.data.password);
  await createSession(user.id);
  redirect("/onboarding");
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
  redirect("/profile");
}

export async function logoutAction() {
  destroySession();
  redirect("/");
}
