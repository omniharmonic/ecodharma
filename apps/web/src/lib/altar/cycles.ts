// The ritual calendar — which reflection is due, at what depth, right now.
// Pure (no server-only). Thresholds (equinoxes/solstices, lunations, solar
// returns) are exact instants from the ephemeris service; the person's weekly
// day/hour are wall-clock in THEIR time zone.
//
// Depths (the three loops of learning):
//   1 · weekly, lunar            — am I doing it?
//   2 · monthly, quarterly       — is this the right way? are my measures true?
//   3 · seasonal, solar return   — is this still the prayer? which roots compost?
// When several fall in the same few days, the deepest one carries the moment
// and the shallower ones are folded into it (one invitation, never three).

export type Cadence = "weekly" | "lunar" | "monthly" | "quarterly" | "seasonal" | "solar_return";
export type Prefs = { weekly_dow: number; local_hour: number; tz: string; lunar: boolean; hemisphere: "N" | "S" };
export type Threshold = { kind: string; label: string; at: string };
export type Due = { cadence: Cadence; depth: 1 | 2 | 3; due_at: string; label: string };

const DEPTH: Record<Cadence, 1 | 2 | 3> = { weekly: 1, lunar: 1, monthly: 2, quarterly: 2, seasonal: 3, solar_return: 3 };
const DAY = 86_400_000;

/** Offset (ms) of `tz` at instant `utcMs`: local = utc + offset. */
export function tzOffset(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock time in `tz` → UTC instant (handles DST by re-checking the offset). */
export function zonedToUtc(y: number, m: number, d: number, h: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, h);
  let utc = guess - tzOffset(guess, tz);
  utc = guess - tzOffset(utc, tz);
  return utc;
}

/** Local calendar parts of an instant in `tz`. */
export function localParts(utcMs: number, tz: string) {
  const local = new Date(utcMs + tzOffset(utcMs, tz));
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), dow: local.getUTCDay(), h: local.getUTCHours() };
}

const SEASON_VERB: Record<string, string> = {
  "Spring Equinox": "seeding", "Summer Solstice": "full flowering", "Autumn Equinox": "harvest & release", "Winter Solstice": "composting & re-vowing",
};

export function seasonOf(label: string): string | null {
  return Object.keys(SEASON_VERB).find((s) => label.startsWith(s)) ?? null;
}

/** All rituals whose window is open at `now`, deepest first. */
export function dueRituals(prefs: Prefs, thresholds: Threshold[], solarReturns: string[], now: number): Due[] {
  const tz = prefs.tz || "UTC";
  const out: Due[] = [];
  const lp = localParts(now, tz);

  // weekly: the most recent weekly_dow at local_hour (≤ now)
  {
    let back = (lp.dow - prefs.weekly_dow + 7) % 7;
    let at = zonedToUtc(lp.y, lp.m, lp.d - back, prefs.local_hour, tz);
    if (at > now) { back += 7; at = zonedToUtc(lp.y, lp.m, lp.d - back, prefs.local_hour, tz); }
    out.push({ cadence: "weekly", depth: 1, due_at: new Date(at).toISOString(), label: "weekly reflection" });
  }
  // monthly: the 1st at local_hour, open for 7 days
  {
    const at = zonedToUtc(lp.y, lp.m, 1, prefs.local_hour, tz);
    if (at <= now && now - at < 7 * DAY) {
      const month = new Date(Date.UTC(lp.y, lp.m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
      out.push({ cadence: "monthly", depth: 2, due_at: new Date(at).toISOString(), label: `${month} reflection` });
    }
  }
  // quarterly: Jan/Apr/Jul/Oct 1st, open 10 days
  {
    const qm = Math.floor((lp.m - 1) / 3) * 3 + 1;
    const at = zonedToUtc(lp.y, qm, 1, prefs.local_hour, tz);
    if (at <= now && now - at < 10 * DAY) out.push({ cadence: "quarterly", depth: 2, due_at: new Date(at).toISOString(), label: `Q${(qm + 2) / 3} ${lp.y} quarterly reflection` });
  }
  // seasonal: an equinox/solstice in the last 10 days
  for (const t of thresholds) {
    if (t.kind !== "season") continue;
    const at = Date.parse(t.at);
    if (at <= now && now - at < 10 * DAY) {
      const s = seasonOf(t.label);
      out.push({ cadence: "seasonal", depth: 3, due_at: t.at, label: `${t.label}${s ? ` — ${SEASON_VERB[s]}` : ""}` });
    }
  }
  // lunar (opt-in): a new/full moon in the last 3 days
  if (prefs.lunar) {
    for (const t of thresholds) {
      if (t.kind !== "new_moon" && t.kind !== "full_moon") continue;
      const at = Date.parse(t.at);
      if (at <= now && now - at < 3 * DAY) out.push({ cadence: "lunar", depth: 1, due_at: t.at, label: t.kind === "new_moon" ? "New Moon — planting" : "Full Moon — ripening" });
    }
  }
  // solar return: in the last 14 days
  for (const sr of solarReturns) {
    const at = Date.parse(sr);
    if (at <= now && now - at < 14 * DAY) out.push({ cadence: "solar_return", depth: 3, due_at: sr, label: `Solar return ${new Date(at).getUTCFullYear()} — a new ring` });
  }
  const rank: Record<Cadence, number> = { solar_return: 6, seasonal: 5, quarterly: 4, monthly: 3, lunar: 2, weekly: 1 };
  return out.sort((a, b) => rank[b.cadence] - rank[a.cadence]);
}

/**
 * The ONE ritual to invite to now: the deepest due whose moment has arrived and
 * that hasn't been completed/invited. A deeper ritual within 4 days folds the
 * weekly into it (so a solstice week sends one invitation).
 */
export function carrying(due: Due[], done: Set<string>, invited: Set<string>): Due | null {
  const key = (d: Due) => `${d.cadence}@${d.due_at}`;
  const open = due.filter((d) => !done.has(key(d)));
  if (!open.length) return null;
  const deepest = open[0];
  if (invited.has(key(deepest))) return null;
  return deepest;
}

export function folds(due: Due[]): Due[] {
  // which shallower rituals the deepest one absorbs (within 4 days of each other)
  if (!due.length) return [];
  const top = due[0];
  return due.slice(1).filter((d) => Math.abs(Date.parse(d.due_at) - Date.parse(top.due_at)) < 4 * DAY && d.depth < top.depth);
}

export { DEPTH as CADENCE_DEPTH };
