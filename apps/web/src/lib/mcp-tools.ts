import "server-only";
import { reflectForUser, readingSummaryForUser, constellationKinForUser } from "./bot";
import { loadFramework } from "./framework";
import { canUseAltar } from "./altar/access";
import {
  addAlignment, addStrands, createElement, createProposal, createReflection, getAltar, listReflections, reviewStrands, setStatus,
} from "./altar/repo";
import { proposeStrands } from "./altar/strands";
import { altarElements, isCadence, isKind, isRelation, KIND_META, LENSES, RELATIONS, type ElementKind } from "./altar/model";
import { dueRitualFor, getRitual } from "./altar/rituals";
import { ritualSpec } from "./altar/prompts";
import { loadSnapshot } from "./altar/snapshot";
import { lensTrend, loopState, strainedRoots, vitals } from "./altar/becoming";
import { assembleStory } from "./altar/story";
import { constellationPulse } from "./altar/constellations";
import { withUser } from "./db";

// The hosted MCP tool registry — the Living Altar, reachable from Claude.
// Governing rule: THE PERSON HOLDS THE PEN. Claude may read everything of the
// person's own, log reflections, and propose strands — but changes to the core
// of the altar (prayer, roots, measures, works…) are PROPOSALS the person accepts
// in the app. The only direct writes are ones the person makes in the chat by
// explicitly confirming (confirm_strands, open/update an inquiry they dictated).

type Json = Record<string, unknown>;
export type Tool = { name: string; description: string; inputSchema: Json; altar?: boolean; run: (userId: string, args: any) => Promise<string> };

const obj = (properties: Json, required: string[] = []) => ({ type: "object", properties, required });
const fmtDate = (s: string) => new Date(s).toISOString().slice(0, 10);

async function altarText(userId: string): Promise<string> {
  const a = await getAltar(userId);
  if (!a.prayer) return "This person hasn't kindled their altar yet. Invite them to visit /altar/kindle and write their prayer in their own words — do not write it for them.";
  const sec = (k: ElementKind, items: { lineage_id: number; title: string; status: string; body?: string }[]) =>
    items.length ? `\n${KIND_META[k].plural.toUpperCase()}:\n${items.map((e) => `- [${e.lineage_id}] ${e.title}${e.status !== "active" ? ` (${e.status})` : ""}${e.body ? ` — ${e.body.slice(0, 200)}` : ""}`).join("\n")}` : "";
  const f = a.prayer.facets || {};
  return [
    `PRAYER (ring ${a.prayer.version}) [${a.prayer.lineage_id}]: “${a.prayer.title}”`,
    f.for_whom ? `  for: ${f.for_whom}` : "", f.toward_what ? `  toward: ${f.toward_what}` : "", f.through_what ? `  through: ${f.through_what}` : "",
    sec("devotion", a.devotions), sec("root", a.roots), sec("work", a.works), sec("practice", a.practices),
    sec("measure", a.measures), sec("inquiry", a.inquiries), sec("thread", a.threads.filter((t) => t.status === "accepted")),
    a.prayerRings.length > 1 ? `\nPRAYER HISTORY:\n${a.prayerRings.map((r) => `- ring ${r.version} (${fmtDate(r.created_at)}): “${r.title}”`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

export const TOOLS: Tool[] = [
  // --- v3 tools (kept) ---
  {
    name: "my_reading",
    description: "The signed-in member's EcoDharma reading — their recognition, dominant archetypes, and portrait.",
    inputSchema: obj({}),
    run: async (u) => {
      const r = await readingSummaryForUser(u);
      if (!r) return "No reading yet — complete one at ecodharma first.";
      return `${r.recognition}\n\nArchetypes:\n${r.archetypes.map((a) => `- ${a.name}: ${a.how}`).join("\n")}\n\nPortrait:\n${r.portrait}`;
    },
  },
  {
    name: "reflect",
    description: "Reflect a thought, question, or situation back through the member's own gifts (constellation-aware). Returns a warm, specific reflection — never a verdict. Does NOT save anything; use log_reflection to journal.",
    inputSchema: obj({ message: { type: "string", description: "What's alive for you, or who you're trying to relate to." } }, ["message"]),
    run: async (u, a) => {
      const m = String(a.message || "").trim();
      return m ? reflectForUser(u, m) : "Tell me what's alive for you and I'll reflect it back.";
    },
  },
  {
    name: "my_constellations",
    description: "The people this member is woven with — their kin's gifts and the relational read beneath each connection. Consent-gated.",
    inputSchema: obj({}),
    run: async (u) => (await constellationKinForUser(u)) || "You're not woven with anyone yet.",
  },
  {
    name: "get_framework",
    description: "The EcoDharma gift framework — the archetypes and world-work domains used as the interpretive lens.",
    inputSchema: obj({}),
    run: async () => {
      const fw = loadFramework();
      return `EcoDharma gift framework (v${fw.framework_version}):\n${fw.gifts.map((g: any) => `${g.name} — ${g.essence || g.description || ""}`).join("\n")}`;
    },
  },

  // --- v4: the Living Altar ---
  {
    name: "get_altar",
    altar: true,
    description: "The person's Living Altar: their Prayer (what their life is in service to, with its history of versions), Devotions, Roots (foundational beliefs, with state held/questioning/composting/renewed), Works, Practices, Measures (signs of alignment), open Inquiries and accepted Threads. Element ids in [brackets] are used by other tools. Read this first in any reflection session.",
    inputSchema: obj({}),
    run: altarText,
  },
  {
    name: "get_ritual",
    altar: true,
    description: "What reflection is due now on the person's ritual calendar (weekly, lunar, monthly, quarterly, solstice/equinox, solar return), its loop depth (1 practice · 2 method/measures · 3 prayer/roots), and the tailored questions to ask. Suggest gathering evidence (their calendar, notes, projects) for the period before asking.",
    inputSchema: obj({}),
    run: async (u) => {
      const due = await dueRitualFor(u);
      const a = await getAltar(u);
      if (!due) return "Nothing is due right now — a spontaneous reflection is always welcome (log_reflection with cadence 'spontaneous').";
      const r = await getRitual(u, due.id);
      const spec = ritualSpec(due.cadence as any, due.label, { prayer: a.prayer?.title, works: a.works.map((w) => w.title), measures: a.measures.map((m) => m.title) });
      return [
        `DUE: ${due.label} (cadence ${due.cadence}, loop depth ${due.depth}${r?.done ? ", already completed" : ""}) · ritual_id ${due.id}`,
        spec.opening, "", "QUESTIONS:", ...spec.steps.map((s, i) => `${i + 1}. ${s.q}${s.hint ? ` (${s.hint})` : ""}`),
        spec.revisePrayer ? "\nThis is a triple-loop ritual: invite them to re-read their prayer and, if it has changed, propose a new version with propose_element_change (they accept it in the app)." : "",
        "\nWhen they've answered, save it with log_reflection (pass ritual_id) and show them the proposed strands to confirm.",
      ].join("\n");
    },
  },
  {
    name: "log_reflection",
    altar: true,
    description: "Save a journal reflection in the person's OWN words (sealed/encrypted at rest). Proposes strands — how it touches their altar elements — which you should show them and then confirm with confirm_strands once they agree. Optional five-lens alignment values 1–5. Use their words; you may lightly assemble them from the conversation, but never invent experiences.",
    inputSchema: obj({
      body: { type: "string", description: "The reflection text, in the person's words." },
      cadence: { type: "string", enum: ["weekly", "lunar", "monthly", "quarterly", "seasonal", "solar_return", "spontaneous"] },
      ritual_id: { type: "integer", description: "If answering a due ritual (from get_ritual)." },
      evidence: { type: "array", items: { type: "string" }, description: "Short references to evidence gathered (e.g. 'calendar: 11h on Foodshed this week')." },
      alignment: { type: "object", properties: Object.fromEntries(LENSES.map((l) => [l, { type: "integer", minimum: 1, maximum: 5 }])) },
    }, ["body"]),
    run: async (u, a) => {
      const body = String(a.body || "").trim();
      if (body.length < 3) return "A reflection needs some words.";
      const cadence = isCadence(a.cadence) ? a.cadence : "spontaneous";
      const id = await createReflection(u, { body, cadence, source: "mcp", ritual_id: Number(a.ritual_id) || null, evidence: Array.isArray(a.evidence) ? a.evidence.slice(0, 20) : [] });
      if (a.alignment && typeof a.alignment === "object") {
        await addAlignment(u, id, LENSES.filter((l) => a.alignment[l] != null).map((l) => ({ lens: l, value: Number(a.alignment[l]) })));
      }
      const altar = await getAltar(u);
      const proposed = await proposeStrands(body, altar);
      await addStrands(u, id, proposed);
      const saved = (await listReflections(u, { limit: 1 }))[0];
      const title = new Map(altarElements(altar).map((e) => [e.lineage_id, e.title]));
      return [
        `Saved reflection ${id} (sealed).`,
        saved?.strands.length ? "PROPOSED STRANDS (show the person; confirm with confirm_strands):" : "No strands were found.",
        ...(saved?.strands || []).map((s) => `- strand ${s.id}: ${s.relation} → [${s.lineage_id}] ${title.get(s.lineage_id)} (charge ${s.charge > 0 ? "+" : ""}${s.charge})${s.quote ? ` — “${s.quote}”` : ""}`),
      ].join("\n");
    },
  },
  {
    name: "confirm_strands",
    altar: true,
    description: "After the person agrees, confirm, reject, or adjust proposed strands (by strand id). Only call this with their explicit say-so.",
    inputSchema: obj({
      confirm: { type: "array", items: { type: "integer" } },
      reject: { type: "array", items: { type: "integer" } },
      edits: { type: "array", items: obj({ id: { type: "integer" }, relation: { type: "string", enum: [...RELATIONS] }, charge: { type: "integer", minimum: -2, maximum: 2 } }, ["id"]) },
    }),
    run: async (u, a) => {
      await reviewStrands(u, {
        confirm: (a.confirm || []).map(Number), reject: (a.reject || []).map(Number),
        edits: (a.edits || []).filter((e: any) => !e.relation || isRelation(e.relation)).map((e: any) => ({ id: Number(e.id), relation: e.relation, charge: e.charge })),
      });
      return "Done — woven into the altar.";
    },
  },
  {
    name: "list_reflections",
    altar: true,
    description: "The person's journal: reflections (their words), with strands and alignment, filterable by date range, element id, or cadence.",
    inputSchema: obj({
      since: { type: "string", description: "ISO date" }, until: { type: "string", description: "ISO date" },
      element_id: { type: "integer" }, cadence: { type: "string" }, limit: { type: "integer", maximum: 100 },
    }),
    run: async (u, a) => {
      const rs = await listReflections(u, { since: a.since, until: a.until, lineageId: a.element_id ? Number(a.element_id) : undefined, cadence: isCadence(a.cadence) ? a.cadence : undefined, limit: Math.min(100, Number(a.limit) || 20) });
      const altar = await getAltar(u);
      const title = new Map(altarElements(altar).map((e) => [e.lineage_id, e.title]));
      if (!rs.length) return "No reflections in that range.";
      return rs.map((r) => [
        `— ${fmtDate(r.created_at)} · ${r.cadence} · loop ${r.depth} · via ${r.source} (id ${r.id})`,
        r.body,
        r.strands.filter((s) => s.status !== "rejected").map((s) => `  ⟿ ${s.relation} ${title.get(s.lineage_id) || "(composted)"} (${s.charge > 0 ? "+" : ""}${s.charge}, ${s.status})`).join("\n"),
        r.alignment.filter((x) => x.value != null).map((x) => `  ${x.lens}: ${x.value}/5`).join("\n"),
      ].filter(Boolean).join("\n")).join("\n\n");
    },
  },
  {
    name: "open_inquiry",
    altar: true,
    description: "Open a living question the person wants to hold over time (e.g. 'What would it mean to be sustained without hustle?'). Use their words. Optionally link it to the root it interrogates and set that root to 'questioning'.",
    inputSchema: obj({ question: { type: "string" }, root_id: { type: "integer", description: "the root this questions (optional)" } }, ["question"]),
    run: async (u, a) => {
      const q = String(a.question || "").trim();
      if (!q) return "What's the question?";
      const el = await createElement(u, { kind: "inquiry", title: q });
      if (a.root_id) {
        const { linkElements } = await import("./altar/repo");
        await linkElements(u, el.lineage_id, Number(a.root_id), "questions");
        try { await setStatus(u, Number(a.root_id), "questioning", "inquiry opened via Claude"); } catch { /* not a root */ }
      }
      return `Inquiry opened [${el.lineage_id}]: ${q}`;
    },
  },
  {
    name: "update_inquiry",
    altar: true,
    description: "Move an inquiry along its life: opened → living → integrated (with an integration note in their words).",
    inputSchema: obj({ inquiry_id: { type: "integer" }, status: { type: "string", enum: ["opened", "living", "integrated"] }, note: { type: "string" } }, ["inquiry_id", "status"]),
    run: async (u, a) => {
      const el = await setStatus(u, Number(a.inquiry_id), String(a.status), a.note ? String(a.note) : undefined);
      return `Inquiry [${el.lineage_id}] is now ${el.status}.`;
    },
  },
  {
    name: "propose_element_change",
    altar: true,
    description: "PROPOSE (never apply) a change to the person's altar: a new version of the Prayer, a new Work/Practice/Measure/Devotion/Root, or a Root's state (held/questioning/composting/renewed). The person accepts or declines it on their altar page. Always explain why, in their own terms.",
    inputSchema: obj({
      element_id: { type: "integer", description: "existing element to change (omit to propose a new one)" },
      kind: { type: "string", enum: ["prayer", "devotion", "root", "work", "practice", "measure", "inquiry"] },
      title: { type: "string", description: "new title / new prayer text" },
      status: { type: "string", description: "for roots: held | questioning | composting | renewed" },
      rationale: { type: "string" },
    }, ["kind"]),
    run: async (u, a) => {
      if (!isKind(a.kind)) return "Unknown kind.";
      const change: Record<string, unknown> = {};
      if (a.title) change.title = String(a.title).slice(0, 500);
      if (a.status) change.status = String(a.status);
      if (!Object.keys(change).length) return "Nothing to propose.";
      const id = await createProposal(u, { lineage_id: a.element_id ? Number(a.element_id) : null, kind: a.kind, change, rationale: a.rationale, source: "mcp" });
      return `Proposal ${id} is waiting on their altar page for them to accept or decline. (You can't apply it — they hold the pen.)`;
    },
  },
  {
    name: "get_becoming",
    altar: true,
    description: "The person's becoming in numbers and patterns: per-element vital signs (touches, mean charge, aliveness/fidelity), the three learning loops and when each was last walked, roots under strain, five-lens trends. Use it to notice patterns and ask better questions — never to grade them.",
    inputSchema: obj({}),
    run: async (u) => {
      const snap = await loadSnapshot(u);
      const now = Date.parse(snap.now);
      const v = vitals(snap.elements, snap.strands, snap.alignment, now);
      const loops = loopState(snap.reflections, now);
      const strained = strainedRoots(snap.elements, snap.strands, now);
      const title = new Map(snap.elements.map((e) => [e.lineage_id, `${KIND_META[e.kind].label}: ${e.title}`]));
      const lines = [
        `LOOPS: practice last ${loops.single.last ? fmtDate(loops.single.last) : "never"} (${loops.single.count90} in 90d) · method ${loops.double.last ? fmtDate(loops.double.last) : "never"} · prayer ${loops.triple.last ? fmtDate(loops.triple.last) : "never"} · pulse ${Math.round(loops.pulse * 100)}/100`,
        strained.length ? `ROOTS UNDER STRAIN (≥3 strains in 60d): ${strained.map((id) => title.get(id)).join("; ")}` : "",
        "ELEMENT VITALS (90d):",
        ...[...v.values()].filter((x) => x.touches > 0).sort((a, b) => b.recentTouches - a.recentTouches).map((x) =>
          `- ${title.get(x.lineage_id)} — ${x.recentTouches} touches, mean charge ${x.charge.toFixed(1)}${x.aliveness ? `, aliveness ${x.aliveness.toFixed(1)}` : ""}${x.strain ? `, ${x.strain} strains` : ""}`),
        ...LENSES.map((l) => { const t = lensTrend(snap.alignment, l); return t.length ? `${l}: ${t.map((p) => p.value).join(" → ")}` : ""; }),
      ];
      return lines.filter(Boolean).join("\n");
    },
  },
  {
    name: "assemble_story",
    altar: true,
    description: "The story of a period (a season, a year, since a solar return) assembled from the person's own words: most alive moments, strains, what they questioned and released, how the prayer and roots changed. Defaults to the last 90 days.",
    inputSchema: obj({ since: { type: "string" }, until: { type: "string" } }),
    run: async (u, a) => {
      const until = a.until || new Date().toISOString();
      const since = a.since || new Date(Date.parse(until) - 90 * 86_400_000).toISOString();
      return (await assembleStory(u, since, until)).markdown;
    },
  },
  {
    name: "constellation_pulse",
    altar: true,
    description: "What the person's Dharma Constellations are sharing: reflections members have chosen to offer, accountability partners' ritual completions, and witness notes. Consent-gated.",
    inputSchema: obj({}),
    run: async (u) => constellationPulse(u),
  },
];

export async function runTool(userId: string, name: string, args: any): Promise<string> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`Unknown tool: ${name}`);
  if (t.altar && !(await canUseAltar(userId))) return "The Living Altar isn't enabled for this account yet.";
  return t.run(userId, args || {});
}

export const toolList = () => TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

export async function hasAltar(userId: string): Promise<boolean> {
  return withUser(userId, async (c) => ((await c.query("select 1 from altar_elements where user_id = auth.uid() limit 1")).rowCount ?? 0) > 0);
}
