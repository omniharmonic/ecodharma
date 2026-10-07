"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { chamberOf, nextChamber, type InquirySuggestion } from "@/lib/altar/inquiry";
import { getAnswers, markStage, saveAnswers, type StageId } from "@/lib/altar/inquiry-repo";
import { compostElement, createElement, getAltar, linkElements, reviseElement, setRitualPrefs, setStatus, getRitualPrefs } from "@/lib/altar/repo";
import { withUser } from "@/lib/db";

type State = { error?: string; ok?: string } | null;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function seeker(): Promise<string> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  return user!.id;
}

export async function saveChamberAction(_p: State, f: FormData): Promise<State> {
  const userId = await seeker();
  const chamber = str(f, "chamber");
  const ch = chamberOf(chamber);
  if (!ch) return { error: "Unknown chamber." };
  const answers: Record<string, string> = {};
  for (const q of ch.questions) answers[q.id] = str(f, q.id);
  try {
    await saveAnswers(userId, chamber, answers);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/inquiry");
  redirect(`/inquiry/${chamber}?mirror=1`);
}

/** Place the chosen proposals on the altar (before the vow they wait as 'seeds'). */
export async function placeSeedsAction(_p: State, f: FormData): Promise<State> {
  const userId = await seeker();
  const chamber = str(f, "chamber");
  const chosen = f.getAll("seed").map(String);
  const altar = await getAltar(userId);
  try {
    for (const c of chosen) {
      const s = JSON.parse(c) as InquirySuggestion;
      const el = await createElement(userId, {
        kind: s.kind, title: s.title,
        facets: { ...(s.mode ? { mode: s.mode } : {}), ...(s.scope ? { scope: s.scope } : {}), source: `inquiry:${s.chamber}` },
      });
      if (altar.prayer) await linkElements(userId, el.lineage_id, altar.prayer.lineage_id, s.kind === "root" ? "grounds" : s.kind === "measure" ? "measures" : "serves");
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  const next = nextChamber(chamber);
  revalidatePath("/inquiry");
  redirect(next ? `/inquiry/${next.id}` : "/inquiry/vow");
}

/** The Vow: the person writes their Prayer. Kindles the altar if it isn't yet. */
export async function vowAction(_p: State, f: FormData): Promise<State> {
  const userId = await seeker();
  const prayer = str(f, "prayer");
  if (prayer.length < 8) return { error: "Write your prayer in your own words — even a rough first draft." };
  const facets = { for_whom: str(f, "for_whom"), toward_what: str(f, "toward_what"), through_what: str(f, "through_what") };
  try {
    const altar = await getAltar(userId);
    const p = altar.prayer
      ? await reviseElement(userId, altar.prayer.lineage_id, { title: prayer, facets }, "vowed through the Dharma Inquiry")
      : await createElement(userId, { kind: "prayer", title: prayer, facets });
    // everything placed during the inquiry now gathers around the prayer
    for (const e of [...altar.devotions, ...altar.works, ...altar.roots, ...altar.measures, ...altar.capacities, ...altar.practices]) {
      await linkElements(userId, e.lineage_id, p.lineage_id, e.kind === "root" ? "grounds" : e.kind === "measure" ? "measures" : "serves");
    }
    if (!(await getRitualPrefs(userId))) {
      const tz = await withUser(userId, async (c) => (await c.query("select tz_str, lat from birth_data where user_id=$1", [userId])).rows[0]);
      await setRitualPrefs(userId, { tz: tz?.tz_str || "UTC", hemisphere: (tz?.lat ?? 1) < 0 ? "S" : "N" });
    }
    await markStage(userId, "vow");
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/altar");
  redirect("/journey?vowed=1");
}

/** Journey stages III–VI: each saves its decisions and marks the stage. */
export async function journeyStageAction(_p: State, f: FormData): Promise<State> {
  const userId = await seeker();
  const stage = str(f, "stage") as StageId;
  try {
    const altar = await getAltar(userId);
    if (stage === "roots") {
      for (const t of str(f, "new_roots").split(/\n+/).map((x) => x.trim()).filter(Boolean)) await createElement(userId, { kind: "root", title: t, facets: { scope: "unique" } });
      for (const r of altar.roots) {
        const scope = str(f, `scope_${r.lineage_id}`);
        if (scope === "universal" || scope === "unique") await reviseElement(userId, r.lineage_id, { facets: { ...r.facets, scope } });
      }
      const q = Number(str(f, "question_root"));
      if (q) {
        await setStatus(userId, q, "questioning", "chosen on the Dharma Journey");
        const root = altar.roots.find((r) => r.lineage_id === q);
        const inq = await createElement(userId, { kind: "inquiry", title: `Is “${root?.title}” still true for me?`, facets: { mode: "becoming" } });
        await linkElements(userId, inq.lineage_id, q, "questions");
      }
    }
    if (stage === "paths") {
      for (const t of str(f, "new_works").split(/\n+/).map((x) => x.trim()).filter(Boolean)) await createElement(userId, { kind: "work", title: t, facets: { mode: "doing" } });
      const rel = Number(str(f, "release"));
      if (rel) await compostElement(userId, rel, str(f, "release_note") || "released on the Dharma Journey");
    }
    if (stage === "practice") {
      const title = str(f, "practice");
      if (title) await createElement(userId, { kind: "practice", title, facets: { mode: "being", cadence: str(f, "cadence") || "weekly", when: str(f, "when") } });
    }
    if (stage === "becoming") {
      const title = str(f, "capacity");
      if (!title) return { error: "Name the capacity you'll grow." };
      await createElement(userId, { kind: "capacity", title, facets: { mode: "becoming", horizon: "90 days", sign: str(f, "sign"), first_step: str(f, "first_step") } });
    }
    await markStage(userId, stage);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/journey");
  revalidatePath("/altar");
  redirect("/journey");
}

export async function answersFor(userId: string) {
  return getAnswers(userId);
}
