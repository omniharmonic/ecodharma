import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { canUseAltar } from "@/lib/altar/access";
import { getAnswers, STAGES } from "@/lib/altar/inquiry-repo";
import { phrases } from "@/lib/altar/inquiry";
import { getAltar } from "@/lib/altar/repo";
import { MessageForm } from "@/components/MessageForm";
import { journeyStageAction } from "../../actions/inquiry";

export const dynamic = "force-dynamic";

const STRATEGY: Record<string, string> = {
  Generator: "wait for something to respond to", "Manifesting Generator": "respond, then inform before you leap",
  Manifestor: "inform those your moves touch", Projector: "wait for the invitation; rest without guilt", Reflector: "give big decisions a lunar cycle",
};

export default async function StagePage({ params }: { params: { stage: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const stage = STAGES.find((s) => s.id === params.stage && ["roots", "paths", "practice", "becoming"].includes(s.id));
  if (!stage) notFound();
  const [altar, answers, hd] = await Promise.all([
    getAltar(user!.id), getAnswers(user!.id),
    withUser(user!.id, async (c) => (await c.query("select raw_json from charts where user_id=$1 and modality='human_design'", [user!.id])).rows[0]?.raw_json),
  ]);
  if (!altar.prayer) redirect("/inquiry");
  return (
    <div className="mx-auto max-w-2xl py-10" data-testid={`journey-${stage.id}`}>
      <p className="whisper text-center">Stage {stage.numeral} · {stage.title}</p>
      <h1 className="invocation mt-4 text-center text-[2.2rem] leading-tight md:text-[3rem]">{stage.essence}</h1>
      <div className="veil veil-gold mt-8 p-6">
        <MessageForm action={journeyStageAction} submitLabel="Complete this stage" pendingLabel="weaving…" className="dream-btn">
          <input type="hidden" name="stage" value={stage.id} />
          {stage.id === "roots" && (
            <>
              <p className="text-sm text-[#c9d6e8]">Roots are the beliefs your prayer stands on. Some are <b>universal</b> — right for anyone. Some are <b>unique</b> — right for your path.</p>
              {altar.roots.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2 text-sm">
                  <span className="text-fg">⟟ {r.title}</span>
                  <select name={`scope_${r.lineage_id}`} defaultValue={r.facets?.scope || ""} className="input w-auto py-1 text-2xs" data-testid="root-scope">
                    <option value="">scope…</option><option value="universal">universal</option><option value="unique">unique</option>
                  </select>
                </div>
              ))}
              <label className="label" htmlFor="new_roots">Other roots you stand on — one per line</label>
              <textarea id="new_roots" name="new_roots" rows={3} className="input" placeholder="e.g. Small coherent groups change systems" />
              <label className="label" htmlFor="question_root">Choose one root to question (it becomes a living inquiry)</label>
              <select id="question_root" name="question_root" className="input" defaultValue="">
                <option value="">— none yet —</option>
                {altar.roots.map((r) => <option key={r.id} value={r.lineage_id}>{r.title}</option>)}
              </select>
            </>
          )}
          {stage.id === "paths" && (
            <>
              <p className="text-sm text-[#c9d6e8]">Doing: adding to the beauty of reality — protecting what is, creating what could be. Name your works. Then, the harder thing: choose one to release.</p>
              <ul className="space-y-1 text-sm text-fg">{altar.works.map((w) => <li key={w.id}>◈ {w.title}</li>)}</ul>
              <label className="label" htmlFor="new_works">Works not yet named — one per line</label>
              <textarea id="new_works" name="new_works" rows={3} className="input" />
              <label className="label" htmlFor="release">Release one (it will be composted, with gratitude)</label>
              <select id="release" name="release" className="input" defaultValue="">
                <option value="">— not now —</option>
                {altar.works.map((w) => <option key={w.id} value={w.lineage_id}>{w.title}</option>)}
              </select>
              <input name="release_note" className="input" placeholder="what it gave you" />
            </>
          )}
          {stage.id === "practice" && (
            <>
              <p className="text-sm text-[#c9d6e8]">
                Being: receiving the beauty of what is. Design one practice from your design{hd?.type ? ` — as a ${hd.type}, ${STRATEGY[hd.type] || "move with your design"}` : ""}
                {phrases(answers["prop.replenish"], 2).length ? ` — and from what replenishes you: ${phrases(answers["prop.replenish"], 2).join(", ")}` : ""}.
              </p>
              <label className="label" htmlFor="practice">The practice</label>
              <input id="practice" name="practice" className="input" required placeholder="e.g. A wordless creek walk before any screen" data-testid="practice-input" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="cadence">How often</label>
                  <select id="cadence" name="cadence" className="input" defaultValue="weekly"><option value="daily">daily</option><option value="weekly">weekly</option><option value="lunar">each moon</option></select></div>
                <div><label className="label" htmlFor="when">When / where</label><input id="when" name="when" className="input" placeholder="Sunday mornings, the creek" /></div>
              </div>
            </>
          )}
          {stage.id === "becoming" && (
            <>
              <p className="text-sm text-[#c9d6e8]">Becoming: growing in both being and doing. One capacity, ninety days, and a sign you&apos;ll recognize.</p>
              {altar.capacities.length > 0 && <p className="text-2xs text-[#9fb4c8]">From your inquiry: {altar.capacities.map((c) => c.title).join(" · ")}</p>}
              <label className="label" htmlFor="capacity">The capacity</label>
              <input id="capacity" name="capacity" className="input" required defaultValue={altar.capacities[0]?.title || ""} data-testid="capacity-input" />
              <label className="label" htmlFor="sign">How will you know it&apos;s growing?</label>
              <input id="sign" name="sign" className="input" placeholder="a sign you'd recognize in ninety days" />
              <label className="label" htmlFor="first_step">The first small step</label>
              <input id="first_step" name="first_step" className="input" />
            </>
          )}
        </MessageForm>
      </div>
      <p className="mt-4 text-center text-2xs text-[#9fb4c8]"><Link href="/journey" className="hover:text-[#ffd9a0]">← the journey</Link></p>
    </div>
  );
}
