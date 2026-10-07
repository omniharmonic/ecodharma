import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { loadSnapshot } from "@/lib/altar/snapshot";
import { withUser } from "@/lib/db";

// The dreamscape's data: the signed-in person's constellation (titles, states,
// numbers, dates — never private text). Anonymous → { snap: null } and the
// world renders an empty, waiting sky.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ snap: null, natal: null });
  try {
    if (await canUseAltar(user.id)) return Response.json({ snap: await loadSnapshot(user.id) });
    // No altar access yet: still give them their natal sky.
    const natal = await withUser(user.id, async (c) => (await c.query("select raw_json from charts where user_id=$1 and modality='western'", [user.id])).rows[0]?.raw_json);
    return Response.json({ snap: null, natal: natal ? Object.entries<any>(natal.positions || {}).map(([body, p]) => ({ body, lon: p.lon, sign: p.sign })) : null });
  } catch (e) {
    console.error("[snapshot]", e);
    return Response.json({ snap: null, natal: null });
  }
}
