import { runRitualsCron } from "@/lib/altar/rituals";

// The ritual calendar's heartbeat. Vercel Cron calls this hourly (Pro) or daily
// (Hobby) with `Authorization: Bearer ${CRON_SECRET}`. Idempotent: each ritual is
// invited at most once, and only after the person's own local send time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(req: Request): Promise<Response> {
  const test = process.env.ECODHARMA_BOT_TEST === "1";
  const secret = process.env.CRON_SECRET;
  if (!test) {
    if (!secret) return new Response("cron not configured", { status: 503 });
    if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  }
  // Test seam: ?at=<iso> runs the calendar as of that instant.
  const at = test ? new URL(req.url).searchParams.get("at") : null;
  const result = await runRitualsCron(at ? Date.parse(at) : Date.now());
  return Response.json(test ? { ok: true, ...result } : { ok: true, people: result.people, invited: result.invited.length });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
