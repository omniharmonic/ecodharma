import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { loadFramework } from "@/lib/framework";
import { normalizeReading } from "@/lib/normalize-reading";
import { canUseAltar } from "@/lib/altar/access";
import { getAltar } from "@/lib/altar/repo";
import { kindle } from "@/lib/altar/kindle";
import { KIND_META } from "@/lib/altar/model";
import { MessageForm } from "@/components/MessageForm";
import { SacredGeometry } from "@/components/altar/SacredGeometry";
import { PageTransition } from "@/components/PageTransition";
import { birthDefaults, kindleAction } from "../../actions/altar";
import type { Ikigai } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function KindlePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const altar = await getAltar(user!.id);
  if (altar.prayer) redirect("/altar");

  const { reading, charts, ikigai } = await withUser(user!.id, async (c) => {
    const p = await c.query("select content_json from gift_profiles where user_id=$1 and status='ready' order by generated_at desc limit 1", [user!.id]);
    const ch = await c.query("select modality, raw_json from charts where user_id=$1", [user!.id]);
    const pr = await c.query("select settings from profiles where id=$1", [user!.id]);
    const charts: Record<string, any> = {};
    for (const r of ch.rows) charts[r.modality] = r.raw_json;
    return { reading: p.rows[0] ? normalizeReading(p.rows[0].content_json) : null, charts, ikigai: (pr.rows[0]?.settings?.ikigai || {}) as Ikigai };
  });
  const fw = loadFramework();
  const k = kindle(reading, charts, ikigai, fw);
  const defaults = await birthDefaults(user!.id);
  const byKind = (kind: string) => k.suggestions.filter((s) => s.kind === kind);

  return (
    <PageTransition>
      <section className="relative mx-auto mt-10 max-w-3xl">
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-0 -translate-x-1/2 opacity-80">
          <SacredGeometry size={560} variant="flower" opacity={0.14} />
        </div>
        <div className="relative text-center">
          <p className="eyebrow">Kindling · the first lighting of your altar</p>
          <h1 className="mt-4 font-display text-title leading-tight text-fg md:text-[3.4rem]">What is your life in service to?</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Your reading described how you are made. This is where you say what you are <em>for</em> — in your own words —
            and begin a practice of returning to it. Nothing here is final. Everything here can grow.
          </p>
        </div>
      </section>

      <section className="relative mx-auto mt-12 max-w-3xl">
        <MessageForm action={kindleAction} submitLabel="Light the altar" pendingLabel="kindling…" className="btn-solar">
          {/* I · THE PRAYER */}
          <fieldset className="console p-6">
            <legend className="px-2 font-mono text-2xs uppercase tracking-eyebrow text-accent">I · The Prayer ☉</legend>
            <ul className="mb-4 space-y-1.5 text-sm text-muted" data-testid="prayer-prompts">
              {k.prayerPrompts.map((q) => <li key={q}>— {q}</li>)}
            </ul>
            <label className="label" htmlFor="prayer">Your prayer, in your own words</label>
            <textarea id="prayer" name="prayer" required rows={3} className="input font-display text-lg" placeholder="May my life…" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div><label className="label" htmlFor="for_whom">For whom</label><input id="for_whom" name="for_whom" className="input" placeholder="the beings it serves" /></div>
              <div><label className="label" htmlFor="toward_what">Toward what</label><input id="toward_what" name="toward_what" className="input" placeholder="the world it longs for" /></div>
              <div><label className="label" htmlFor="through_what">Through what</label><input id="through_what" name="through_what" className="input" placeholder="your particular offering" /></div>
            </div>
          </fieldset>

          {/* II–V · elements: suggestions to tick + your own lines */}
          {(["devotion", "root", "work", "practice", "measure"] as const).map((kind, i) => (
            <fieldset key={kind} className="mt-6 border border-rule/20 p-6">
              <legend className="px-2 font-mono text-2xs uppercase tracking-eyebrow text-accent">
                {["II", "III", "IV", "V", "VI"][i]} · {KIND_META[kind].plural} <span className="glyph">{KIND_META[kind].glyph}</span>
              </legend>
              <p className="mb-3 text-sm text-muted">{KIND_META[kind].prompt}</p>
              {byKind(kind).length > 0 && (
                <div className="mb-3 space-y-2">
                  {byKind(kind).map((s) => (
                    <label key={s.title} className="flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" name="suggestion" value={`${kind}|${s.title}|${JSON.stringify(s.constitution_refs || [])}`} className="mt-1 accent-[rgb(var(--accent))]" />
                      <span><span className="text-fg">{s.title}</span><span className="block text-2xs text-muted">{s.why}</span></span>
                    </label>
                  ))}
                </div>
              )}
              <label className="label" htmlFor={`custom_${kind}`}>Your own — one per line</label>
              <textarea id={`custom_${kind}`} name={`custom_${kind}`} rows={2} className="input" />
            </fieldset>
          ))}

          {/* VII · RHYTHM */}
          <fieldset className="mt-6 border border-rule/20 p-6">
            <legend className="px-2 font-mono text-2xs uppercase tracking-eyebrow text-accent">VII · Your rhythm ⟲</legend>
            <p className="mb-3 text-sm text-muted">
              A weekly invitation to reflect, deepening at the new month, the quarter, the solstices and equinoxes, and your solar return.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="weekly_dow">Weekly on</label>
                <select id="weekly_dow" name="weekly_dow" className="input" defaultValue="0">
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="local_hour">At</label>
                <select id="local_hour" name="local_hour" className="input" defaultValue="18">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tz">Time zone</label>
                <input id="tz" name="tz" className="input" defaultValue={defaults.tz} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="channels" value="email" defaultChecked /> Email</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="channels" value="telegram" /> Telegram</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="lunar" /> New &amp; full moons too</label>
              <label className="flex items-center gap-2">
                Hemisphere
                <select name="hemisphere" className="input w-auto py-1" defaultValue={defaults.hemisphere}>
                  <option value="N">Northern</option>
                  <option value="S">Southern</option>
                </select>
              </label>
            </div>
          </fieldset>
          <p className="mt-6 text-2xs text-muted">
            Your words are sealed (encrypted) at rest. Titles are visible to the system so it can draw your altar; nothing is shared unless you offer it.
          </p>
        </MessageForm>
        <p className="mt-6 text-center text-2xs text-muted">
          <Link href="/profile" className="hover:text-accent">← back to your reading</Link>
        </p>
      </section>
    </PageTransition>
  );
}
