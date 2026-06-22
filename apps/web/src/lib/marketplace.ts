import "server-only";
import { withService, withUser } from "./db";
import { loadFramework } from "./framework";
import type { GiftProfile } from "./types";

export type ProjectRow = {
  id: number;
  owner_id: string;
  title: string;
  description: string;
  needed_gifts: string[];
  needed_domains: string[];
  place: string | null;
  status: string;
  created_at: string;
};

export type PersonMatch = {
  user_id: string;
  display_name: string;
  gift_names: string[];
  offerings: string[];
  score: number;
  shared_gifts: string[];
  shared_domains: string[];
};

export type ProjectMatch = { project: ProjectRow; score: number; shared_gifts: string[]; shared_domains: string[] };

// A person's framework signature = the gift/domain ids in their latest gift profile.
function signatureOf(profile: GiftProfile | null): { gifts: Set<string>; domains: Set<string> } {
  const gifts = new Set<string>();
  const domains = new Set<string>();
  for (const p of profile?.pairings || []) {
    if (p.gift_id) gifts.add(p.gift_id);
    if (p.domain_id) domains.add(p.domain_id);
  }
  for (const d of profile?.domains || []) if (d.domain_id) domains.add(d.domain_id);
  return { gifts, domains };
}

function score(
  sig: { gifts: Set<string>; domains: Set<string> },
  neededGifts: string[],
  neededDomains: string[],
) {
  const sharedGifts = neededGifts.filter((g) => sig.gifts.has(g));
  const sharedDomains = neededDomains.filter((d) => sig.domains.has(d));
  return { value: sharedGifts.length * 3 + sharedDomains.length * 2, sharedGifts, sharedDomains };
}

const giftName = (id: string) => loadFramework().gifts.find((g) => g.id === id)?.name || id;

/** People who match a project — only those who opted into marketplace discovery. */
export async function matchPeopleForProject(project: ProjectRow): Promise<PersonMatch[]> {
  const rows = await withService(async (c) => {
    const { rows } = await c.query(
      `select p.id as user_id, p.display_name, p.settings,
              gp.content_json,
              coalesce(o.offerings, '{}') as offerings
         from profiles p
         join lateral (
           select content_json from gift_profiles g where g.user_id = p.id
           order by generated_at desc limit 1
         ) gp on true
         left join offerings o on o.user_id = p.id
        where coalesce((p.settings->>'discoverable')::boolean, false) = true
          and p.id <> $1`,
      [project.owner_id],
    );
    return rows;
  });

  const matches: PersonMatch[] = [];
  for (const r of rows) {
    const sig = signatureOf(r.content_json as GiftProfile);
    const s = score(sig, project.needed_gifts, project.needed_domains);
    if (s.value <= 0) continue;
    matches.push({
      user_id: r.user_id,
      display_name: r.display_name || "A kin",
      gift_names: [...sig.gifts].map(giftName),
      offerings: r.offerings || [],
      score: s.value,
      shared_gifts: s.sharedGifts.map(giftName),
      shared_domains: s.sharedDomains.map((d) => loadFramework().domains.find((x) => x.id === d)?.name || d),
    });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 12);
}

/** Open projects that match a person's gifts (their "find your work" feed). */
export async function matchProjectsForUser(userId: string): Promise<ProjectMatch[]> {
  const profile = await withUser(userId, async (c) => {
    const { rows } = await c.query(
      "select content_json from gift_profiles where user_id=$1 order by generated_at desc limit 1",
      [userId],
    );
    return (rows[0]?.content_json as GiftProfile) || null;
  });
  if (!profile) return [];
  const sig = signatureOf(profile);

  const projects = await withService(async (c) => {
    const { rows } = await c.query<ProjectRow>(
      "select * from projects where status='open' order by created_at desc limit 100",
    );
    return rows;
  });

  const out: ProjectMatch[] = [];
  for (const project of projects) {
    if (project.owner_id === userId) continue;
    const s = score(sig, project.needed_gifts, project.needed_domains);
    if (s.value <= 0) continue;
    out.push({
      project,
      score: s.value,
      shared_gifts: s.sharedGifts.map(giftName),
      shared_domains: s.sharedDomains.map((d) => loadFramework().domains.find((x) => x.id === d)?.name || d),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function isDiscoverable(userId: string): Promise<boolean> {
  return withUser(userId, async (c) => {
    const { rows } = await c.query("select settings->>'discoverable' as d from profiles where id=$1", [userId]);
    return rows[0]?.d === "true";
  });
}
