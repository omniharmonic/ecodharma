import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { withService } from "./db";
import { loadFramework } from "./framework";
import { claudeMode } from "./config";
import { clip } from "./interpret-fixture";
import { normalizeReading } from "./normalize-reading";
import { GENE_KEYS } from "./gene-keys";
import { sendEmail, emailEnabled, htmlEmail } from "./email";
import { unsubscribeToken } from "./unsubscribe";
import { getAltar, listReflections } from "./altar/repo";
import { altarElements, type Altar } from "./altar/model";
import {
  AUTHORITY_LINE, STRATEGY, checkContract, composeDeterministic, midSentence,
  type Cadence, type ContractResult, type Packet, type PacketItem,
} from "./invitation-core";

// Invitations — grounded, contract-checked prompts to reflect. Replaces the old
// weekly nudge (see invitation-core.ts for why). Flow:
//   buildPacket → Claude (dedicated prompt) → contract → [retry once] →
//   deterministic personalised fallback → persist (with refs) → deliver.

const MODEL = process.env.ECODHARMA_INVITE_MODEL || process.env.ECODHARMA_BOT_MODEL || "claude-sonnet-4-6";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://ecodharma.vercel.app";
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const words = (s: string, n: number) => s.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
// Distinctive anchor words from free text (≥5 letters, not stop-ish).
const STOP = new Set(["about", "their", "there", "which", "would", "could", "people", "things", "being", "really", "other", "where", "these", "those", "while"]);
const keyWords = (s: string, n = 3) =>
  [...new Set(s.toLowerCase().match(/\p{L}{5,}/gu) || [])].filter((w) => !STOP.has(w)).slice(0, n);

function altarItems(altar: Altar): PacketItem[] {
  const items: PacketItem[] = [];
  for (const e of altarElements(altar)) {
    if (e.kind === "thread" && e.status !== "accepted") continue;
    if (e.kind === "inquiry" && e.status === "integrated") continue;
    const anchors = [e.title, words(e.title, 4), ...(e.kind === "prayer" ? [words(e.title, 3)] : [])];
    items.push({ ref: `${e.kind}:${e.lineage_id}`, kind: e.kind, label: e.title, detail: clip(e.body || "", 140) || undefined, anchors });
  }
  return items;
}

export async function buildPacket(userId: string, opts: { cadence?: Cadence; depth?: 1 | 2 | 3; thresholdLabel?: string } = {}): Promise<Packet | null> {
  const base = await withService(async (c) => {
    const { rows } = await c.query(
      `select p.display_name, p.settings->'ikigai' as ikigai,
              (select content_json from gift_profiles g where g.user_id = p.id and g.status = 'ready' order by generated_at desc limit 1) as reading,
              (select raw_json from charts ch where ch.user_id = p.id and ch.modality = 'human_design') as hd,
              (select raw_json from charts ch where ch.user_id = p.id and ch.modality = 'western') as western,
              (select raw_json from charts ch where ch.user_id = p.id and ch.modality = 'gene_keys') as gk
         from profiles p where p.id = $1`,
      [userId],
    );
    const { rows: recent } = await c.query(
      "select body, refs from invitations where user_id = $1 order by sent_at desc limit 6", [userId]);
    return { row: rows[0], recent };
  });
  if (!base.row) return null;
  const { row, recent } = base;
  const fw = loadFramework();
  const items: PacketItem[] = [];

  // The altar first — it's the person's own words.
  let altar: Altar | null = null;
  try {
    altar = await getAltar(userId);
    items.push(...altarItems(altar));
  } catch (e) {
    console.error("[invitations] altar unavailable:", (e as Error).message);
  }

  // The reading: gifts, trim-tabs.
  if (row.reading) {
    const p = normalizeReading(row.reading);
    for (const g of p.gift_constellation.slice(0, 3)) {
      const name = fw.gifts.find((x) => x.id === g.gift_id)?.name || g.gift_id;
      items.push({ ref: `gift:${g.gift_id}`, kind: "gift", label: name, detail: clip(g.how_they_carry || "", 120) || undefined, anchors: [name.replace(/^The\s+/, "")] });
    }
    p.trim_tabs.slice(0, 3).forEach((t, i) => {
      if (!t.action) return;
      items.push({ ref: `trimtab:${t.trim_tab_id ?? i}`, kind: "trimtab", label: clip(t.action, 80), detail: clip(t.action, 200), anchors: [words(t.action, 5), words(t.action, 4)] });
    });
  }
  // The constitution as embodiment instruments (HD strategy + authority).
  const hd = row.hd as any;
  if (hd?.type && STRATEGY[hd.type]) items.push({ ref: "hd:type", kind: "hd", label: `${hd.type} strategy`, detail: STRATEGY[hd.type], anchors: [hd.type] });
  if (hd?.authority && AUTHORITY_LINE[hd.authority]) {
    items.push({ ref: "hd:authority", kind: "hd", label: `${hd.authority} authority`, detail: `Your ${hd.authority} authority: ${AUTHORITY_LINE[hd.authority]}`, anchors: [`${hd.authority} authority`] });
  }
  const lw = (row.gk as any)?.activation_sequence?.lifes_work;
  if (lw?.gate && GENE_KEYS[lw.gate]) {
    const n = GENE_KEYS[lw.gate];
    items.push({ ref: "gk:lifes_work", kind: "gk", label: `the gift of ${n.gift}`, detail: `Your Life's Work key carries the gift of ${n.gift}.`, anchors: [n.gift] });
  }
  const sun = (row.western as any)?.positions?.Sun?.sign;
  if (sun) items.push({ ref: "astro:sun", kind: "astro", label: `your ${sun} Sun`, detail: `With your Sun in ${sun}, let that light lead.`, anchors: [`${sun} Sun`, `Sun in ${sun}`] });
  const love = (row.ikigai as any)?.love;
  if (typeof love === "string" && love.trim()) {
    items.push({ ref: "ikigai:love", kind: "ikigai", label: clip(love.trim(), 80), anchors: keyWords(love) });
  }

  let lastReflection: string | undefined;
  try {
    lastReflection = (await listReflections(userId, { limit: 1 }))[0]?.body;
  } catch { /* journal not set up yet */ }

  return {
    firstName: (row.display_name || "").split(/\s+/)[0] || undefined,
    cadence: opts.cadence || "weekly",
    depth: opts.depth || 1,
    thresholdLabel: opts.thresholdLabel,
    items,
    lastReflection: lastReflection ? clip(lastReflection, 600) : undefined,
    recentBodies: recent.map((r: any) => r.body),
    recentRefs: recent.map((r: any) => (Array.isArray(r.refs) ? r.refs : [])),
  };
}

const SYSTEM = `You write ONE short invitation to reflect, for a person keeping a "Living Altar" — an ongoing practice of aligning their life with what it is in service to.

You are given a GROUNDING PACKET: things from this person's own world (their prayer, roots, works, practices, gifts, design). Write directly TO them (second person), warm and specific, 50–110 words:
- Name at least TWO packet items in their own words (use the exact names/phrases given).
- Match the depth: depth 1 = this week's lived practice; depth 2 = is the METHOD right, are the measures true; depth 3 = is the prayer itself still true, which roots are ready to compost.
- End with ONE open question they can answer by replying.
- Plain text. No greeting line like "Dear", no sign-off, no preamble, no lists, no quotation of these instructions.
- Never ask for more information. Never mention a packet, data, charts, or that you are an AI. If something seems missing, simply write from what IS there.
Output ONLY the invitation text.`;

function packetText(p: Packet): string {
  const lines = [
    `Cadence: ${p.cadence} (depth ${p.depth})${p.thresholdLabel ? ` — ${p.thresholdLabel}` : ""}`,
    p.firstName ? `First name: ${p.firstName}` : "",
    "Items (kind · name · context):",
    ...p.items.map((i) => `- ${i.kind} · ${i.label}${i.detail ? ` · ${i.detail}` : ""}`),
    p.lastReflection ? `Their most recent reflection (for continuity, don't quote at length): ${p.lastReflection}` : "",
    p.recentBodies.length ? `Recent invitations (do NOT repeat their shape or phrasing):\n${p.recentBodies.slice(0, 3).map((b) => `> ${clip(b, 200)}`).join("\n")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

async function claudeInvitation(p: Packet, feedback?: string): Promise<string | null> {
  if (!(await claudeMode()) || !process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: packetText(p) + (feedback ? `\n\nYour previous draft was rejected (${feedback}). Write a new one that fixes this.` : "") }],
      },
      { signal: AbortSignal.timeout(30_000) },
    );
    return msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("").trim() || null;
  } catch (e) {
    console.error("[invitations] claude failed:", (e as Error).message);
    return null;
  }
}

export type Composed = { body: string; refs: string[]; engine: "claude" | "det"; contract: ContractResult };

/** Compose a contract-passing invitation. Never returns ungrounded text. */
export async function composeInvitation(p: Packet): Promise<Composed> {
  let feedback: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const draft = await claudeInvitation(p, feedback);
    if (!draft) break;
    const contract = checkContract(draft, p);
    if (contract.ok) return { body: draft, refs: contract.refs, engine: "claude", contract };
    console.warn(`[invitations] claude draft failed contract: ${contract.failures.join(", ")}`);
    feedback = contract.failures.join("; ");
  }
  const det = composeDeterministic(p);
  return { ...det, engine: "det", contract: checkContract(det.body, p) };
}

async function telegramChatFor(userId: string): Promise<string | null> {
  return withService(async (c) => {
    const { rows } = await c.query("select platform_user_id from bot_accounts where platform = 'telegram' and user_id = $1 limit 1", [userId]);
    return (rows[0]?.platform_user_id as string) ?? null;
  });
}

async function sendTelegram(chatId: string, text: string): Promise<string | null> {
  if (!TELEGRAM_TOKEN) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const j = await r.json();
    return j?.ok ? String(j.result?.message_id) : null;
  } catch {
    return null;
  }
}

const SUBJECT: Record<Cadence, string> = {
  weekly: "Your weekly reflection",
  lunar: "A reflection for this moon",
  monthly: "Your monthly reflection",
  quarterly: "Your quarterly reflection",
  seasonal: "A threshold of the year",
  solar_return: "Your solar return",
  spontaneous: "An invitation to reflect",
};

/**
 * Compose, persist and deliver one invitation on each requested channel.
 * The body is NEVER sent unless it passed the grounding contract.
 */
export async function inviteUser(
  userId: string,
  opts: { cadence?: Cadence; depth?: 1 | 2 | 3; thresholdLabel?: string; ritualId?: number | null; channels?: string[]; email?: string } = {},
): Promise<{ body: string; engine: string; delivered: string[] } | null> {
  const packet = await buildPacket(userId, opts);
  if (!packet || packet.items.length < 2) return null; // nothing personal to ground in → send nothing
  const inv = await composeInvitation(packet);
  if (!inv.contract.ok) {
    console.error(`[invitations] refusing to send ungrounded invitation to ${userId}: ${inv.contract.failures.join(", ")}`);
    return null;
  }
  const channels = opts.channels?.length ? opts.channels : ["email"];
  const delivered: string[] = [];
  for (const channel of channels) {
    let platformId: string | null = null;
    let ok = false;
    if (channel === "email" && opts.email && emailEnabled()) {
      const unsub = `${SITE}/api/unsubscribe?u=${await unsubscribeToken(userId)}`;
      const subject = SUBJECT[packet.cadence] + (packet.thresholdLabel ? ` — ${packet.thresholdLabel}` : "");
      ok = await sendEmail({
        to: opts.email,
        subject,
        text: `${inv.body}\n\n—\nReflect at ${SITE}/journal\nUnsubscribe: ${unsub}`,
        html: htmlEmail({ heading: subject, body: inv.body, siteUrl: `${SITE}/journal`, unsubscribeUrl: unsub }),
        listUnsubscribe: unsub,
      });
    } else if (channel === "telegram") {
      const chat = await telegramChatFor(userId);
      if (chat) {
        platformId = await sendTelegram(chat, inv.body);
        ok = !!platformId;
      }
    }
    await withService((c) =>
      c.query(
        `insert into invitations (user_id, ritual_id, cadence, channel, body, refs, engine, contract, platform_message_id, delivered)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [userId, opts.ritualId ?? null, packet.cadence, channel, inv.body, JSON.stringify(inv.refs), inv.engine,
          JSON.stringify(inv.contract), platformId, ok],
      ));
    if (ok) delivered.push(channel);
  }
  return { body: inv.body, engine: inv.engine, delivered };
}

/** Latest invitation (for /settings + the dashboard). */
export async function latestInvitation(userId: string): Promise<{ body: string; created_at: Date } | null> {
  return withService(async (c) => {
    const { rows } = await c.query("select body, sent_at as created_at from invitations where user_id=$1 order by sent_at desc limit 1", [userId]);
    return (rows[0] as { body: string; created_at: Date } | undefined) ?? null;
  });
}

/** Match a Telegram reply to the invitation it answers. */
export async function invitationForReply(chatUserId: string, replyToMessageId: string) {
  return withService(async (c) => {
    const { rows } = await c.query(
      `select i.id, i.user_id, i.ritual_id, i.cadence from invitations i
         join bot_accounts b on b.user_id = i.user_id and b.platform = 'telegram' and b.platform_user_id = $1
        where i.channel = 'telegram' and i.platform_message_id = $2 limit 1`,
      [chatUserId, replyToMessageId],
    );
    return rows[0] ? { id: Number(rows[0].id), userId: rows[0].user_id as string, ritualId: rows[0].ritual_id ? Number(rows[0].ritual_id) : null, cadence: rows[0].cadence as Cadence } : null;
  });
}

export async function markReplied(invitationId: number, reflectionId: number) {
  await withService((c) => c.query("update invitations set reply_reflection_id = $2 where id = $1", [invitationId, reflectionId]));
}

export { midSentence };
