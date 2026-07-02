"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { isPremium } from "@/lib/billing";
import { setNudgesEnabled } from "@/lib/nudges";

type ActionState = { error?: string; ok?: string } | null;

/** Premium: turn the weekly dharma nudge email on or off. */
export async function setNudgesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await isPremium(user!.id))) return { error: "Weekly nudges are a premium companion." };
  const on = String(formData.get("on")) === "true";
  await setNudgesEnabled(user!.id, on);
  revalidatePath("/settings");
  return { ok: on ? "Weekly nudges on." : "Weekly nudges paused." };
}
