import "server-only";
import { canUseAltar } from "./access";
import { addStrands, createElement, createReflection, getAltar, listReflections } from "./repo";
import { proposeStrands } from "./strands";
import { altarElements, RELATION_META } from "./model";
import { dueRitualFor } from "./rituals";
import { ritualSpec } from "./prompts";
import { constellationPulse } from "./constellations";
import { invitationForReply, markReplied } from "../invitations";

// The Living Altar over chat (Telegram now; transport-agnostic). Replying to an
// invitation IS reflecting: the reply becomes a sealed journal entry tied to the
// ritual, strands are proposed, and the person is shown them to confirm in-app.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ecodharma.vercel.app";

async function saveReflection(userId: string, text: string, opts: { cadence?: any; ritualId?: number | null } = {}): Promise<string> {
  const id = await createReflection(userId, { body: text, source: "telegram", cadence: opts.cadence || "spontaneous", ritual_id: opts.ritualId ?? null });
  const altar = await getAltar(userId);
  await addStrands(userId, id, await proposeStrands(text, altar));
  const saved = (await listReflections(userId, { limit: 1 }))[0];
  const title = new Map(altarElements(altar).map((e) => [e.lineage_id, e.title]));
  const strands = (saved?.strands || []).map((s) => `· ${RELATION_META[s.relation].label} — ${title.get(s.lineage_id)} (${s.charge > 0 ? "+" : ""}${s.charge})`);
  return [
    "Received and sealed in your journal. 🌱",
    strands.length ? `It seems to touch:\n${strands.join("\n")}` : "",
    `Confirm how it weaves into your altar: ${SITE}/journal?r=${id}`,
  ].filter(Boolean).join("\n\n");
}

export const ALTAR_HELP = [
  "Your Living Altar, here in chat:",
  "• Reply to any invitation — your reply becomes a journal entry.",
  "/reflect <words> — journal anything, any time",
  "/ritual — what reflection is due now, and its questions",
  "/prayer — read your prayer",
  "/inquiry <question> — open a living question",
  "/pulse — your Dharma Constellations",
  "Anything else: I'll reflect it back through your gifts.",
].join("\n");

/**
 * Handle altar-specific messages. Returns a reply, or null to fall through to
 * the general reflective companion.
 */
export async function handleAltarMessage(input: {
  userId: string;
  platformUserId: string;
  text: string;
  replyToMessageId?: string | null;
}): Promise<string | null> {
  const { userId, text } = input;
  const t = text.trim();
  if (!(await canUseAltar(userId))) return null;

  // Reply-to-reflect.
  if (input.replyToMessageId) {
    const inv = await invitationForReply(input.platformUserId, input.replyToMessageId);
    if (inv && inv.userId === userId && t) {
      const reply = await saveReflection(userId, t, { cadence: inv.cadence, ritualId: inv.ritualId });
      const latest = (await listReflections(userId, { limit: 1 }))[0];
      if (latest) await markReplied(inv.id, latest.id);
      return reply;
    }
  }

  const [cmd, ...rest] = t.split(/\s+/);
  const arg = rest.join(" ").trim();
  switch (cmd.toLowerCase().replace(/@\w+$/, "")) {
    case "/reflect":
      return arg ? saveReflection(userId, arg) : "Write it after the command, e.g. /reflect Today the land walk cleared my head.";
    case "/prayer": {
      const a = await getAltar(userId);
      return a.prayer ? `☉ Your prayer (ring ${a.prayer.version}):\n\n“${a.prayer.title}”` : `You haven't lit your altar yet — begin the Dharma Inquiry: ${SITE}/inquiry`;
    }
    case "/inquiry": {
      if (!arg) return "Write the question after the command, e.g. /inquiry What would it mean to rest without guilt?";
      const el = await createElement(userId, { kind: "inquiry", title: arg });
      return `? Inquiry opened — you'll find it among your living questions.\n“${el.title}”`;
    }
    case "/ritual": {
      const due = await dueRitualFor(userId);
      if (!due) return "Nothing is due right now. /reflect anything that's alive for you.";
      const a = await getAltar(userId);
      const spec = ritualSpec(due.cadence as any, due.label, { prayer: a.prayer?.title, works: a.works.map((w) => w.title) });
      return `⟲ ${due.label} — loop ${"I".repeat(due.depth)}\n${spec.opening}\n\n${spec.steps.map((s, i) => `${i + 1}. ${s.q}`).join("\n")}\n\nAnswer here with /reflect, or take the full ritual: ${SITE}/ritual/${due.cadence}?r=${due.id}`;
    }
    case "/pulse":
      return constellationPulse(userId);
    case "/altar":
    case "/help":
      return ALTAR_HELP;
    default:
      return null;
  }
}
