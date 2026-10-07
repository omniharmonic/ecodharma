// Ritual prompt sets — the questions each cadence asks, at its loop depth,
// personalised with the person's own altar and design. Pure.

import type { Cadence } from "./cycles";
import { seasonOf } from "./cycles";

export type PromptCtx = {
  prayer?: string;
  hdType?: string;
  authority?: string;
  works?: string[];
  roots?: string[];
  measures?: string[];
  hemisphere?: "N" | "S";
  /** One Dharma Inquiry question to return to ("an ongoing and unending inquiry"). */
  inquiry?: { id: string; q: string; prior?: string };
};

export type RitualStep = { id: string; q: string; hint?: string };
export type RitualSpec = { title: string; depth: 1 | 2 | 3; opening: string; steps: RitualStep[]; revisePrayer: boolean; reviewRoots: boolean };

const STRATEGY_Q: Record<string, string> = {
  Generator: "Where did you wait for something to respond to — and where did you push without a yes?",
  "Manifesting Generator": "Where did you respond first and inform before leaping — and where did you skip a step?",
  Manifestor: "Who did you inform before you moved — and who was surprised by your wake?",
  Projector: "Where were you truly invited — and where did you spend yourself uninvited?",
  Reflector: "What did the month's turning reveal that a quick decision would have missed?",
};

const PRETTY: Record<Cadence, string> = {
  weekly: "Weekly reflection", lunar: "Lunar reflection", monthly: "Monthly reflection",
  quarterly: "Quarterly reflection", seasonal: "Threshold of the year", solar_return: "Solar return",
};
const unpunct = (s?: string) => (s || "").trim().replace(/[.!?…]+$/, "");

export function ritualSpec(cadence: Cadence, rawLabel: string, ctx: PromptCtx): RitualSpec {
  const spec = baseSpec(cadence, rawLabel, ctx);
  if (spec.depth >= 2 && cadence !== "monthly" && ctx.inquiry) {
    const prior = ctx.inquiry.prior ? `Last time you wrote: “${unpunct(ctx.inquiry.prior).slice(0, 220)}.” What is true now?` : "Return to the Dharma Inquiry with this one.";
    spec.steps.push({ id: "return", q: ctx.inquiry.q, hint: prior });
  }
  return spec;
}

function baseSpec(cadence: Cadence, rawLabel: string, ctx: PromptCtx): RitualSpec {
  const label = !rawLabel || rawLabel === cadence ? PRETTY[cadence] : rawLabel;
  const work = ctx.works?.[0];
  const strategy = (ctx.hdType && STRATEGY_Q[ctx.hdType]) || "Where did you move with your design — and where against it?";
  switch (cadence) {
    case "weekly":
      return {
        title: "Weekly reflection", depth: 1, revisePrayer: false, reviewRoots: false,
        opening: "Single loop — am I living what I said I'm for? Ten honest minutes.",
        steps: [
          { id: "alive", q: "Which moment this week most felt like your prayer in motion?" },
          { id: "drain", q: work ? `Which work drained you — ${work}, or another? Was it the work, or the way?` : "Which work drained you — was it the work, or the way?" },
          { id: "design", q: strategy, hint: ctx.authority ? `Your ${ctx.authority} authority is the instrument here.` : undefined },
          { id: "next", q: "One small act for the week ahead that only you would think to do." },
        ],
      };
    case "lunar":
      return {
        title: label, depth: 1, revisePrayer: false, reviewRoots: false,
        opening: label.startsWith("New") ? "The dark of the moon — what are you planting?" : "The moon is full — what is ripening, ready to be seen?",
        steps: label.startsWith("New")
          ? [{ id: "seed", q: "What intention do you plant in the dark this cycle?" }, { id: "soil", q: "What does it need from you to take root?" }]
          : [{ id: "ripe", q: "What has ripened since the new moon?" }, { id: "share", q: "Who should see it?" }],
      };
    case "monthly":
      return {
        title: label, depth: 2, revisePrayer: false, reviewRoots: false,
        opening: "Double loop — not just what you did, but whether your way of doing it, and your way of measuring it, is still true.",
        steps: [
          { id: "pattern", q: "Looking across the month, what pattern do you see in where you came alive and where you contracted?" },
          { id: "measures", q: ctx.measures?.length ? `Are your signs of alignment still telling the truth? (${ctx.measures.slice(0, 3).join(" · ")})` : "What would tell you — honestly — that you're aligned? Name a sign." },
          { id: "method", q: "Is there a way of working you keep repeating that no longer serves the prayer?" },
        ],
      };
    case "quarterly":
      return {
        title: label, depth: 2, revisePrayer: false, reviewRoots: false,
        opening: "Three months of your becoming. Tend the paths: start, tend, release.",
        steps: [
          { id: "start", q: "What path wants to begin — that you've been circling?" },
          { id: "tend", q: ctx.works?.length ? `Of your works (${ctx.works.slice(0, 4).join(" · ")}), which needs more of you?` : "Which path needs more of you?" },
          { id: "release", q: "Which path would you not choose again, knowing what you know now? What would releasing it free?" },
        ],
      };
    case "seasonal": {
      const season = seasonOf(label) || "Winter Solstice";
      const steps: Record<string, RitualStep[]> = {
        "Spring Equinox": [
          { id: "seed", q: "Light and dark are balanced. What seed of your prayer is ready to be planted this half of the year?" },
          { id: "root", q: "Which belief beneath it do you want to plant consciously — or uproot?" },
        ],
        "Summer Solstice": [
          { id: "flower", q: "The longest light. Where is your prayer in full flower? Let yourself see it." },
          { id: "shade", q: "What has grown in its shadow that needs tending?" },
        ],
        "Autumn Equinox": [
          { id: "harvest", q: "What has this year's work borne? Name the harvest — and give thanks for it." },
          { id: "release", q: "What will you let fall, like leaves, so the tree can rest?" },
        ],
        "Winter Solstice": [
          { id: "compost", q: "The longest night. What in you — a habit, a belief, a role — is ready to be composted?" },
          { id: "dream", q: "In the dark before return: what is your life for now?" },
        ],
      };
      return {
        title: label, depth: 3, revisePrayer: true, reviewRoots: true,
        opening: "Triple loop — the prayer itself, and the roots it stands on. Read your prayer aloud before you begin.",
        steps: [...steps[season], { id: "prayer", q: ctx.prayer ? `Your prayer: “${unpunct(ctx.prayer)}.” Is it still true? What would you change?` : "Is your prayer still true?" }],
      };
    }
    case "solar_return":
      return {
        title: label, depth: 3, revisePrayer: true, reviewRoots: true,
        opening: "The Sun has returned to where you began. Another ring on the tree.",
        steps: [
          { id: "become", q: "Who has this year made you?" },
          { id: "gift", q: "What did you give that only you could have given?" },
          { id: "vow", q: "What do you vow — or un-vow — for the year ahead?" },
        ],
      };
  }
}

/** Fold the step answers into one reflection body (Q/A pairs). */
export function composeRitualBody(spec: RitualSpec, answers: Record<string, string>): string {
  return spec.steps
    .filter((s) => (answers[s.id] || "").trim())
    .map((s) => `${s.q}\n${answers[s.id].trim()}`)
    .join("\n\n");
}
