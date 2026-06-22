"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { recordResonance, promoteTrimTab, deleteTrimTab } from "@/lib/trimtabs";
import { isAdmin } from "@/lib/admin";

export async function resonateTrimTabAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) return { error: "Sign in to respond." };
  const id = Number(formData.get("trim_tab_id"));
  const dir = String(formData.get("dir")) === "up" ? "up" : "down";
  if (!id) return { error: "Missing trim-tab." };
  await recordResonance(id, dir);
  return { ok: dir === "up" ? "🙏 Resonance noted." : "Noted — thank you." };
}

export async function promoteTrimTabAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user || !(await isAdmin(user.email))) return { error: "Not authorized." };
  await promoteTrimTab(Number(formData.get("trim_tab_id")));
  revalidatePath("/curate");
  return { ok: "Promoted to the canon." };
}

export async function deleteCandidateAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user || !(await isAdmin(user.email))) return { error: "Not authorized." };
  await deleteTrimTab(Number(formData.get("trim_tab_id")));
  revalidatePath("/curate");
  return { ok: "Removed." };
}
