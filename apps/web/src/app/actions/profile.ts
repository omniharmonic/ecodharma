"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { generateGiftProfile } from "@/lib/interpret";
import { frameworkVersion } from "@/lib/framework";
import { VOICE_VERSION } from "@/lib/voice";
import { assertWithinQuota, PaywallError } from "@/lib/entitlements";
import type { Charts, Ikigai } from "@/lib/types";

export async function regenerateProfileAction(_prev?: unknown, _formData?: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  try {
    await assertWithinQuota(user!.id, "profile_regen");
  } catch (e) {
    if (e instanceof PaywallError) {
      return { error: "You've used your free regenerations. (Paid tier covers heavier AI compute.)" };
    }
    throw e;
  }

  const { charts, ikigai } = await withUser(user!.id, async (c) => {
    const ch = await c.query("select modality, raw_json from charts where user_id=$1", [user!.id]);
    const pr = await c.query("select settings from profiles where id=$1", [user!.id]);
    const charts: Charts = {};
    for (const row of ch.rows) charts[row.modality] = row.raw_json;
    const ikigai = (pr.rows[0]?.settings?.ikigai || {}) as Ikigai;
    return { charts, ikigai };
  });

  const profile = await generateGiftProfile(charts, ikigai);
  await withUser(user!.id, (c) =>
    c.query(
      `insert into gift_profiles (user_id, framework_version, voice_version, content_json, status)
       values ($1,$2,$3,$4,'ready')`,
      [user!.id, frameworkVersion(), VOICE_VERSION, JSON.stringify(profile)],
    ),
  );
  revalidatePath("/profile");
  return { ok: "Your profile has been regenerated." };
}

export async function saveOfferingsAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const skills = String(formData.get("skills") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const offerings = String(formData.get("offerings") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const availability = String(formData.get("availability") || "").trim();

  await withUser(user!.id, (c) =>
    c.query(
      `insert into offerings (user_id, skills, offerings, availability)
       values ($1,$2,$3,$4)
       on conflict (user_id) do update set skills=excluded.skills, offerings=excluded.offerings, availability=excluded.availability`,
      [user!.id, skills, offerings, availability],
    ),
  );
  revalidatePath("/profile");
  return { ok: "Offerings saved." };
}
