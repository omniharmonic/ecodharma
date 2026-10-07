import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { canUseAltar } from "@/lib/altar/access";
import { getAltar } from "@/lib/altar/repo";
import { getRitual } from "@/lib/altar/rituals";
import { ritualSpec } from "@/lib/altar/prompts";
import { LENS_META, LENSES, ROOT_STATUSES } from "@/lib/altar/model";
import { MessageForm } from "@/components/MessageForm";
import { SacredGeometry } from "@/components/altar/SacredGeometry";
import { PageTransition } from "@/components/PageTransition";
import { ritualAction } from "../../actions/altar";

export const dynamic = "force-dynamic";
const CADENCES = ["weekly", "lunar", "monthly", "quarterly", "seasonal", "solar_return"];

export default async function RitualPage({ params, searchParams }: { params: { cadence: string }; searchParams: { r?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  if (!CADENCES.includes(params.cadence)) notFound();
  const altar = await getAltar(user!.id);
  if (!altar.prayer) redirect("/inquiry");
  const ritual = searchParams.r ? await getRitual(user!.id, Number(searchParams.r)) : null;
  const hd = await withUser(user!.id, async (c) => (await c.query("select raw_json from charts where user_id=$1 and modality='human_design'", [user!.id])).rows[0]?.raw_json);
  const spec = ritualSpec(params.cadence as any, ritual?.label || params.cadence, {
    prayer: altar.prayer.title, hdType: hd?.type, authority: hd?.authority,
    works: altar.works.map((w) => w.title), roots: altar.roots.map((r) => r.title), measures: altar.measures.map((m) => m.title),
  });

  return (
    <PageTransition>
      <section className="relative mx-auto mt-10 max-w-2xl text-center">
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2">
          <SacredGeometry size={420} variant={spec.depth === 3 ? "metatron" : "flower"} opacity={0.12} />
        </div>
        <p className="eyebrow relative">Loop {"I".repeat(spec.depth)} · {params.cadence.replace("_", " ")}</p>
        <h1 className="relative mt-3 font-display text-[2.2rem] leading-tight text-fg" data-testid="ritual-title">{spec.title}</h1>
        <p className="relative mx-auto mt-3 max-w-lg text-muted">{spec.opening}</p>
        {ritual?.done && <p className="relative mt-3 text-2xs text-accent">You&apos;ve already completed this one — you can always reflect again.</p>}
      </section>

      <section className="mx-auto mt-10 max-w-2xl">
        <div className="console mb-6 p-5 text-center">
          <p className="telemetry text-accent">☉ your prayer</p>
          <p className="mt-2 font-display text-lg text-fg">{altar.prayer.title}</p>
        </div>
        <MessageForm action={ritualAction} submitLabel="Offer this reflection" pendingLabel="weaving…" className="btn-solar">
          <input type="hidden" name="ritual_id" value={ritual?.id ?? ""} />
          <input type="hidden" name="cadence" value={params.cadence} />
          {spec.steps.map((s, i) => (
            <div key={s.id} className="mb-5">
              <label className="block font-display text-lg text-fg" htmlFor={`a_${s.id}`}>
                <span className="mr-2 font-mono text-2xs text-accent">{String(i + 1).padStart(2, "0")}</span>{s.q}
              </label>
              {s.hint && <p className="mt-1 text-2xs text-muted">{s.hint}</p>}
              <textarea id={`a_${s.id}`} name={`a_${s.id}`} rows={3} className="input mt-2" data-testid={`answer-${s.id}`} />
            </div>
          ))}

          <fieldset className="mb-6 border border-rule/20 p-4">
            <legend className="px-2 telemetry">the five lights of alignment — optional, 1 (dim) to 5 (bright)</legend>
            {LENSES.map((lens) => (
              <div key={lens} className="mb-3 grid gap-2 sm:grid-cols-[150px_1fr]">
                <span className="text-sm text-fg" title={LENS_META[lens].question}>{LENS_META[lens].label}</span>
                <div className="flex flex-wrap items-center gap-3">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <label key={v} className="flex items-center gap-1 text-2xs text-muted"><input type="radio" name={`lens_${lens}`} value={v} />{v}</label>
                  ))}
                  <input name={`lens_${lens}_note`} className="input min-w-[10rem] flex-1 py-1 text-2xs" placeholder={LENS_META[lens].question} />
                </div>
              </div>
            ))}
          </fieldset>

          {spec.revisePrayer && (
            <fieldset className="mb-6 border border-accent/40 p-4">
              <legend className="px-2 telemetry text-accent">re-vow · a new ring</legend>
              <p className="mb-2 text-2xs text-muted">If your prayer has changed, write it as it is now. The old one stays as a ring in the trunk.</p>
              <textarea name="new_prayer" rows={2} className="input font-display" defaultValue={altar.prayer.title} data-testid="new-prayer" />
            </fieldset>
          )}
          {spec.reviewRoots && altar.roots.length > 0 && (
            <fieldset className="mb-6 border border-rule/20 p-4">
              <legend className="px-2 telemetry">⟟ the roots you stand on</legend>
              {altar.roots.map((r) => (
                <div key={r.id} className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-fg">{r.title}</span>
                  <select name={`root_${r.lineage_id}`} defaultValue={r.status} className="input w-auto py-1 text-2xs">
                    {ROOT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    <option value="compost">compost it</option>
                  </select>
                </div>
              ))}
            </fieldset>
          )}
        </MessageForm>
        <p className="mt-6 text-center text-2xs text-muted"><Link href="/altar" className="hover:text-accent">← back to the altar</Link></p>
      </section>
    </PageTransition>
  );
}
