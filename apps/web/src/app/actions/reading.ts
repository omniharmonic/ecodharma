"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { computeChart, type BirthInput } from "@/lib/ephemeris";
import { generateGiftProfile } from "@/lib/interpret";
import { frameworkVersion } from "@/lib/framework";
import { VOICE_VERSION } from "@/lib/voice";
import { geocode } from "@/lib/places";
import type { Charts, GiftProfile, Ikigai } from "@/lib/types";

const MODALITIES = ["western", "vedic", "human_design", "gene_keys"] as const;

const schema = z.object({
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  birth_time: z.string().optional(),
  unknown_time: z.coerce.boolean().optional(),
  place: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  tz_str: z.string().optional(),
  love: z.string().min(1),
  skill: z.string().min(1),
  world_need: z.string().min(1),
  livelihood: z.string().min(1),
});

export async function createReadingAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;

  // Resolve location. Explicit coordinates win; otherwise geocode the place name
  // through the universal resolver (any city on Earth, real IANA timezone).
  let lat = f.lat;
  let lng = f.lng;
  let tz = f.tz_str;
  if (lat === undefined || lng === undefined || !tz) {
    const place = await geocode(f.place || null);
    if (place) {
      lat = place.lat;
      lng = place.lng;
      tz = place.tz;
    }
  }
  if (lat === undefined || lng === undefined || !tz) {
    return { error: "We couldn't find that place — try a city (e.g. \"Reykjavík\"), or enter latitude, longitude and timezone below." };
  }

  const [year, month, day] = f.birth_date.split("-").map(Number);
  const unknown = !!f.unknown_time || !f.birth_time;
  let hour: number | null = null;
  let minute: number | null = null;
  if (!unknown && f.birth_time) {
    const [h, m] = f.birth_time.split(":").map(Number);
    hour = h;
    minute = m;
  }

  const birth: BirthInput = {
    name: user!.email,
    year, month, day, hour, minute, lat, lng, tz_str: tz, unknown_time: unknown,
  };
  const ikigai: Ikigai = {
    love: f.love, skill: f.skill, world_need: f.world_need, livelihood: f.livelihood,
  };

  // 1) Persist birth data + ikigai (RLS owner-only).
  await withUser(user!.id, async (c) => {
    await c.query(
      `insert into birth_data (user_id, birth_date, birth_time, lat, lng, tz_str, unknown_time)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (user_id) do update set
         birth_date=excluded.birth_date, birth_time=excluded.birth_time,
         lat=excluded.lat, lng=excluded.lng, tz_str=excluded.tz_str, unknown_time=excluded.unknown_time`,
      [user!.id, f.birth_date, unknown ? null : f.birth_time, lat, lng, tz, unknown],
    );
    await c.query(
      `update profiles set
         settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{ikigai}', $2::jsonb, true),
         display_name = coalesce(nullif(display_name, ''), $3)
       where id = $1`,
      [user!.id, JSON.stringify(ikigai), user!.email.split("@")[0]],
    );
  });

  // 2) Compute all charts and persist (RLS owner-only).
  const charts: Charts = {};
  for (const m of MODALITIES) {
    const chart = await computeChart(m, birth);
    charts[m] = chart.data;
    await withUser(user!.id, (c) =>
      c.query(
        `insert into charts (user_id, modality, raw_json, engine_version)
         values ($1,$2,$3,$4)
         on conflict (user_id, modality) do update set
           raw_json=excluded.raw_json, engine_version=excluded.engine_version, computed_at=now()`,
        [user!.id, m, chart.data, chart.engine_version],
      ),
    );
  }

  // 3) Interpret through framework + voice -> persist gift profile.
  let profile: GiftProfile;
  try {
    profile = await generateGiftProfile(charts, ikigai);
    await withUser(user!.id, (c) =>
      c.query(
        `insert into gift_profiles (user_id, framework_version, voice_version, content_json, status)
         values ($1,$2,$3,$4,'ready')`,
        [user!.id, frameworkVersion(), VOICE_VERSION, JSON.stringify(profile)],
      ),
    );
  } catch (e) {
    console.error("[reading] interpret/persist failed:", e);
    return { error: `Interpretation failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  redirect("/profile");
}
