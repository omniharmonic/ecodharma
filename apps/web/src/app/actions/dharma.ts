"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { addSharedElement, DHARMA_ROLES, offerReflection, revokeOffering, sendWitness, setMyRole, type DharmaRole } from "@/lib/altar/constellations";

type State = { error?: string; ok?: string } | null;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function me(): Promise<string> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  return user!.id;
}

async function attempt(fn: () => Promise<unknown>, ok: string, paths: string[]): Promise<State> {
  try {
    await fn();
  } catch (e) {
    return { error: (e as Error).message };
  }
  for (const p of paths) revalidatePath(p);
  return { ok };
}

export async function setRoleAction(_p: State, f: FormData): Promise<State> {
  const u = await me();
  const cid = Number(str(f, "constellation_id"));
  const role = str(f, "role") as DharmaRole;
  if (!DHARMA_ROLES.includes(role)) return { error: "Choose a role." };
  return attempt(() => setMyRole(u, cid, role), "Your role is set.", [`/constellations/${cid}`]);
}

export async function offerAction(_p: State, f: FormData): Promise<State> {
  const u = await me();
  const cid = Number(str(f, "constellation_id"));
  if (!cid) return { error: "Choose a constellation to offer it to." };
  return attempt(() => offerReflection(u, Number(str(f, "reflection_id")), cid, str(f, "excerpt")), "Offered. You can withdraw it any time.", ["/journal", `/constellations/${cid}`]);
}

export async function revokeOfferingAction(_p: State, f: FormData): Promise<State> {
  const u = await me();
  return attempt(() => revokeOffering(u, Number(str(f, "offering_id"))), "Withdrawn.", ["/journal", `/constellations/${str(f, "constellation_id")}`]);
}

export async function witnessAction(_p: State, f: FormData): Promise<State> {
  const u = await me();
  const cid = Number(str(f, "constellation_id"));
  return attempt(() => sendWitness(u, str(f, "to_user"), cid, str(f, "body"), Number(str(f, "offering_id")) || null), "Your witness is sent.", [`/constellations/${cid}`]);
}

export async function sharedPrayerAction(_p: State, f: FormData): Promise<State> {
  const u = await me();
  const cid = Number(str(f, "constellation_id"));
  return attempt(() => addSharedElement(u, cid, (str(f, "kind") === "work" ? "work" : "prayer"), str(f, "title")), "Placed on the shared altar.", [`/constellations/${cid}`]);
}
