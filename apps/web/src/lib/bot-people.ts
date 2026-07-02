import "server-only";
import { withUser } from "./db";
import { loadFramework } from "./framework";
import { compareHumanDesign } from "./hd-relational";
import { clip } from "./interpret-fixture";
import type { GiftProfile } from "./types";

// "People you're woven with" context for the reflection bot / MCP, so a member can
// ask relational questions by name ("how do I relate to Josie better?") and the
// companion can draw on who they share a constellation with — including the Human
// Design synastry beneath it. Consent-gated: co-members' readings are loaded AS the
// asking user, so RLS returns only those who've consented to be woven with them.

const MAX_PEOPLE = 8;

type Person = { name: string; profile: GiftProfile };

function giftLabels(fw: ReturnType<typeof loadFramework>, p: GiftProfile): string[] {
  const named = (p.gift_constellation || [])
    .map((g) => fw.gifts.find((x) => x.id === g.gift_id)?.name || g.gift_id)
    .filter(Boolean);
  if (named.length) return named.slice(0, 3);
  return (p.unique_gifts || []).map((g) => g.split("—")[0].trim()).slice(0, 3);
}

/** A prompt block naming the member's consented constellation kin (+ HD synastry),
 *  or "" if they aren't woven with anyone (or no one has consented). */
export async function peopleContextFor(userId: string, selfProfile: GiftProfile | null): Promise<string> {
  const people: Person[] = await withUser(userId, async (c) => {
    const { rows } = await c.query(
      `select distinct on (m2.user_id) m2.user_id, p.display_name, gp.content_json
         from constellation_members m1
         join constellation_members m2
           on m2.constellation_id = m1.constellation_id and m2.user_id <> m1.user_id
         left join profiles p on p.id = m2.user_id
         left join lateral (
           select content_json from gift_profiles g
            where g.user_id = m2.user_id and g.status = 'ready'
            order by generated_at desc limit 1
         ) gp on true
        where m1.user_id = $1
        order by m2.user_id`,
      [userId],
    );
    return rows
      .filter((r) => r.content_json) // consent gate: only kin whose reading we can see
      .map((r) => ({ name: (r.display_name as string) || "A kin", profile: r.content_json as GiftProfile }))
      .slice(0, MAX_PEOPLE);
  });
  if (!people.length) return "";

  const fw = loadFramework();
  const selfSig = selfProfile?.hd_signature;
  const lines = people.map((pn) => {
    const gifts = giftLabels(fw, pn.profile).join(", ");
    let line = `- ${pn.name} — gifts: ${gifts || "their own medicine"}.`;
    const sig = pn.profile.hd_signature;
    if (selfSig && sig) {
      try {
        const cmp = compareHumanDesign(selfSig, sig, "You", pn.name);
        if (cmp?.summary) line += ` Relational read (you ↔ ${pn.name}): ${clip(cmp.summary, 240)}`;
      } catch {
        /* structural HD compare failed — the gifts still ground a relational reflection */
      }
    }
    return line;
  });

  return [
    "PEOPLE THIS PERSON IS WOVEN WITH — their consented constellation kin. When they ask about relating to someone by name, match on the first name (case-insensitive) and ground your reflection in that person's gifts and the relational read below. If they name someone NOT listed here, say you don't have a reading for that person yet.",
    ...lines,
  ].join("\n");
}
