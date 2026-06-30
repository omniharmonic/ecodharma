"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { redeemCode, mintCode } from "@/lib/entitlements";

/** Redeem an unlock code → upgrade this user to the Claude-powered tier. */
export async function redeemCodeAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  const code = String(formData.get("code") || "");
  const result = await redeemCode(user!.id, code);
  if (!result.ok) return { error: result.message };

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { ok: result.message };
}

/** Admin-only: mint a fresh shareable unlock code. */
export async function mintCodeAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(user.email))) return { error: "Minting is limited to stewards." };

  const note = String(formData.get("note") || "");
  const maxRaw = String(formData.get("max_redemptions") || "").trim();
  const max = maxRaw ? Math.max(1, Math.floor(Number(maxRaw))) : null;
  if (maxRaw && (!Number.isFinite(max) || (max as number) < 1)) {
    return { error: "Max redemptions must be a positive number, or blank for unlimited." };
  }

  const code = await mintCode(note, max);
  revalidatePath("/curate");
  return { ok: `Code minted: ${code}` };
}
