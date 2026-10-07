import "server-only";
import type { PoolClient } from "pg";
import { withUser, withService } from "../db";
import { decOpt, encOpt, encrypt } from "../crypto";
import {
  type Altar, type AltarElement, type ConstitutionRef, type ElementKind, type ExternalRef, type Reflection,
  type Relation, type Strand, type Cadence,
  CADENCE_DEPTH, clampCharge, defaultStatus, groupAltar, isRelation, validStatus,
} from "./model";

// Data access for the Living Altar. Every function takes the acting user's id and
// runs under RLS (withUser) — the person's own rows only. Trusted server paths
// (cron, bot, hosted MCP) call the SAME functions; they already resolved the
// user, and the owner-only policies still bind every query to that user.

type Row = Record<string, any>;

function toElement(r: Row): AltarElement {
  return {
    id: Number(r.id),
    lineage_id: Number(r.lineage_id ?? r.id),
    version: r.version,
    kind: r.kind,
    title: r.title,
    body: decOpt(r.body_enc),
    facets: r.facets || {},
    status: r.status,
    constitution_refs: r.constitution_refs || [],
    external_refs: r.external_refs || [],
    created_at: new Date(r.created_at).toISOString(),
    retired_at: r.retired_at ? new Date(r.retired_at).toISOString() : null,
  };
}

const LIVE = "user_id = auth.uid() and superseded_at is null";

export async function getAltar(userId: string): Promise<Altar> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query(`select * from altar_elements where ${LIVE} order by kind, created_at`);
    const { rows: rings } = await c.query(
      "select * from altar_elements where user_id = auth.uid() and kind = 'prayer' order by version",
    );
    return groupAltar(rows.map(toElement), rings.map(toElement));
  });
}

export async function getElement(userId: string, lineageId: number): Promise<AltarElement | null> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query(`select * from altar_elements where ${LIVE} and lineage_id = $1`, [lineageId]);
    return rows[0] ? toElement(rows[0]) : null;
  });
}

export async function elementHistory(userId: string, lineageId: number) {
  return withUser(userId, async (c) => {
    const { rows: versions } = await c.query(
      "select * from altar_elements where user_id = auth.uid() and lineage_id = $1 order by version", [lineageId]);
    const { rows: events } = await c.query(
      "select event, note_enc, at from element_events where user_id = auth.uid() and lineage_id = $1 order by at", [lineageId]);
    return {
      versions: versions.map(toElement),
      events: events.map((e) => ({ event: e.event as string, note: decOpt(e.note_enc), at: new Date(e.at).toISOString() })),
    };
  });
}

async function logEvent(c: PoolClient, userId: string, lineageId: number, event: string, note?: string) {
  await c.query("insert into element_events (user_id, lineage_id, event, note_enc) values ($1,$2,$3,$4)",
    [userId, lineageId, event, encOpt(note)]);
}

export type NewElement = {
  kind: ElementKind;
  title: string;
  body?: string;
  facets?: Record<string, string>;
  status?: string;
  constitution_refs?: ConstitutionRef[];
  external_refs?: ExternalRef[];
};

export async function createElement(userId: string, e: NewElement): Promise<AltarElement> {
  const title = e.title.trim().slice(0, 500);
  if (!title) throw new Error("An altar element needs a title.");
  const status = e.status && validStatus(e.kind, e.status) ? e.status : defaultStatus(e.kind);
  return withUser(userId, async (c) => {
    if (e.kind === "prayer") {
      // One living prayer: a "new" prayer is a revision of the existing one.
      const { rows } = await c.query(`select lineage_id from altar_elements where ${LIVE} and kind='prayer' and retired_at is null`);
      if (rows[0]) return reviseIn(c, userId, Number(rows[0].lineage_id), { title, body: e.body, facets: e.facets });
    }
    const { rows } = await c.query(
      `insert into altar_elements (user_id, kind, title, body_enc, facets, status, constitution_refs, external_refs)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [userId, e.kind, title, encOpt(e.body), e.facets || {}, status,
        JSON.stringify(e.constitution_refs || []), JSON.stringify(e.external_refs || [])],
    );
    const id = Number(rows[0].id);
    const { rows: done } = await c.query("update altar_elements set lineage_id = $1 where id = $1 returning *", [id]);
    await logEvent(c, userId, id, "created");
    return toElement(done[0]);
  });
}

async function reviseIn(
  c: PoolClient, userId: string, lineageId: number,
  change: { title?: string; body?: string; facets?: Record<string, string>; constitution_refs?: ConstitutionRef[]; external_refs?: ExternalRef[] },
  note?: string,
): Promise<AltarElement> {
  const { rows } = await c.query(`select * from altar_elements where ${LIVE} and lineage_id = $1 for update`, [lineageId]);
  const cur = rows[0];
  if (!cur) throw new Error("That altar element doesn't exist.");
  await c.query("update altar_elements set superseded_at = now() where id = $1", [cur.id]);
  const { rows: next } = await c.query(
    `insert into altar_elements (user_id, kind, lineage_id, version, title, body_enc, facets, status, constitution_refs, external_refs, retired_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [userId, cur.kind, lineageId, cur.version + 1,
      (change.title ?? cur.title).trim().slice(0, 500),
      change.body !== undefined ? encOpt(change.body) : cur.body_enc,
      change.facets ?? cur.facets, cur.status,
      JSON.stringify(change.constitution_refs ?? cur.constitution_refs),
      JSON.stringify(change.external_refs ?? cur.external_refs), cur.retired_at],
  );
  await logEvent(c, userId, lineageId, "revised", note);
  return toElement(next[0]);
}

/** Append a new version (tree ring). */
export async function reviseElement(userId: string, lineageId: number, change: Parameters<typeof reviseIn>[3], note?: string) {
  return withUser(userId, (c) => reviseIn(c, userId, lineageId, change, note));
}

/** Status changes (root held→questioning→composting/renewed, inquiry opened→integrated…). In place + logged. */
export async function setStatus(userId: string, lineageId: number, status: string, note?: string): Promise<AltarElement> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query(`select * from altar_elements where ${LIVE} and lineage_id = $1`, [lineageId]);
    const cur = rows[0];
    if (!cur) throw new Error("That altar element doesn't exist.");
    if (!validStatus(cur.kind, status)) throw new Error(`"${status}" isn't a valid state for a ${cur.kind}.`);
    const { rows: out } = await c.query("update altar_elements set status = $2 where id = $1 returning *", [cur.id, status]);
    await logEvent(c, userId, lineageId, `status:${status}`, note);
    return toElement(out[0]);
  });
}

/** Compost (retire) — history is kept and drawn as decomposition, never deleted. */
export async function compostElement(userId: string, lineageId: number, note?: string) {
  return withUser(userId, async (c) => {
    await c.query(`update altar_elements set retired_at = now() where ${LIVE} and lineage_id = $1`, [lineageId]);
    await logEvent(c, userId, lineageId, "composted", note);
  });
}

export async function linkElements(userId: string, from: number, to: number, relation: string) {
  return withUser(userId, (c) =>
    c.query("insert into element_links (user_id, from_lineage, to_lineage, relation) values ($1,$2,$3,$4) on conflict do nothing",
      [userId, from, to, relation]));
}

export async function listLinks(userId: string): Promise<{ from: number; to: number; relation: string }[]> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query("select from_lineage, to_lineage, relation from element_links where user_id = auth.uid()");
    return rows.map((r) => ({ from: Number(r.from_lineage), to: Number(r.to_lineage), relation: r.relation }));
  });
}

// ---------------------------------------------------------------- journal ----

export type NewReflection = {
  body: string;
  cadence?: Cadence;
  source?: Reflection["source"];
  ritual_id?: number | null;
  evidence?: unknown[];
};

export async function createReflection(userId: string, r: NewReflection): Promise<number> {
  const body = r.body.trim();
  if (!body) throw new Error("A reflection needs some words.");
  const cadence = r.cadence || "spontaneous";
  return withUser(userId, async (c) => {
    const { rows } = await c.query(
      `insert into reflections (user_id, cadence, depth, source, body_enc, evidence, ritual_id)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [userId, cadence, CADENCE_DEPTH[cadence] ?? 1, r.source || "web", encrypt(body), JSON.stringify(r.evidence || []), r.ritual_id ?? null],
    );
    const id = Number(rows[0].id);
    if (r.ritual_id) {
      await c.query("update rituals set completed_reflection_id = $2 where id = $1 and user_id = auth.uid() and completed_reflection_id is null", [r.ritual_id, id]);
    }
    return id;
  });
}

export type ProposedStrand = { lineage_id: number; relation: Relation; charge: number; quote: string; proposed_by: Strand["proposed_by"] };

export async function addStrands(userId: string, reflectionId: number, strands: ProposedStrand[], status: Strand["status"] = "proposed") {
  if (!strands.length) return;
  await withUser(userId, async (c) => {
    // Only link to elements the person actually owns.
    const { rows } = await c.query(`select lineage_id from altar_elements where ${LIVE}`);
    const owned = new Set(rows.map((r) => Number(r.lineage_id)));
    for (const s of strands) {
      if (!owned.has(s.lineage_id) || !isRelation(s.relation)) continue;
      await c.query(
        `insert into strands (user_id, reflection_id, lineage_id, relation, charge, quote_enc, proposed_by, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [userId, reflectionId, s.lineage_id, s.relation, clampCharge(s.charge), encOpt(s.quote), s.proposed_by, status],
      );
    }
  });
}

export async function reviewStrands(
  userId: string,
  decisions: { confirm?: number[]; reject?: number[]; edits?: { id: number; relation?: Relation; charge?: number }[] },
) {
  await withUser(userId, async (c) => {
    if (decisions.confirm?.length) await c.query("update strands set status='confirmed' where user_id = auth.uid() and id = any($1)", [decisions.confirm]);
    if (decisions.reject?.length) await c.query("update strands set status='rejected' where user_id = auth.uid() and id = any($1)", [decisions.reject]);
    for (const e of decisions.edits || []) {
      await c.query(
        `update strands set relation = coalesce($2, relation), charge = coalesce($3, charge), status='confirmed', proposed_by='person'
          where user_id = auth.uid() and id = $1`,
        [e.id, e.relation && isRelation(e.relation) ? e.relation : null, e.charge === undefined ? null : clampCharge(e.charge)],
      );
    }
  });
}

export async function addAlignment(
  userId: string, reflectionId: number,
  readings: { lineage_id?: number | null; lens: string; value?: number | null; note?: string }[],
) {
  if (!readings.length) return;
  await withUser(userId, async (c) => {
    for (const a of readings) {
      const v = a.value == null ? null : Math.max(1, Math.min(5, Math.round(a.value)));
      if (v == null && !a.note?.trim()) continue;
      await c.query(
        "insert into alignment_readings (user_id, reflection_id, lineage_id, lens, value, note_enc) values ($1,$2,$3,$4,$5,$6)",
        [userId, reflectionId, a.lineage_id ?? null, a.lens.slice(0, 64), v, encOpt(a.note?.trim())],
      );
    }
  });
}

export async function listReflections(
  userId: string,
  opts: { limit?: number; since?: string; until?: string; lineageId?: number; relation?: Relation; cadence?: Cadence } = {},
): Promise<Reflection[]> {
  return withUser(userId, async (c) => {
    const where = ["r.user_id = auth.uid()"];
    const args: unknown[] = [];
    const p = (v: unknown) => (args.push(v), `$${args.length}`);
    if (opts.since) where.push(`r.created_at >= ${p(opts.since)}`);
    if (opts.until) where.push(`r.created_at < ${p(opts.until)}`);
    if (opts.cadence) where.push(`r.cadence = ${p(opts.cadence)}`);
    if (opts.lineageId || opts.relation) {
      where.push(`exists (select 1 from strands s where s.reflection_id = r.id and s.status <> 'rejected'
        ${opts.lineageId ? `and s.lineage_id = ${p(opts.lineageId)}` : ""} ${opts.relation ? `and s.relation = ${p(opts.relation)}` : ""})`);
    }
    const { rows } = await c.query(
      `select * from reflections r where ${where.join(" and ")} order by r.created_at desc limit ${p(Math.min(opts.limit ?? 50, 500))}`, args);
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const { rows: st } = await c.query("select * from strands where user_id = auth.uid() and reflection_id = any($1) order by id", [ids]);
    const { rows: al } = await c.query("select * from alignment_readings where user_id = auth.uid() and reflection_id = any($1) order by id", [ids]);
    return rows.map((r) => ({
      id: Number(r.id),
      cadence: r.cadence,
      depth: r.depth,
      source: r.source,
      body: decOpt(r.body_enc),
      created_at: new Date(r.created_at).toISOString(),
      ritual_id: r.ritual_id ? Number(r.ritual_id) : null,
      strands: st.filter((s) => s.reflection_id === r.id).map((s) => ({
        id: Number(s.id), reflection_id: Number(s.reflection_id), lineage_id: Number(s.lineage_id), relation: s.relation,
        charge: s.charge, quote: decOpt(s.quote_enc), proposed_by: s.proposed_by, status: s.status,
      })),
      alignment: al.filter((a) => a.reflection_id === r.id).map((a) => ({
        lineage_id: a.lineage_id ? Number(a.lineage_id) : null, lens: a.lens, value: a.value, note: decOpt(a.note_enc),
      })),
    }));
  });
}

// --------------------------------------------------------------- proposals ---

export async function createProposal(
  userId: string,
  p: { lineage_id?: number | null; kind: ElementKind; change: Record<string, unknown>; rationale?: string; source?: string },
): Promise<number> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query(
      "insert into altar_proposals (user_id, lineage_id, kind, change, rationale, source) values ($1,$2,$3,$4,$5,$6) returning id",
      [userId, p.lineage_id ?? null, p.kind, JSON.stringify(p.change), p.rationale?.slice(0, 2000) ?? null, p.source || "mcp"],
    );
    return Number(rows[0].id);
  });
}

export async function listProposals(userId: string) {
  return withUser(userId, async (c) => {
    const { rows } = await c.query("select * from altar_proposals where user_id = auth.uid() and status = 'pending' order by created_at");
    return rows.map((r) => ({ id: Number(r.id), lineage_id: r.lineage_id ? Number(r.lineage_id) : null, kind: r.kind as ElementKind, change: r.change, rationale: r.rationale as string | null, source: r.source as string, created_at: new Date(r.created_at).toISOString() }));
  });
}

/** Apply a pending proposal — ONLY ever called from an explicit acceptance by the person. */
export async function decideProposal(userId: string, id: number, accept: boolean): Promise<AltarElement | null> {
  const p = (await listProposals(userId)).find((x) => x.id === id);
  if (!p) throw new Error("That proposal isn't pending.");
  let out: AltarElement | null = null;
  if (accept) {
    const ch = p.change as { title?: string; body?: string; status?: string; facets?: Record<string, string> };
    if (p.lineage_id) {
      if (ch.title !== undefined || ch.body !== undefined || ch.facets) out = await reviseElement(userId, p.lineage_id, ch, "accepted proposal");
      if (ch.status) out = await setStatus(userId, p.lineage_id, ch.status, "accepted proposal");
    } else {
      out = await createElement(userId, { kind: p.kind, title: ch.title || "Untitled", body: ch.body, facets: ch.facets, status: ch.status });
    }
  }
  await withUser(userId, (c) =>
    c.query("update altar_proposals set status = $2, decided_at = now() where id = $1 and user_id = auth.uid()", [id, accept ? "accepted" : "declined"]));
  return out;
}

// ------------------------------------------------------------- ritual prefs --

export type RitualPrefs = { weekly_dow: number; local_hour: number; tz: string; channels: string[]; lunar: boolean; hemisphere: "N" | "S" };

export async function getRitualPrefs(userId: string): Promise<RitualPrefs | null> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query("select * from ritual_prefs where user_id = auth.uid()");
    return (rows[0] as RitualPrefs | undefined) ?? null;
  });
}

export async function setRitualPrefs(userId: string, p: Partial<RitualPrefs>) {
  await withUser(userId, (c) =>
    c.query(
      `insert into ritual_prefs (user_id, weekly_dow, local_hour, tz, channels, lunar, hemisphere)
       values ($1, coalesce($2::smallint,0), coalesce($3::smallint,18), coalesce($4::text,'UTC'), coalesce($5::text[],'{email}'), coalesce($6::boolean,false), coalesce($7::text,'N'))
       on conflict (user_id) do update set
         weekly_dow = coalesce($2::smallint, ritual_prefs.weekly_dow), local_hour = coalesce($3::smallint, ritual_prefs.local_hour),
         tz = coalesce($4::text, ritual_prefs.tz), channels = coalesce($5::text[], ritual_prefs.channels),
         lunar = coalesce($6::boolean, ritual_prefs.lunar), hemisphere = coalesce($7::text, ritual_prefs.hemisphere), updated_at = now()`,
      [userId, p.weekly_dow ?? null, p.local_hour ?? null, p.tz ?? null, p.channels ?? null, p.lunar ?? null, p.hemisphere ?? null],
    ));
}

/** Everyone with an altar (for cron). Service role — returns ids only. */
export async function altarKeepers(): Promise<string[]> {
  return withService(async (c) => {
    const { rows } = await c.query("select distinct user_id from altar_elements where superseded_at is null and retired_at is null");
    return rows.map((r) => r.user_id as string);
  });
}

/** Persist newly noticed threads as PROPOSED thread elements (deduped by signature, incl. dismissed ones). */
export async function refreshThreads(userId: string, proposals: { signature: string; title: string; why: string; lineages: number[] }[]): Promise<number> {
  if (!proposals.length) return 0;
  return withUser(userId, async (c) => {
    const { rows } = await c.query("select facets->>'signature' as sig from altar_elements where user_id = auth.uid() and kind = 'thread'");
    const seen = new Set(rows.map((r) => r.sig));
    let added = 0;
    for (const p of proposals) {
      if (seen.has(p.signature)) continue;
      const { rows: ins } = await c.query(
        `insert into altar_elements (user_id, kind, title, facets, status) values ($1,'thread',$2,$3,'proposed') returning id`,
        [userId, p.title.slice(0, 500), { signature: p.signature, why: p.why }]);
      const id = Number(ins[0].id);
      await c.query("update altar_elements set lineage_id = $1 where id = $1", [id]);
      for (const l of p.lineages) {
        await c.query("insert into element_links (user_id, from_lineage, to_lineage, relation) values ($1,$2,$3,'notices') on conflict do nothing", [userId, id, l]);
      }
      added++;
    }
    return added;
  });
}
