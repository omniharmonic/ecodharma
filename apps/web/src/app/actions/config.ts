"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { setInterpreterMode, setAccessPassword, type InterpreterMode } from "@/lib/config";

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
