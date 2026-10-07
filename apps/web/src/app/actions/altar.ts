"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import {
  addAlignment, addStrands, compostElement, createElement, createReflection, decideProposal, getAltar,
  linkElements, reviewStrands, reviseElement, setRitualPrefs, setStatus,
} from "@/lib/altar/repo";
import { proposeStrands } from "@/lib/altar/strands";
import { isCadence, isKind, isRelation, LENSES, type ElementKind } from "@/lib/altar/model";
import { withUser } from "@/lib/db";

type State = { error?: string; ok?: string } | null;

async function requireKeeper(): Promise<string> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  return user!.id;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const lines = (s: string) => s.split(/\n+/).map((x) => x.trim()).filter(Boolean);

/** First lighting of the altar: prayer + chosen suggestions + custom lines + ritual rhythm. */
export async function kindleAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  const prayer = str(f, "prayer");
  if (prayer.length < 8) return { error: "Write your prayer in your own words — even a rough first draft. It will grow." };
  try {
    const prayerEl = await createElement(userId, {
      kind: "prayer",
      title: prayer,
      facets: { for_whom: str(f, "for_whom"), toward_what: str(f, "toward_what"), through_what: str(f, "through_what") },
    });
    // Suggestions the person ticked (value = kind|title|refsJSON) + their own lines per kind.
    const chosen = f.getAll("suggestion").map(String);
    const created: { kind: ElementKind; lineage: number }[] = [];
    for (const c of chosen) {
      const [kind, title, refs] = c.split("|");
      if (!isKind(kind) || !title) continue;
      let constitution_refs: any[] = [];
      try { constitution_refs = refs ? JSON.parse(refs) : []; } catch { /* ignore */ }
      const el = await createElement(userId, { kind, title, constitution_refs });
      created.push({ kind, lineage: el.lineage_id });
    }
    for (const kind of ["devotion", "root", "work", "practice", "measure"] as const) {
      for (const title of lines(str(f, `custom_${kind}`))) {
        const el = await createElement(userId, { kind, title });
        created.push({ kind, lineage: el.lineage_id });
      }
    }
    // The prayer is grounded by its roots and served by its works.
    for (const c of created) {
      if (c.kind === "root") await linkElements(userId, c.lineage, prayerEl.lineage_id, "grounds");
      if (c.kind === "work" || c.kind === "devotion") await linkElements(userId, c.lineage, prayerEl.lineage_id, "serves");
      if (c.kind === "measure") await linkElements(userId, c.lineage, prayerEl.lineage_id, "measures");
    }
    const channels = f.getAll("channels").map(String).filter((x) => x === "email" || x === "telegram");
    await setRitualPrefs(userId, {
      weekly_dow: Number(str(f, "weekly_dow") || 0),
      local_hour: Number(str(f, "local_hour") || 18),
      tz: str(f, "tz") || "UTC",
      channels: channels.length ? channels : ["email"],
      lunar: f.get("lunar") === "on",
      hemisphere: str(f, "hemisphere") === "S" ? "S" : "N",
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/altar");
  redirect("/altar?kindled=1");
}

export async function addElementAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  const kind = str(f, "kind");
  const title = str(f, "title");
  if (!isKind(kind)) return { error: "Choose what kind of element this is." };
  if (!title) return { error: "Give it a name." };
  try {
    const el = await createElement(userId, { kind, title, body: str(f, "body") || undefined });
    const altar = await getAltar(userId);
    if (altar.prayer && el.kind !== "prayer") {
      const rel = kind === "root" ? "grounds" : kind === "measure" ? "measures" : kind === "inquiry" ? "questions" : "serves";
      await linkElements(userId, el.lineage_id, altar.prayer.lineage_id, rel);
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/altar");
  revalidatePath("/altar/edit");
  return { ok: "Placed on the altar." };
}

export async function reviseElementAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  const lineage = Number(str(f, "lineage_id"));
  const title = str(f, "title");
  if (!lineage || !title) return { error: "Nothing to revise." };
  try {
    const facets: Record<string, string> = {};
    for (const k of ["for_whom", "toward_what", "through_what"]) if (f.has(k)) facets[k] = str(f, k);
    await reviseElement(userId, lineage, { title, body: f.has("body") ? str(f, "body") : undefined, facets: Object.keys(facets).length ? facets : undefined }, str(f, "note") || undefined);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/altar");
  revalidatePath("/altar/edit");
  return { ok: "A new ring is added — the old version is kept in its history." };
}

export async function setStatusAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  try {
    await setStatus(userId, Number(str(f, "lineage_id")), str(f, "status"), str(f, "note") || undefined);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/altar");
  revalidatePath("/altar/edit");
  return { ok: "Status changed." };
}

export async function compostAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  await compostElement(userId, Number(str(f, "lineage_id")), str(f, "note") || undefined);
  revalidatePath("/altar");
  revalidatePath("/altar/edit");
  return { ok: "Composted — it will feed what grows next." };
}

/** Write a reflection → propose strands → go confirm them. */
export async function reflectAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  const body = str(f, "body");
  if (body.length < 3) return { error: "Write a few words — anything true." };
  const cadence = isCadence(str(f, "cadence")) ? (str(f, "cadence") as any) : "spontaneous";
  const ritualId = Number(str(f, "ritual_id")) || null;
  let id: number;
  try {
    id = await createReflection(userId, { body, cadence, source: "web", ritual_id: ritualId });
    const readings = LENSES.map((lens) => ({
      lens,
      value: str(f, `lens_${lens}`) ? Number(str(f, `lens_${lens}`)) : null,
      note: str(f, `lens_${lens}_note`) || undefined,
    }));
    await addAlignment(userId, id, readings);
    const altar = await getAltar(userId);
    await addStrands(userId, id, await proposeStrands(body, altar));
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/journal");
  revalidatePath("/altar");
  redirect(`/journal?r=${id}`);
}

/** Confirm / reject / edit proposed strands. Field names: s_<id> = confirm|reject, rel_<id>, charge_<id>. */
export async function reviewStrandsAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  const confirm: number[] = [];
  const reject: number[] = [];
  const edits: { id: number; relation?: any; charge?: number }[] = [];
  for (const [k, v] of f.entries()) {
    const m = /^s_(\d+)$/.exec(k);
    if (!m) continue;
    const id = Number(m[1]);
    if (v === "reject") { reject.push(id); continue; }
    const rel = str(f, `rel_${id}`);
    const ch = str(f, `charge_${id}`);
    if ((rel && isRelation(rel)) || ch !== "") edits.push({ id, relation: isRelation(rel) ? rel : undefined, charge: ch === "" ? undefined : Number(ch) });
    else confirm.push(id);
  }
  await reviewStrands(userId, { confirm, reject, edits });
  // Person-added strands (an element the extractor missed).
  const addLineage = Number(str(f, "add_lineage"));
  const addRel = str(f, "add_relation");
  const reflectionId = Number(str(f, "reflection_id"));
  if (addLineage && reflectionId && isRelation(addRel)) {
    await addStrands(userId, reflectionId, [{ lineage_id: addLineage, relation: addRel, charge: Number(str(f, "add_charge") || 0), quote: "", proposed_by: "person" }], "confirmed");
  }
  revalidatePath("/journal");
  revalidatePath("/altar");
  return { ok: "Woven into your altar." };
}

export async function decideProposalAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  try {
    await decideProposal(userId, Number(str(f, "proposal_id")), str(f, "decision") === "accept");
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/altar");
  return { ok: str(f, "decision") === "accept" ? "Accepted — your altar is updated." : "Declined." };
}

export async function ritualPrefsAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  const channels = f.getAll("channels").map(String).filter((x) => x === "email" || x === "telegram");
  await setRitualPrefs(userId, {
    weekly_dow: Number(str(f, "weekly_dow") || 0),
    local_hour: Number(str(f, "local_hour") || 18),
    tz: str(f, "tz") || undefined,
    channels: channels.length ? channels : ["email"],
    lunar: f.get("lunar") === "on",
    hemisphere: str(f, "hemisphere") === "S" ? "S" : "N",
  });
  revalidatePath("/altar");
  return { ok: "Your rhythm is set." };
}

/** Birth tz + hemisphere defaults for kindling. */
export async function birthDefaults(userId: string): Promise<{ tz: string; hemisphere: "N" | "S" }> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query("select tz_str, lat from birth_data where user_id = $1", [userId]);
    return { tz: rows[0]?.tz_str || "UTC", hemisphere: (rows[0]?.lat ?? 1) < 0 ? "S" : "N" };
  });
}

/** A guided ritual: answers → one reflection; at depth 3, optionally a new prayer ring and root changes. */
export async function ritualAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  const { getRitual, completeFolded } = await import("@/lib/altar/rituals");
  const { ritualSpec, composeRitualBody } = await import("@/lib/altar/prompts");
  const ritualId = Number(str(f, "ritual_id")) || null;
  const ritual = ritualId ? await getRitual(userId, ritualId) : null;
  const cadence = (ritual?.cadence || str(f, "cadence") || "weekly") as any;
  const altar = await getAltar(userId);
  const { QUESTION } = await import("@/lib/altar/inquiry");
  const rq = QUESTION.get(str(f, "return_qid"));
  const spec = ritualSpec(cadence, ritual?.label || cadence, { prayer: altar.prayer?.title, inquiry: rq ? { id: rq.id, q: rq.q } : undefined });
  const answers: Record<string, string> = {};
  for (const s of spec.steps) answers[s.id] = str(f, `a_${s.id}`);
  const body = composeRitualBody(spec, answers);
  if (body.length < 3) return { error: "Answer at least one question — even a sentence." };
  let id: number;
  try {
    id = await createReflection(userId, { body, cadence, source: "web", ritual_id: ritualId });
    await addAlignment(userId, id, LENSES.map((lens) => ({ lens, value: str(f, `lens_${lens}`) ? Number(str(f, `lens_${lens}`)) : null, note: str(f, `lens_${lens}_note`) || undefined })));
    await addStrands(userId, id, await proposeStrands(body, altar));
    const newPrayer = str(f, "new_prayer");
    if (newPrayer && altar.prayer && newPrayer !== altar.prayer.title) {
      await reviseElement(userId, altar.prayer.lineage_id, { title: newPrayer }, `re-vowed at ${ritual?.label || cadence}`);
    }
    for (const r of altar.roots) {
      const st = str(f, `root_${r.lineage_id}`);
      if (st && st !== r.status) {
        if (st === "compost") await compostElement(userId, r.lineage_id, `composted at ${ritual?.label || cadence}`);
        else await setStatus(userId, r.lineage_id, st, `at ${ritual?.label || cadence}`);
      }
    }
    await completeFolded(userId, id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/altar");
  revalidatePath("/journal");
  redirect(`/journal?r=${id}`);
}

/** Root under strain → open an inquiry about it and mark the root as questioning. */
export async function inquireRootAction(_prev: State, f: FormData): Promise<State> {
  const userId = await requireKeeper();
  const root = Number(str(f, "lineage_id"));
  const title = str(f, "title");
  try {
    const q = await createElement(userId, { kind: "inquiry", title: `Is “${title}” still true for me?` });
    await linkElements(userId, q.lineage_id, root, "questions");
    await setStatus(userId, root, "questioning", "opened an inquiry after repeated strain");
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/altar");
  return { ok: "An inquiry is open. Live with the question." };
}
