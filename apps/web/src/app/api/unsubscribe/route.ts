import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { setNudgesEnabled } from "@/lib/nudges";

// No-login unsubscribe for weekly nudges. POST = RFC 8058 one-click (from the
// List-Unsubscribe-Post header); GET = a human landing page (footer link).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function unsubscribe(token: string | null): Promise<boolean> {
  const userId = await verifyUnsubscribeToken(token);
  if (!userId) return false;
  await setNudgesEnabled(userId, false);
  return true;
}

export async function POST(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get("u"));
  return new Response(ok ? "unsubscribed" : "invalid token", { status: ok ? 200 : 400 });
}

export async function GET(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get("u"));
  const body = ok
    ? "<h1>You're unsubscribed</h1><p>You won't receive any more weekly dharma nudges. You can turn them back on any time in your EcoDharma settings.</p>"
    : "<h1>Link expired</h1><p>That unsubscribe link isn't valid. Manage nudges in your EcoDharma settings.</p>";
  return new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>EcoDharma</title></head>
     <body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:36rem;margin:12vh auto;padding:0 1.5rem;color:#15191B;">${body}</body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
