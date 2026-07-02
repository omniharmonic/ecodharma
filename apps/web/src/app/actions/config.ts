"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser, findUserByEmail } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { setInterpreterMode, setAccessPassword, type InterpreterMode } from "@/lib/config";
import { setCompedPremium } from "@/lib/billing";
import { z } from "zod";

async function requireAdmin() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(user.email))) return null;
  return user;
}

/** Admin: flip the global reading engine between Claude and the hardcoded fixture. */
export async function setModeAction(_prev: unknown, formData: FormData) {
  if (!(await requireAdmin())) return { error: "Only stewards can change the reading engine." };
  const mode = String(formData.get("mode") || "") as InterpreterMode;
  if (mode !== "claude" && mode !== "fixture") return { error: "Pick a valid mode." };
  await setInterpreterMode(mode);
  revalidatePath("/curate");
  return { ok: mode === "claude" ? "Reading engine set to Claude-powered." : "Reading engine set to the hardcoded fallback." };
}

/** Admin: set or clear the shared access password (blank clears it → open signup). */
export async function setPasswordAction(_prev: unknown, formData: FormData) {
  if (!(await requireAdmin())) return { error: "Only stewards can set the access password." };
  const pw = String(formData.get("access_password") || "").trim();
  await setAccessPassword(pw || null);
  revalidatePath("/curate");
  return { ok: pw ? "Access password updated." : "Access password cleared — signup is open." };
}

/** Admin: comp (or revoke) premium for a member by email — no Stripe needed.
 *  Doubles as the way to gift premium to friends and to enable premium in tests. */
export async function compPremiumAction(_prev: unknown, formData: FormData) {
  if (!(await requireAdmin())) return { error: "Only stewards can grant premium." };
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email." };
  const grant = String(formData.get("action") || "grant") !== "revoke";
  const target = await findUserByEmail(email.data);
  if (!target) return { error: "No member with that email yet." };
  await setCompedPremium(target.id, grant);
  revalidatePath("/curate");
  return { ok: grant ? `Premium granted to ${email.data}.` : `Premium revoked from ${email.data}.` };
}
