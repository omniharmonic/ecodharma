import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { withUser } from "../db";
import { decOpt, encOpt, encrypt } from "../crypto";
import { claudeMode } from "../config";
import { loadFramework } from "../framework";
import { normalizeReading } from "../normalize-reading";
import { CHAMBERS, DHARMA_FRAME, WHY, chamberOf, coreQuestions, mirrorChamber } from "./inquiry";
import { getAltar } from "./repo";

// The Dharma Inquiry & Journey, server side. Answers are sealed like the journal.

export async function getAnswers(userId: string): Promise<Record<string, string>> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query("select question_id, answer_enc from dharma_inquiry where user_id = auth.uid()");
    return Object.fromEntries(rows.map((r) => [r.question_id, decOpt(r.answer_enc)]));
  });
}

export async function saveAnswers(userId: string, chamber: string, answers: Record<string, string>) {
  const ch = chamberOf(chamber);
  if (!ch) throw new Error("Unknown chamber.");
  await withUser(userId, async (c) => {
    for (const q of ch.questions) {
      const v = (answers[q.id] || "").trim();
      if (!v) { await c.query("delete from dharma_inquiry where user_id = $1 and question_id = $2", [userId, q.id]); continue; }
      await c.query(
        `insert into dharma_inquiry (user_id, chamber, question_id, answer_enc) values ($1,$2,$3,$4)
         on conflict (user_id, question_id) do update set answer_enc = excluded.answer_enc, updated_at = now()`,
        [userId, chamber, q.id, encrypt(v.slice(0, 4000))]);
    }
  });
}

export function chamberStatus(answers: Record<string, string>) {
  return CHAMBERS.map((ch) => ({ id: ch.id, answered: ch.questions.filter((q) => (answers[q.id] || "").trim()).length, total: coreQuestions(ch).length }));
}

export async function readingHints(userId: string): Promise<{ gifts: string[]; hdType?: string; authority?: string }> {
  const fw = loadFramework();
  return withUser(userId, async (c) => {
    const r = (await c.query("select content_json from gift_profiles where user_id=$1 and status='ready' order by generated_at desc limit 1", [userId])).rows[0];
    const hd = (await c.query("select raw_json from charts where user_id=$1 and modality='human_design'", [userId])).rows[0]?.raw_json;
    const gifts = r ? normalizeReading(r.content_json).gift_constellation.slice(0, 3).map((g) => fw.gifts.find((x) => x.id === g.gift_id)?.name || g.gift_id) : [];
    return { gifts, hdType: hd?.type, authority: hd?.authority };
  });
}

/** The mirror after a chamber: Claude when available (their words only, no verdicts), else deterministic. */
export async function mirror(userId: string, chamber: string, answers: Record<string, string>): Promise<string> {
  const hints = await readingHints(userId);
  const det = mirrorChamber(chamber, answers, hints);
  const ch = chamberOf(chamber);
  if (!ch || !(await claudeMode()) || !process.env.ANTHROPIC_API_KEY) return det;
  const qa = ch.questions.filter((q) => (answers[q.id] || "").trim()).map((q) => `Q: ${q.q}\nA: ${answers[q.id].trim().split(WHY).join("\n  (and why?) ")}`).join("\n\n");
  if (!qa) return det;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: process.env.ECODHARMA_BOT_MODEL || "claude-sonnet-4-6",
      max_tokens: 350,
      system: `You are a mirror in a Dharma Inquiry (after Daniel Schmachtenberger: dharma as right relationship with Life — lived in being, doing and becoming). Reflect back, in 3–5 sentences, what you hear in this person's answers to the "${ch.title}" chamber. Quote 1–3 of their exact phrases. Where they asked "why?" beneath an answer, honour the deepest layer they reached — it is what felt fundamental. Hold gifts and shadows together. Gently connect to their reading where it truly fits (gifts: ${hints.gifts.join(", ") || "unknown"}; Human Design type: ${hints.hdType || "unknown"}). No advice, no verdicts, no flattery, no questions back except at most one at the very end. Plain text.`,
      messages: [{ role: "user", content: qa }],
    }, { signal: AbortSignal.timeout(25_000) });
    const out = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("").trim();
    if (!out || /I need|could you share|as an AI/i.test(out)) return det;
    return out;
  } catch {
    return det;
  }
}

// ---------------------------------------------------------------- journey --

export const STAGES = [
  { id: "inquiry", numeral: "I", glyph: "◈", title: "The Inquiry", href: "/inquiry", essence: "Walk the six chambers." },
  { id: "vow", numeral: "II", glyph: "☉", title: "The Vow", href: "/inquiry/vow", essence: "Write your prayer — the first ring." },
  { id: "roots", numeral: "III", glyph: "⟟", title: "The Roots", href: "/journey/roots", essence: "Name what you stand on; sort the universal from the unique; question one." },
  { id: "paths", numeral: "IV", glyph: "◈", title: "The Paths · Doing", href: "/journey/paths", essence: "Name your works. Choose one to release." },
  { id: "practice", numeral: "V", glyph: "○", title: "The Practice · Being", href: "/journey/practice", essence: "Design a practice from your design and what replenishes you." },
  { id: "becoming", numeral: "VI", glyph: "△", title: "The Becoming", href: "/journey/becoming", essence: "One capacity to grow over ninety days, and a sign you'll know." },
  { id: "witness", numeral: "VII", glyph: "⁂", title: "The Witness", href: "/constellations", essence: "Invite one or two people to co-arise with you." },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

export async function markStage(userId: string, stage: StageId, note?: string) {
  await withUser(userId, (c) => c.query(
    "insert into journey_progress (user_id, stage, note_enc) values ($1,$2,$3) on conflict (user_id, stage) do nothing", [userId, stage, encOpt(note)]));
}

export async function journey(userId: string) {
  const [answers, altar, marked, witness] = await Promise.all([
    getAnswers(userId),
    getAltar(userId),
    withUser(userId, async (c) => new Set((await c.query("select stage from journey_progress where user_id = auth.uid()")).rows.map((r) => r.stage as string))),
    withUser(userId, async (c) => (await c.query(
      `select count(*)::int as n from constellation_members m join consents cs on cs.id = m.consent_id and cs.revoked_at is null
        where m.constellation_id in (select mm.constellation_id from constellation_members mm join consents c2 on c2.id = mm.consent_id and c2.revoked_at is null where mm.user_id = auth.uid())
          and m.user_id <> auth.uid()`)).rows[0]?.n ?? 0),
  ]);
  const chambers = chamberStatus(answers);
  const auto: Record<StageId, boolean> = {
    inquiry: chambers.every((c) => c.answered > 0),
    vow: !!altar.prayer,
    roots: marked.has("roots"),
    paths: marked.has("paths"),
    practice: marked.has("practice"),
    becoming: marked.has("becoming"),
    witness: witness > 0,
  };
  const stages = STAGES.map((s) => ({ ...s, done: auto[s.id] || marked.has(s.id) }));
  const current = stages.find((s) => !s.done) || null;
  return { stages, current, chambers, answers, altar, frame: DHARMA_FRAME };
}
