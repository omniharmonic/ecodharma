"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser, destroySession } from "@/lib/auth";
import { deleteAccount, revokeAllConsents } from "@/lib/account";

export async function revokeAllConsentsAction(_prev: unknown, _formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const n = await revokeAllConsents(user.id);
  revalidatePath("/settings");
  return { ok: `Revoked ${n} active consent${n === 1 ? "" : "s"}. Your profile is no longer woven into others' constellations.` };
}

export async function deleteAccountAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (String(formData.get("confirm")).trim().toUpperCase() !== "DELETE") {
    return { error: 'Type DELETE to confirm.' };
  }
  await deleteAccount(user.id);
  destroySession();
  redirect("/?deleted=1");
}
