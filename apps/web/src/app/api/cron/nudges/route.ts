import { runWeeklyNudges } from "@/lib/nudges";

// Weekly dharma-nudge job. Vercel Cron hits this on a schedule (see vercel.json)
// and includes `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set.
// In dev/test (no secret) it's open so the pipeline is exercisable.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(req: Request): Promise<Response> {
  const test = process.env.ECODHARMA_BOT_TEST === "1";
  const secret = process.env.CRON_SECRET;
  if (!test) {
    // Production: require the Vercel-injected CRON_SECRET. Never run open.
    if (!secret) return new Response("cron not configured", { status: 503 });
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }
  const result = await runWeeklyNudges();
  // Only expose per-user detail in the test seam; prod returns just counts.
  return Response.json(test ? { ok: true, ...result } : { ok: true, count: result.count, emailed: result.emailed });
}

export async function GET(req: Request) {
  return run(req);
}
// Allow POST too (some schedulers prefer it).
export async function POST(req: Request) {
  return run(req);
}
