import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canUseAltar } from "@/lib/altar/access";
import { prayerFacets, prayerMaterial } from "@/lib/altar/inquiry";
import { getAnswers } from "@/lib/altar/inquiry-repo";
import { getAltar } from "@/lib/altar/repo";
import { MessageForm } from "@/components/MessageForm";
import { SacredGeometry } from "@/components/altar/SacredGeometry";
import { vowAction } from "../../actions/inquiry";

export const dynamic = "force-dynamic";

// The Vow: your own luminous lines come back to you as raw material. You write the prayer.
export default async function VowPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await canUseAltar(user!.id))) redirect("/settings?altar=locked");
  const [answers, altar] = await Promise.all([getAnswers(user!.id), getAltar(user!.id)]);
  const material = prayerMaterial(answers);
  const facets = altar.prayer?.facets?.for_whom || altar.prayer?.facets?.toward_what ? altar.prayer.facets : prayerFacets(answers);
  return (
    <div className="relative mx-auto max-w-3xl py-10" data-testid="vow">
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 opacity-60"><SacredGeometry size={520} variant="flower" opacity={0.16} /></div>
      <div className="relative text-center">
        <p className="whisper">The Vow · the first ring</p>
        <h1 className="invocation mt-4 text-[2.4rem] leading-tight md:text-[3.4rem]">Say what your life is in service to.</h1>
        <p className="mx-auto mt-4 max-w-xl text-[#c9d6e8]">Nothing here is final. A prayer is offered, not executed — and it will grow rings.</p>
      </div>
      {material.length > 0 && (
        <div className="veil relative mt-10 p-6">
          <p className="whisper mb-3">Your own words, from the chambers</p>
          <ul className="space-y-3">
            {material.map((m) => (
              <li key={m.label}>
                <span className="font-mono text-2xs uppercase tracking-eyebrow text-[#9fb4c8]">{m.label}</span>
                <p className="font-display text-lg leading-snug text-fg">“{m.text}”</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="veil veil-gold relative mt-6 p-6">
        <MessageForm action={vowAction} submitLabel={altar.prayer ? "Vow it · a new ring" : "Vow it · light the altar"} pendingLabel="kindling…" className="dream-btn">
          <label className="whisper block" htmlFor="prayer">Your prayer</label>
          <textarea id="prayer" name="prayer" rows={3} required className="input font-display text-xl" defaultValue={altar.prayer?.title || ""} placeholder="May my life…" data-testid="prayer-input" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label" htmlFor="for_whom">For whom</label><input id="for_whom" name="for_whom" className="input" defaultValue={facets.for_whom} /></div>
            <div><label className="label" htmlFor="toward_what">Toward what</label><input id="toward_what" name="toward_what" className="input" defaultValue={facets.toward_what} /></div>
            <div><label className="label" htmlFor="through_what">Through what</label><input id="through_what" name="through_what" className="input" defaultValue={facets.through_what} /></div>
          </div>
        </MessageForm>
      </div>
      <p className="mt-4 text-center text-2xs text-[#9fb4c8]"><Link href="/inquiry" className="hover:text-[#ffd9a0]">← the chambers</Link></p>
    </div>
  );
}
