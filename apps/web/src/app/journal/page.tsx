import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { getAltar, listReflections } from "@/lib/altar/repo";
import { altarElements, CADENCES, KIND_META, LENS_META, LENSES, RELATIONS, RELATION_META } from "@/lib/altar/model";
import { MessageForm } from "@/components/MessageForm";
import { StrandChip } from "@/components/altar/StrandChip";
import { DreamPulse } from "@/components/dream/DreamPulse";
import { PageTransition } from "@/components/PageTransition";
import { reflectAction, reviewStrandsAction } from "../actions/altar";
import { offerAction } from "../actions/dharma";
import { myConstellations } from "@/lib/altar/constellations";

export const dynamic = "force-dynamic";

export default async function JournalPage({ searchParams }: { searchParams: { r?: string; el?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const altar = await getAltar(user!.id);
  if (!altar.prayer) redirect("/inquiry");
  const elements = altarElements(altar);
  const titleOf = new Map(elements.map((e) => [e.lineage_id, e]));
  const filterEl = searchParams.el ? Number(searchParams.el) : undefined;
  const reflections = await listReflections(user!.id, { limit: 60, lineageId: filterEl });
  const focus = searchParams.r ? reflections.find((r) => r.id === Number(searchParams.r)) : null;
  const pending = focus?.strands.filter((s) => s.status === "proposed") || [];
  const circles = await myConstellations(user!.id);

  return (
    <PageTransition>
      <section className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">The journal · your words, sealed</p>
          <h1 className="mt-2 font-display text-[2.2rem] leading-tight text-fg">Reflect</h1>
        </div>
        <Link href="/altar" className="btn-line">← the altar</Link>
      </section>

      {focus && <DreamPulse />}
      {/* STRAND REVIEW for the reflection just written */}
      {focus && pending.length > 0 && (
        <section className="console mt-6 p-5" data-testid="strand-review">
          <p className="telemetry text-accent">⟿ how this reflection touches your altar — confirm, adjust, or let go</p>
          <MessageForm action={reviewStrandsAction} submitLabel="Weave into the altar" className="btn-solar">
            <input type="hidden" name="reflection_id" value={focus.id} />
            <ul className="mt-3 space-y-3">
              {pending.map((s) => (
                <li key={s.id} className="grid gap-2 border-b border-rule/10 pb-3 sm:grid-cols-[1fr_auto]" data-testid="proposed-strand">
                  <div>
                    <StrandChip relation={s.relation} title={titleOf.get(s.lineage_id)?.title || "…"} charge={s.charge} status="proposed" />
                    {s.quote && <p className="mt-1.5 text-2xs italic text-muted">“{s.quote}”</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-2xs">
                    <select name={`rel_${s.id}`} defaultValue="" className="input w-auto py-1 text-2xs">
                      <option value="">{RELATION_META[s.relation].label}</option>
                      {RELATIONS.filter((r) => r !== s.relation).map((r) => <option key={r} value={r}>{RELATION_META[r].label}</option>)}
                    </select>
                    <select name={`charge_${s.id}`} defaultValue="" className="input w-auto py-1 text-2xs">
                      <option value="">charge {s.charge > 0 ? "+" : ""}{s.charge}</option>
                      {[-2, -1, 0, 1, 2].filter((c) => c !== s.charge).map((c) => <option key={c} value={c}>{c > 0 ? "+" : ""}{c}</option>)}
                    </select>
                    <label className="flex items-center gap-1"><input type="radio" name={`s_${s.id}`} value="confirm" defaultChecked /> keep</label>
                    <label className="flex items-center gap-1"><input type="radio" name={`s_${s.id}`} value="reject" /> let go</label>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs">
              <span className="telemetry">also touched:</span>
              <select name="add_lineage" defaultValue="" className="input w-auto py-1 text-2xs">
                <option value="">—</option>
                {elements.map((e) => <option key={e.lineage_id} value={e.lineage_id}>{KIND_META[e.kind].glyph} {e.title.slice(0, 50)}</option>)}
              </select>
              <select name="add_relation" defaultValue="embodies" className="input w-auto py-1 text-2xs">
                {RELATIONS.map((r) => <option key={r} value={r}>{RELATION_META[r].label}</option>)}
              </select>
              <select name="add_charge" defaultValue="0" className="input w-auto py-1 text-2xs">
                {[-2, -1, 0, 1, 2].map((c) => <option key={c} value={c}>{c > 0 ? "+" : ""}{c}</option>)}
              </select>
            </div>
          </MessageForm>
        </section>
      )}
      {focus && pending.length === 0 && (
        <p className="mt-6 border-l-2 border-accent pl-3 text-sm text-fg" data-testid="reflection-saved">
          Saved and sealed. {focus.strands.length ? "Its strands are woven into your altar." : "No strands were found — you can still link it from the altar later."}
        </p>
      )}

      {/* COMPOSER */}
      <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="border border-rule/20 p-5">
          <MessageForm action={reflectAction} submitLabel="Offer this reflection" pendingLabel="weaving…" className="btn-solar">
            <label className="label" htmlFor="body">What&apos;s alive in you?</label>
            <textarea id="body" name="body" rows={7} className="input text-base leading-relaxed" placeholder="Write freely. Name your works, your roots, your practices — the system will notice which ones you touch." data-testid="journal-body" />
            <div className="flex flex-wrap items-center gap-3">
              <label className="telemetry" htmlFor="cadence">cadence</label>
              <select id="cadence" name="cadence" defaultValue="spontaneous" className="input w-auto py-1 text-2xs">
                {CADENCES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </div>
            <details className="border border-rule/15 p-3">
              <summary className="cursor-pointer telemetry">the five lights of alignment (optional)</summary>
              {LENSES.map((lens) => (
                <div key={lens} className="mt-2 flex flex-wrap items-center gap-2 text-2xs">
                  <span className="w-24 text-fg" title={LENS_META[lens].question}>{LENS_META[lens].label}</span>
                  {[1, 2, 3, 4, 5].map((v) => <label key={v} className="flex items-center gap-0.5 text-muted"><input type="radio" name={`lens_${lens}`} value={v} />{v}</label>)}
                </div>
              ))}
            </details>
          </MessageForm>
        </div>
        <aside className="space-y-3 text-2xs text-muted">
          <p className="telemetry">Filter by what it touched</p>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/journal" className={`strand-chip ${!filterEl ? "charge-pos" : "charge-zero"}`}>all</Link>
            {elements.filter((e) => e.kind !== "prayer").map((e) => (
              <Link key={e.lineage_id} href={`/journal?el=${e.lineage_id}`} className={`strand-chip ${filterEl === e.lineage_id ? "charge-pos" : "charge-zero"}`}>
                {KIND_META[e.kind].glyph} {e.title.length > 22 ? `${e.title.slice(0, 20)}…` : e.title}
              </Link>
            ))}
          </div>
          <p className="pt-2">Your reflections are encrypted at rest. Only you can read them, unless you choose to offer one to a constellation.</p>
        </aside>
      </section>

      {/* THE JOURNAL */}
      <section className="mt-10" data-testid="journal-list">
        <p className="eyebrow">{filterEl ? `Reflections touching “${titleOf.get(filterEl)?.title || ""}”` : "All reflections"}</p>
        <ul className="mt-3 divide-y divide-rule/10">
          {reflections.map((r) => (
            <li key={r.id} id={`r${r.id}`} className="py-4">
              <p className="telemetry">{new Date(r.created_at).toLocaleString()} · {r.cadence.replace("_", " ")} · loop {"I".repeat(r.depth)} · via {r.source}</p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-fg">{r.body}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.strands.filter((s) => s.status !== "rejected").map((s) => (
                  <StrandChip key={s.id} relation={s.relation} title={titleOf.get(s.lineage_id)?.title || "(composted)"} charge={s.charge} status={s.status} />
                ))}
                {r.alignment.filter((a) => a.value != null).map((a, i) => (
                  <span key={i} className="strand-chip charge-zero">{a.lens} {"●".repeat(a.value || 0)}{"○".repeat(5 - (a.value || 0))}</span>
                ))}
              </div>
              {circles.length > 0 && (
                <details className="mt-2" data-testid="offer">
                  <summary className="cursor-pointer telemetry hover:text-accent">◉ offer to a constellation</summary>
                  <MessageForm action={offerAction} submitLabel="Offer these words" className="btn-line text-2xs">
                    <input type="hidden" name="reflection_id" value={r.id} />
                    <select name="constellation_id" className="input">{circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <textarea name="excerpt" rows={3} className="input" defaultValue={r.body} />
                    <p className="text-2xs text-muted">Only these words are shared (a copy) — trim them as you like. You can withdraw them any time.</p>
                  </MessageForm>
                </details>
              )}
            </li>
          ))}
          {reflections.length === 0 && <li className="py-4 text-sm text-muted">No reflections yet.</li>}
        </ul>
      </section>
    </PageTransition>
  );
}
