import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { withService } from "./db";
import { loadFramework } from "./framework";
import { useClaude } from "./llm";
import type { Framework, Ikigai } from "./types";

// The growing trim-tab commons: generic patterns per gift x domain cell, seeded
// from the curated artifact and accreted at runtime on cache-miss. Stored generic
// (reusable + promotable); the runtime personalizes phrasing per person.

export type TrimTabRow = {
  id: number;
  gift_id: string;
  domain_id: string;
  pattern: string;
  upward_spiral_logic: string;
  source: "seed" | "generated" | "fixture";
  status: "candidate" | "curated";
  framework_version: string;
  usage_count: number;
  resonance_up: number;
  resonance_down: number;
};

function giftOf(fw: Framework, id: string) {
  return fw.gifts.find((g) => g.id === id);
}
function domainOf(fw: Framework, id: string) {
  return fw.domains.find((d) => d.id === id);
}

const GEN_TOOL = {
  name: "trim_tab",
  description: "A small, high-leverage action at a gift x domain intersection that starts an upward spiral.",
  input_schema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "the concrete action, generic enough to reuse across people" },
      upward_spiral_logic: { type: "string", description: "why each turn makes the next easier (the compounding loop)" },
    },
    required: ["pattern", "upward_spiral_logic"],
  },
} as const;

async function claudeGenerate(fw: Framework, giftId: string, domainId: string) {
  const g = giftOf(fw, giftId);
  const d = domainOf(fw, domainId);
  const anthropic = new Anthropic();
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6", // single trim-tab: fast + cheap
    max_tokens: 700,
    tools: [GEN_TOOL as any],
    tool_choice: { type: "tool", name: "trim_tab" },
    system:
      "You distill Benjamin Life's regenerative framework into trim-tabs: small, high-leverage actions " +
      "(Buckminster Fuller's image) that create upward spirals — self-amplifying loops that compound " +
      "regeneration. Write one generic, reusable trim-tab (not personalized) for the given gift x domain " +
      "intersection, grounded in that gift's way of serving and that domain's needs.",
    messages: [
      {
        role: "user",
        content:
          `GIFT — ${g?.name}: ${g?.description}\n\nDOMAIN — ${d?.name}: ${d?.description}\n\n` +
          "Produce one trim-tab: a concrete pattern + its explicit upward-spiral logic.",
      },
    ],
  });
  const block = msg.content.find((b) => b.type === "tool_use") as any;
  const out = block?.input as { pattern: string; upward_spiral_logic: string };
  if (!out?.pattern || !out?.upward_spiral_logic) throw new Error("incomplete trim-tab generation");
  return out;
}

function fixtureGenerate(fw: Framework, giftId: string, domainId: string) {
  const g = giftOf(fw, giftId);
  const d = domainOf(fw, domainId);
  return {
    pattern:
      `As ${g?.name}, take one small, concrete action in ${d?.name}: gather two or three others ` +
      `already near you and begin the smallest real version of the work, in public.`,
    upward_spiral_logic:
      `Each participant and each visible act lowers the threshold for the next — trust, capacity, and ` +
      `legitimacy compound, so the work becomes easier and more attractive the more it is done.`,
  };
}

/** Resolve a generic trim-tab for a cell from the library; GENERATE on a true miss. */
export async function resolveTrimTab(giftId: string, domainId: string): Promise<TrimTabRow> {
  const fw = loadFramework();
  // Best existing: curated first, then by net resonance, then usage.
  const existing = await withService(async (c) => {
    const { rows } = await c.query<TrimTabRow>(
      `select * from trim_tabs where gift_id=$1 and domain_id=$2
       order by (status='curated') desc, (resonance_up - resonance_down) desc, usage_count desc
       limit 1`,
      [giftId, domainId],
    );
    return rows[0];
  });

  if (existing) {
    await withService((c) => c.query("update trim_tabs set usage_count = usage_count + 1 where id=$1", [existing.id]));
    return existing;
  }

  // Cache-miss: generate a generic trim-tab and save it as a candidate.
  const gen = useClaude()
    ? await claudeGenerate(fw, giftId, domainId).catch(() => fixtureGenerate(fw, giftId, domainId))
    : fixtureGenerate(fw, giftId, domainId);
  const source = useClaude() ? "generated" : "fixture";

  const saved = await withService(async (c) => {
    const { rows } = await c.query<TrimTabRow>(
      `insert into trim_tabs (gift_id, domain_id, pattern, upward_spiral_logic, source, status, framework_version, usage_count)
       values ($1,$2,$3,$4,$5,'candidate',$6,1) returning *`,
      [giftId, domainId, gen.pattern, gen.upward_spiral_logic, source, fw.framework_version],
    );
    return rows[0];
  });
  return saved;
}

/** Personalize a generic library trim-tab into the per-person profile shape. */
export function personalizeTrimTab(
  row: TrimTabRow,
  giftName: string,
  domainName: string,
  ikigai: Ikigai,
) {
  const love = ikigai.love?.length > 50 ? ikigai.love.slice(0, 50).trim() + "…" : ikigai.love;
  return {
    trim_tab_id: row.id,
    action: row.pattern,
    domain_id: row.domain_id,
    gift_basis: giftName,
    upward_spiral: row.upward_spiral_logic,
    ikigai_fit:
      `Sits where what you love (${love || "your aliveness"}) meets what ${domainName} needs — ` +
      `sustainably, if you let it carry your livelihood.`,
  };
}

export async function recordResonance(trimTabId: number, dir: "up" | "down"): Promise<void> {
  const col = dir === "up" ? "resonance_up" : "resonance_down";
  await withService((c) => c.query(`update trim_tabs set ${col} = ${col} + 1 where id=$1`, [trimTabId]));
}

export async function listCandidates(): Promise<TrimTabRow[]> {
  return withService(async (c) => {
    const { rows } = await c.query<TrimTabRow>(
      `select * from trim_tabs where status='candidate' order by (resonance_up - resonance_down) desc, usage_count desc, created_at desc`,
    );
    return rows;
  });
}

export async function libraryStats() {
  return withService(async (c) => {
    const { rows } = await c.query(
      `select source, status, count(*)::int n, sum(usage_count)::int uses from trim_tabs group by 1,2 order by 1,2`,
    );
    return rows;
  });
}

export async function promoteTrimTab(id: number): Promise<void> {
  await withService((c) => c.query("update trim_tabs set status='curated' where id=$1", [id]));
}

export async function deleteTrimTab(id: number): Promise<void> {
  await withService((c) => c.query("delete from trim_tabs where id=$1 and source<>'seed'", [id]));
}
