import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { claudeMode } from "../config";
import { altarElements, clampCharge, isRelation, RELATIONS, type Altar, type Relation } from "./model";
import { proposeStrandsDet, type StrandTarget } from "./strands-det";
import type { ProposedStrand } from "./repo";

// Strand proposal: Claude (tool-use, strict schema) when available, the
// deterministic extractor otherwise. Claude sees element TITLES only (never their
// private bodies) and must quote the reflection verbatim — anything that fails
// validation is dropped, and an empty Claude result falls back to the extractor.

const MODEL = process.env.ECODHARMA_STRAND_MODEL || "claude-sonnet-4-6";

export function targetsOf(altar: Altar): StrandTarget[] {
  return altarElements(altar)
    .filter((e) => !(e.kind === "thread" && e.status !== "accepted"))
    .map((e) => ({ lineage_id: e.lineage_id, kind: e.kind, title: e.title }));
}

const TOOL = {
  name: "record_strands",
  description: "Record how this reflection touches the person's altar elements.",
  input_schema: {
    type: "object",
    properties: {
      strands: {
        type: "array",
        items: {
          type: "object",
          properties: {
            lineage_id: { type: "integer", description: "id of the altar element touched" },
            relation: { type: "string", enum: [...RELATIONS] },
            charge: { type: "integer", minimum: -2, maximum: 2, description: "-2 contracted … +2 radiant" },
            quote: { type: "string", description: "an EXACT verbatim span from the reflection that grounds this" },
          },
          required: ["lineage_id", "relation", "charge", "quote"],
        },
      },
    },
    required: ["strands"],
  },
} as const;

const SYSTEM = `You help a person see how one journal reflection touches the living altar of their life: their prayer, devotions, roots (foundational beliefs), works, practices, measures, and open inquiries.

For each element the reflection genuinely touches, record ONE strand:
- relation: embodies (lived it) · strains (pulled against it) · questions (doubted/interrogated it) · evidences (fruit in the world) · nourishes (was fed by it / it fed them) · releases (letting it go) · discovers (a new seeing about it)
- charge: -2 (contracted, painful) … 0 … +2 (radiant, alive)
- quote: copy the EXACT words from the reflection (verbatim substring) that ground it.
Only record strands the text clearly supports. Fewer, truer strands beat many guesses. Never invent elements.`;

export async function proposeStrands(text: string, altar: Altar): Promise<ProposedStrand[]> {
  const targets = targetsOf(altar);
  if (!targets.length || !text.trim()) return [];
  const det = (): ProposedStrand[] => proposeStrandsDet(text, targets).map(({ score: _s, ...s }) => s);
  if (!(await claudeMode()) || !process.env.ANTHROPIC_API_KEY) return det();
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        tools: [TOOL as any],
        tool_choice: { type: "tool", name: "record_strands" },
        messages: [{
          role: "user",
          content: `ALTAR ELEMENTS (id · kind · title):\n${targets.map((t) => `${t.lineage_id} · ${t.kind} · ${t.title}`).join("\n")}\n\nREFLECTION:\n${text}`,
        }],
      },
      { signal: AbortSignal.timeout(45_000) },
    );
    const block = msg.content.find((b) => b.type === "tool_use") as any;
    const ids = new Set(targets.map((t) => t.lineage_id));
    const seen = new Set<number>();
    const out: ProposedStrand[] = [];
    for (const s of (block?.input?.strands || []) as any[]) {
      const lineage_id = Number(s?.lineage_id);
      const quote = String(s?.quote || "").trim();
      if (!ids.has(lineage_id) || seen.has(lineage_id) || !isRelation(s?.relation)) continue;
      if (!quote || !text.includes(quote)) continue; // must be verbatim
      seen.add(lineage_id);
      out.push({ lineage_id, relation: s.relation as Relation, charge: clampCharge(s.charge), quote: quote.slice(0, 280), proposed_by: "claude" });
    }
    return out.length ? out : det();
  } catch (e) {
    console.error("[strands] claude failed, using deterministic extractor:", (e as Error).message);
    return det();
  }
}
