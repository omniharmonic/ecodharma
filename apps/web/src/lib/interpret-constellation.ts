import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ConstellationRead, Framework, GiftProfile } from "./types";
import { loadFramework } from "./framework";
import { loadVoice } from "./voice";

const ENGINE_FIXTURE = "fixture-constellation@1.0.0";

export type Member = {
  display_name: string;
  profile: GiftProfile | null;
};

// ---------- deterministic fixture ----------
function giftLabels(p: GiftProfile | null): string[] {
  return (p?.unique_gifts || []).map((g) => g.split("—")[0].trim());
}

function fixtureRead(framework: Framework, members: Member[]): ConstellationRead {
  const allGifts = members.flatMap((m) => giftLabels(m.profile));
  const giftCounts = new Map<string, number>();
  for (const g of allGifts) giftCounts.set(g, (giftCounts.get(g) || 0) + 1);

  const collective = [...new Set(allGifts)];
  const overlaps = [...giftCounts.entries()].filter(([, n]) => n > 1).map(([g]) => g);
  const distinct = [...giftCounts.entries()].filter(([, n]) => n === 1).map(([g]) => g);

  // Domain coverage across members.
  const coveredDomains = new Set<string>();
  for (const m of members) for (const d of m.profile?.domains || []) coveredDomains.add(d.domain_id);
  const gaps = framework.domains
    .filter((d) => !coveredDomains.has(d.id))
    .map((d) => d.name);

  const names = members.map((m) => m.display_name);

  const pairwise =
    members.length === 2 && members[0].profile && members[1].profile
      ? [
          {
            a: members[0].display_name,
            b: members[1].display_name,
            dynamic:
              `${members[0].display_name} brings ${giftLabels(members[0].profile).join(", ") || "their medicine"}; ` +
              `${members[1].display_name} brings ${giftLabels(members[1].profile).join(", ") || "their medicine"}. ` +
              (overlaps.length
                ? `You share ${overlaps.join(", ")} — shared language, but watch for crowding the same space. `
                : `Your gifts are largely complementary — fertile ground, if you make the handoffs explicit. `),
          },
        ]
      : undefined;

  const narrative =
    `This constellation of ${names.join(", ")} carries a collective medicine across ` +
    `${collective.length} distinct gifts. ` +
    (distinct.length
      ? `Its complementarity lives in ${distinct.slice(0, 5).join(", ")} — each offered by a different person, ` +
        `so no one is asked to be what they are not. `
      : "") +
    (overlaps.length
      ? `Where gifts overlap (${overlaps.join(", ")}), name it early: shared strength becomes friction when it goes unspoken. `
      : "") +
    (gaps.length
      ? `The field is thinner in ${gaps.slice(0, 3).join(", ")}; decide together whether to grow into those domains or weave in someone who already lives there. `
      : "All seven domains are touched — a rare wholeness; tend it. ") +
    `Weave by making the handoffs explicit, honoring each person's authority, and choosing one shared trim-tab to begin.`;

  return {
    collective_gifts: collective,
    complementarities: distinct,
    frictions: overlaps.map((g) => `Shared gift "${g}" — risk of crowding; clarify who holds it when.`),
    gaps,
    make_explicit: [
      "Who holds final authority on what?",
      "Where do two of you carry the same gift, and how will you take turns?",
      "Which single trim-tab will this constellation begin with together?",
    ],
    weaving_guidance:
      "Complementarity over conformity: align where gifts differ, rather than expecting each other to do what you were not uniquely made for.",
    pairwise,
    narrative,
    meta: { engine: ENGINE_FIXTURE, framework_version: framework.framework_version },
  };
}

// ---------- Claude path ----------
const READ_TOOL = {
  name: "constellation_read",
  description: "Structured EcoDharma constellation read.",
  input_schema: {
    type: "object",
    properties: {
      collective_gifts: { type: "array", items: { type: "string" } },
      complementarities: { type: "array", items: { type: "string" } },
      frictions: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      make_explicit: { type: "array", items: { type: "string" } },
      weaving_guidance: { type: "string" },
      pairwise: {
        type: "array",
        items: {
          type: "object",
          properties: { a: { type: "string" }, b: { type: "string" }, dynamic: { type: "string" } },
        },
      },
      narrative: { type: "string" },
    },
    required: ["collective_gifts", "complementarities", "frictions", "weaving_guidance", "narrative"],
  },
} as const;

async function claudeRead(framework: Framework, members: Member[]): Promise<ConstellationRead> {
  const anthropic = new Anthropic();
  // Sonnet for pairs, Opus for groups (model routing per the architecture).
  const model = members.length <= 2 ? "claude-sonnet-4-6" : "claude-opus-4-8";
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 6000, // headroom so the closing narrative isn't truncated

    tools: [READ_TOOL as any],
    tool_choice: { type: "tool", name: "constellation_read" },
    system: [
      { type: "text", text: loadVoice(), cache_control: { type: "ephemeral" } },
      { type: "text", text: `FRAMEWORK:\n${JSON.stringify(framework)}`, cache_control: { type: "ephemeral" } },
    ] as any,
    messages: [
      {
        role: "user",
        content:
          "Read this constellation THROUGH the framework, in the EcoDharma voice. Surface collective gifts, " +
          "complementarities, frictions, gaps vs. the domains, what to make explicit, and weaving guidance. " +
          "For two members give a 1:1 synastry dynamic; invite reflection, never assert deterministic compatibility.\n\n" +
          `MEMBERS:\n${JSON.stringify(members)}`,
      },
    ],
  });
  const block = msg.content.find((b) => b.type === "tool_use") as any;
  const out = block?.input as ConstellationRead;
  out.meta = { engine: model, framework_version: framework.framework_version };
  return out;
}

export async function generateConstellationRead(members: Member[]): Promise<ConstellationRead> {
  const framework = loadFramework();
  if (process.env.ANTHROPIC_API_KEY && process.env.ECODHARMA_INTERPRETER !== "fixture") {
    try {
      return await claudeRead(framework, members);
    } catch (err) {
      console.error("[interpret-constellation] Claude path failed, fixture fallback:", err);
    }
  }
  return fixtureRead(framework, members);
}
