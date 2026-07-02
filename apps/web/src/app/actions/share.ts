"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { getOrCreateShareToken, disableShareToken } from "@/lib/share";

type ActionState = { error?: string; ok?: string } | null;

/** Mint (or reveal) the user's public share link. */
export async function ensureShareLinkAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) redirect("/login");
  await getOrCreateShareToken(user!.id);
  revalidatePath("/profile");
  return { ok: "Your share link is live." };
}

/** Turn the public share link off (the link 404s immediately after). */
export async function disableShareLinkAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) redirect("/login");
  await disableShareToken(user!.id);
  revalidatePath("/profile");
  return { ok: "Sharing turned off." };
}
