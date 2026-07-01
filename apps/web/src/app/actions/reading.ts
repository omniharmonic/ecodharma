"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { computeChart, type BirthInput } from "@/lib/ephemeris";
import { generateGiftProfile } from "@/lib/interpret";
import { claudeMode } from "@/lib/config";
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
  // precise coords from the birthplace autocomplete selection (the reliable path)
  place_lat: z.coerce.number().optional(),
  place_lng: z.coerce.number().optional(),
  place_tz: z.string().optional(),
  // manual override (Advanced: exact coordinates)
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  tz_str: z.string().optional(),
  love: z.string().min(1),
  skill: z.string().min(1),
  world_need: z.string().optional(),
  livelihood: z.string().optional(),
});

export async function createReadingAction(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;

  // Resolve location, most-precise first:
  //   1. manual "exact coordinates" override,
  //   2. the coords of the city the person PICKED in the autocomplete (reliable —
  //      no ambiguity), 3. geocode the typed text as a last resort.
  let lat = f.lat ?? f.place_lat;
  let lng = f.lng ?? f.place_lng;
  let tz = f.tz_str || f.place_tz;
  // Human-readable label to show back on the profile (so a wrong city is catchable).
  let placeLabel = f.place_lat !== undefined ? (f.place || null) : null;
  if (lat === undefined || lng === undefined || !tz) {
    const place = await geocode(f.place || null);
    if (place) {
      lat = place.lat;
      lng = place.lng;
      tz = place.tz;
      placeLabel = place.label || f.place || null;
    }
  }
  if (!placeLabel && f.place) placeLabel = f.place;
  if (lat === undefined || lng === undefined || !tz) {
    return { error: "We couldn't place that town. Start typing and pick your city from the list, or add exact coordinates under “Can't find your town?”." };
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
    love: f.love, skill: f.skill, world_need: f.world_need || "", livelihood: f.livelihood || "",
  };

  // 1) Persist birth data + ikigai (RLS owner-only).
  await withUser(user!.id, async (c) => {
    await c.query(
      `insert into birth_data (user_id, birth_date, birth_time, lat, lng, tz_str, unknown_time, place_label)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (user_id) do update set
         birth_date=excluded.birth_date, birth_time=excluded.birth_time,
         lat=excluded.lat, lng=excluded.lng, tz_str=excluded.tz_str,
         unknown_time=excluded.unknown_time, place_label=excluded.place_label`,
      [user!.id, f.birth_date, unknown ? null : f.birth_time, lat, lng, tz, unknown, placeLabel],
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
    profile = await generateGiftProfile(charts, ikigai, { useClaude: await claudeMode() });
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
