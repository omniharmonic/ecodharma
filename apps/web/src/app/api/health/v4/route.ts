import { NextResponse } from "next/server";
import { withService } from "@/lib/db";

// Deploy readiness for v4 (the Living Altar). Booleans only — never secrets.
// Open /api/health/v4 after deploying: every check should be true.
export const dynamic = "force-dynamic";

const TABLES = ["altar_elements", "reflections", "strands", "invitations", "ritual_prefs", "offerings_shared", "witness_notes", "dharma_inquiry", "journey_progress"];

export async function GET() {
  const checks: Record<string, boolean | string> = {};
  try {
    const have = await withService(async (c) =>
      new Set((await c.query("select table_name from information_schema.tables where table_schema='public' and table_name = any($1)", [TABLES])).rows.map((r) => r.table_name as string)));
    const missing = TABLES.filter((t) => !have.has(t));
    checks.migrations = missing.length === 0;
    if (missing.length) checks.missing_tables = missing.join(", ");
  } catch {
    checks.migrations = false;
    checks.database = "unreachable";
  }
  checks.journal_key = !!process.env.JOURNAL_KEYS?.trim();
  try {
    const base = process.env.EPHEMERIS_URL || "http://127.0.0.1:8000";
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.EPHEMERIS_TOKEN) headers.authorization = `Bearer ${process.env.EPHEMERIS_TOKEN}`;
    const r = await fetch(`${base}/cycles`, { method: "POST", headers, body: JSON.stringify({ year: 2026, lat: 40 }), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    checks.ephemeris_v2 = r.ok;
  } catch {
    checks.ephemeris_v2 = false;
  }
  checks.altar_access = process.env.ALTAR_ACCESS === "open" ? "open" : "invite (premium/comped)";
  checks.cron_secret = !!process.env.CRON_SECRET;
  const ready = checks.migrations === true && checks.journal_key === true && checks.ephemeris_v2 === true;
  return NextResponse.json({ ready, ...checks }, { status: ready ? 200 : 503 });
}
